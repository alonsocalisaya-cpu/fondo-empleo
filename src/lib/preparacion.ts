import "server-only";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  actividades,
  asistencias,
  documentos,
  equipos,
  fichaItems,
  inscripciones,
  insumos,
  modulos,
  preparaciones,
  programaciones,
  revisionesEquipo,
  sesiones,
  type PasoRegistro,
} from "@/db/schema";
import { conRuta } from "./consultas";
import { equivalencias } from "./disponibilidad";
import { liquidacionDe } from "./liquidacion-db";
import { avisosDe, destinatariosDe } from "./avisos";
import type { ContextoFlujo } from "./flujo-pre";

/**
 * Para cada sesión, ¿es la primera o la última de su capacitación (actividad)?
 * Primera → examen de entrada; última → examen de salida; si la actividad tiene una sola sesión → ambos.
 */
export async function examenes(sesionIds: number[]) {
  const res = new Map<number, ContextoFlujo["examen"]>();
  if (!sesionIds.length) return res;
  const acts = await db
    .selectDistinct({ id: modulos.actividadId })
    .from(sesiones)
    .innerJoin(modulos, eq(sesiones.moduloId, modulos.id))
    .where(inArray(sesiones.id, sesionIds));
  const filas = await db
    .select({ sesionId: sesiones.id, actividadId: modulos.actividadId })
    .from(sesiones)
    .innerJoin(modulos, eq(sesiones.moduloId, modulos.id))
    .innerJoin(actividades, eq(modulos.actividadId, actividades.id))
    .where(inArray(modulos.actividadId, acts.map((a) => a.id)))
    .orderBy(asc(modulos.actividadId), asc(modulos.orden), asc(modulos.id), asc(sesiones.orden), asc(sesiones.id));

  const porActividad = new Map<number, number[]>();
  for (const f of filas) porActividad.set(f.actividadId, [...(porActividad.get(f.actividadId) ?? []), f.sesionId]);
  for (const lista of porActividad.values()) {
    lista.forEach((id, i) => {
      const primera = i === 0;
      const ultima = i === lista.length - 1;
      res.set(id, primera && ultima ? "ambos" : primera ? "entrada" : ultima ? "salida" : null);
    });
  }
  return res;
}

type ProgSesiones = { sesionId: number; combinadas?: { sesionId: number }[] };
const idsSesiones = (p: ProgSesiones) => [p.sesionId, ...(p.combinadas ?? []).map((c) => c.sesionId)];

/** Examen que corresponde a una programación, considerando también sus sesiones combinadas. */
export function examenDe(p: ProgSesiones, ex: Map<number, ContextoFlujo["examen"]>): ContextoFlujo["examen"] {
  const tipos = idsSesiones(p).map((id) => ex.get(id) ?? null);
  const entrada = tipos.some((t) => t === "entrada" || t === "ambos");
  const salida = tipos.some((t) => t === "salida" || t === "ambos");
  return entrada && salida ? "ambos" : entrada ? "entrada" : salida ? "salida" : null;
}

export function contexto(
  pasos: Record<string, PasoRegistro> | undefined,
  fueraDeArequipa: boolean,
  examen: ContextoFlujo["examen"],
): ContextoFlujo {
  return { pasos: pasos ?? {}, fueraDeArequipa, examen };
}

/** Todo lo necesario para la página del expediente de pre-capacitación de una sesión. */
export async function cargarExpediente(id: number) {
  const p = await db.query.programaciones.findFirst({
    where: eq(programaciones.id, id),
    with: {
      ...conRuta,
      sesion: { with: { modulo: { with: { actividad: { with: { componente: { with: { estructura: true } } } } } } } },
      asistente: true,
      preparacion: true,
    },
  });
  if (!p) return null;

  const [items, docs, eqs, [{ inscritos }], ex, personal, consultores, inventario, [{ presentes }], todosInsumos] = await Promise.all([
    db.select().from(fichaItems).where(eq(fichaItems.programacionId, id)).orderBy(fichaItems.categoria, fichaItems.id),
    db
      .select()
      .from(documentos)
      // material oficial de la(s) sesión(es) + lo personalizado para ESTA programación
      .where(and(inArray(documentos.sesionId, idsSesiones(p)), or(isNull(documentos.programacionId), eq(documentos.programacionId, id))))
      .orderBy(sql`${documentos.programacionId} is null`, documentos.tipo, documentos.nombre),
    db.query.equipos.findMany({
      with: { sede: true },
      orderBy: (t) => t.nombre,
    }),
    db.select({ inscritos: sql<number>`count(*)::int` }).from(inscripciones).where(eq(inscripciones.programacionId, id)),
    examenes(idsSesiones(p)),
    db.query.personal.findMany({ where: (t, { eq }) => eq(t.activo, true), orderBy: (t) => [t.nombres, t.apellidos] }),
    db.query.capacitadores.findMany({ where: (t, { eq }) => eq(t.activo, true), orderBy: (t) => [t.nombres, t.apellidos] }),
    db.select().from(insumos).where(eq(insumos.activo, true)).orderBy(insumos.categoria, insumos.nombre),
    db
      .select({ presentes: sql<number>`count(*)::int` })
      .from(asistencias)
      .where(and(eq(asistencias.programacionId, id), inArray(asistencias.estado, ["presente", "tarde"]))),
    db.select().from(insumos),
  ]);

  // Personas ocupadas: tienen otra sesión el mismo día con horario que se cruza
  const cruces = await db.query.programaciones.findMany({
    where: and(
      eq(programaciones.fecha, p.fecha),
      lt(programaciones.horaInicio, p.horaFin),
      gt(programaciones.horaFin, p.horaInicio),
      ne(programaciones.estado, "cancelada"),
      ne(programaciones.id, id),
    ),
    with: { sede: true },
  });
  const ocupado = (quien: number | null, c: (typeof cruces)[number]) =>
    quien ? [[quien, `${c.horaInicio.slice(0, 5)}–${c.horaFin.slice(0, 5)} en ${c.sede.nombre}`] as const] : [];
  // Personas ocupadas en cualquiera de sus roles: quien es capacitador en otra sesión que se cruza
  // tampoco está libre como asistente (y al revés). Se relacionan por usuario, DNI o nombre.
  const eqv = await equivalencias();
  const ocupadosCap = new Map<number, string>();
  const ocupadosAsis = new Map<number, string>();
  const marcar = (m: Map<number, string>, ids: number[], texto: string) => ids.forEach((k) => !m.has(k) && m.set(k, texto));
  for (const c of cruces) {
    const franja = `${c.horaInicio.slice(0, 5)}–${c.horaFin.slice(0, 5)} en ${c.sede.nombre}`;
    if (c.capacitadorId) {
      marcar(ocupadosCap, [c.capacitadorId], `capacitador ${franja}`);
      marcar(ocupadosAsis, eqv.personalDe(c.capacitadorId), `capacitador ${franja}`);
    }
    if (c.asistenteId) {
      marcar(ocupadosAsis, [c.asistenteId], `asistente ${franja}`);
      marcar(ocupadosCap, eqv.capacitadoresDe(c.asistenteId), `asistente ${franja}`);
    }
  }


  // Equipos de Mantenimiento: todos los operativos, y cuáles ya están asignados a una sesión que se cruza
  const [operativos, enUso] = await Promise.all([
    db.query.equipos.findMany({ where: eq(equipos.estado, "operativo"), with: { sede: true }, orderBy: (t) => [t.tipo, t.codigo] }),
    cruces.length
      ? db
          .select({ equipoId: fichaItems.equipoId, programacionId: fichaItems.programacionId })
          .from(fichaItems)
          .where(and(inArray(fichaItems.programacionId, cruces.map((c) => c.id)), isNotNull(fichaItems.equipoId)))
      : Promise.resolve([]),
  ]);
  const usos = await db
    .select({ id: revisionesEquipo.equipoId, n: sql<number>`count(*) filter (where ${revisionesEquipo.usado})::int` })
    .from(revisionesEquipo)
    .groupBy(revisionesEquipo.equipoId);
  const usosEquipo = new Map(usos.map((u) => [u.id, u.n]));
  const cruceDe = new Map(cruces.map((c) => [c.id, c]));
  const equiposOcupados = new Map(enUso.flatMap((u) => ocupado(u.equipoId, cruceDe.get(u.programacionId)!)));

  const [destinatarios, avisosComunicar, liquidacion] = await Promise.all([
    destinatariosDe(p),
    avisosDe(id, "comunicar"),
    liquidacionDe(p, p.preparacion?.pasos ?? {}),
  ]);

  return {
    p,
    destinatarios,
    avisosComunicar,
    liquidacion,
    ocupadosCap,
    ocupadosAsis,
    items,
    docs,
    equipos: eqs,
    inscritos,
    personal,
    consultores,
    inventario,
    presentes,
    stockInsumos: new Map(todosInsumos.map((i) => [i.id, i])),
    operativos,
    equiposOcupados,
    usosEquipo,
    ctx: contexto(p.preparacion?.pasos, p.sede.fueraDeArequipa, examenDe(p, ex)),
  };
}

/** Estados del flujo de varias programaciones (para la bandeja). */
export async function contextosDe(progs: ({ id: number; sede: { fueraDeArequipa: boolean } } & ProgSesiones)[]) {
  const ids = progs.map((p) => p.id);
  const [preps, ex] = await Promise.all([
    ids.length ? db.select().from(preparaciones).where(inArray(preparaciones.programacionId, ids)) : Promise.resolve([]),
    examenes([...new Set(progs.flatMap(idsSesiones))]),
  ]);
  const m = new Map(preps.map((x) => [x.programacionId, x.pasos]));
  return new Map(progs.map((p) => [p.id, contexto(m.get(p.id), p.sede.fueraDeArequipa, examenDe(p, ex))]));
}
