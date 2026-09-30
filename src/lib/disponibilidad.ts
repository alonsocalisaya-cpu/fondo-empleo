/**
 * Disponibilidad del personal para las sesiones.
 * Una misma persona puede figurar como consultor/capacitador (tabla «capacitadores») y como asistente
 * (tabla «personal»). Para detectar cruces de horario hay que mirar AMBOS roles: si ya es capacitador
 * en una sesión, no puede ser asistente en otra que se cruce (y al revés).
 */
import "server-only";
import { and, eq, gt, inArray, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { programaciones } from "@/db/schema";
import { normalizar } from "./personas";

export type Equivalencias = {
  /** personal.id de la misma persona que el capacitador dado */
  personalDe: (capacitadorId: number) => number[];
  /** capacitadores.id de la misma persona que el personal dado */
  capacitadoresDe: (personalId: number) => number[];
};

const agregar = (m: Map<number, Set<number>>, k: number, v: number) => m.set(k, (m.get(k) ?? new Set()).add(v));

/** Relaciona los registros de consultor y de personal que son la misma persona (por usuario, DNI o nombre). */
export async function equivalencias(): Promise<Equivalencias> {
  const [us, caps, pers] = await Promise.all([
    db.query.usuarios.findMany({ columns: { capacitadorId: true, personalId: true } }),
    db.query.capacitadores.findMany({ columns: { id: true, nombres: true, apellidos: true, dni: true } }),
    db.query.personal.findMany({ columns: { id: true, nombres: true, apellidos: true, dni: true } }),
  ]);
  const c2p = new Map<number, Set<number>>();
  const p2c = new Map<number, Set<number>>();
  const unir = (c: number, p: number) => (agregar(c2p, c, p), agregar(p2c, p, c));

  for (const u of us) if (u.capacitadorId && u.personalId) unir(u.capacitadorId, u.personalId);

  const clave = (x: { nombres: string; apellidos: string }) => normalizar(`${x.nombres} ${x.apellidos}`);
  const porNombre = new Map<string, number[]>();
  const porDni = new Map<string, number[]>();
  for (const p of pers) {
    if (clave(p)) porNombre.set(clave(p), [...(porNombre.get(clave(p)) ?? []), p.id]);
    if (p.dni?.trim()) porDni.set(p.dni.trim(), [...(porDni.get(p.dni.trim()) ?? []), p.id]);
  }
  for (const c of caps) {
    for (const p of porNombre.get(clave(c)) ?? []) unir(c.id, p);
    if (c.dni?.trim()) for (const p of porDni.get(c.dni.trim()) ?? []) unir(c.id, p);
  }
  return {
    personalDe: (id) => [...(c2p.get(id) ?? [])],
    capacitadoresDe: (id) => [...(p2c.get(id) ?? [])],
  };
}

type Franja = { fecha: string; horaInicio: string; horaFin: string };

/**
 * Busca un cruce de horario para el capacitador y/o asistente propuestos, en cualquiera de sus roles.
 * Devuelve el mensaje de error, o null si están disponibles.
 */
export async function validarDisponibilidad(
  { capacitadorId, asistenteId }: { capacitadorId?: number | null; asistenteId?: number | null },
  franja: Franja,
  excluirId?: number | null,
  eq_?: Equivalencias,
): Promise<string | null> {
  if (!capacitadorId && !asistenteId) return null;
  const e = eq_ ?? (await equivalencias());

  if (capacitadorId && asistenteId && e.personalDe(capacitadorId).includes(asistenteId)) {
    return "La misma persona no puede ser capacitador y asistente en la misma sesión.";
  }

  const revisar = async (quien: "capacitador" | "asistente", capIds: number[], persIds: number[]) => {
    if (!capIds.length && !persIds.length) return null;
    const c = await db.query.programaciones.findFirst({
      where: and(
        eq(programaciones.fecha, franja.fecha),
        lt(programaciones.horaInicio, franja.horaFin),
        gt(programaciones.horaFin, franja.horaInicio),
        ne(programaciones.estado, "cancelada"),
        excluirId ? ne(programaciones.id, excluirId) : undefined,
        or(
          capIds.length ? inArray(programaciones.capacitadorId, capIds) : undefined,
          persIds.length ? inArray(programaciones.asistenteId, persIds) : undefined,
        ),
      ),
      with: { sede: true },
    });
    if (!c) return null;
    const comoCap = c.capacitadorId != null && capIds.includes(c.capacitadorId);
    return `Sin disponibilidad: el ${quien} ya figura como ${comoCap ? "capacitador" : "asistente"} en ${c.sede.nombre} de ${c.horaInicio.slice(0, 5)} a ${c.horaFin.slice(0, 5)} ese día.`;
  };

  return (
    (capacitadorId ? await revisar("capacitador", [capacitadorId], e.personalDe(capacitadorId)) : null) ??
    (asistenteId ? await revisar("asistente", e.capacitadoresDe(asistenteId), [asistenteId]) : null)
  );
}
