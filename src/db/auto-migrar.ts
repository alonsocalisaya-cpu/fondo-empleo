/**
 * Aplica solas las migraciones nuevas de drizzle/ sin reiniciar el servidor:
 * el proxy llama a esto en cada petición y solo migra cuando cambia drizzle/meta/_journal.json
 * (por ejemplo, al copiar una actualización del sistema con `npm run dev` ya abierto).
 */
import { stat } from "node:fs/promises";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

const g = globalThis as unknown as { feMigracion?: { mtime: number; p: Promise<void> } };

export async function migrarSiHayCambios() {
  const carpeta = path.join(process.cwd(), "drizzle");
  const mtime = (await stat(path.join(carpeta, "meta", "_journal.json")).catch(() => null))?.mtimeMs ?? 0;
  if (!g.feMigracion || g.feMigracion.mtime !== mtime) {
    const p = migrate(db, { migrationsFolder: carpeta }).then(() => console.log("✔ Base de datos actualizada con las migraciones nuevas."));
    g.feMigracion = { mtime, p };
    p.catch(() => {
      // Si falló (p. ej. la base no respondió), se reintenta en la próxima petición
      if (g.feMigracion?.p === p) g.feMigracion = undefined;
    });
  }
  await g.feMigracion.p;
}
