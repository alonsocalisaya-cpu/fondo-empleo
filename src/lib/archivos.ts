import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Carpeta donde se guardan los archivos subidos (dentro del proyecto, junto al código). */
export const CARPETA_ARCHIVOS = path.join(process.cwd(), "archivos");
export const MAX_MB = 50;
export const MAX_MB_VIDEO = 300;
const EXTENSIONES = new Set(["pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx", "odp", "odt", "jpg", "jpeg", "png", "heic", "zip", "rar", "mp4", "mov", "avi", "3gp"]);
const VIDEO = new Set(["mp4", "mov", "avi", "3gp"]);

/** Archivos reales de un campo <input type="file"> (ignora el vacío que envía el navegador). */
export function archivosDe(f: FormData, campo: string) {
  return f.getAll(campo).filter((x): x is File => typeof x === "object" && x !== null && "arrayBuffer" in x && x.size > 0);
}

export function validarArchivo(a: File): string | null {
  const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONES.has(ext)) return `«${a.name}»: tipo de archivo no permitido (usa PDF, PowerPoint, Word, Excel, imagen o ZIP).`;
  const max = VIDEO.has(ext) ? MAX_MB_VIDEO : MAX_MB;
  if (a.size > max * 1024 * 1024) return `«${a.name}» pesa más de ${max} MB.`;
  return null;
}

/** Guarda el archivo en disco y devuelve su ruta relativa (para la columna documentos.archivo). */
export async function guardarArchivo(a: File, subcarpeta: string) {
  const limpio = a.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-70);
  const relativa = path.posix.join(subcarpeta, `${randomUUID().slice(0, 8)}-${limpio}`);
  await mkdir(path.join(CARPETA_ARCHIVOS, subcarpeta), { recursive: true });
  await writeFile(path.join(CARPETA_ARCHIVOS, relativa), Buffer.from(await a.arrayBuffer()));
  return { archivo: relativa, tamano: a.size };
}

export async function borrarArchivo(relativa: string | null | undefined) {
  if (!relativa) return;
  await unlink(path.join(CARPETA_ARCHIVOS, relativa)).catch(() => {});
}

/** Ruta absoluta segura (evita salir de la carpeta «archivos»). */
export function rutaSegura(relativa: string) {
  const abs = path.resolve(CARPETA_ARCHIVOS, relativa);
  return abs.startsWith(CARPETA_ARCHIVOS + path.sep) ? abs : null;
}
