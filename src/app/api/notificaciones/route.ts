import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { avisos } from "@/db/schema";
import { usuarioActual } from "@/lib/auth";
import { avisosPara } from "@/lib/avisos";
import { marcarVistas, notificacionesDe } from "@/lib/notificaciones";

/** Lo que muestra la campana: mensajes para el usuario + actividades pendientes de su rol (las primeras 30). */
export async function GET() {
  const u = await usuarioActual();
  if (!u) return Response.json({ error: "Sin sesión" }, { status: 401 });
  const [todas, mensajes] = await Promise.all([notificacionesDe(u), avisosPara(u.id)]);
  const sinLeer = mensajes.filter((m) => !m.leidoEn).length;
  return Response.json({
    total: todas.length,
    nuevas: todas.filter((n) => n.nueva).length + sinLeer,
    items: todas.slice(0, 30),
    mensajes: mensajes.map((m) => ({
      id: m.id,
      titulo: m.titulo,
      mensaje: m.mensaje,
      href: m.href,
      de: m.de,
      creadoEn: m.creadoEn.toISOString(),
      leido: !!m.leidoEn,
      confirmado: !!m.confirmadoEn,
    })),
  });
}

/**
 * Sin cuerpo: al abrir la campana, todo lo actual deja de ser «nuevo».
 * Con { confirmar: id }: la persona marca «Enterado» en un mensaje.
 */
export async function POST(req: Request) {
  const u = await usuarioActual();
  if (!u) return Response.json({ error: "Sin sesión" }, { status: 401 });
  const cuerpo = await req.json().catch(() => ({}));
  const id = Number(cuerpo?.confirmar);
  if (id) {
    await db
      .update(avisos)
      .set({ confirmadoEn: new Date() })
      .where(and(eq(avisos.id, id), eq(avisos.usuarioId, u.id), isNull(avisos.confirmadoEn)));
    await db.update(avisos).set({ leidoEn: new Date() }).where(and(eq(avisos.id, id), isNull(avisos.leidoEn)));
    return Response.json({ ok: true });
  }
  await marcarVistas(u.id);
  await db.update(avisos).set({ leidoEn: new Date() }).where(and(eq(avisos.usuarioId, u.id), isNull(avisos.leidoEn)));
  return Response.json({ ok: true });
}
