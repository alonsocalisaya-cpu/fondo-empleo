import Link from "next/link";
import { connection } from "next/server";
import { and, gte, lte, ne } from "drizzle-orm";
import { programaciones } from "@/db/schema";
import { listarProgramaciones, opcionesFiltros } from "@/lib/consultas";
import { equivalencias } from "@/lib/disponibilidad";
import { fechaCorta, hoyISO, inicioSemana, sumarDias } from "@/lib/fechas";
import { Encabezado, Vacio, nombreCompleto } from "@/components/ui";
import FiltrosFecha from "@/components/FiltrosFecha";

export const metadata = { title: "Carga del personal" };

const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
type Conteo = { capacitador: number; soporte: number };
const vacio = (): Conteo => ({ capacitador: 0, soporte: 0 });

export default async function CargaPersonal({ searchParams }: PageProps<"/estrategico/consultores">) {
  await connection();
  const sp = await searchParams;
  const hoy = hoyISO();
  const primerDia = `${hoy.slice(0, 7)}-01`;
  const ultimoDia = new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const pedidoDesde = esFecha(sp.desde) ? sp.desde : primerDia;
  const pedidoHasta = esFecha(sp.hasta) ? sp.hasta : ultimoDia;
  const desde = pedidoDesde <= pedidoHasta ? pedidoDesde : pedidoHasta;
  const hasta = pedidoDesde <= pedidoHasta ? pedidoHasta : pedidoDesde;
  const [sesiones, opciones, equivalentes] = await Promise.all([
    listarProgramaciones(and(gte(programaciones.fecha, desde), lte(programaciones.fecha, hasta), ne(programaciones.estado, "cancelada"))),
    opcionesFiltros(), equivalencias(),
  ]);

  // Incluye también a quienes ya no están activos pero tienen asignaciones en el período.
  const caps = new Map(opciones.capacitadores.map((p) => [p.id, p]));
  const asistentes = new Map(opciones.asistentes.map((p) => [p.id, p]));
  for (const p of sesiones) {
    if (p.capacitador) caps.set(p.capacitador.id, p.capacitador);
    if (p.asistente) asistentes.set(p.asistente.id, p.asistente);
  }
  const personas = [...caps.values()].map((p) => ({ id: `c${p.id}`, nombre: nombreCompleto(p), capIds: [p.id], asisIds: [] as number[], sedes: new Map<number, Conteo>() }));
  for (const asistente of asistentes.values()) {
    const capIds = equivalentes.capacitadoresDe(asistente.id);
    const grupos = personas.filter((p) => p.capIds.some((id) => capIds.includes(id)));
    if (!grupos.length) personas.push({ id: `a${asistente.id}`, nombre: nombreCompleto(asistente), capIds, asisIds: [asistente.id], sedes: new Map() });
    else {
      const grupo = grupos[0];
      grupo.capIds = [...new Set([...capIds, ...grupos.flatMap((p) => p.capIds)])];
      grupo.asisIds = [...new Set([asistente.id, ...grupos.flatMap((p) => p.asisIds)])];
      for (const otro of grupos.slice(1)) personas.splice(personas.indexOf(otro), 1);
    }
  }
  const porCap = new Map(personas.flatMap((p) => p.capIds.map((id) => [id, p] as const)));
  const porAsistente = new Map(personas.flatMap((p) => p.asisIds.map((id) => [id, p] as const)));
  for (const sesion of sesiones) {
    for (const [persona, rol] of [[sesion.capacitadorId ? porCap.get(sesion.capacitadorId) : undefined, "capacitador"], [sesion.asistenteId ? porAsistente.get(sesion.asistenteId) : undefined, "soporte"]] as const) {
      if (!persona) continue;
      const conteo = persona.sedes.get(sesion.sedeId) ?? vacio();
      conteo[rol]++;
      persona.sedes.set(sesion.sedeId, conteo);
    }
  }
  personas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const sedes = [...new Map(sesiones.map((p) => [p.sede.id, p.sede])).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const sumar = (persona: (typeof personas)[number], ids: number[]) => ids.reduce((total, id) => {
    const c = persona.sedes.get(id) ?? vacio();
    return { capacitador: total.capacitador + c.capacitador, soporte: total.soporte + c.soporte };
  }, vacio());
  const regiones = opciones.estructuras.map((region) => ({ ...region, sedes: sedes.filter((s) => s.estructuraId === region.id) })).filter((region) => region.sedes.length > 0);
  const lunes = inicioSemana(hoy);
  const siguienteMes = new Date(`${primerDia}T12:00:00Z`);
  siguienteMes.setUTCMonth(siguienteMes.getUTCMonth() + 1);
  const proximoInicio = siguienteMes.toISOString().slice(0, 10);
  siguienteMes.setUTCMonth(siguienteMes.getUTCMonth() + 1);
  siguienteMes.setUTCDate(0);
  const periodos = [
    { nombre: "Esta semana", desde: lunes, hasta: sumarDias(lunes, 6) },
    { nombre: "Este mes", desde: primerDia, hasta: ultimoDia },
    { nombre: "Próximo mes", desde: proximoInicio, hasta: siguienteMes.toISOString().slice(0, 10) },
  ];

  return <>
    <Encabezado titulo="Carga del personal" antetitulo={`Estratégico · del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`} acciones={<div className="flex flex-wrap gap-2">{periodos.map((p) => <Link key={p.nombre} href={`/estrategico/consultores?${new URLSearchParams({ desde: p.desde, hasta: p.hasta })}`} className="btn-secundario">{p.nombre}</Link>)}</div>} />
    <form key={`${desde}:${hasta}`} className="card flex flex-wrap items-end gap-3 p-4">
      <FiltrosFecha inicio={desde} fin={hasta} prefijo="carga" />
      <button className="btn-oscuro">Ver período</button>
      <p className="basis-full text-xs text-texto-2">Conteos de visitas asignadas por persona, región y sede. Cada sesión cuenta como una visita en su función: capacitador o soporte. Se excluyen las canceladas.</p>
    </form>
    {!regiones.length && <div className="card"><Vacio>No hay visitas programadas en este período.</Vacio></div>}
    {regiones.map((region) => {
      const ids = region.sedes.map((s) => s.id);
      const filas = personas.filter((p) => { const total = sumar(p, ids); return total.capacitador + total.soporte > 0; });
      const totalRegion = filas.reduce((total, p) => { const c = sumar(p, ids); return { capacitador: total.capacitador + c.capacitador, soporte: total.soporte + c.soporte }; }, vacio());
      return <section key={region.id} aria-label={`Visitas en ${region.nombre}`} className="card overflow-x-auto">
        <h2 className="border-b border-borde px-4 py-3 font-semibold text-marino">{region.nombre}</h2>
        <table className="w-full text-sm">
          <caption className="sr-only">Visitas por persona y sede en {region.nombre}</caption>
          <thead className="bg-marino text-white">
            <tr><th rowSpan={2} scope="col" className="sticky left-0 z-20 min-w-48 bg-marino px-4 py-3 text-left shadow-[2px_0_3px_rgb(0_0_0/0.08)]">Persona</th>{region.sedes.map((s) => <th key={s.id} colSpan={2} scope="colgroup" className="min-w-40 border-l border-white/20 px-3 py-3 text-center">{s.nombre}</th>)}<th colSpan={3} scope="colgroup" className="border-l border-white/20 px-3 py-3 text-center">Total {region.nombre}</th></tr>
            <tr>{[...region.sedes.map((s) => String(s.id)), "total"].map((id) => <ColumnaRol key={id} total={id === "total"} />)}</tr>
          </thead>
          <tbody>{filas.map((p) => { const total = sumar(p, ids); return <tr key={p.id} className="border-b border-borde odd:bg-white even:bg-[#eef4f8]"><th scope="row" className="sticky left-0 z-10 bg-inherit px-4 py-3 text-left font-medium shadow-[2px_0_3px_rgb(0_0_0/0.08)]">{p.nombre}</th>{region.sedes.map((s) => <Celdas key={s.id} conteo={p.sedes.get(s.id) ?? vacio()} />)}<Celdas conteo={total} total /><td className="border-l border-borde bg-[#e6f4ef] px-3 py-3 text-center font-bold tabular-nums">{total.capacitador + total.soporte}</td></tr>; })}</tbody>
          <tfoot className="bg-[#eef1f5] font-semibold"><tr><th scope="row" className="sticky left-0 z-10 bg-[#eef1f5] px-4 py-3 text-left shadow-[2px_0_3px_rgb(0_0_0/0.08)]">Total</th>{region.sedes.map((s) => <Celdas key={s.id} conteo={filas.reduce((total, p) => { const c = p.sedes.get(s.id) ?? vacio(); return { capacitador: total.capacitador + c.capacitador, soporte: total.soporte + c.soporte }; }, vacio())} total />)}<Celdas conteo={totalRegion} total /><td className="border-l border-borde bg-[#e6f4ef] px-3 py-3 text-center font-bold tabular-nums">{totalRegion.capacitador + totalRegion.soporte}</td></tr></tfoot>
        </table>
      </section>;
    })}
  </>;
}

function ColumnaRol({ total = false }: { total?: boolean }) {
  return <><th scope="col" className="border-l border-white/20 px-3 pb-3 text-center text-xs font-normal">Capacitador</th><th scope="col" className="px-3 pb-3 text-center text-xs font-normal">Soporte</th>{total && <th scope="col" className="whitespace-nowrap border-l border-white/20 px-3 pb-3 text-center text-xs">Total visitas</th>}</>;
}

function Celdas({ conteo, total = false }: { conteo: Conteo; total?: boolean }) {
  return <><td className={`border-l border-borde px-3 py-3 text-center tabular-nums ${total ? "font-semibold" : ""}`}>{conteo.capacitador}</td><td className={`px-3 py-3 text-center tabular-nums ${total ? "font-semibold" : ""}`}>{conteo.soporte}</td></>;
}
