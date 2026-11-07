import type { PlanMejora } from "./plan-mejora";
export type SeccionPlan = "Problemas y objetivos" | "Presupuesto" | "Cronograma" | "Documentos y versiones";
export type CambioPlan = { seccion: SeccionPlan; campo: string; antes: string; despues: string };
type Campo = {seccion:SeccionPlan;campo:string;valor:string};
/** Identificadores estables: cambiar una meta no convierte todo el plan en un cambio. */
function campos(plan:PlanMejora) {
 const mapa=new Map<string,Campo>();
 const poner=(clave:string,seccion:SeccionPlan,campo:string,valor:unknown)=>mapa.set(clave,{seccion,campo,valor:String(valor ?? "").trim()});
 const nombreProblema=(id:string)=>{const i=plan.problemas.findIndex(p=>p.id===id);return i<0?"Sin vincular":`Problema ${i+1}: ${[plan.problemas[i].categoria,plan.problemas[i].texto].filter(Boolean).join(" · ") || "Sin descripción"}`;};
 plan.problemas.forEach((p,i)=>{
   const pref=`Problema ${i+1}`;const k=`p/${p.id}`;
   poner(k,"Problemas y objetivos",pref,p.texto || "Sin descripción");
   poner(k+"/categoria","Problemas y objetivos",`${pref} · Grupo`,p.categoria);
   poner(k+"/objetivo","Problemas y objetivos",`${pref} · Objetivo`,p.objetivo);
   poner(k+"/plazo","Problemas y objetivos",`${pref} · Plazo`,p.plazo);
   poner(k+"/estrategias","Problemas y objetivos",`${pref} · Estrategias`,[...p.estrategias].sort().join("; "));
   poner(k+"/recursos","Problemas y objetivos",`${pref} · Recursos`,[...p.recursos].sort().join("; "));
   p.indicadores.forEach((ind,j)=>{
     const titulo=`${pref} · Indicador ${j+1}`;const ik=k+`/i/${ind.id}`;
     poner(ik,"Problemas y objetivos",titulo,ind.nombre || "Sin nombre");
     ind.metas.forEach((m,n)=>{
       const mk=ik+`/m/${m.id}`;const mt=`${titulo} · Meta ${n+1}`;
       poner(mk,"Problemas y objetivos",mt,m.texto || "Sin descripción");
       poner(mk+"/valor","Problemas y objetivos",`${mt} · Valor`,m.valor);
       poner(mk+"/unidad","Problemas y objetivos",`${mt} · Unidad`,m.unidad);
     });
   });
 });
 plan.presupuesto.forEach((r,i)=>{
   const k=`r/${r.id}`,pref=`Recurso ${i+1}: ${r.nombre || "Sin nombre"}`;
   poner(k,"Presupuesto",`Recurso ${i+1}`,r.nombre || "Sin nombre");
   poner(k+"/problema","Presupuesto",`${pref} · Problema`,r.problemaId);
   // La clave de vínculo usa el ID y la presentación se resuelve al comparar.
   poner(k+"/cantidad","Presupuesto",`${pref} · Cantidad`,r.cantidad);
   poner(k+"/costo","Presupuesto",`${pref} · Costo unitario (S/)`,r.costo);
   poner(k+"/fuente","Presupuesto",`${pref} · Financiamiento`,r.fuente==="propios"?"Recursos propios":"Financiamiento externo");
 });
 poner("inicio","Cronograma","Mes de inicio",plan.inicio ? `${plan.inicio.slice(5)}/${plan.inicio.slice(0,4)}` : "");
 plan.actividades.forEach((a,i)=>{
   const k=`a/${a.id}`,pref=`Actividad ${i+1}: ${a.nombre || "Sin nombre"}`;
   poner(k,"Cronograma",`Actividad ${i+1}`,a.nombre || "Sin nombre");
   poner(k+"/problema","Cronograma",`${pref} · Problema`,a.problemaId);
   poner(k+"/meses","Cronograma",`${pref} · Meses`,[...a.meses].sort((a,b)=>a-b).map(m=>`Mes ${m}`).join(", "));
   poner(k+"/responsable","Cronograma",`${pref} · Responsable`,a.responsable);
 });
 return {mapa,nombreProblema};
}
export function compararPlanes(antes:PlanMejora,despues:PlanMejora):CambioPlan[]{
 const a=campos(antes),d=campos(despues);const cambios:CambioPlan[]=[];
 for(const k of new Set([...a.mapa.keys(),...d.mapa.keys()])){
   const av=a.mapa.get(k),dv=d.mapa.get(k);const v1=av?.valor ?? "",v2=dv?.valor ?? "";
   if(v1===v2)continue;
   const dato=dv ?? av!;
   const vinculo=k.endsWith("/problema");
   cambios.push({seccion:dato.seccion,campo:dato.campo,antes:vinculo && v1 ? a.nombreProblema(v1):v1,despues:vinculo && v2 ? d.nombreProblema(v2):v2});
 }
 return cambios;
}
