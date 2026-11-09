import EstadoPlan from "./EstadoPlan";
import { colorGrupo, nombreGrupo } from "@/lib/grupos-plan";
import { costoRecurso } from "@/lib/plan-mejora";
import Link from "next/link";
import { and, ne, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { participantes, sedes, planesMejoraVersiones } from "@/db/schema";
import { exigir } from "@/lib/auth";
import { Encabezado, Vacio } from "@/components/ui";
export const metadata = { title: "Planes de Mejora" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigir("planes_mejora", "ver");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sede = Number(sp.sede) || 0;
  const [lista, lugares, versiones] = await Promise.all([
    db.select({ p: participantes, sede: sedes.nombre }).from(participantes).leftJoin(sedes, eq(sedes.id, participantes.sedeId)).where(and(sede ? eq(participantes.sedeId, sede) : undefined, ...q.split(/\s+/).filter(Boolean).map((t) => or(ilike(sql`concat_ws(' ', ${participantes.nombres}, ${participantes.apellidos})`, `%${t}%`), ilike(participantes.dni, `%${t}%`))))).orderBy(participantes.apellidos, participantes.nombres),
    db.select().from(sedes).orderBy(sedes.nombre),
    db.select().from(planesMejoraVersiones).where(ne(planesMejoraVersiones.estado,"descartada")).orderBy(sql`${planesMejoraVersiones.numero} desc`),
  ]);
  const ultimas = new Map<number, typeof versiones[number]>();
  for (const v of versiones) if (!ultimas.has(v.participanteId)) ultimas.set(v.participanteId, v);
  const vigentes=new Map<number,typeof versiones[number]>();
  for(const v of versiones)if(v.estado==="publicada"&&!vigentes.has(v.participanteId))vigentes.set(v.participanteId,v);
  return <>
    <Encabezado antetitulo="Operativo" titulo="Planes de Mejora" />
    <p className="text-sm text-texto-2">Un expediente por beneficiario: tres problemas principales, su evolución y las evidencias de cada versión.</p>
    <form className="card flex flex-wrap items-end gap-3 p-4">
      <label className="flex flex-col gap-1 text-sm">Buscar beneficiario<input name="q" defaultValue={q} placeholder="Nombre, apellidos o DNI" className="campo" /></label>
      <label className="flex flex-col gap-1 text-sm">Sede<select name="sede" defaultValue={sede || ""} className="campo"><option value="">Todas las sedes</option>{lugares.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
      <button className="btn-oscuro">Buscar</button><Link className="btn-secundario" href="/operativo/planes-mejora">Limpiar</Link>
    </form>
    <section className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="th">Beneficiario</th><th className="th">Sede</th><th className="th">Problemas principales</th><th className="th">Presupuesto solicitado</th><th className="th">Estado del documento</th><th className="th">Evaluación</th><th className="th">Acción</th></tr></thead><tbody>
      {lista.map(({p,sede}) => { const v = ultimas.get(p.id); const documento=vigentes.get(p.id); const plan = p.planMejora ?? v?.plan; const problemas = plan?.problemas ?? (p.problemasMejora ?? v?.problemas ?? []).map(pr=>({...pr,categoria:""})); const presupuesto = plan?.presupuesto.reduce((total,r)=>total+costoRecurso(r),0); return <tr key={p.id}><td className="td font-semibold">{p.apellidos}, {p.nombres}<span className="block text-xs font-normal text-texto-2">{p.dni || "Sin DNI"}</span></td><td className="td">{sede || "Sin sede"}</td><td className="td min-w-[380px]"><div className="w-[360px] min-w-[360px]">{problemas.length?<ol className="space-y-2.5">{problemas.map((pr,i)=><li key={i} className="flex min-w-0 items-center gap-2"><span className="inline-flex shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium" style={colorGrupo(pr.categoria||"")}>{pr.categoria?nombreGrupo(pr.categoria):"Sin grupo"}</span><span aria-hidden="true" className="shrink-0 text-texto-2">–</span><span className="min-w-0 flex-1 truncate text-sm" title={pr.texto||"Sin descripción"}>{pr.texto||"Sin descripción"}</span></li>)}</ol>:"Sin plan registrado"}</div></td><td className="td whitespace-nowrap font-semibold text-[#166044]">{presupuesto!==undefined?new Intl.NumberFormat("es-PE",{style:"currency",currency:"PEN"}).format(presupuesto):"—"}</td><td className="td"><span title={documento?`Versión vigente: ${documento.numero}`:"Todavía no hay una versión publicada"} className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${documento?.estadoDocumento==="completo"?"bg-green-100 text-green-800":documento?.estadoDocumento==="observado"?"bg-red-100 text-red-800":"bg-slate-100 text-slate-600"}`}>{documento?.estadoDocumento==="completo"?"Completo":documento?.estadoDocumento==="observado"?"Observado":documento?"Sin marcar":"Sin documento vigente"}</span></td><td className="td"><EstadoPlan valor={p.estadoPlanMejora}/></td><td className="td"><Link className="btn-secundario whitespace-nowrap" href={`/operativo/planes-mejora/${p.id}`}>{v ? "Ver plan" : "Crear plan"}</Link></td></tr>; })}
    </tbody></table>{!lista.length && <Vacio>No se encontraron beneficiarios.</Vacio>}</section>
  </>;
}
