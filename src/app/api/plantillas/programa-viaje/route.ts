import { readFile } from "node:fs/promises";
import path from "node:path";
import { usuarioActual } from "@/lib/auth";
import { CARPETA_PLANTILLAS_VIAJE, listarPlantillasViaje } from "@/lib/plantillas-viaje";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!await usuarioActual()) return Response.json({ error: "Inicia sesión para descargar la plantilla." }, { status: 401 });
  const nombre = new URL(req.url).searchParams.get("archivo");
  const permitidos = await listarPlantillasViaje();
  if (!nombre || !permitidos.includes(nombre)) return Response.json({ error: "La plantilla no está disponible." }, { status: 404 });
  try {
    const archivo = await readFile(path.join(CARPETA_PLANTILLAS_VIAJE, nombre));
    return new Response(new Uint8Array(archivo), { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Response.json({ error: "La plantilla no está disponible." }, { status: 404 });
    throw error;
  }
}
