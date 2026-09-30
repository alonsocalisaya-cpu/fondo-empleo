import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { programaciones } from "@/db/schema";
import { soloSesionesDe, usuarioActual } from "@/lib/auth";
import { datosLista, listaAsistenciaXlsx } from "@/lib/lista-asistencia";

/** Listas de asistencia de TODAS las sesiones de un día (una pestaña por sede y turno), formato oficial. */
export async function GET(req: Request) {
  const u = await usuarioActual();
  if (!u) return new Response("Sin sesión", { status: 401 });
  const fecha = new URL(req.url).searchParams.get("fecha") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return new Response("Fecha no válida", { status: 400 });
  const progs = await db
    .select({ id: programaciones.id })
    .from(programaciones)
    .where(and(eq(programaciones.fecha, fecha), ne(programaciones.estado, "cancelada"), soloSesionesDe(u)));
  if (!progs.length) return new Response("No hay sesiones ese día", { status: 404 });
  const datos = await datosLista(progs.map((x) => x.id));
  const xlsx = await listaAsistenciaXlsx(datos.map((d) => d.hoja));
  const archivo = `Listas de asistencia - ${fecha.split("-").reverse().join("-")}.xlsx`;
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="listas.xlsx"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
    },
  });
}
