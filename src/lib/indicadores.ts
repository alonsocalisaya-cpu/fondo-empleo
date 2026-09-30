import "server-only";
import { and, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, inscripciones, preparaciones, programaciones } from "@/db/schema";
import { listarProgramaciones } from "./consultas";
import { nombreCompleto } from "@/components/ui";

/** Metas institucionales (en %). Ajusta aquí los valores objetivo. */
export const METAS = {
  cumplimiento: 95, // sesiones ejecutadas / sesiones que ya debían realizarse
  asistencia: 85, // (presentes + tardanzas) / registros de asistencia
  puntualidad: 90, // presentes a tiempo / asistentes
  cobertura: 100, // sesiones con consultor asignado
  programados: 80, // asistentes / beneficiarios programados por turno
  cierre: 100, // listas cerradas de sesiones pasadas
} as const;

export type Semaforo = "verde" | "ambar" | "rojo" | "sin";
export function semaforo(valor: number | null, meta: number): Semaforo {
  if (valor === null) return "sin";
  if (valor >= meta) return "verde";
  if (valor >= meta - 10) return "ambar";
  return "rojo";
}

const pct = (a: number, b: number) => (b ? Math.round((a * 1000) / b) / 10 : null);

type Acum = {
  programadas: number; // total en el periodo (sin canceladas)
  vencidas: number; // con fecha <= hoy
  ejecutadas: number;
  pasadas: number; // fecha < hoy
  cerradas: number;
  conConsultor: number;
  registros: number;
  asistieron: number;
  aTiempo: number;
  asistentesFicha: number;
  programados: number;
};
const vacio = (): Acum => ({
  programadas: 0, vencidas: 0, ejecutadas: 0, pasadas: 0, cerradas: 0, conConsultor: 0,
  registros: 0, asistieron: 0, aTiempo: 0, asistentesFicha: 0, programados: 0,
});

export type Resultado = {
  cumplimiento: number | null;
  asistencia: number | null;
  puntualidad: number | null;
  cobertura: number | null;
  programados: number | null;
  cierre: number | null;
  sesiones: number;
  ejecutadas: number;
  registros: number;
};

function resultado(a: Acum): Resultado {
  return {
    cumplimiento: pct(a.ejecutadas, a.vencidas),
    asistencia: pct(a.asistieron, a.registros),
    puntualidad: pct(a.aTiempo, a.asistieron),
    cobertura: pct(a.conConsultor, a.programadas),
    programados: pct(a.asistentesFicha, a.programados),
    cierre: pct(a.cerradas, a.pasadas),
    sesiones: a.programadas,
    ejecutadas: a.ejecutadas,
    registros: a.registros,
  };
}

/** Calcula los indicadores del periodo: total y desglosado por sede, componente y consultor. */
export async function calcularIndicadores(desde: string, hasta: string, hoy: string) {
  const progs = await listarProgramaciones(
    and(gte(programaciones.fecha, desde), lte(programaciones.fecha, hasta), ne(programaciones.estado, "cancelada")),
  );
  const ids = progs.map((p) => p.id);

  const [asis, ins, preps] = ids.length
    ? await Promise.all([
        db
          .select({
            id: asistencias.programacionId,
            n: sql<number>`count(*)::int`,
            asistieron: sql<number>`count(*) filter (where ${asistencias.estado} in ('presente','tarde'))::int`,
            aTiempo: sql<number>`count(*) filter (where ${asistencias.estado} = 'presente')::int`,
          })
          .from(asistencias)
          .where(inArray(asistencias.programacionId, ids))
          .groupBy(asistencias.programacionId),
        db
          .select({ id: inscripciones.programacionId, n: sql<number>`count(*)::int` })
          .from(inscripciones)
          .where(inArray(inscripciones.programacionId, ids))
          .groupBy(inscripciones.programacionId),
        db.select({ id: preparaciones.programacionId, pasos: preparaciones.pasos }).from(preparaciones).where(inArray(preparaciones.programacionId, ids)),
      ])
    : [[], [], []];
  // Programados y asistentes declarados en la 2da sección de la ficha (llenar_ficha2)
  const mFicha = new Map(
    preps.flatMap((x) => {
      const f2 = (x.pasos as Record<string, { programados?: number; asistentes?: number } | undefined>).llenar_ficha2;
      return f2 && typeof f2.programados === "number" && typeof f2.asistentes === "number" ? [[x.id, { programados: f2.programados, asistentes: f2.asistentes }] as const] : [];
    }),
  );
  const mAsis = new Map(asis.map((a) => [a.id, a]));
  const mIns = new Map(ins.map((i) => [i.id, i.n]));

  const total = vacio();
  const grupos = {
    sede: new Map<string, { id: number; nombre: string; acum: Acum }>(),
    componente: new Map<string, { id: number; nombre: string; acum: Acum }>(),
    consultor: new Map<string, { id: number; nombre: string; acum: Acum }>(),
  };

  for (const p of progs) {
    const a = mAsis.get(p.id);
    const inscritos = mIns.get(p.id) ?? 0;
    const comp = p.sesion.modulo.actividad.componente;
    const claves: [keyof typeof grupos, number, string][] = [
      ["sede", p.sede.id, p.sede.nombre],
      ["componente", comp.id, comp.nombre],
    ];
    if (p.capacitador) claves.push(["consultor", p.capacitador.id, nombreCompleto(p.capacitador)]);

    const destinos = [total, ...claves.map(([g, id, nombre]) => {
      const mapa = grupos[g];
      if (!mapa.has(String(id))) mapa.set(String(id), { id, nombre, acum: vacio() });
      return mapa.get(String(id))!.acum;
    })];

    for (const d of destinos) {
      const ejecutada = p.estado === "finalizada" || p.listaCerrada;
      d.programadas++;
      // "Debían realizarse": las de días anteriores, más las de hoy que ya se cerraron
      if (p.fecha < hoy || ejecutada) d.vencidas++;
      if (ejecutada) d.ejecutadas++;
      if (p.fecha < hoy) {
        d.pasadas++;
        if (p.listaCerrada) d.cerradas++;
      }
      if (p.capacitadorId) d.conConsultor++;
      if (a) {
        d.registros += a.n;
        d.asistieron += a.asistieron;
        d.aTiempo += a.aTiempo;
      }
      // Asistencia frente a lo programado: lo de la ficha; si no se llenó, los inscritos por turno y la lista de asistencia
      const f2 = mFicha.get(p.id);
      if (f2 && f2.programados > 0) {
        d.programados += f2.programados;
        d.asistentesFicha += f2.asistentes;
      } else if (a && inscritos > 0) {
        d.programados += inscritos;
        d.asistentesFicha += a.asistieron;
      }
    }
  }

  const lista = (g: keyof typeof grupos) =>
    [...grupos[g].values()]
      .map((x) => ({ id: x.id, nombre: x.nombre, ...resultado(x.acum) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    total: resultado(total),
    porSede: lista("sede"),
    porComponente: lista("componente"),
    porConsultor: lista("consultor"),
  };
}
