"use client";
import { useRef, type ReactNode } from "react";
export default function SubirDocumento({children}: {children:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);
 return <><button type="button" className="btn-oscuro self-start" onClick={()=>ref.current?.showModal()}>+ Subir documento</button><dialog ref={ref} className="fixed inset-0 m-auto max-h-[90vh] w-[min(780px,94vw)] overflow-y-auto rounded-xl border border-borde bg-white p-6 shadow-xl backdrop:bg-black/50"><header className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-marino">Subir documento del plan</h2><button type="button" className="btn-secundario" onClick={()=>ref.current?.close()}>Cerrar</button></header><p className="mt-2 text-sm text-texto-2">Se guardará como una nueva versión. Las evidencias quedarán dentro de este documento.</p>{children}</dialog></>;
}
