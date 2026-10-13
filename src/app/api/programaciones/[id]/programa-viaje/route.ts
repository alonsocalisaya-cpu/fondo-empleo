import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { programaciones } from "@/db/schema";
import { usuarioActual, puedeVerSesion } from "@/lib/auth";
import { generarProgramaViaje } from "@/lib/programa-viaje-docx";
import { CARPETA_PLANTILLAS_VIAJE } from "@/lib/plantillas-viaje";
import { leerActividadesViaje, type ActividadViaje } from "@/lib/actividades-viaje";

export const runtime = "nodejs";

async function descargar(req: Request, ctx: RouteContext<"/api/programaciones/[id]/programa-viaje">) {
  const u = await usuarioActual();
  if (!u) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Sesión no válida." }, { status: 400 });
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, id), with: { sede: true, capacitador: true, asistente: true, preparacion: true } });
  if (!p || !puedeVerSesion(u, p)) return Response.json({ error: "Sesión no encontrada." }, { status: 404 });
  const registro = p.preparacion?.pasos?.programa_viaje;
  const vistaPrevia = req.method === "POST";
  if ((vistaPrevia || !registro?.personasViaje) && (!p.capacitador || !p.asistente)) return Response.json({ error: "Asigna el capacitador y el asistente en la programación para generar el programa de viaje." }, { status: 400 });
  const consultor = !vistaPrevia && typeof registro?.consultor === "string" ? registro.consultor : [p.capacitador!, p.asistente!].map((persona) => `${persona.apellidos} ${persona.nombres}`.trim()).join(" / ");
  let actividades: ActividadViaje[] = [];
  if (vistaPrevia) {
    let contenido: unknown;
    try { const cuerpo = await req.text(); if (cuerpo.length > 20000) return Response.json({ error: "El programa es demasiado extenso." }, { status: 413 }); contenido = JSON.parse(cuerpo).actividades; } catch { return Response.json({ error: "Datos del programa no válidos." }, { status: 400 }); }
    const resultado = leerActividadesViaje(contenido);
    if (resultado.error) return Response.json({ error: resultado.error }, { status: 400 });
    actividades = resultado.actividades;
  } else if (Array.isArray(registro?.actividadesViaje)) {
    const resultado = leerActividadesViaje(registro.actividadesViaje);
    if (resultado.error) return Response.json({ error: resultado.error }, { status: 400 });
    actividades = resultado.actividades;
  }
  try {
    const plantilla = await readFile(path.join(CARPETA_PLANTILLAS_VIAJE, "Programa_viaje_formato.docx"));
    const archivo = generarProgramaViaje(plantilla, { consultor, fecha: !vistaPrevia && typeof registro?.fechaPrograma === "string" ? registro.fechaPrograma : p.fecha, sede: !vistaPrevia && typeof registro?.empresaDestino === "string" ? registro.empresaDestino : p.sede.nombre, proyecto: "FONDOEMPLEO AREQUIPA", actividades });
    return new Response(new Uint8Array(archivo), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="Programa-viaje-${id}.docx"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Response.json({ error: "La plantilla no está disponible." }, { status: 404 });
    throw error;
  }
}

export async function GET(req: Request, ctx: RouteContext<"/api/programaciones/[id]/programa-viaje">) { return descargar(req, ctx); }
export async function POST(req: Request, ctx: RouteContext<"/api/programaciones/[id]/programa-viaje">) { return descargar(req, ctx); }
