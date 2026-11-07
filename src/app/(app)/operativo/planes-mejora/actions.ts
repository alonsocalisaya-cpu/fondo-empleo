"use server";
import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { participantes, planesMejoraVersiones, historialPlanesMejora, eventosVersionesPlan } from "@/db/schema";
import { exigir } from "@/lib/auth";
import { archivosDe, validarArchivo, CARPETA_ARCHIVOS, borrarArchivo } from "@/lib/archivos";
import { cambiosDeVersion } from "@/lib/eventos-versiones";
import { compararPlanes } from "@/lib/historial-plan";
import { planInicial, validarPlan, type ResultadoPlan } from "@/lib/plan-mejora";
import { errorPublicacion, type ArchivoPlan } from "@/lib/versiones-plan";
import { guardarContinuo } from "@/lib/archivo-continuo";
export async function guardarVersion(form: FormData) {
  const u = await exigir("capacitaciones");
  const id = Number(form.get("participanteId"));
  const volver = `/operativo/planes-mejora/${id}`;
  const cambios = String(form.get("cambios") ?? "").trim();
  const escaneados = archivosDe(form, "escaneado");
  const editables = archivosDe(form, "editable");
  const evidencias = archivosDe(form, "evidencias");
  let error = "";
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Beneficiario inválido");
  if (!cambios || cambios.length > 5000) error = "Describe los cambios de la versión.";
  if (!escaneados.length || !editables.length) error = "Adjunta el escaneado y el editable para publicar.";
  for (const f of [...escaneados, ...editables, ...evidencias]) error ||= validarArchivo(f) ?? "";
  if (error) redirect(`${volver}?error=${encodeURIComponent(error)}`);
  const archivos: {nombre: string; ruta: string; tipo: "escaneado" | "editable" | "evidencia"}[] = [];
  try {
    await db.transaction(async (tx) => {
      const [persona] = await tx.select({id: participantes.id, problemas: participantes.problemasMejora, plan: participantes.planMejora}).from(participantes).where(eq(participantes.id, id)).for("update");
      if (!persona) throw new Error("Beneficiario no encontrado");
      const [anterior] = await tx.select({problemas: planesMejoraVersiones.problemas}).from(planesMejoraVersiones).where(eq(planesMejoraVersiones.participanteId, id)).orderBy(sql`${planesMejoraVersiones.numero} desc`).limit(1);
      const problemas = persona.problemas ?? anterior?.problemas ?? [];
      const [ultima] = await tx.select({ numero: sql<number>`coalesce(max(${planesMejoraVersiones.numero}), 0)::int` }).from(planesMejoraVersiones).where(eq(planesMejoraVersiones.participanteId, id));
      for (const [tipo, lista] of [["escaneado", escaneados], ["editable", editables], ["evidencia", evidencias]] as const) {
        for (const f of lista) {
          const guardado = await guardarContinuo({ cuerpo: f.stream(), nombre: f.name, tamano: f.size, carpeta: `planes-mejora/${id}`, base: CARPETA_ARCHIVOS });
          archivos.push({nombre: f.name, ruta: guardado.archivo, tipo});
        }
      }
      await tx.insert(planesMejoraVersiones).values({ participanteId: id, numero: ultima.numero + 1, cambios, problemas, plan: persona.plan, archivos, autorId: u.id });
    });
  } catch (e) {
    await Promise.all(archivos.map((a) => borrarArchivo(a.ruta)));
    console.error("No se pudo guardar el plan", e);
    redirect(`${volver}?error=No%20se%20pudo%20guardar.%20Intenta%20nuevamente.`);
  }
  revalidatePath("/operativo/planes-mejora");
  revalidatePath(volver);
  redirect(`${volver}?guardado=1`);
}

export async function guardarProblemas(form: FormData) {
  await exigir("capacitaciones");
  const id=Number(form.get("participanteId"));
  if(!Number.isSafeInteger(id) || id<1) throw new Error("Beneficiario inválido");
  const problemas=[1,2,3].map((n)=>({texto:String(form.get(`problema${n}`) ?? "").trim()}));
  if(problemas.some((p)=>!p.texto || p.texto.length>500)) redirect(`/operativo/planes-mejora/${id}?error=Completa%20los%20tres%20problemas`);
  await db.update(participantes).set({problemasMejora:problemas}).where(eq(participantes.id,id));
  revalidatePath("/operativo/planes-mejora");
  revalidatePath(`/operativo/planes-mejora/${id}`);
  redirect(`/operativo/planes-mejora/${id}?problemasGuardados=1`);
}

export async function guardarEditorPlan(_prev:ResultadoPlan, form:FormData):Promise<ResultadoPlan> {
 const u=await exigir("capacitaciones");
 const id=Number(form.get("participanteId"));const revision=Number(form.get("revision"));
 if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(revision)||revision<0)return {error:"Beneficiario o revisión inválida."};
 const raw=String(form.get("plan") ?? "");if(raw.length>250000)return {error:"El plan supera el tamaño permitido."};
 let plan;
 try {plan=validarPlan(JSON.parse(raw));}catch(e){return {error:e instanceof SyntaxError ? "No se pudo leer el plan." : e instanceof Error ? e.message : "Plan inválido."};}
 try {
   const resultado=await db.transaction(async(tx):Promise<ResultadoPlan>=>{
     const [persona]=await tx.select().from(participantes).where(eq(participantes.id,id)).for("update");
     if(!persona)return {error:"Beneficiario no encontrado."};
     if(persona.planRevision!==revision)return {error:"El plan cambió en otra ventana. Copia tus cambios y recarga antes de guardar para no sobrescribirlos."};
     const [anterior]=persona.planMejora || persona.problemasMejora ? [] : await tx.select({problemas:planesMejoraVersiones.problemas}).from(planesMejoraVersiones).where(eq(planesMejoraVersiones.participanteId,id)).orderBy(sql`${planesMejoraVersiones.numero} desc`).limit(1);
     const antes=persona.planMejora ?? planInicial(persona.problemasMejora ?? anterior?.problemas ?? []);
     const cambios=compararPlanes(antes,plan);
     if(!cambios.length)return {ok:true,revision};
     await tx.update(participantes).set({planMejora:plan,problemasMejora:plan.problemas.map(p=>({texto:p.texto})),planRevision:revision+1}).where(eq(participantes.id,id));
     await tx.insert(historialPlanesMejora).values({participanteId:id,revision:revision+1,usuarioId:u.id,autor:u.nombre,antes,despues:plan,cambios});
     return {ok:true,revision:revision+1};
   });
   if(resultado.ok){revalidatePath("/operativo/planes-mejora");revalidatePath(`/operativo/planes-mejora/${id}`);}
   return resultado;
 }catch(e){console.error("No se pudo guardar el plan y su historial",e);return {error:"No se pudo guardar. Intenta nuevamente."};}
}

export async function prepararVersion(form:FormData) {
 const u=await exigir("capacitaciones");const id=Number(form.get("participanteId"));
 if(!Number.isSafeInteger(id)||id<1)throw Error("Beneficiario inválido");
 await db.transaction(async(tx)=>{
   const [p]=await tx.select().from(participantes).where(eq(participantes.id,id)).for("update");
   if(!p)throw Error("Beneficiario no encontrado");
   const [borrador]=await tx.select({id:planesMejoraVersiones.id}).from(planesMejoraVersiones).where(and(eq(planesMejoraVersiones.participanteId,id),eq(planesMejoraVersiones.estado,"preparacion")));
   if(borrador)return;
   const [ultima]=await tx.select({numero:sql<number>`coalesce(max(${planesMejoraVersiones.numero}),0)::int`}).from(planesMejoraVersiones).where(eq(planesMejoraVersiones.participanteId,id));
   const [previa]=await tx.select({problemas:planesMejoraVersiones.problemas}).from(planesMejoraVersiones).where(eq(planesMejoraVersiones.participanteId,id)).orderBy(sql`${planesMejoraVersiones.numero} desc`).limit(1);
   const [version]=await tx.insert(planesMejoraVersiones).values({participanteId:id,numero:ultima.numero+1,estado:"preparacion",cambios:"",archivos:[],problemas:p.problemasMejora ?? previa?.problemas ?? [],plan:p.planMejora,autorId:u.id}).returning({id:planesMejoraVersiones.id});
   await tx.insert(eventosVersionesPlan).values({participanteId:id,versionId:version.id,usuarioId:u.id,autor:u.nombre,cambios:cambiosDeVersion({operacion:"preparar",numero:ultima.numero+1,antes:{cambios:"",archivos:[]},despues:{cambios:"",archivos:[]}})});
 });
 revalidatePath(`/operativo/planes-mejora/${id}`);
 redirect(`/operativo/planes-mejora/${id}?preparacion=1#versiones-plan`);
}
export async function guardarPreparacion(_prev:{error?:string},form:FormData):Promise<{error?:string;ok?:boolean}> {
 const u=await exigir("capacitaciones");
 const id=Number(form.get("participanteId")),versionId=Number(form.get("versionId")),edicion=Number(form.get("edicion"));
 if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(versionId)||versionId<1||!Number.isSafeInteger(edicion)||edicion<0)return {error:"Versión inválida."};
 const descartar=form.get("operacion")==="descartar";
 const cambios=String(form.get("cambios") ?? "").trim();if(!descartar && cambios.length>5000)return {error:"El detalle admite hasta 5000 caracteres."};
 const publicar=form.get("operacion")==="publicar";
 const grupos=[["escaneado",archivosDe(form,"escaneado")],["editable",archivosDe(form,"editable")],["evidencia",archivosDe(form,"evidencias")]] as const;
 if(!descartar)for(const [,files] of grupos)for(const f of files){const err=validarArchivo(f);if(err)return {error:err};}
 const nuevos:ArchivoPlan[]=[];
 try {
   await db.transaction(async(tx)=>{
     const [p]=await tx.select().from(participantes).where(eq(participantes.id,id)).for("update");
     const [v]=await tx.select().from(planesMejoraVersiones).where(and(eq(planesMejoraVersiones.id,versionId),eq(planesMejoraVersiones.participanteId,id))).for("update");
     if(!p || !v)throw Error("No se encontró la preparación.");
     if(v.estado!=="preparacion")throw Error("Esta versión ya fue publicada. Recarga para verla.");
     if(v.edicion!==edicion)throw Error("La preparación cambió en otra ventana. Recarga antes de continuar.");
     if(descartar){await tx.update(planesMejoraVersiones).set({estado:"descartada",edicion:v.edicion+1,actualizadoEn:new Date()}).where(eq(planesMejoraVersiones.id,v.id));await tx.insert(eventosVersionesPlan).values({participanteId:id,versionId:v.id,usuarioId:u.id,autor:u.nombre,cambios:cambiosDeVersion({operacion:"descartar",numero:v.numero,antes:v,despues:v})});return;}
     // No se modifica ni reemplaza ningún adjunto previamente guardado.
     for(const [tipo,files] of grupos)for(const f of files){const r=await guardarContinuo({cuerpo:f.stream(),nombre:f.name,tamano:f.size,carpeta:`planes-mejora/${id}`,base:CARPETA_ARCHIVOS});nuevos.push({nombre:f.name,ruta:r.archivo,tipo});}
     const archivos=[...v.archivos,...nuevos];
     if(publicar){const err=errorPublicacion(cambios,archivos);if(err)throw Error(err);}
     const [vigente]=await tx.select({numero:planesMejoraVersiones.numero}).from(planesMejoraVersiones).where(and(eq(planesMejoraVersiones.participanteId,id),eq(planesMejoraVersiones.estado,"publicada"))).orderBy(sql`${planesMejoraVersiones.numero} desc`).limit(1);
     const eventos=cambiosDeVersion({operacion:publicar?"publicar":"guardar",numero:v.numero,antes:v,despues:{cambios,archivos},vigenteAnterior:vigente?.numero});
     if(eventos.length)await tx.insert(eventosVersionesPlan).values({participanteId:id,versionId:v.id,usuarioId:u.id,autor:u.nombre,cambios:eventos});
     await tx.update(planesMejoraVersiones).set({cambios,archivos,edicion:v.edicion+1,actualizadoEn:new Date(),...(publicar?{estado:"publicada",publicadoEn:new Date(),plan:p.planMejora,problemas:p.problemasMejora ?? v.problemas}:{})}).where(eq(planesMejoraVersiones.id,v.id));
   });
 }catch(e){await Promise.all(nuevos.map(a=>borrarArchivo(a.ruta)));console.error("No se pudo guardar la preparación",e);return {error:e instanceof Error && !('query' in e)?e.message:"No se pudo guardar. Intenta nuevamente."};}
 revalidatePath("/operativo/planes-mejora");revalidatePath(`/operativo/planes-mejora/${id}`);
 return {ok:true};
}
