/**
 * Si todavía no hay usuarios, crea el administrador inicial:
 *   usuario: admin   ·   contraseña: Fondoempleo2026   (se pide cambiarla al primer ingreso)
 */
import "dotenv/config";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { usuarios } from "./schema";

const scrypt = promisify(scryptCb) as (c: string, s: string, n: number) => Promise<Buffer>;

async function main() {
  // Solo si no hay ningún administrador con acceso (las personas sin acceso no cuentan)
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(usuarios)
    .where(sql`'admin' = any(${usuarios.roles}) and ${usuarios.acceso} and ${usuarios.claveHash} is not null`);
  if (n) return;
  const [{ tomado }] = await db.select({ tomado: sql<number>`count(*)::int` }).from(usuarios).where(sql`${usuarios.usuario} = 'admin'`);
  if (tomado) return; // existe «admin» (quizá sin acceso): no se toca
  const sal = randomBytes(16).toString("hex");
  const hash = (await scrypt("Fondoempleo2026", sal, 64)).toString("hex");
  await db.insert(usuarios).values({ usuario: "admin", nombre: "Administrador", nombres: "Administrador", rol: "admin", roles: ["admin"], acceso: true, claveHash: `${sal}:${hash}`, debeCambiarClave: true });
  console.log("✔ Usuario administrador creado → usuario: admin · contraseña: Fondoempleo2026 (se cambia al primer ingreso)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✖ No se pudo crear el administrador:", e);
    process.exit(1);
  });
