import Link from "next/link";
import HistorialCambios from "../HistorialCambios";
import EditorPlan from "../EditorPlan";
import { planInicial } from "@/lib/plan-mejora";
import VersionesPlan from "../VersionesPlan";
import { vigenteDe } from "@/lib/versiones-plan";
import { notFound } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { participantes, planesMejoraVersiones, historialPlanesMejora, eventosVersionesPlan, usuarios, sedes } from "@/db/schema";
import { exigir } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { Encabezado } from "@/components/ui";
export default async function Page({params, searchParams}: {params: Promise<{id:string}>; searchParams: Promise<Record<string,string|undefined>>}) {
  const u = await exigir("capacitaciones", "ver");
  const {id} = await params; const sp = await searchParams;
  const [persona] = await db.select({p:participantes,sede:sedes.nombre}).from(participantes).leftJoin(sedes,eq(sedes.id,participantes.sedeId)).where(eq(participantes.id,Number(id)||0));
  if (!persona) notFound();
  const registros = await db.select({v:planesMejoraVersiones,autor:usuarios.nombre}).from(planesMejoraVersiones).leftJoin(usuarios,eq(usuarios.id,planesMejoraVersiones.autorId)).where(and(eq(planesMejoraVersiones.participanteId,persona.p.id),ne(planesMejoraVersiones.estado,"descartada"))).orderBy(desc(planesMejoraVersiones.numero));
  const versiones = registros.map((registro) => ({ ...registro, v: { ...registro.v, archivos: registro.v.archivos.map((a) => a.tipo === "plan" ? { ...a, tipo: "escaneado" as const } : a) } }));
  const actual = vigenteDe(versiones.map(x=>x.v));
  const historial = await db.select().from(historialPlanesMejora).where(eq(historialPlanesMejora.participanteId,persona.p.id)).orderBy(desc(historialPlanesMejora.revision));
  const eventos = await db.select().from(eventosVersionesPlan).where(eq(eventosVersionesPlan.participanteId,persona.p.id));
  const entradas = [...historial.map(e=>({id:`plan-${e.id}`,revision:e.revision as number|null,autor:e.autor,fecha:e.creadoEn.toISOString(),cambios:e.cambios})),...eventos.map(e=>{const publicacion=e.cambios.find(c=>c.campo.startsWith("Publicó la versión "));return {id:`documento-${e.id}`,revision:null,autor:e.autor,fecha:e.creadoEn.toISOString(),cambios:publicacion?[publicacion]:e.cambios};})].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id.localeCompare(a.id,undefined,{numeric:true}));

  return <>
    <Link className="enlace self-start" href="/operativo/planes-mejora">← Volver a Planes de Mejora</Link>
    <Encabezado antetitulo={`Planes de Mejora · ${persona.sede || "Sin sede"}`} titulo={`${persona.p.nombres} ${persona.p.apellidos}`} />
    {sp.guardado && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">Versión guardada correctamente.</p>}
    {sp.error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{sp.error}</p>}
    <EditorPlan tabInicial={sp.preparacion ? "vigente" : "problemas"} participanteId={persona.p.id} inicial={persona.p.planMejora ?? planInicial(persona.p.problemasMejora ?? actual?.problemas ?? [])} revision={persona.p.planRevision} editable={puede(u.roles,"capacitaciones","editar")} planVigente={<VersionesPlan participanteId={persona.p.id} editable={puede(u.roles,"capacitaciones","editar")} versiones={versiones.map(({v,autor})=>({id:v.id,numero:v.numero,estado:v.estado,edicion:v.edicion,cambios:v.cambios,archivos:v.archivos,autor:autor??"Usuario",fecha:v.creadoEn.toISOString(),publicado:v.publicadoEn?.toISOString()??null}))} />} />
    <HistorialCambios entradas={entradas} />
  </>;
}
