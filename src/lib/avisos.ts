/** Mensajes a personas concretas (aparecen en su campana de notificaciones). */
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { avisos, usuarios } from "@/db/schema";

export type Destinatario = { rol: "Capacitador" | "Asistente"; nombre: string; usuarioId: number | null; conAcceso: boolean };

/** Capacitador y asistente asignados a una sesión, con su usuario del sistema (si tienen). */
export async function destinatariosDe(p: { capacitadorId: number | null; asistenteId: number | null }) {
  const gente = await db
    .select()
    .from(usuarios)
    .where(
      or(
        p.capacitadorId ? eq(usuarios.capacitadorId, p.capacitadorId) : sql`false`,
        p.asistenteId ? eq(usuarios.personalId, p.asistenteId) : sql`false`,
      ),
    );
  const d: Destinatario[] = [];
  const de = (rol: Destinatario["rol"], u: (typeof gente)[number] | undefined, nombre: string) =>
    d.push({ rol, nombre: u?.nombre ?? nombre, usuarioId: u?.id ?? null, conAcceso: !!u && u.activo && u.acceso && !!u.claveHash });
  if (p.capacitadorId) de("Capacitador", gente.find((u) => u.capacitadorId === p.capacitadorId), "el capacitador");
  if (p.asistenteId) de("Asistente", gente.find((u) => u.personalId === p.asistenteId), "el asistente");
  return d;
}

/** Avisos de una sesión y actividad (para ver quién ya confirmó «Enterado»). */
export function avisosDe(programacionId: number, origen: string) {
  return db
    .select({ id: avisos.id, usuarioId: avisos.usuarioId, nombre: usuarios.nombre, leidoEn: avisos.leidoEn, confirmadoEn: avisos.confirmadoEn })
    .from(avisos)
    .innerJoin(usuarios, eq(usuarios.id, avisos.usuarioId))
    .where(and(eq(avisos.programacionId, programacionId), eq(avisos.origen, origen)));
}

/** Mensajes de la campana de un usuario: los no confirmados y los de los últimos 15 días. */
export function avisosPara(usuarioId: number) {
  return db
    .select()
    .from(avisos)
    .where(and(eq(avisos.usuarioId, usuarioId), or(isNull(avisos.confirmadoEn), sql`${avisos.creadoEn} > now() - interval '15 days'`)))
    .orderBy(desc(avisos.creadoEn))
    .limit(30);
}
