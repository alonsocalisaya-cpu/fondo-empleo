import type { CambioPlan } from "./historial-plan";
import type { ArchivoPlan } from "./versiones-plan";
export function cambiosDeVersion({operacion,numero,antes,despues,vigenteAnterior}:{operacion:"preparar"|"guardar"|"publicar"|"descartar";numero:number;antes:{cambios:string;archivos:ArchivoPlan[]};despues:{cambios:string;archivos:ArchivoPlan[]};vigenteAnterior?:number}):CambioPlan[]{
 const seccion="Documentos y versiones" as const;const cambios:CambioPlan[]=[];
 if(operacion==="preparar")return [{seccion,campo:`Preparó la versión ${numero}`,antes:"",despues:"En preparación"}];
 if(operacion==="descartar")return [{seccion,campo:`Descartó la preparación de la versión ${numero}`,antes:`En preparación · ${antes.archivos.length} adjuntos`,despues:"Preparación descartada. El plan vigente se conserva."}];
 if(operacion==="publicar")return [{seccion,campo:`Publicó la versión ${numero} como vigente`,antes:vigenteAnterior?`Vigente: versión ${vigenteAnterior}`:"Sin plan vigente",despues:`Vigente: versión ${numero}`}];
 if(antes.cambios!==despues.cambios)cambios.push({seccion,campo:`Versión ${numero} · Editó el detalle de cambios`,antes:antes.cambios,despues:despues.cambios});
 for(const [tipo,nombre] of [["escaneado","escaneado"],["editable","editable"],["evidencia","evidencias"]] as const){const nuevos=despues.archivos.filter(a=>a.tipo===tipo&&!antes.archivos.some(x=>x.ruta===a.ruta));if(nuevos.length)cambios.push({seccion,campo:`Versión ${numero} · Adjuntó ${nombre} (${nuevos.length})`,antes:antes.archivos.filter(a=>a.tipo===tipo).map(a=>a.nombre).join("\n"),despues:despues.archivos.filter(a=>a.tipo===tipo).map(a=>a.nombre).join("\n")});}
 return cambios;
}
