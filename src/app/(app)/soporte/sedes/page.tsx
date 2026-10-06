import SiPuede from "@/components/SiPuede";
import Link from "next/link";
import { connection } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { programaciones, sedes } from "@/db/schema";
import { Encabezado, Vacio } from "@/components/ui";
import { alternarSede, eliminarSede } from "@/lib/acciones-maestros";
import BotonEliminar from "@/components/BotonEliminar";
import FormSede from "./FormSede";
import FormRegion from "./FormRegion";
export const metadata={title:"Sedes"};
const hora=(h:string)=>new Intl.DateTimeFormat("es-PE",{hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(`2000-01-01T${h}`));
export default async function Sedes({searchParams}:{searchParams:Promise<{programa?:string;editar?:string;nuevo?:string}>}){
 await connection();const sp=await searchParams;
 const[programas,todas,horarios]=await Promise.all([
  db.query.estructuras.findMany({orderBy:(t,{asc})=>[asc(t.orden),asc(t.id)]}),
  db.select({sede:sedes,sesiones:sql<number>`count(${programaciones.id})::int`}).from(sedes).leftJoin(programaciones,eq(programaciones.sedeId,sedes.id)).groupBy(sedes.id).orderBy(sedes.nombre),
  db.query.sedeHorarios.findMany(),
 ]);
 const programa=programas.find(p=>p.id===Number(sp.programa))??programas[0];
 const filas=todas.filter(s=>s.sede.estructuraId===programa?.id);
 const editar=filas.find(s=>s.sede.id===Number(sp.editar))?.sede;
 const url=`/soporte/sedes?programa=${programa?.id??""}`;
 return <>
  <Encabezado antetitulo="Soporte" titulo="Sedes y horarios" acciones={programa ? <SiPuede modulo="sedes"><Link href={`/soporte/sedes?programa=${programa.id}&nuevo=1`} className="btn-primario">+ Agregar sede</Link></SiPuede> : undefined}/>
  <nav aria-label="Programa" className="flex flex-wrap gap-2">{programas.map(p=><Link key={p.id} href={`/soporte/sedes?programa=${p.id}`} aria-current={p.id===programa?.id?"page":undefined} className={p.id===programa?.id?"btn-primario":"btn-secundario"}>{p.nombre} · {todas.filter(s=>s.sede.estructuraId===p.id).length} sedes</Link>)}</nav>
  <SiPuede modulo="sedes"><details className="card px-5 py-3"><summary className="cursor-pointer font-semibold text-acento">+ Agregar región o programa</summary><p className="mt-2 text-sm text-texto-2">Cada región agrupa sus propias sedes, beneficiarios y cronograma. Ejemplos: Arequipa, Puno o Cusco.</p><FormRegion/></details></SiPuede>
  <p className="text-sm text-texto-2">Cada fila pertenece a un programa y tiene un único horario. Los turnos de un mismo local se registran por separado.</p>
  {programa&&<SiPuede modulo="sedes">{editar?<section className="card p-5"><div className="mb-4 flex justify-between gap-3"><h2 className="font-semibold text-marino">Editar {editar.nombre}</h2><Link href={url} className="enlace">Cerrar edición</Link></div><FormSede key={editar.id} sede={{...editar,horarios:horarios.filter(h=>h.sedeId===editar.id)}} programas={programas} programaId={programa.id}/></section>:<details open={sp.nuevo==="1"} className="card p-5"><summary className="cursor-pointer font-semibold text-acento">+ Agregar otra sede en {programa.nombre}</summary><div className="mt-5"><p className="mb-4 text-sm text-texto-2">Al crearla como activa, estará disponible automáticamente al registrar o editar beneficiarios de {programa.nombre}.</p><FormSede key={programa.id} programas={programas} programaId={programa.id}/></div></details>}</SiPuede>}
  <section className="card overflow-x-auto">{filas.length===0?<Vacio>No hay sedes registradas para este programa.</Vacio>:<table className="w-full text-sm"><thead><tr>{["Sede / turno","Ubicación","Horario","Distrito","Contacto","Sesiones","Estado","Acciones"].map(t=><th key={t} scope="col" className="th">{t}</th>)}</tr></thead><tbody>{filas.map(({sede:s,sesiones})=>{const h=horarios.find(h=>h.sedeId===s.id);return <tr key={s.id} className={s.activa?"":"text-texto-2"}>
   <td className="td font-medium">{s.nombre}</td><td className="td">{s.direccion||"Por completar"}</td><td className="td whitespace-nowrap">{h?`${hora(h.horaInicio)} – ${hora(h.horaFin)}`:"Por completar"}</td><td className="td">{s.distrito||"—"}</td><td className="td"><span className="block">{s.contacto||"—"}</span><span className="text-xs text-texto-2">{s.telefono}</span></td><td className="td">{sesiones}</td><td className="td">{s.activa?"Activa":"Inactiva"}</td>
   <td className="td"><SiPuede modulo="sedes"><div className="flex flex-wrap items-center gap-3"><Link href={`${url}&editar=${s.id}`} className="enlace" aria-label={`Editar ${s.nombre}`}>Editar</Link><form action={alternarSede}><input type="hidden" name="id" value={s.id}/><button className="enlace">{s.activa?"Desactivar":"Activar"}</button></form><BotonEliminar accion={eliminarSede} campos={{id:s.id}} pregunta={`¿Eliminar la sede ${s.nombre}?`} detalle={sesiones?`Tiene ${sesiones} sesiones: no se puede eliminar mientras existan.`:"Sus beneficiarios y equipos quedarán sin sede."}/></div></SiPuede></td>
  </tr>})}</tbody></table>}</section>
 </>;
}
