import Link from "next/link";
import { and, asc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, estructuras, inscripciones, preparaciones, programaciones, sedes } from "@/db/schema";
import { soloSesionesDe, type Usuario } from "@/lib/auth";
import { hoyISO, sumarDias, fechaCorta } from "@/lib/fechas";
import { totalizarAsistencia } from "@/lib/seguimiento-asistencia";
import { Vacio } from "@/components/ui";
import CampoFecha from "@/components/CampoFecha";
import ExportarSeguimiento from "@/components/ExportarSeguimiento";

const RUTA = "/operativo/seguimiento-asistencia";
const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function TotalesSede({ sp, u }: { sp: Record<string, string | string[] | undefined>; u: Usuario }) {
  const region = Number(sp.region) || 0;
  const desde = esFecha(sp.desde) ? sp.desde : "";
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoyISO();
  const semanaSql = sql<string>`to_char(date_trunc('week', ${programaciones.fecha}), 'YYYY-MM-DD')`;
  const [regiones, lista, cantidades] = await Promise.all([
    db.select({ id: estructuras.id, nombre: estructuras.nombre }).from(estructuras).orderBy(asc(estructuras.orden), asc(estructuras.nombre)),
    db.select({ id: sedes.id, nombre: sedes.nombre, region: estructuras.nombre }).from(sedes).innerJoin(estructuras, eq(estructuras.id, sedes.estructuraId)).where(region ? eq(sedes.estructuraId, region) : undefined).orderBy(asc(estructuras.orden), asc(estructuras.nombre), asc(sedes.nombre)),
    db.select({
      sedeId: programaciones.sedeId,
      semana: semanaSql,
      programados: sql<number>`count(${inscripciones.id})::int`,
      asistentes: sql<number>`count(${asistencias.id}) filter (where ${asistencias.estado} in ('presente','tarde'))::int`,
    }).from(programaciones)
      .innerJoin(sedes, eq(sedes.id, programaciones.sedeId))
      .leftJoin(preparaciones, eq(preparaciones.programacionId, programaciones.id))
      .leftJoin(inscripciones, eq(inscripciones.programacionId, programaciones.id))
      .leftJoin(asistencias, and(eq(asistencias.programacionId, programaciones.id), eq(asistencias.participanteId, inscripciones.participanteId)))
      .where(and(
        ne(programaciones.estado, "cancelada"), soloSesionesDe(u),
        desde ? gte(programaciones.fecha, desde) : undefined, lte(programaciones.fecha, hasta),
        region ? eq(sedes.estructuraId, region) : undefined,
        sql`(${preparaciones.pasos}->'datos_capacitacion'->>'realizada') is distinct from 'false'`,
      )).groupBy(programaciones.sedeId, semanaSql),
  ]);
  const semanas = [...new Set(cantidades.map((r) => r.semana))].sort();
  const porSedeSemana = new Map(cantidades.map((r) => [`${r.sedeId}:${r.semana}`, r]));
  const filas = lista.map((s) => ({ ...s, semanas: semanas.map((semana) => totalizarAsistencia([porSedeSemana.get(`${s.id}:${semana}`) ?? { programados: 0, asistentes: 0 }])) }));
  const totales = semanas.map((_, i) => totalizarAsistencia(filas.map((f) => f.semanas[i])));
  const numero = (n: number) => n.toLocaleString("es-PE");
  const ddmm = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  const borde = "border-b border-r border-[#d8dee7]";
  const cabecera = `${borde} bg-[#f2f4f5] text-texto-2`;
  const color = (pct: number | null, anterior: number | null | undefined) => pct == null || anterior == null || pct === anterior ? "bg-[#e5e7eb] text-[#4b5563]" : pct > anterior ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]";
  return <>
    <form key={`${region}:${desde}:${hasta}`} className="card flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="vista" value="totales" />
      <div className="w-full sm:w-64"><label htmlFor="tot-region" className="etiqueta">Región</label><select id="tot-region" name="region" defaultValue={region || ""} className="campo"><option value="">Todas las regiones</option>{regiones.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div>
      <div><label htmlFor="tot-desde" className="etiqueta">Desde</label><CampoFecha id="tot-desde" name="desde" value={desde} /></div>
      <div><label htmlFor="tot-hasta" className="etiqueta">Hasta</label><CampoFecha id="tot-hasta" name="hasta" value={hasta} /></div>
      <button className="btn-oscuro">Ver totales</button><Link href={`${RUTA}?vista=totales`} className="btn-secundario">Limpiar</Link>
    </form>
    <ExportarSeguimiento titulo="Totales de asistencia por sede" contexto={`Región: ${region || "Todas"} · Desde: ${desde || "Sin límite"} · Hasta: ${hasta}`} totales />
    <section className="card overflow-hidden">
      <div className="space-y-2 border-b border-borde px-4 py-3"><h2 className="font-semibold text-marino">Asistencia semanal por sede</h2><p className="text-xs leading-relaxed text-texto-2">Semanas de lunes a domingo. Se acumulan las inscripciones y asistencias de cada sesión dentro del rango seleccionado; asistentes incluye presentes y tardanzas. Se excluyen sesiones canceladas o no ejecutadas.</p><p className="text-[11px] text-texto-2">El porcentaje se compara con la semana anterior: verde si aumenta, rojo si disminuye y gris si se mantiene. El primer porcentaje y las semanas sin referencia comparable aparecen en gris.</p></div>
      {desde && desde > hasta ? <Vacio>La fecha de inicio debe ser anterior o igual a la fecha de fin.</Vacio> : !filas.length ? <Vacio>No hay sedes para la región seleccionada.</Vacio> : !semanas.length ? <Vacio>No hay sesiones programadas para los filtros seleccionados.</Vacio> : <div className="max-h-[70vh] overflow-auto" tabIndex={0} role="region" aria-label="Totales semanales de asistencia por sede"><table data-exportar-seguimiento className="table-fixed border-separate border-spacing-0 text-[11px]" style={{ width: 240 + semanas.length * 232 }}>
        <caption className="sr-only">Programados, asistentes y porcentaje por sede y semana, con totales de cada semana.</caption>
        <colgroup><col style={{ width: 240 }} />{semanas.flatMap((s) => [<col key={`${s}-p`} style={{ width: 84 }} />, <col key={`${s}-a`} style={{ width: 84 }} />, <col key={`${s}-pct`} style={{ width: 64 }} />])}</colgroup>
        <thead><tr className="h-9"><th rowSpan={2} scope="col" className={`sticky left-0 top-0 z-30 px-3 text-left font-semibold ${cabecera}`}>Sede</th>{semanas.map((s) => <th key={s} colSpan={3} scope="colgroup" title={`${fechaCorta(s)} al ${fechaCorta(sumarDias(s, 6))}`} className={`sticky top-0 z-20 h-9 text-center font-semibold ${cabecera}`}>Semana {ddmm(s)}–{ddmm(sumarDias(s, 6))} · {s.slice(0, 4)}</th>)}</tr><tr className="h-7">{semanas.flatMap((s) => [<th key={`${s}-p`} scope="col" className={`sticky top-9 z-20 h-7 text-center text-[10px] font-medium ${cabecera}`}>Programados</th>, <th key={`${s}-a`} scope="col" className={`sticky top-9 z-20 h-7 text-center text-[10px] font-medium ${cabecera}`}>Asistentes</th>, <th key={`${s}-pct`} scope="col" className={`sticky top-9 z-20 h-7 text-center font-medium ${cabecera}`}>%</th>])}</tr></thead>
        <tbody>{filas.map((f) => <tr key={f.id} className="group h-9"><th scope="row" className={`sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-normal group-hover:bg-[#f5f8fc] ${borde}`}><Link href={`${RUTA}?${new URLSearchParams({ sede: String(f.id), ...(desde ? { desde } : {}), hasta })}`} className="block truncate font-medium text-marino hover:underline">{f.nombre}</Link><span className="block text-[9px] text-texto-2">{f.region}</span></th>{f.semanas.flatMap((s, i) => [<td key={`${semanas[i]}-p`} className={`${borde} bg-[#edf2fa] px-2 py-1 text-center tabular-nums`}>{numero(s.programados)}</td>, <td key={`${semanas[i]}-a`} className={`${borde} px-2 py-1 text-center tabular-nums group-hover:bg-[#fafbfd]`}>{numero(s.asistentes)}</td>, <td key={`${semanas[i]}-pct`} className={`${borde} px-2 py-1 text-center font-semibold tabular-nums ${color(s.porcentaje, f.semanas[i - 1]?.porcentaje)}`}>{s.porcentaje == null ? "—" : `${s.porcentaje}%`}</td>])}</tr>)}</tbody>
        <tfoot><tr className="h-10 font-bold text-marino"><th scope="row" className={`sticky bottom-0 left-0 z-30 bg-[#e4ebf5] px-3 py-2 text-left ${borde}`}>Total general</th>{totales.flatMap((t, i) => [<td key={`${semanas[i]}-p`} className={`sticky bottom-0 z-20 bg-[#e4ebf5] px-2 py-2 text-center tabular-nums ${borde}`}>{numero(t.programados)}</td>, <td key={`${semanas[i]}-a`} className={`sticky bottom-0 z-20 bg-[#e4ebf5] px-2 py-2 text-center tabular-nums ${borde}`}>{numero(t.asistentes)}</td>, <td key={`${semanas[i]}-pct`} className={`sticky bottom-0 z-20 px-2 py-2 text-center tabular-nums ${borde} ${color(t.porcentaje, totales[i - 1]?.porcentaje)}`}>{t.porcentaje == null ? "—" : `${t.porcentaje}%`}</td>])}</tr></tfoot>
      </table></div>}
    </section>
  </>;
}
