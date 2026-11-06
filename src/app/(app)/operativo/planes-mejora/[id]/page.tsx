import Link from "next/link";
import SubirDocumento from "../SubirDocumento";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { participantes, planesMejoraVersiones, usuarios, sedes } from "@/db/schema";
import { exigir } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { Encabezado } from "@/components/ui";
import { guardarVersion, guardarProblemas } from "../actions";
import FormularioVersion from "../FormularioVersion";
export default async function Page({params, searchParams}: {params: Promise<{id:string}>; searchParams: Promise<Record<string,string|undefined>>}) {
  const u = await exigir("capacitaciones", "ver");
  const {id} = await params; const sp = await searchParams;
  const [persona] = await db.select({p:participantes,sede:sedes.nombre}).from(participantes).leftJoin(sedes,eq(sedes.id,participantes.sedeId)).where(eq(participantes.id,Number(id)||0));
  if (!persona) notFound();
  const registros = await db.select({v:planesMejoraVersiones,autor:usuarios.nombre}).from(planesMejoraVersiones).leftJoin(usuarios,eq(usuarios.id,planesMejoraVersiones.autorId)).where(eq(planesMejoraVersiones.participanteId,persona.p.id)).orderBy(asc(planesMejoraVersiones.numero));
  const versiones = registros.map((registro) => ({ ...registro, v: { ...registro.v, archivos: registro.v.archivos.map((a) => a.tipo === "plan" ? { ...a, tipo: "escaneado" as const } : a) } }));
  const actual = versiones.at(-1)?.v;

  return <>
    <Link className="enlace self-start" href="/operativo/planes-mejora">← Volver a Planes de Mejora</Link>
    <Encabezado antetitulo={`Planes de Mejora · ${persona.sede || "Sin sede"}`} titulo={`${persona.p.nombres} ${persona.p.apellidos}`} />
    {sp.guardado && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">Versión guardada correctamente.</p>}
    {sp.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{sp.error}</p>}
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borde bg-[#f7faf9] px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-[#298774]">Plan de mejora</p><h2 className="mt-1 text-base font-semibold text-marino">Enfoque y plan vigente</h2></div>{actual && <span className="rounded-full border border-[#c8e5dc] bg-[#e8f5ef] px-3 py-1 text-xs font-semibold text-[#23745e]">Versión {actual.numero}</span>}</header>
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]"><div className="min-w-0 p-5 sm:p-6"><h3 className="text-sm font-semibold text-marino">Tres problemas principales</h3><p className="mb-4 mt-1 text-xs text-texto-2">Los puntos que orientan las mejoras del negocio.</p>
      {sp.problemasGuardados && <p role="status" className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">✓ Problemas guardados</p>}
      {puede(u.roles,"capacitaciones","editar") ? <form action={guardarProblemas} className="space-y-3"><input type="hidden" name="participanteId" value={persona.p.id}/>{[1,2,3].map((n)=><label key={n} className="flex items-center gap-3 rounded-xl border border-[#e1e8e5] bg-[#fafcfb] px-3 py-2 transition-colors focus-within:border-[#298774] focus-within:bg-white"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#e4f1ec] text-xs font-bold text-[#247b68]">0{n}</span><input name={`problema${n}`} aria-label={`Problema ${n}`} required maxLength={500} defaultValue={(persona.p.problemasMejora ?? actual?.problemas)?.[n-1]?.texto ?? ""} placeholder={`Escribe el problema ${n}`} className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-marino outline-none placeholder:text-[#8a9691]"/></label>)}<div className="flex justify-end pt-1"><button className="btn-secundario text-xs">Guardar problemas</button></div></form> : <ol className="space-y-3">{(persona.p.problemasMejora ?? actual?.problemas ?? []).map((p,i)=><li key={i} className="flex items-start gap-3 rounded-xl border border-borde bg-[#fafcfb] p-3 text-sm"><span className="font-semibold text-[#247b68]">0{i+1}</span><span>{p.texto}</span></li>)}</ol>}
      </div><aside className="min-w-0 border-t border-borde bg-[#f5f8fa] p-5 sm:p-6 lg:border-l lg:border-t-0"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl border border-[#d7e3ef] bg-white text-[#4472a0]" aria-hidden="true"><svg width="20" height="22" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 1h10l6 6v20H4zM14 1v7h6M8 14h8M8 19h8"/></svg></span><div><h3 className="text-sm font-semibold text-marino">Último plan vigente</h3><p className="mt-0.5 text-xs text-texto-2">{actual ? `Actualizado el ${actual.creadoEn.toLocaleDateString("es-PE",{timeZone:"America/Lima"})}` : "Pendiente de primer documento"}</p></div></div>
        <div className="mt-5 space-y-3">{[{tipo:"escaneado",nombre:"Escaneado",ayuda:"Documento digitalizado",color:"bg-[#e6eefb] text-[#3d66a2]"},{tipo:"editable",nombre:"Editable",ayuda:"Archivo para trabajar",color:"bg-[#e1f1e9] text-[#287454]"}].map((grupo)=><div key={grupo.tipo} className="rounded-xl border border-[#e0e6ec] bg-white p-3"><div className="mb-2 flex items-center gap-2"><span className={`flex size-7 items-center justify-center rounded-lg text-[10px] font-bold ${grupo.color}`}>{grupo.tipo==="editable" ? "ED" : "SC"}</span><div><h4 className="text-xs font-semibold text-marino">{grupo.nombre}</h4><p className="text-[10px] text-texto-2">{grupo.ayuda}</p></div></div>{actual?.archivos.some((a)=>a.tipo===grupo.tipo) ? <div className="space-y-1">{actual.archivos.map((a,i)=>a.tipo===grupo.tipo && <a key={i} href={`/operativo/planes-mejora/archivo/${actual.id}?indice=${i}`} className="group flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-[#edf5f1] focus-visible:outline-2 focus-visible:outline-marino-2" title={`Descargar ${a.nombre}`}><span className="min-w-0 flex-1 truncate text-texto-2 group-hover:text-marino">{a.nombre}</span><span className="shrink-0 font-semibold text-[#247b68]">Descargar ↓</span></a>)}</div> : <p className="px-1 py-2 text-xs text-[#8a9691]">Sin archivo adjunto</p>}</div>)}</div>
      </aside></div>
    </section>
    {puede(u.roles,"capacitaciones","editar") && <SubirDocumento key={versiones.length}><FormularioVersion participanteId={persona.p.id} accion={guardarVersion} inicial={!actual} /></SubirDocumento>}
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-borde bg-[#f7f9fc] px-5 py-4"><h2 className="font-semibold text-marino">Historial del plan</h2><span className="text-xs text-texto-2">{versiones.length} versiones</span></header>
      {!versiones.length && <div className="px-5 py-10 text-center text-sm text-texto-2">Aún no hay documentos. Usa «Subir documento» para agregar la primera versión.</div>}
      {versiones.map(({v,autor},indice) => <details key={v.id} open={indice===versiones.length-1} className="group/correo border-b border-borde last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-[#f0f6f4] [&::-webkit-details-marker]:hidden">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e1eeea] text-xs font-bold text-[#247b68]" aria-hidden="true">{(autor || "Usuario").split(" ").filter(Boolean).slice(0,2).map((n)=>n[0]).join("")}</span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-marino">Versión {v.numero}</span>{indice===versiones.length-1 && <span className="rounded bg-[#e1eeea] px-2 py-0.5 text-[10px] font-semibold text-[#247b68]">Actual</span>}</div><p className="mt-1 truncate text-xs text-texto-2">De: {autor}</p></div>
          <div className="shrink-0 text-right"><time className="text-xs text-texto-2">Fecha: {v.creadoEn.toLocaleString("es-PE",{timeZone:"America/Lima",dateStyle:"short",timeStyle:"short"})}</time><span className="mt-1 block text-[11px] text-texto-2">{v.archivos.length} adjuntos <span aria-hidden="true" className="ml-2 inline-block transition-transform group-open/correo:rotate-180">⌄</span></span></div>
        </summary>
        <div className="border-t border-borde bg-white px-5 py-5 sm:pl-[68px]">

          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-texto-2">{v.cambios}</p>
          <div className="mt-6 grid grid-cols-1 items-start gap-3 border-t border-borde pt-4 lg:grid-cols-3">{[
            {tipo:"escaneado",nombre:"Escaneado"}, {tipo:"editable",nombre:"Editable"}, {tipo:"evidencia",nombre:"Evidencias"}
          ].map((grupo)=><section key={grupo.tipo} className="min-w-0 rounded-xl border border-borde bg-[#f8fafc] p-3"><h4 className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold text-marino"><span>{grupo.nombre}</span><span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-texto-2">{v.archivos.filter((a)=>a.tipo===grupo.tipo).length}</span></h4><div className="flex flex-col gap-2">{v.archivos.map((a,i)=>a.tipo===grupo.tipo && <a key={i} href={`/operativo/planes-mejora/archivo/${v.id}?indice=${i}`} className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-borde bg-white p-2.5 transition-colors hover:border-marino-2 hover:bg-[#edf7f4]" title={`Descargar ${a.nombre}`}><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#e0eafa] text-[10px] font-bold uppercase text-[#365e9c]">{a.nombre.split(".").pop()?.slice(0,5)}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-marino">{a.nombre}</p><p className="mt-1 text-[11px] text-texto-2">{grupo.nombre} · Descargar</p></div><span aria-hidden="true">↓</span></a>)}</div>{!v.archivos.some((a)=>a.tipo===grupo.tipo) && <p className="py-3 text-center text-xs text-texto-2">Sin adjuntos</p>}</section>)}</div>
        </div>
      </details>)}
    </section>
  </>;
}
