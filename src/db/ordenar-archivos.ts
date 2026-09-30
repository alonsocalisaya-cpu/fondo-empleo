/**
 * Ordena la carpeta «archivos» según la estructura Componente / Actividad / Módulo / Sesión.
 * Mueve los archivos que estén en otra carpeta (por ejemplo, si se renombró un módulo) y actualiza la base.
 *   npm run archivos:ordenar      (también se ejecuta solo al arrancar)
 */
import "dotenv/config";
import { mkdir, rename, readdir, rmdir, stat } from "node:fs/promises";
import path from "node:path";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "./index";
import { documentos } from "./schema";
import { carpetaDe } from "../lib/carpetas";
import { seccionDe } from "../lib/documentos";

const BASE = path.join(process.cwd(), "archivos");

async function borrarVacias(dir: string) {
  const e = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const x of e) if (x.isDirectory()) await borrarVacias(path.join(dir, x.name));
  if (dir !== BASE && (await readdir(dir).catch(() => ["x"])).length === 0) await rmdir(dir).catch(() => {});
}

async function main() {
  const docs = await db.select().from(documentos).where(isNotNull(documentos.archivo));
  let movidos = 0;
  for (const d of docs) {
    if (!d.sesionId || !d.archivo) continue;
    const seccion = d.programacionId ? seccionDe(d) : null;
    if (seccion && d.seccion !== seccion) await db.update(documentos).set({ seccion }).where(eq(documentos.id, d.id));
    const carpeta = await carpetaDe(d.sesionId, d.programacionId, seccion);
    if (path.posix.dirname(d.archivo) === carpeta) continue;
    const origen = path.join(BASE, d.archivo);
    if (!(await stat(origen).catch(() => null))) continue;
    const nueva = path.posix.join(carpeta, path.posix.basename(d.archivo));
    await mkdir(path.join(BASE, carpeta), { recursive: true });
    await rename(origen, path.join(BASE, nueva));
    await db.update(documentos).set({ archivo: nueva }).where(eq(documentos.id, d.id));
    movidos++;
  }
  if (movidos) {
    await borrarVacias(BASE);
    console.log(`✔ ${movidos} archivo(s) ordenados por componente / actividad / módulo / sesión (y por fecha: fotos, video, lista de asistencia…).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✖ No se pudo ordenar la carpeta de archivos:", e);
    process.exit(1);
  });
