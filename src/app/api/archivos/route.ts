import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentos, programaciones, sesiones, tipoDocumentoEnum } from "@/db/schema";
import { borrarArchivo, CARPETA_ARCHIVOS, validarArchivo } from "@/lib/archivos";
import { ErrorTransferencia, guardarContinuo } from "@/lib/archivo-continuo";
import { carpetaDe } from "@/lib/carpetas";
import { esSeccion, seccionDe } from "@/lib/documentos";
import { autorizarSesion, permitir } from "@/lib/auth";
import { validarEntregable } from "@/lib/entregables";

type Tipo = (typeof tipoDocumentoEnum.enumValues)[number];
export const runtime = "nodejs";

/**
 * Sube UN archivo al repositorio (se usa desde el navegador con barra de avance).
 * Cuerpo binario; metadatos en la URL. Valida permisos antes de leer el cuerpo.
 * Escribe un temporal, verifica su tamaño y publica el archivo completo.
 */
export async function POST(req: Request) {
  const f = new URL(req.url).searchParams;
  const archivo = { name: f.get("archivo") ?? "" };
  const tamano = Number(f.get("tamano"));
  if (!req.body || !Number.isSafeInteger(tamano) || tamano <= 0) return Response.json({ error: "Archivo o tamaño no válido." }, { status: 400 });
  if (req.headers.get("content-type")?.split(";")[0] !== "application/octet-stream") return Response.json({ error: "Actualiza la página y vuelve a seleccionar el archivo." }, { status: 415 });
  const longitud = req.headers.get("content-length");
  if (longitud !== null && Number(longitud) !== tamano) return Response.json({ error: "El tamaño enviado no coincide con el archivo." }, { status: 400 });
  const err = validarArchivo(archivo);
  if (err) return Response.json({ error: err }, { status: 400 });

  const tipo = String(f.get("tipo") ?? "") as Tipo;
  if (!tipoDocumentoEnum.enumValues.includes(tipo)) return Response.json({ error: "Tipo de documento no válido." }, { status: 400 });

  const programacionId = Number(f.get("programacionId")) || null;
  let sesionId = Number(f.get("sesionId")) || null;
  // Permiso: material de una fecha → quien trabaja esa sesión; repositorio oficial → Gestión documental
  let perm = programacionId ? await autorizarSesion(programacionId) : await permitir("documental");
  if (programacionId && !perm.u) perm = await permitir("documental");
  if (!perm.u) return Response.json({ error: perm.error }, { status: 403 });
  if (programacionId) {
    const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, programacionId) });
    if (!p) return Response.json({ error: "La sesión ya no existe." }, { status: 404 });
    sesionId = p.sesionId;
  }
  if (!sesionId || !await db.query.sesiones.findFirst({ where: eq(sesiones.id, sesionId), columns: { id: true } })) return Response.json({ error: "Elige una sesión válida." }, { status: 400 });

  const nombre = (String(f.get("nombre") ?? "").trim() || archivo.name.replace(/\.[^.]+$/, "")).slice(0, 200);
  const version = String(f.get("version") ?? "").trim() || null;
  // Subcarpeta de la fecha: la elegida al subir (fotos, video, lista de asistencia…) o según el tipo
  const pedida = f.get("seccion");
  const seccion = programacionId ? seccionDe({ tipo, seccion: esSeccion(pedida) ? pedida : null, nombre: archivo.name }) : null;
  const errorEntregable = validarEntregable(seccion, archivo.name);
  if (errorEntregable) return Response.json({ error: errorEntregable }, { status: 400 });
  let guardado: { archivo: string; tamano: number } | undefined;
  try {
    guardado = await guardarContinuo({ cuerpo: req.body, nombre: archivo.name, tamano,
      carpeta: await carpetaDe(sesionId, programacionId, seccion), base: CARPETA_ARCHIVOS, signal: req.signal });
    const [d] = await db
      .insert(documentos)
      .values({ nombre, tipo, sesionId, programacionId, version, seccion, ...guardado })
      .returning({ id: documentos.id, nombre: documentos.nombre, tamano: documentos.tamano });
    return Response.json(d);
  } catch (error) {
    // Si falla el registro, no dejamos un archivo final sin documento asociado.
    if (guardado) await borrarArchivo(guardado.archivo);
    if (error instanceof ErrorTransferencia) return Response.json({ error: error.message }, { status: 400 });
    console.error("Error al subir documento:", error);
    const codigo = (error as NodeJS.ErrnoException).code;
    return Response.json({ error: codigo === "ENOSPC" ? "El servidor no tiene espacio libre para guardar el archivo."
      : "La subida no se completó. Revisa la conexión y vuelve a intentarlo." }, { status: 500 });
  }
}
