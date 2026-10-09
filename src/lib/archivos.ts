import "server-only";
import { unlink } from "node:fs/promises";
import path from "node:path";

/** Carpeta donde se guardan los archivos subidos (dentro del proyecto, junto al código). */
export const CARPETA_ARCHIVOS = path.join(process.cwd(), "archivos");
const EXTENSIONES = new Set(["pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx", "odp", "odt", "jpg", "jpeg", "png", "heic", "zip", "rar", "mp4", "mov", "avi", "3gp"]);

/** Archivos reales de un campo <input type="file"> (ignora el vacío que envía el navegador). */
export function archivosDe(f: FormData, campo: string) {
  return f.getAll(campo).filter((x): x is File => typeof x === "object" && x !== null && "arrayBuffer" in x && x.size > 0);
}

export function validarArchivo(a: { name: string }): string | null {
  const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONES.has(ext)) return `«${a.name}»: tipo de archivo no permitido (usa PDF, PowerPoint, Word, Excel, imagen o ZIP).`;
  return null;
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
