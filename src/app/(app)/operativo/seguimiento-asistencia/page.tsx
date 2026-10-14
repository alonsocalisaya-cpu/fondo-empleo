import Link from "next/link";
import { connection } from "next/server";
import { and, asc, eq, gte, ilike, inArray, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, inscripciones, participantes, programaciones, sedes, estructuras } from "@/db/schema";
import { exigir, soloSesionesDe } from "@/lib/auth";
import { fechaCorta, hoyISO } from "@/lib/fechas";
import { marcaSeguimiento, MARCAS_SEGUIMIENTO, type MarcaSeguimiento } from "@/lib/seguimiento-asistencia";
import { Encabezado, Vacio } from "@/components/ui";
import CampoFecha from "@/components/CampoFecha";
import PestanasSeguimiento from "./PestanasSeguimiento";
import TotalesSede from "./TotalesSede";

export const metadata = { title: "Seguimiento de asistencia" };
const RUTA = "/operativo/seguimiento-asistencia";
const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function SeguimientoAsistencia({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const u = await exigir("capacitaciones", "ver");
  const sp = await searchParams;
  if (sp.vista === "totales") return <>
    <Encabezado antetitulo="Operativo" titulo="Seguimiento de asistencia" />
    <PestanasSeguimiento vista="totales" />
    <TotalesSede sp={sp} u={u} />
  </>;
  const [opciones, regiones] = await Promise.all([
    db.query.sedes.findMany({ orderBy: asc(sedes.nombre) }),
    db.select({ id: estructuras.id, nombre: estructuras.nombre }).from(estructuras).orderBy(asc(estructuras.orden), asc(estructuras.nombre)),
  ]);
  const sede = opciones.find((s) => s.id === Number(sp.sede)) ?? opciones[0];
  const desde = esFecha(sp.desde) ? sp.desde : "";
  const hasta = esFecha(sp.hasta) ? sp.hasta : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const progs = sede ? await db.query.programaciones.findMany({
    where: and(eq(programaciones.sedeId, sede.id), ne(programaciones.estado, "cancelada"), soloSesionesDe(u), desde ? gte(programaciones.fecha, desde) : undefined, hasta ? lte(programaciones.fecha, hasta) : undefined),
    with: { sesion: true, combinadas: { with: { sesion: true } }, preparacion: true },
    orderBy: [asc(programaciones.fecha), asc(programaciones.horaInicio), asc(programaciones.id)],
  }) : [];
  const ids = progs.map((p) => p.id);
  const [ins, asist] = ids.length ? await Promise.all([
    db.select().from(inscripciones).where(inArray(inscripciones.programacionId, ids)),
    db.select().from(asistencias).where(inArray(asistencias.programacionId, ids)),
  ]) : [[], []];
  const participantesSesion = [...new Set([...ins.map((i) => i.participanteId), ...asist.map((a) => a.participanteId)])];
  const gente = sede ? await db.select({ id: participantes.id, nombres: participantes.nombres, apellidos: participantes.apellidos, dni: participantes.dni }).from(participantes).where(and(
    or(eq(participantes.sedeId, sede.id), participantesSesion.length ? inArray(participantes.id, participantesSesion) : undefined),
    ...q.split(/\s+/).filter(Boolean).map((termino) => or(ilike(participantes.nombres, `%${termino}%`), ilike(participantes.apellidos, `%${termino}%`), ilike(participantes.dni, `%${termino}%`))),
  )).orderBy(asc(participantes.apellidos), asc(participantes.nombres), asc(participantes.id)) : [];
  const registros = new Map(asist.map((a) => [`${a.programacionId}:${a.participanteId}`, a.estado]));
  const inscritos = new Set(ins.map((i) => `${i.programacionId}:${i.participanteId}`));
  const hoy = hoyISO();
  const horaActual = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const columnas = progs.map((p) => ({
    ...p,
    nombre: [p.sesion.nombre, ...p.combinadas.map((c) => c.sesion.nombre)].join(" + "),
    pendiente: p.fecha > hoy || (p.fecha === hoy && p.horaFin.slice(0, 5) > horaActual),
  }));
  const filas = gente.map((b) => {
    const marcas = columnas.map((p) => marcaSeguimiento({ estado: registros.get(`${p.id}:${b.id}`), inscrito: inscritos.has(`${p.id}:${b.id}`), pendiente: p.pendiente, cerrada: p.listaCerrada, realizada: p.preparacion?.pasos.datos_capacitacion?.realizada as boolean | undefined }));
    return { ...b, marcas };
  });
  const principales: MarcaSeguimiento[] = ["presente", "tarde", "justificado", "ausente"];
  const fechaColumna = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  const borde = "border-b border-r border-[#d8dee7]";
  const cabecera = `${borde} bg-[#f2f4f5] text-[#646b73]`;
  return <>
    <Encabezado antetitulo="Operativo" titulo="Seguimiento de asistencia" />
    <PestanasSeguimiento vista="beneficiarios" />
    <form className="card flex flex-wrap items-end gap-3 rounded-xl border-[#d8dee7] p-4 shadow-sm">
      <div className="w-full sm:w-64"><label htmlFor="seg-sede" className="etiqueta">Sede por región</label><select id="seg-sede" name="sede" defaultValue={sede?.id ?? ""} className="campo">{regiones.map((region) => { const lista = opciones.filter((s) => s.estructuraId === region.id); return lista.length > 0 && <optgroup key={region.id} label={region.nombre}>{lista.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</optgroup>; })}{!opciones.length && <option value="">Sin sede disponible</option>}</select></div>
      <div className="w-full sm:w-64"><label htmlFor="seg-q" className="etiqueta">Buscar beneficiario</label><input id="seg-q" name="q" defaultValue={q} placeholder="DNI, nombres o apellidos" className="campo" /></div>
      <div><label htmlFor="seg-desde" className="etiqueta">Desde</label><CampoFecha id="seg-desde" name="desde" value={desde} /></div>
      <div><label htmlFor="seg-hasta" className="etiqueta">Hasta</label><CampoFecha id="seg-hasta" name="hasta" value={hasta} /></div>
      <button className="btn-oscuro">Ver seguimiento</button><Link href={RUTA} className="btn-secundario">Limpiar</Link>
    </form>
    <section className="card overflow-hidden">
      <div className="space-y-2 border-b border-borde px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-marino">Asistencia por beneficiario{sede ? ` · ${sede.nombre}` : ""}</h2><span className="text-xs text-texto-2">{filas.length} beneficiarios · {columnas.length} sesiones programadas</span></div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-texto-2">{Object.values(MARCAS_SEGUIMIENTO).map((m) => <span key={m.texto} className="inline-flex items-center gap-1.5"><span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 font-semibold ${m.clase}`}>{m.sigla}</span>{m.texto}</span>)}</div>
        <p className="text-xs text-texto-2">Cada columna corresponde a una sesión programada. En sesiones terminadas, los inscritos sin marca cuentan como ausentes; las futuras se muestran como «Por realizar». Desliza la tabla para ver las demás fechas.</p>
      </div>
      {!sede ? <Vacio>No hay sedes registradas.</Vacio> : !columnas.length ? <Vacio>No hay sesiones programadas en el rango seleccionado para esta sede.</Vacio> : !filas.length ? <Vacio>No se encontraron beneficiarios.</Vacio> : <div className="max-h-[70vh] overflow-auto" tabIndex={0} role="region" aria-label={`Tabla de seguimiento de asistencia de ${sede.nombre}`}>
        <table className="table-fixed border-separate border-spacing-0 text-[11px]" style={{ width: `${348 + columnas.length * 72 + 5 * 44}px` }}>
          <colgroup><col style={{ width: 36 }} /><col style={{ width: 224 }} /><col style={{ width: 88 }} />{columnas.map((p) => <col key={p.id} style={{ width: 72 }} />)}{[0, 1, 2, 3, 4].map((i) => <col key={`total-${i}`} style={{ width: 44 }} />)}</colgroup>
          <caption className="sr-only">Asistencia de los beneficiarios de {sede.nombre} por fecha y sesión.</caption>
          <thead>
            <tr className="h-11">
              <th scope="col" rowSpan={2} className={`sticky left-0 top-0 z-30 px-1 text-center font-medium ${cabecera}`}>N°</th>
              <th scope="col" rowSpan={2} className={`sticky left-9 top-0 z-30 px-2 text-left font-medium ${cabecera}`}>Apellidos y nombres</th>
              <th scope="col" rowSpan={2} className={`sticky left-[260px] top-0 z-30 px-2 text-left font-medium ${cabecera}`}>DNI</th>
              {columnas.map((p) => <th key={p.id} scope="col" className={`sticky top-0 z-20 h-11 px-1 py-1 text-center font-normal ${cabecera}`}><Link href={`/operativo/capacitacion/${p.id}`} title={fechaCorta(p.fecha)} className="whitespace-nowrap font-semibold hover:text-marino hover:underline">{fechaColumna(p.fecha)}</Link><a href={`#tema-${p.id}`} className="mt-0.5 block text-[9px] text-texto-2 hover:underline" aria-label={`Ver tema de la sesión S${p.id}`}>S{p.id}</a></th>)}
              <th scope="colgroup" colSpan={5} className={`sticky top-0 z-20 h-11 text-center font-semibold ${cabecera}`}>Asistencia</th>
            </tr>
            <tr className="h-6">{columnas.map((p) => <th key={p.id} scope="col" className={`sticky top-11 z-20 h-6 px-1 text-center text-[10px] font-medium ${cabecera}`}>Asist.</th>)}{principales.map((estado) => <th key={estado} scope="col" title={MARCAS_SEGUIMIENTO[estado].texto} className={`sticky top-11 z-20 h-6 text-center font-medium ${cabecera}`}>{MARCAS_SEGUIMIENTO[estado].sigla}</th>)}<th scope="col" className={`sticky top-11 z-20 h-6 text-center font-medium ${cabecera}`}>%</th></tr>
          </thead>
          <tbody>{filas.map((b, i) => {
            const conteos = principales.map((estado) => b.marcas.filter((m) => m === estado).length);
            const total = conteos.reduce((suma, n) => suma + n, 0);
            const porcentaje = total ? Math.round(100 * (conteos[0] + conteos[1]) / total) : null;
            return <tr key={b.id} className="group h-7">
              <td className={`sticky left-0 z-10 bg-white px-1 py-1 text-center text-texto-2 group-hover:bg-[#f5f8fc] ${borde}`}>{i + 1}</td>
              <th scope="row" className={`sticky left-9 z-10 bg-white px-2 py-1 text-left font-normal text-marino group-hover:bg-[#f5f8fc] ${borde}`}><span className="block truncate" title={`${b.apellidos}, ${b.nombres}`}>{b.apellidos}, {b.nombres}</span></th>
              <td className={`sticky left-[260px] z-10 bg-white px-2 py-1 tabular-nums text-texto-2 group-hover:bg-[#f5f8fc] ${borde}`}>{b.dni}</td>
              {b.marcas.map((estado, j) => { const m = MARCAS_SEGUIMIENTO[estado]; return <td key={columnas[j].id} title={`${m.texto} · ${b.nombres} ${b.apellidos} · ${fechaCorta(columnas[j].fecha)} · ${columnas[j].nombre}`} aria-label={m.texto} className={`${borde} px-1 py-1 text-center font-semibold ${principales.includes(estado) ? m.clase : "bg-white text-[#9aa2ac]"}`}>{m.sigla}</td>; })}
              {conteos.map((n, j) => <td key={principales[j]} className={`${borde} bg-white px-1 py-1 text-center tabular-nums ${principales[j] === "ausente" && n ? "font-semibold text-[#b91c1c]" : "text-[#4b5563]"}`}>{n}</td>)}
              <td className={`${borde} bg-white px-1 py-1 text-center font-bold tabular-nums ${porcentaje == null ? "text-texto-2" : porcentaje >= 80 ? "text-[#15803d]" : "text-[#b91c1c]"}`}>{porcentaje == null ? "—" : `${porcentaje}%`}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {columnas.length > 0 && <section aria-label="Leyenda de temas" className="space-y-3 border-t border-borde bg-[#f8fafc] p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-marino">Leyenda de temas</h3>
        <dl className="grid gap-2 sm:grid-cols-2">{columnas.map((p) => <div key={p.id} id={`tema-${p.id}`} className="flex scroll-mt-4 items-start gap-3 rounded-lg border border-borde bg-white p-3"><dt className="shrink-0 rounded bg-[#e7edf5] px-2 py-1 text-xs font-semibold text-marino">S{p.id}</dt><dd className="min-w-0 text-sm"><p className="break-words text-marino">{p.nombre}</p><p className="mt-1 text-xs text-texto-2">{fechaCorta(p.fecha)}</p></dd></div>)}</dl>
      </section>}
    </section>
  </>;
}
