import Link from "next/link";
import type { documentos } from "@/db/schema";
import type { ProgramacionConRuta } from "@/lib/consultas";
import { fechaCorta } from "@/lib/fechas";
import { enlaceEntregables, type FiltrosEntregables } from "@/lib/navegacion-entregables";
import CampoFecha from "@/components/CampoFecha";
import { Vacio } from "@/components/ui";
import { Desplegable } from "./PresentacionRepositorio";

export default function EntregablesPorSede({ filtros: f, programadas, documentosPorProgramacion, sedes, sesiones }: {
  filtros: FiltrosEntregables; programadas: ProgramacionConRuta[];
  documentosPorProgramacion: Map<number, (typeof documentos.$inferSelect)[]>;
  sedes: { id: number; nombre: string }[]; sesiones: { id: number; codigo: string; nombre: string }[];
}) {
  const visibles = programadas.filter((p) => !f.sesion || p.sesionId === f.sesion || p.combinadas.some((c) => c.sesionId === f.sesion));
  const grupos = [...new Set(visibles.map((p) => p.sedeId))].map((id) => ({ id, nombre: visibles.find((p) => p.sedeId === id)!.sede.nombre, programadas: visibles.filter((p) => p.sedeId === id) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return <div className="space-y-4">
    <form key={JSON.stringify(f)} className="card flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="parte" value="sesiones" /><input type="hidden" name="vista" value="sede" />{f.proyecto && <input type="hidden" name="proyecto" value={f.proyecto} />}
      <div className="w-full sm:w-60"><label htmlFor="repo-sede" className="etiqueta">Sede</label><select id="repo-sede" name="sede" defaultValue={f.sede || ""} className="campo"><option value="">Todas las sedes del proyecto</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
      <div><label htmlFor="repo-desde" className="etiqueta">Desde</label><CampoFecha id="repo-desde" name="desde" value={f.desde} /></div>
      <div><label htmlFor="repo-hasta" className="etiqueta">Hasta</label><CampoFecha id="repo-hasta" name="hasta" value={f.hasta} /></div>
      <div className="w-full sm:w-72"><label htmlFor="repo-sesion" className="etiqueta">Sesión / tema</label><select id="repo-sesion" name="sesion" defaultValue={f.sesion || ""} className="campo"><option value="">Todas las sesiones</option>{sesiones.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}</select></div>
      <button className="btn-oscuro">Buscar entregables</button><Link href={enlaceEntregables({ ...f, sede: 0, desde: "", hasta: "", sesion: 0 })} className="btn-secundario">Limpiar</Link>
    </form>
    <p className="text-xs text-texto-2">{visibles.length} capacitaciones encontradas. Las sesiones combinadas se muestran una sola vez, con sus temas y entregables compartidos.</p>
    {f.desde && f.hasta && f.desde > f.hasta ? <Vacio>La fecha de inicio debe ser anterior o igual a la fecha de fin.</Vacio> : !grupos.length ? <Vacio>No hay capacitaciones para esta sede y las fechas seleccionadas.</Vacio> : grupos.map((g) => <Desplegable key={g.id} titulo={g.nombre} persistencia={`sede-${g.id}`} cantidad={`${g.programadas.length} capacitaciones`}>
      {g.programadas.map((p) => <article key={p.id} id={`gd-programacion-${p.id}`} className="flex scroll-mt-4 flex-wrap items-center justify-between gap-3 rounded-xl border border-borde bg-white p-4">
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-texto-2">{fechaCorta(p.fecha)} · {p.horaInicio.slice(0, 5)}–{p.horaFin.slice(0, 5)}</p><h3 className="mt-1 text-sm font-semibold text-marino">{[p.sesion.nombre, ...p.combinadas.map((c) => c.sesion.nombre)].join(" + ")}</h3><p className="mt-2 text-xs text-texto-2">{documentosPorProgramacion.get(p.id)?.length ?? 0} archivos{p.combinadas.length ? " · Sesión combinada" : ""}{p.estado === "cancelada" ? " · Cancelada" : ""}</p></div>
        <Link href={enlaceEntregables(f, { sesion: f.sesion || p.sesionId, programacion: p.id })} className="btn-secundario shrink-0 text-sm">Ver entregables →</Link>
      </article>)}
    </Desplegable>)}
  </div>;
}
