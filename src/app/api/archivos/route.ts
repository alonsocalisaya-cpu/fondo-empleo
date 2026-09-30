import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentos, programaciones, tipoDocumentoEnum } from "@/db/schema";
import { guardarArchivo, validarArchivo } from "@/lib/archivos";
import { carpetaDe } from "@/lib/carpetas";
import { esSeccion, seccionDe } from "@/lib/documentos";
import { autorizarSesion, permitir } from "@/lib/auth";

type Tipo = (typeof tipoDocumentoEnum.enumValues)[number];

/**
 * Sube UN archivo al repositorio (se usa desde el navegador con barra de avance).
 * Campos: archivo, tipo, y según el caso sesionId (material oficial) o programacionId (material de una fecha),
 * más nombre y versión opcionales. Responde { id, nombre, tamano } o { error }.
 */
export async function POST(req: Request) {
  let f: FormData;
  try {
    f = await req.formData();
  } catch {
    return Response.json({ error: "No se pudo leer el archivo enviado." }, { status: 400 });
  }
  const archivo = f.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return Response.json({ error: "No llegó ningún archivo." }, { status: 400 });
  const err = validarArchivo(archivo);
  if (err) return Response.json({ error: err }, { status: 400 });

  const tipo = String(f.get("tipo") ?? "") as Tipo;
  if (!tipoDocumentoEnum.enumValues.includes(tipo)) return Response.json({ error: "Tipo de documento no válido." }, { status: 400 });

  const programacionId = Number(f.get("programacionId")) || null;
  let sesionId = Number(f.get("sesionId")) || null;
  // Permiso: material de una fecha → quien trabaja esa sesión; repositorio oficial → Gestión documental
  const perm = programacionId ? await autorizarSesion(programacionId) : await permitir("documental");
  if (!perm.u) return Response.json({ error: perm.error }, { status: 403 });
  if (programacionId) {
    const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, programacionId) });
    if (!p) return Response.json({ error: "La sesión ya no existe." }, { status: 404 });
    sesionId = p.sesionId;
  }
  if (!sesionId) return Response.json({ error: "Elige la sesión." }, { status: 400 });

  const nombre = (String(f.get("nombre") ?? "").trim() || archivo.name.replace(/\.[^.]+$/, "")).slice(0, 200);
  const version = String(f.get("version") ?? "").trim() || null;
  // Subcarpeta de la fecha: la elegida al subir (fotos, video, lista de asistencia…) o según el tipo
  const pedida = f.get("seccion");
  const seccion = programacionId ? seccionDe({ tipo, seccion: esSeccion(pedida) ? pedida : null, nombre: archivo.name }) : null;
  const guardado = await guardarArchivo(archivo, await carpetaDe(sesionId, programacionId, seccion));
  const [d] = await db
    .insert(documentos)
    .values({ nombre, tipo, sesionId, programacionId, version, seccion, ...guardado })
    .returning({ id: documentos.id, nombre: documentos.nombre, tamano: documentos.tamano });
  return Response.json(d);
}
