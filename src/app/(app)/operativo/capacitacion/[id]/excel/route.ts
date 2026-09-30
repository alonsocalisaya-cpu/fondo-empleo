import { eq } from "drizzle-orm";
import { db } from "@/db";
import { programaciones } from "@/db/schema";
import { puedeVerSesion, usuarioActual } from "@/lib/auth";
import { datosLista, listaAsistenciaXlsx } from "@/lib/lista-asistencia";

/** Lista de asistencia de UNA sesión, en el formato oficial (Excel). */
export async function GET(_req: Request, ctx: RouteContext<"/operativo/capacitacion/[id]/excel">) {
  const u = await usuarioActual();
  if (!u) return new Response("Sin sesión", { status: 401 });
  const id = Number((await ctx.params).id);
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, id) });
  if (!p || !puedeVerSesion(u, p)) return new Response("No encontrada", { status: 404 });
  const [d] = await datosLista([id]);
  const xlsx = await listaAsistenciaXlsx([d.hoja]);
  const archivo = `Lista de asistencia - ${d.hoja.sede} - ${p.fecha.split("-").reverse().join("-")}.xlsx`;
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lista.xlsx"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
    },
  });
}
