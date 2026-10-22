import Link from "next/link";
import { connection } from "next/server";
import { and, asc, eq, gte, ilike, inArray, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, estructuras, inscripciones, participantes, programaciones, sedes } from "@/db/schema";
import { exigir, soloSesionesDe } from "@/lib/auth";
import { examenDe, examenes } from "@/lib/preparacion";
import { fechaCorta, hoyISO } from "@/lib/fechas";
import { promedioNotas, resultadoExamen, type EstadoNota } from "@/lib/seguimiento-examenes";
import { Encabezado, Vacio } from "@/components/ui";
import CampoFecha from "@/components/CampoFecha";
import ExportarSeguimiento from "@/components/ExportarSeguimiento";

export const metadata = { title: "Registro de notas" };
const RUTA = "/operativo/seguimiento-examenes";
const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ETIQUETA: Record<EstadoNota, { texto: string; sigla: string }> = {
  registrada: { texto: "Nota registrada", sigla: "" }, pendiente: { texto: "Examen por realizar", sigla: "·" },
  sin_nota: { texto: "Sin nota registrada", sigla: "S/N" }, no_rindio: { texto: "No rindió (ausente o justificado)", sigla: "N/R" },
  no_inscrito: { texto: "No inscrito en esta sesión", sigla: "—" }, no_realizada: { texto: "Capacitación no ejecutada", sigla: "N/E" },
};
const formatoNota = (n: number | null) => n == null ? "—" : n.toLocaleString("es-PE", { maximumFractionDigits: 1 });
const colorNota = (n: number | null) => n == null ? "text-[#8a939f]" : n >= 14 ? "bg-[#dcfce7] text-[#166534]" : n >= 11 ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#fee2e2] text-[#991b1b]";

export default async function SeguimientoExamenes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const u = await exigir("capacitaciones", "ver");
  const sp = await searchParams;
  const [opciones, regiones] = await Promise.all([
    db.query.sedes.findMany({ orderBy: asc(sedes.nombre) }),
    db.select({ id: estructuras.id, nombre: estructuras.nombre }).from(estructuras).orderBy(asc(estructuras.orden), asc(estructuras.nombre)),
  ]);
  const sede = opciones.find((s) => s.id === Number(sp.sede)) ?? opciones[0];
  const desde = esFecha(sp.desde) ? sp.desde : "";
  const hasta = esFecha(sp.hasta) ? sp.hasta : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const actividad = Number(sp.actividad) || 0;
  const base = sede ? await db.query.programaciones.findMany({
    where: and(eq(programaciones.sedeId, sede.id), ne(programaciones.estado, "cancelada"), soloSesionesDe(u), desde ? gte(programaciones.fecha, desde) : undefined, hasta ? lte(programaciones.fecha, hasta) : undefined),
    with: { sesion: { with: { modulo: { with: { actividad: true } } } }, combinadas: { with: { sesion: { with: { modulo: { with: { actividad: true } } } } } }, preparacion: true },
    orderBy: [asc(programaciones.fecha), asc(programaciones.horaInicio), asc(programaciones.id)],
  }) : [];
  const actividades = [...new Map(base.flatMap((p) => [p.sesion.modulo.actividad, ...p.combinadas.map((c) => c.sesion.modulo.actividad)]).map((a) => [a.id, a])).values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  const mapaExamenes = await examenes([...new Set(base.flatMap((p) => [p.sesionId, ...p.combinadas.map((c) => c.sesionId)]))]);
  const hoy = hoyISO();
  const horaActual = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const columnas = base.filter((p) => !actividad || p.sesion.modulo.actividad.id === actividad || p.combinadas.some((c) => c.sesion.modulo.actividad.id === actividad)).map((p) => ({
    ...p, nombre: [p.sesion.nombre, ...p.combinadas.map((c) => c.sesion.nombre)].join(" + "),
    tipos: (["entrada", "salida"] as const).filter((tipo) => { const examen = examenDe(p, mapaExamenes); return examen === tipo || examen === "ambos"; }),
    pendiente: !p.listaCerrada && (p.fecha > hoy || (p.fecha === hoy && p.horaFin.slice(0, 5) > horaActual)),
  })).filter((p) => p.tipos.length > 0);
  const ids = columnas.map((p) => p.id);
  const [ins, asis] = ids.length ? await Promise.all([
    db.select().from(inscripciones).where(inArray(inscripciones.programacionId, ids)),
    db.select().from(asistencias).where(inArray(asistencias.programacionId, ids)),
  ]) : [[], []];
  const pids = [...new Set([...ins.map((i) => i.participanteId), ...asis.map((a) => a.participanteId)])];
  const gente = sede ? await db.select({ id: participantes.id, nombres: participantes.nombres, apellidos: participantes.apellidos, dni: participantes.dni }).from(participantes).where(and(
    or(eq(participantes.sedeId, sede.id), pids.length ? inArray(participantes.id, pids) : undefined),
    ...q.split(/\s+/).filter(Boolean).map((t) => or(ilike(participantes.nombres, `%${t}%`), ilike(participantes.apellidos, `%${t}%`), ilike(participantes.dni, `%${t}%`))),
  )).orderBy(asc(participantes.apellidos), asc(participantes.nombres), asc(participantes.id)) : [];
  const inscritos = new Set(ins.map((i) => `${i.programacionId}:${i.participanteId}`));
  const registros = new Map(asis.map((a) => [`${a.programacionId}:${a.participanteId}`, a]));
  const columnasNotas = columnas.flatMap((p) => p.tipos.map((tipo) => ({ p, tipo })));
  const filas = gente.map((b) => {
    const notas = columnasNotas.map(({ p, tipo }) => {
      const a = registros.get(`${p.id}:${b.id}`);
      return { ...resultadoExamen({ nota: tipo === "entrada" ? a?.notaEntrada : a?.notaSalida, estado: a?.estado, inscrito: inscritos.has(`${p.id}:${b.id}`), pendiente: p.pendiente, realizada: p.preparacion?.pasos.datos_capacitacion?.realizada as boolean | undefined }), tipo };
    });
    return { ...b, notas, entrada: promedioNotas(notas.filter((n) => n.tipo === "entrada").map((n) => n.nota)), salida: promedioNotas(notas.filter((n) => n.tipo === "salida").map((n) => n.nota)) };
  });
  const borde = "border-b border-r border-[#d8dee7]";
  const cabecera = `${borde} bg-[#f2f4f5] text-texto-2`;
  return <>
    <Encabezado antetitulo="Operativo" titulo="Registro de notas" />
    <form key={`${sede?.id}:${actividad}:${desde}:${hasta}:${q}`} className="card flex flex-wrap items-end gap-3 rounded-xl border-[#d8dee7] p-4 shadow-sm">
      <div className="w-full sm:w-60"><label htmlFor="ex-sede" className="etiqueta">Sede por región</label><select id="ex-sede" name="sede" defaultValue={sede?.id ?? ""} className="campo">{regiones.map((r) => { const lista = opciones.filter((s) => s.estructuraId === r.id); return lista.length > 0 && <optgroup key={r.id} label={r.nombre}>{lista.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</optgroup>; })}{!opciones.length && <option value="">Sin sede disponible</option>}</select></div>
      <div className="w-full sm:w-60"><label htmlFor="ex-q" className="etiqueta">Buscar beneficiario</label><input id="ex-q" name="q" defaultValue={q} placeholder="DNI, nombres o apellidos" className="campo" /></div>
      <div className="w-full sm:w-64"><label htmlFor="ex-act" className="etiqueta">Actividad</label><select id="ex-act" name="actividad" defaultValue={actividad || ""} className="campo"><option value="">Todas</option>{actividades.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}</select></div>
      <div><label htmlFor="ex-desde" className="etiqueta">Desde</label><CampoFecha id="ex-desde" name="desde" value={desde} /></div>
      <div><label htmlFor="ex-hasta" className="etiqueta">Hasta</label><CampoFecha id="ex-hasta" name="hasta" value={hasta} /></div>
      <button className="btn-oscuro">Ver exámenes</button><Link href={RUTA} className="btn-secundario">Limpiar</Link>
    </form>
    <ExportarSeguimiento titulo="Registro de notas" contexto={`Sede: ${sede?.nombre ?? ""} · Desde: ${desde || "Sin límite"} · Hasta: ${hasta || "Sin límite"} · Actividad: ${actividades.find((a) => a.id === actividad)?.nombre ?? "Todas"} · Búsqueda: ${q || "Todos"}`} />
    <section className="card overflow-hidden">
      <div className="space-y-2 border-b border-borde px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-marino">Notas por beneficiario{sede ? ` · ${sede.nombre}` : ""}</h2><span className="text-xs text-texto-2">{filas.length} beneficiarios · {columnas.length} sesiones con examen</span></div><p className="text-xs text-texto-2">Notas de 0 a 20. Entrada y salida se muestran por separado. Los promedios incluyen únicamente notas registradas; los exámenes pendientes o no rendidos no cuentan como cero.</p><div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-texto-2">{Object.entries(ETIQUETA).filter(([k]) => k !== "registrada").map(([k, e]) => <span key={k}><strong>{e.sigla}</strong> = {e.texto}</span>)}</div></div>
      {!sede ? <Vacio>No hay sedes registradas.</Vacio> : !columnas.length ? <Vacio>No hay sesiones con exámenes para esta sede y los filtros seleccionados.</Vacio> : !filas.length ? <Vacio>No se encontraron beneficiarios.</Vacio> : <div className="max-h-[70vh] overflow-auto" tabIndex={0} role="region" aria-label={`Seguimiento de exámenes de ${sede.nombre}`}>
        <table data-exportar-seguimiento className="table-fixed border-separate border-spacing-0 text-[11px]" style={{ width: 348 + columnasNotas.length * 72 + 144 }}>
          <caption className="sr-only">Notas de entrada y salida por beneficiario y fecha.</caption>
          <colgroup><col style={{ width: 36 }} /><col style={{ width: 224 }} /><col style={{ width: 88 }} />{columnasNotas.map(({ p, tipo }) => <col key={`${p.id}-${tipo}`} style={{ width: 72 }} />)}<col style={{ width: 72 }} /><col style={{ width: 72 }} /></colgroup>
          <thead><tr className="h-11"><th rowSpan={2} scope="col" className={`sticky left-0 top-0 z-30 text-center font-medium ${cabecera}`}>N°</th><th rowSpan={2} scope="col" className={`sticky left-9 top-0 z-30 px-2 text-left font-medium ${cabecera}`}>Apellidos y nombres</th><th rowSpan={2} scope="col" className={`sticky left-[260px] top-0 z-30 px-2 text-left font-medium ${cabecera}`}>DNI</th>{columnas.map((p) => <th key={p.id} colSpan={p.tipos.length} scope="colgroup" className={`sticky top-0 z-20 h-11 px-1 py-1 text-center font-normal ${cabecera}`}><Link href={`/operativo/capacitacion/${p.id}`} title={fechaCorta(p.fecha)} className="font-semibold hover:underline">{p.fecha.slice(8, 10)}/{p.fecha.slice(5, 7)}</Link><a href={`#ex-tema-${p.id}`} className="mt-0.5 block text-[9px] hover:underline">S{p.id}</a></th>)}<th colSpan={2} scope="colgroup" className={`sticky top-0 z-20 text-center font-semibold ${cabecera}`}>Promedio</th></tr><tr className="h-6">{columnasNotas.map(({ p, tipo }) => <th key={`${p.id}-${tipo}`} scope="col" className={`sticky top-11 z-20 h-6 text-center text-[10px] font-medium ${cabecera}`}>Nota {tipo === "entrada" ? "E" : "S"}</th>)}<th scope="col" className={`sticky top-11 z-20 h-6 text-center font-medium ${cabecera}`}>Entrada</th><th scope="col" className={`sticky top-11 z-20 h-6 text-center font-medium ${cabecera}`}>Salida</th></tr></thead>
          <tbody>{filas.map((b, i) => <tr key={b.id} className="group h-7"><td className={`sticky left-0 z-10 bg-white px-1 py-1 text-center text-texto-2 group-hover:bg-[#f5f8fc] ${borde}`}>{i + 1}</td><th scope="row" className={`sticky left-9 z-10 bg-white px-2 py-1 text-left font-normal text-marino group-hover:bg-[#f5f8fc] ${borde}`}><span className="block truncate" title={`${b.apellidos}, ${b.nombres}`}>{b.apellidos}, {b.nombres}</span></th><td className={`sticky left-[260px] z-10 bg-white px-2 py-1 tabular-nums text-texto-2 group-hover:bg-[#f5f8fc] ${borde}`}>{b.dni}</td>{b.notas.map((n, j) => <td key={`${columnasNotas[j].p.id}-${n.tipo}`} title={n.nota == null ? ETIQUETA[n.estado].texto : `Examen de ${n.tipo}: ${formatoNota(n.nota)}`} className={`${borde} px-1 py-1 text-center font-semibold tabular-nums ${colorNota(n.nota)}`}>{n.nota == null ? ETIQUETA[n.estado].sigla : formatoNota(n.nota)}</td>)}{[b.entrada, b.salida].map((n, j) => <td key={j} className={`${borde} px-1 py-1 text-center font-bold tabular-nums ${colorNota(n)}`}>{formatoNota(n)}</td>)}</tr>)}</tbody>
        </table>
      </div>}
      {columnas.length > 0 && <section className="space-y-3 border-t border-borde bg-[#f8fafc] p-4 sm:p-5" aria-label="Leyenda de temas de exámenes"><h3 className="text-sm font-semibold text-marino">Leyenda de temas</h3><dl className="grid gap-2 sm:grid-cols-2">{columnas.map((p) => <div key={p.id} id={`ex-tema-${p.id}`} className="flex scroll-mt-4 items-start gap-3 rounded-lg border border-borde bg-white p-3"><dt className="shrink-0 rounded bg-[#e7edf5] px-2 py-1 text-xs font-semibold text-marino">S{p.id}</dt><dd className="min-w-0 text-sm"><p className="break-words text-marino">{p.nombre}</p><p className="mt-1 text-xs text-texto-2">{fechaCorta(p.fecha)} · {p.tipos.map((t) => t === "entrada" ? "Entrada" : "Salida").join(" y ")}</p></dd></div>)}</dl></section>}
    </section>
  </>;
}
