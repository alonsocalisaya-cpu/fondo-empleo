// Abre pgAdmin 4 (Windows). Uso: npm run db:pgadmin
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const bases = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs") : null].filter(Boolean);

const candidatos = [];
for (const base of bases) {
  // Instalación junto a PostgreSQL: C:\Program Files\PostgreSQL\<versión>\pgAdmin 4\...
  const pg = join(base, "PostgreSQL");
  if (existsSync(pg)) {
    for (const v of readdirSync(pg).sort((a, b) => Number(b) - Number(a))) {
      candidatos.push(join(pg, v, "pgAdmin 4", "runtime", "pgAdmin4.exe"), join(pg, v, "pgAdmin 4", "bin", "pgAdmin4.exe"));
    }
  }
  // Instalación independiente: C:\Program Files\pgAdmin 4\...
  candidatos.push(join(base, "pgAdmin 4", "runtime", "pgAdmin4.exe"), join(base, "pgAdmin 4", "bin", "pgAdmin4.exe"));
}

const exe = candidatos.find((p) => existsSync(p));
if (!exe) {
  console.error("No encontré pgAdmin 4. Instálalo desde https://www.pgadmin.org/download/pgadmin-4-windows/");
  console.error("o usa la otra opción:  npm run db:ver");
  process.exit(1);
}

console.log(`Abriendo pgAdmin 4: ${exe}`);
console.log("Tablas: Servers › PostgreSQL › Databases › fondoempleo › Schemas › public › Tables");
spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
