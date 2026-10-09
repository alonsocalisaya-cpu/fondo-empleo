import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const CARPETA_PLANTILLAS_VIAJE = path.join(process.cwd(), "plantillas", "programa-viaje");

export async function listarPlantillasViaje() {
  try {
    const archivos = await readdir(CARPETA_PLANTILLAS_VIAJE, { withFileTypes: true });
    return archivos.filter((a) => a.isFile() && !a.name.startsWith("~$") && /\.(docx?|xlsx?|pdf)$/i.test(a.name))
      .map((a) => a.name).sort((a, b) => a.localeCompare(b, "es"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
