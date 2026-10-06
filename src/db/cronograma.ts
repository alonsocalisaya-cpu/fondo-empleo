/**
 * Importa el cronograma de sesiones (Excel "Cronograma Consultor", hoja General)
 * desde datos/cronograma.json: sedes, consultores, asistentes (soporte) y programaciones.
 * Es seguro ejecutarlo varias veces: cada fila del Excel se identifica por su código (CRONO-<fila>).
 */
import { and, eq, ilike, inArray, like, sql } from "drizzle-orm";
import { db as dbPorDefecto } from "./index";
import * as s from "./schema";
import cronograma from "../../datos/cronograma.json";
import { turnoDesdeHora } from "../lib/fechas";

type FilaJson = {
  id: string;
  consultor: string | null;
  soporte: string | null;
  sede: string;
  fecha: string;
  inicio: string;
  fin: string;
  sesion: string;
  combinadas?: string[];
  sesionExcel: string;
  estado: s.EstadoProg;
  obs: string | null;
};
type Datos = { sedes: { nombre: string; direccion: string; distrito: string; fueraDeArequipa: boolean; grupo?: string; horaInicio?: string; horaFin?: string }[]; programaciones: FilaJson[] };
export const CRONOGRAMA = cronograma as Datos;

export async function yaImportado(db = dbPorDefecto) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.programaciones)
    .where(like(s.programaciones.codigoExterno, "CRONO-%"));
  return n > 0;
}

export async function importarCronograma(db = dbPorDefecto) {
  const res = { sedes: 0, consultoresNuevos: 0, asistentesNuevos: 0, programaciones: 0, sinSesion: [] as string[] };

  const [estructura] = await db.select().from(s.estructuras).where(eq(s.estructuras.nombre, "Arequipa"));
  if (!estructura) throw new Error("Falta la estructura Arequipa.");
  // 1) Sedes
  const sedeId = new Map<string, number>();
  for (const x of CRONOGRAMA.sedes) {
    const { horaInicio, horaFin, ...datosSede } = x;
    const [fila] = await db
      .insert(s.sedes)
      .values({ ...datosSede, estructuraId: estructura.id })
      .onConflictDoUpdate({ target: [s.sedes.estructuraId, s.sedes.nombre], set: { direccion: x.direccion, distrito: x.distrito, fueraDeArequipa: x.fueraDeArequipa, ...(x.grupo ? {grupo:x.grupo} : {}) } })
      .returning();
    if (horaInicio && horaFin) await db.insert(s.sedeHorarios).values({sedeId:fila.id,nombre:"Principal",horaInicio,horaFin}).onConflictDoNothing();
    sedeId.set(x.nombre, fila.id);
    res.sedes++;
  }

  // 2) Personas (el Excel solo trae el primer nombre: se reutiliza a quien ya exista con ese nombre)
  const consultorId = new Map<string, number>();
  const asistenteId = new Map<string, number>();
  for (const nombre of new Set(CRONOGRAMA.programaciones.map((p) => p.consultor).filter(Boolean) as string[])) {
    // Primero alguien registrado solo con ese nombre; si no, alguien cuyo nombre empiece así (p. ej. "Luis Alberto")
    const existe =
      (await db.query.capacitadores.findFirst({ where: (t) => and(ilike(t.nombres, nombre), eq(t.apellidos, "")) })) ??
      (await db.query.capacitadores.findFirst({ where: (t, { or }) => or(ilike(t.nombres, nombre), ilike(t.nombres, `${nombre} %`)) }));
    if (existe) consultorId.set(nombre, existe.id);
    else {
      const [c] = await db.insert(s.capacitadores).values({ nombres: nombre, apellidos: "" }).returning();
      consultorId.set(nombre, c.id);
      res.consultoresNuevos++;
    }
  }
  for (const nombre of new Set(CRONOGRAMA.programaciones.map((p) => p.soporte).filter(Boolean) as string[])) {
    const existe = await db.query.personal.findFirst({
      where: (t, { or }) => and(eq(t.rol, "asistente"), or(ilike(t.nombres, nombre), ilike(t.nombres, `${nombre} %`))),
    });
    if (existe) asistenteId.set(nombre, existe.id);
    else {
      const [a] = await db.insert(s.personal).values({ nombres: nombre, apellidos: "", rol: "asistente" }).returning();
      asistenteId.set(nombre, a.id);
      res.asistentesNuevos++;
    }
  }

  // 3) Sesiones del programa
  const ses = await db
    .select({ id: s.sesiones.id, codigo: s.sesiones.codigo })
    .from(s.sesiones)
    .where(inArray(s.sesiones.codigo, [...new Set(CRONOGRAMA.programaciones.flatMap((p) => [p.sesion, ...(p.combinadas ?? [])]))]));
  const sesionId = new Map(ses.map((x) => [x.codigo, x.id]));

  // 4) Programaciones
  for (const p of CRONOGRAMA.programaciones) {
    const sid = sesionId.get(p.sesion);
    if (!sid) {
      res.sinSesion.push(`${p.fecha} ${p.sesionExcel}`);
      continue;
    }
    const valores = {
      sesionId: sid,
      sedeId: sedeId.get(p.sede)!,
      capacitadorId: p.consultor ? consultorId.get(p.consultor)! : null,
      asistenteId: p.soporte ? asistenteId.get(p.soporte)! : null,
      fecha: p.fecha,
      horaInicio: p.inicio,
      horaFin: p.fin,
      turno: turnoDesdeHora(p.inicio),
      estado: p.estado,
      observacion: p.obs,
    };
    const [prog] = await db
      .insert(s.programaciones)
      .values({ ...valores, codigoExterno: p.id })
      .onConflictDoUpdate({ target: s.programaciones.codigoExterno, set: valores })
      .returning();
    // Sesiones combinadas ("A + B" en el Excel)
    await db.delete(s.programacionSesiones).where(eq(s.programacionSesiones.programacionId, prog.id));
    const extras = (p.combinadas ?? []).map((c) => sesionId.get(c)).filter((x): x is number => !!x);
    if (extras.length) {
      await db.insert(s.programacionSesiones).values(extras.map((sid, i) => ({ programacionId: prog.id, sesionId: sid, orden: i + 1 })));
    }
    res.programaciones++;
  }
  return res;
}

/**
 * Para bases importadas antes de existir las "sesiones combinadas": convierte la nota
 * "Sesión combinada: A + B" en sesiones combinadas reales, sin tocar consultor, asistente ni estado.
 */
export async function actualizarCombinadas(db = dbPorDefecto) {
  const pendientes = await db
    .select({ id: s.programaciones.id, codigo: s.programaciones.codigoExterno })
    .from(s.programaciones)
    .where(like(s.programaciones.observacion, "Sesión combinada%"));
  if (!pendientes.length) return 0;
  const porCodigo = new Map(CRONOGRAMA.programaciones.map((p) => [p.id, p]));
  const ses = await db.select({ id: s.sesiones.id, codigo: s.sesiones.codigo }).from(s.sesiones);
  const sesionId = new Map(ses.map((x) => [x.codigo, x.id]));
  for (const fila of pendientes) {
    const p = fila.codigo ? porCodigo.get(fila.codigo) : undefined;
    if (!p) continue;
    const extras = (p.combinadas ?? []).map((c) => sesionId.get(c)).filter((x): x is number => !!x);
    await db.delete(s.programacionSesiones).where(eq(s.programacionSesiones.programacionId, fila.id));
    if (extras.length) {
      await db.insert(s.programacionSesiones).values(extras.map((sid, i) => ({ programacionId: fila.id, sesionId: sid, orden: i + 1 })));
    }
    await db.update(s.programaciones).set({ observacion: p.obs }).where(eq(s.programaciones.id, fila.id));
  }
  return pendientes.length;
}
