import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, inscripciones } from "@/db/schema";

/** Cuenta cada estado sobre la lista de inscritos de una sesión. */
export async function resumenAsistenciaDe(programacionId: number) {
  const [resumen] = await db.select({
    programados: sql<number>`count(*)::int`,
    presentes: sql<number>`count(*) filter (where ${asistencias.estado} = 'presente')::int`,
    tardanzas: sql<number>`count(*) filter (where ${asistencias.estado} = 'tarde')::int`,
    ausentes: sql<number>`count(*) filter (where ${asistencias.estado} = 'ausente' or ${asistencias.id} is null)::int`,
    justificados: sql<number>`count(*) filter (where ${asistencias.estado} = 'justificado')::int`,
    pendientes: sql<number>`count(*) filter (where ${asistencias.id} is null)::int`,
    conNotaEntrada: sql<number>`count(*) filter (where ${asistencias.estado} in ('presente','tarde') and ${asistencias.notaEntrada} is not null)::int`,
    conNotaSalida: sql<number>`count(*) filter (where ${asistencias.estado} in ('presente','tarde') and ${asistencias.notaSalida} is not null)::int`,
    conAmbasNotas: sql<number>`count(*) filter (where ${asistencias.estado} in ('presente','tarde') and ${asistencias.notaEntrada} is not null and ${asistencias.notaSalida} is not null)::int`,
  }).from(inscripciones).leftJoin(asistencias, and(
    eq(asistencias.programacionId, inscripciones.programacionId),
    eq(asistencias.participanteId, inscripciones.participanteId),
  )).where(eq(inscripciones.programacionId, programacionId));
  return resumen;
}
