import Link from "next/link";
import { and, ne, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { participantes, sedes, planesMejoraVersiones } from "@/db/schema";
import { exigir } from "@/lib/auth";
import { Encabezado, Vacio } from "@/components/ui";
export const metadata = { title: "Planes de Mejora" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigir("capacitaciones", "ver");
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
  return <>
    <Encabezado antetitulo="Operativo" titulo="Planes de Mejora" />
    <p className="text-sm text-texto-2">Un expediente por beneficiario: tres problemas principales, su evolución y las evidencias de cada versión.</p>
    <form className="card flex flex-wrap items-end gap-3 p-4">
      <label className="flex flex-col gap-1 text-sm">Buscar beneficiario<input name="q" defaultValue={q} placeholder="Nombre, apellidos o DNI" className="campo" /></label>
      <label className="flex flex-col gap-1 text-sm">Sede<select name="sede" defaultValue={sede || ""} className="campo"><option value="">Todas las sedes</option>{lugares.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
      <button className="btn-oscuro">Buscar</button><Link className="btn-secundario" href="/operativo/planes-mejora">Limpiar</Link>
    </form>
    <section className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="th">Beneficiario</th><th className="th">Sede</th><th className="th">Problemas principales</th><th className="th">Última versión</th><th className="th">Acción</th></tr></thead><tbody>
      {lista.map(({p,sede}) => { const v = ultimas.get(p.id); return <tr key={p.id}><td className="td font-semibold">{p.apellidos}, {p.nombres}<span className="block text-xs font-normal text-texto-2">{p.dni || "Sin DNI"}</span></td><td className="td">{sede || "Sin sede"}</td><td className="td">{(p.problemasMejora ?? v?.problemas)?.length ? <ol className="list-inside list-decimal space-y-1">{(p.problemasMejora ?? v?.problemas ?? []).map((pr,i) => <li key={i}>{pr.texto}</li>)}</ol> : "Sin plan registrado"}</td><td className="td">{v ? <>Versión {v.numero}<span className="block text-xs">{v.creadoEn.toLocaleDateString("es-PE", {timeZone:"America/Lima"})}</span></> : "—"}</td><td className="td"><Link className="btn-secundario whitespace-nowrap" href={`/operativo/planes-mejora/${p.id}`}>{v ? "Ver plan" : "Crear plan"}</Link></td></tr>; })}
    </tbody></table>{!lista.length && <Vacio>No se encontraron beneficiarios.</Vacio>}</section>
  </>;
}
