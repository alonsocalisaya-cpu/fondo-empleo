"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
const ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.odp,.odt,.jpg,.jpeg,.png,.heic,.zip,.rar,.mp4,.mov,.avi,.3gp";
function Guardar() { const {pending}=useFormStatus(); return <button disabled={pending} className="btn-oscuro">{pending ? "Subiendo y guardando…" : "Subir documento"}</button>; }
function VistaSeleccionada({archivo}: {archivo:File}) {
 const imagen=useRef<HTMLImageElement>(null);
 useEffect(()=>{const u=URL.createObjectURL(archivo);if(imagen.current) imagen.current.src=u;return ()=>URL.revokeObjectURL(u);},[archivo]);
 // eslint-disable-next-line @next/next/no-img-element
 return archivo.type.startsWith("image/") ? <img ref={imagen} alt={archivo.name} className="size-11 rounded-md object-cover"/> : <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#e9f1f8] text-[10px] font-bold uppercase text-[#4472a0]">{archivo.name.split(".").pop()}</div>;
}
export function CampoArchivo({name,titulo,multiple=false,compacto=false,alCambiarCantidad}: {name:string;titulo:string;multiple?:boolean;compacto?:boolean;alCambiarCantidad?:(n:number)=>void}) {
 const ref=useRef<HTMLInputElement>(null);
 const [archivos,setArchivos]=useState<File[]>([]);
 const {pending}=useFormStatus();
 const [arrastrando,setArrastrando]=useState(false);
 function seleccionar(elegidos:File[]) {
   if(pending) return;
   const nuevos=multiple ? [...archivos,...elegidos].filter((f,i,l)=>l.findIndex((x)=>x.name===f.name && x.size===f.size && x.lastModified===f.lastModified)===i) : elegidos.slice(0,1);
   const datos=new DataTransfer();nuevos.forEach((f)=>datos.items.add(f));if(ref.current) ref.current.files=datos.files;setArchivos(nuevos);alCambiarCantidad?.(nuevos.length);
 }
 function quitar(indice:number) {
   const nuevos=archivos.filter((_,i)=>i!==indice);
   const datos=new DataTransfer(); nuevos.forEach((a)=>datos.items.add(a));
   if(ref.current) ref.current.files=datos.files;
   setArchivos(nuevos);alCambiarCantidad?.(nuevos.length);
 }
 return <div className="min-w-0">
   <div onDragOver={(e)=>{e.preventDefault();if(!pending)setArrastrando(true);}} onDragLeave={()=>setArrastrando(false)} onDrop={(e)=>{e.preventDefault();setArrastrando(false);seleccionar(Array.from(e.dataTransfer.files));}} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed ${compacto?"p-2":"p-4"} transition-colors ${arrastrando ? "border-marino bg-[#eaf1fa]" : "border-[#ccd7e5] bg-[#f8fafc]"}`}>
     <div hidden={compacto}><p className="text-sm font-medium text-marino">{titulo}</p><p className="mt-1 text-xs text-texto-2">{multiple ? "Arrastra tus archivos aquí o selecciónalos." : "Arrastra tu documento aquí o selecciónalo."}</p></div>
     <button type="button" disabled={pending} onClick={()=>ref.current?.click()} className="btn-secundario px-4 py-2 text-sm">{compacto ? `+ Adjuntar ${titulo.toLowerCase()}` : multiple ? "+ Agregar archivos" : "+ Agregar documento"}</button>
     <input ref={ref} id={name} name={name} aria-label={titulo} type="file" multiple={multiple} disabled={pending} accept={ACCEPT} className="sr-only" onChange={(e)=>seleccionar(Array.from(e.target.files ?? []))}/>
   </div>
   <p hidden={compacto} className="mt-2 text-[11px] text-texto-2">{multiple ? name === "evidencias" ? "Fotos, documentos o videos · Opcional" : name === "escaneado" ? "Documento escaneado del plan" : "Archivo fuente del plan, por ejemplo Word o Excel" : "Adjunta el documento de esta versión"}</p>
   <div className="mt-3 flex flex-wrap items-start gap-2" aria-live="polite">
     {archivos.map((a,i)=><article key={`${i}-${a.name}`} className="w-full max-w-[320px] rounded-lg border border-borde bg-white p-2.5 shadow-sm"><div className="flex items-center gap-2.5"><VistaSeleccionada archivo={a}/><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-marino" title={a.name}>{a.name}</p><p className="mt-0.5 text-[11px] text-texto-2">{a.size<1024*1024 ? `${Math.ceil(a.size/1024)} KB` : `${(a.size/1024/1024).toFixed(1)} MB`}</p></div><button type="button" disabled={pending} onClick={()=>quitar(i)} aria-label={`Quitar ${a.name}`} title="Quitar archivo" className="flex size-7 shrink-0 items-center justify-center rounded-full text-texto-2 hover:bg-red-50 hover:text-red-700">×</button></div></article>)}
   </div>
 </div>;
}
export default function FormularioVersion({participanteId,accion,inicial}: {participanteId:number;accion:(f:FormData)=>Promise<void>;inicial:boolean}) {
 const [cambios,setCambios]=useState("");
 return <form action={accion} className="mt-5 space-y-5"><input type="hidden" name="participanteId" value={participanteId}/>

 <p className="text-xs text-texto-2">Adjunta el escaneado y el editable. Las evidencias son opcionales.</p><div className="grid items-start gap-4"><CampoArchivo name="escaneado" titulo="Escaneado" multiple/><CampoArchivo name="editable" titulo="Editable" multiple/><CampoArchivo name="evidencias" titulo="Evidencias (opcional)" multiple/></div>
 <label className="block"><span className="etiqueta">{inicial ? "Descripción del plan inicial *" : "¿Qué cambió respecto a la versión anterior? *"}</span><textarea required name="cambios" value={cambios} onChange={(e)=>setCambios(e.target.value)} maxLength={5000} rows={3} className="campo w-full" placeholder={inicial ? "Describe el punto de partida y las mejoras propuestas" : "Cuenta las mejoras o ajustes realizados"}/></label><div className="border-t border-borde pt-4"><Guardar/></div>
 </form>;
}
