"use client";
import { useRef } from "react";
export default function TarjetaArchivo({nombre,tipo,url,cambios,numero}: {nombre:string;tipo:string;url:string;cambios:string;numero:number}) {
 const dialogo=useRef<HTMLDialogElement>(null);
 const ext=nombre.split(".").pop()?.toLowerCase() || "archivo";
 const imagen=["jpg","jpeg","png"].includes(ext);
 const pdf=ext==="pdf";
 const vista=url+"&vista=1";
 function contenido(grande=false) {
   // eslint-disable-next-line @next/next/no-img-element
   if(imagen) return <img src={vista} alt={nombre} className={`w-full object-contain ${grande ? "max-h-[60vh]" : "h-20"}`}/>;
   if(pdf && grande) return <iframe src={vista} title={nombre} className="h-[60vh] w-full rounded border border-borde"/>;
   return <div className="flex h-20 flex-col items-center justify-center gap-2 bg-[#f7f9fc] text-marino"><svg width="24" height="28" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M4 1h10l6 6v20H4zM14 1v7h6M8 14h8M8 19h8"/></svg><span className="text-sm font-semibold uppercase">{ext}</span><span className="text-xs text-texto-2">{pdf ? "Vista previa en Ver más" : "Archivo para descargar"}</span></div>;
 }
 return <article className="flex min-w-0 flex-col">
   <div className="overflow-hidden rounded-lg border border-borde"><div className="bg-[#f7f9fc]">{contenido()}</div><h4 className="break-words border-t border-borde px-3 py-2 text-center text-sm font-semibold">{nombre}</h4></div>
   <span className="mt-3 text-xs text-texto-2">{tipo==="plan" ? "Documento del plan" : "Evidencia"} · Versión {numero}</span>
   <h5 className="mt-3 text-sm font-semibold">Detalles de versión</h5><p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-texto-2">{cambios}</p>
   <button type="button" onClick={()=>dialogo.current?.showModal()} className="btn-secundario mt-3 w-full justify-center">Ver más →</button>
   <dialog ref={dialogo} className="fixed inset-0 m-auto max-h-[90vh] w-[min(900px,94vw)] overflow-y-auto rounded-xl border border-borde bg-white p-5 shadow-xl backdrop:bg-black/50" onClick={(e)=>{if(e.target===e.currentTarget) dialogo.current?.close();}}>
     <header className="mb-4 flex items-start justify-between gap-4"><h3 className="min-w-0 break-words font-semibold">{nombre}</h3><button type="button" onClick={()=>dialogo.current?.close()} className="btn-secundario" aria-label="Cerrar detalle">Cerrar</button></header>
     {contenido(true)}<h4 className="mt-4 font-semibold">Detalles de versión {numero}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm">{cambios}</p><a href={url} className="btn-oscuro mt-5">Descargar archivo</a>
   </dialog>
 </article>;
}
