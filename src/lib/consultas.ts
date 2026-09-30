import "server-only";
import { and, asc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { programaciones, asistencias, sedes, componentes } from "@/db/schema";

/** Relación completa de una programación: sesión → módulo → actividad → componente, sede y capacitador. */
export const conRuta = {
  sesion: {
    with: { modulo: { with: { actividad: { with: { componente: true } } } } },
  },
  sede: true,
  capacitador: true,
  asistente: true,
  combinadas: { with: { sesion: true } },
} as const;

export type ProgramacionConRuta = Awaited<ReturnType<typeof listarProgramaciones>>[number];

export async function listarProgramaciones(filtro: SQL | undefined, limite?: number) {
  return db.query.programaciones.findMany({
    where: filtro,
    with: conRuta,
    orderBy: [asc(programaciones.fecha), asc(programaciones.horaInicio)],
    limit: limite,
  });
}

/** Nombres de las sesiones combinadas de una programación (además de la principal). */
export function combinadas(p: { combinadas?: { orden: number; sesion: { nombre: string } }[] }) {
  return [...(p.combinadas ?? [])].sort((a, b) => a.orden - b.orden).map((c) => c.sesion.nombre);
}

/** "Habilidades blandas › Taller de comunicación › Comunicación efectiva" */
export function ruta(p: ProgramacionConRuta, nivel: "completa" | "corta" = "corta") {
  const m = p.sesion.modulo;
  const a = m.actividad;
  const c = a.componente;
  return nivel === "completa" ? `${c.nombre} › Actividad ${a.codigo}: ${a.nombre} › ${m.nombre}` : `Act. ${a.codigo} › ${m.nombre}`;
}

/** % de asistencia (presente + tarde) entre dos fechas, total y por sede. */
export async function asistenciaPorSede(desde: string, hasta: string) {
  const rows = await db
    .select({
      sede: sedes.nombre,
      total: sql<number>`count(*)::int`,
      asistieron: sql<number>`count(*) filter (where ${asistencias.estado} in ('presente','tarde'))::int`,
    })
    .from(asistencias)
    .innerJoin(programaciones, eq(asistencias.programacionId, programaciones.id))
    .innerJoin(sedes, eq(programaciones.sedeId, sedes.id))
    .where(and(gte(programaciones.fecha, desde), lte(programaciones.fecha, hasta)))
    .groupBy(sedes.nombre)
    .orderBy(sedes.nombre);

  const total = rows.reduce((a, r) => a + r.total, 0);
  const asistieron = rows.reduce((a, r) => a + r.asistieron, 0);
  return {
    promedio: total ? Math.round((asistieron * 100) / total) : null,
    sedes: rows.map((r) => ({ ...r, pct: Math.round((r.asistieron * 100) / r.total) })),
  };
}

export async function opcionesFiltros() {
  const [s, c, comp, asis] = await Promise.all([
    db.query.sedes.findMany({ where: (t, { eq }) => eq(t.activa, true), orderBy: (t) => t.nombre }),
    db.query.capacitadores.findMany({
      where: (t, { eq }) => eq(t.activo, true),
      orderBy: (t) => [t.nombres, t.apellidos],
    }),
    db.select().from(componentes).orderBy(componentes.orden),
    db.query.personal.findMany({
      where: (t, { and, eq }) => and(eq(t.activo, true), eq(t.rol, "asistente")),
      orderBy: (t) => [t.nombres, t.apellidos],
    }),
  ]);
  return { sedes: s, capacitadores: c, componentes: comp, asistentes: asis };
}
