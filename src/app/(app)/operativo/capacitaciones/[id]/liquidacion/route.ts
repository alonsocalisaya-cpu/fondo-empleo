import { eq } from "drizzle-orm";
import { db } from "@/db";
import { programaciones } from "@/db/schema";
import { puedeVerSesion, usuarioActual } from "@/lib/auth";
import { conRuta } from "@/lib/consultas";
import { liquidacionDe } from "@/lib/liquidacion-db";
import { liquidacionXlsx } from "@/lib/liquidacion-xlsx";

/** Formato «Liquidación de viáticos» lleno con lo registrado en el sistema (Excel). */
export async function GET(_req: Request, ctx: RouteContext<"/operativo/capacitaciones/[id]/liquidacion">) {
  const u = await usuarioActual();
  if (!u) return new Response("Sin sesión", { status: 401 });
  const id = Number((await ctx.params).id);
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, id), with: { ...conRuta, preparacion: true } });
  if (!p || !puedeVerSesion(u, p)) return new Response("No encontrada", { status: 404 });
  const { datos } = await liquidacionDe(p, p.preparacion?.pasos ?? {});
  const xlsx = await liquidacionXlsx(datos);
  const archivo = `Liquidacion de Viaticos - ${p.sede.nombre} - ${p.fecha.split("-").reverse().join("-")}${datos.nombre ? ` - ${datos.nombre}` : ""}.xlsx`;
  return new Response(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquidacion.xlsx"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
    },
  });
}
