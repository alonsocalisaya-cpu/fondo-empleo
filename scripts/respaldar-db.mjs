// Respaldo privado de PostgreSQL, separado del código publicado en GitHub.
import "dotenv/config";
import { mkdir, readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en .env.");
  const conexion = new URL(process.env.DATABASE_URL);
  let bin = process.env.PG_BIN;
  if (!bin && process.platform === "win32") {
    const raiz = path.join(process.env.ProgramFiles ?? "C:/Program Files", "PostgreSQL");
    const versiones = (await readdir(raiz)).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a));
    if (versiones[0]) bin = path.join(raiz, versiones[0], "bin");
  }
  const ejecutable = (nombre) => bin ? path.join(bin, `${nombre}${process.platform === "win32" ? ".exe" : ""}`) : nombre;
  const base = decodeURIComponent(conexion.pathname.slice(1));
  const fecha = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "medium", hour12: false })
    .format(new Date()).replace(/[^\d]/g, "");
  const carpeta = path.resolve("respaldos-db");
  await mkdir(carpeta, { recursive: true });
  const destino = path.join(carpeta, `${base}-${fecha}.backup`);
  const entorno = { ...process.env, PGPASSWORD: decodeURIComponent(conexion.password), PGSSLMODE: conexion.searchParams.get("sslmode") ?? "prefer" };
  const dump = spawnSync(ejecutable("pg_dump"), ["--host", conexion.hostname, "--port", conexion.port || "5432",
    "--username", decodeURIComponent(conexion.username), "--dbname", base, "--format=custom", "--no-password", "--file", destino], { env: entorno, encoding: "utf8" });
  if (dump.error || dump.status !== 0) throw new Error(dump.error?.message ?? dump.stderr.trim());
  const lista = spawnSync(ejecutable("pg_restore"), ["--list", destino], { encoding: "utf8" });
  if (lista.error || lista.status !== 0 || !lista.stdout.includes("TABLE DATA")) throw new Error("No se pudo comprobar el contenido del respaldo.");
  console.log(`Respaldo creado y comprobado: ${destino}`);
  console.log(`Tamaño: ${(await stat(destino)).size} bytes.`);
}

main().catch((error) => { console.error(`No se pudo crear el respaldo: ${error.message}`); process.exitCode = 1; });
