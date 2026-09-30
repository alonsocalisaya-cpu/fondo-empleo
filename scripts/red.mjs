// Utilidades de red: IP de este PC, firewall de Windows y resumen con el link para compartir.
import "dotenv/config";
import { networkInterfaces } from "node:os";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

export const PUERTO = 4000;
const REGLA = `Sistema Fondoempleo (puerto ${PUERTO})`;
const virtuales = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|Loopback|Docker|vbox|virbr|br-|tailscale|zerotier/i;

function ps(comando) {
  return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", comando], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function reglaActiva() {
  try {
    return ps(`(Get-NetFirewallRule -DisplayName '${REGLA}' -ErrorAction SilentlyContinue | Where-Object Enabled -eq 'True' | Measure-Object).Count`) !== "0";
  } catch {
    return false;
  }
}

/** Detecta la IP, abre el puerto en el firewall si hace falta (Windows) y devuelve el estado. */
export function prepararRed() {
  const ipFija = (process.env.IP_RED ?? "").trim();
  const ips = Object.entries(networkInterfaces())
    .filter(([nombre]) => !virtuales.test(nombre))
    .flatMap(([, lista]) => (lista ?? []).filter((i) => i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254.")))
    .map((i) => i.address);

  let firewall = "no-aplica";
  let redPublica = false;
  if (process.platform === "win32") {
    if (reglaActiva()) {
      firewall = "ok";
    } else {
      console.log(`\nHabilitando el puerto ${PUERTO} en el firewall… Windows te pedirá permiso: acepta con "Sí".`);
      try {
        const script = resolve("scripts", "abrir-puerto.ps1");
        ps(`Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','"${script}"'`);
      } catch {
        /* el usuario pudo cancelar el permiso */
      }
      firewall = reglaActiva() ? "ok" : "fallo";
    }
    try {
      redPublica = ps("(Get-NetConnectionProfile | Where-Object NetworkCategory -eq 'Public' | Measure-Object).Count") !== "0";
    } catch {
      /* sin datos */
    }
  }

  const ip = ipFija && (ips.includes(ipFija) || ips.length === 0) ? ipFija : ips[0];
  return {
    ip,
    link: ip ? `http://${ip}:${PUERTO}` : null,
    otras: ips.filter((x) => x !== ip),
    ipFijaCambio: !!ipFija && ips.length > 0 && !ips.includes(ipFija) ? ipFija : null,
    firewall,
    redPublica,
  };
}

/** Imprime el recuadro con el link para compartir. */
export function imprimirResumen(red) {
  const linea = "═".repeat(58);
  console.log(`\n${linea}`);
  if (!red.link) {
    console.log("  ⚠ No encontré una red conectada. Revisa el Wi-Fi o el cable.");
  } else {
    console.log("  PLATAFORMA HABILITADA EN LA RED · comparte este link:");
    console.log(`\n     ➜  ${red.link}\n`);
    if (red.otras.length) console.log(`  Otras redes de este PC: ${red.otras.map((ip) => `http://${ip}:${PUERTO}`).join("  ")}`);
    if (red.ipFijaCambio) console.log(`  ⚠ La IP guardada en .env (${red.ipFijaCambio}) ya no es la de este PC. Usa el link de arriba.`);
  }
  if (red.firewall === "ok") console.log(`  ✔ Puerto ${PUERTO} abierto en el firewall de Windows`);
  if (red.firewall === "fallo") {
    console.log(`  ✖ No se pudo abrir el puerto ${PUERTO}: los demás equipos no podrán entrar.`);
    console.log("    En PowerShell como administrador:  powershell -ExecutionPolicy Bypass -File scripts\\abrir-puerto.ps1");
  }
  if (red.redPublica) console.log("  ⚠ Tu red está como PÚBLICA: cámbiala a PRIVADA (Configuración › Red e Internet).");
  console.log(`  En este PC: http://localhost:${PUERTO}`);
  console.log(`${linea}\n`);
}
