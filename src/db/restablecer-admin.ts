/**
 * Recupera el acceso del administrador si se olvidó la contraseña:
 *   npm run db:restablecer-admin
 * Deja al usuario «admin» con la contraseña temporal Fondoempleo2026 (se pide cambiarla al ingresar).
 * Si no existe «admin», lo crea con el rol de Administrador.
 */
import "dotenv/config";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { sesionesUsuario, usuarios } from "./schema";

const scrypt = promisify(scryptCb) as (c: string, s: string, n: number) => Promise<Buffer>;
const CLAVE = process.env.RESET_ADMIN_PASSWORD ?? "Fondoempleo2026";

async function main() {
  const sal = randomBytes(16).toString("hex");
  const claveHash = `${sal}:${(await scrypt(CLAVE, sal, 64)).toString("hex")}`;
  const [u] = await db.select().from(usuarios).where(eq(usuarios.usuario, "admin"));
  if (u) {
    const roles = u.roles.includes("admin") ? u.roles : ["admin" as const, ...u.roles];
    await db.update(usuarios).set({ claveHash, debeCambiarClave: true, acceso: true, activo: true, roles, rol: roles[0] }).where(eq(usuarios.id, u.id));
    await db.delete(sesionesUsuario).where(eq(sesionesUsuario.usuarioId, u.id));
  } else {
    await db.insert(usuarios).values({ usuario: "admin", nombre: "Administrador", nombres: "Administrador", rol: "admin", roles: ["admin"], acceso: true, claveHash, debeCambiarClave: true });
  }
  console.log(`✔ Listo → usuario: admin · contraseña: ${CLAVE} (el sistema pedirá cambiarla al ingresar)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✖ No se pudo restablecer:", e?.cause?.message ?? e?.message ?? e);
    process.exit(1);
  });
