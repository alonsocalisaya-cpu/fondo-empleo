"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type OpcionesConfirmacion = {
  titulo: string;
  mensaje: string;
  detalle?: string;
  aceptar?: string;
  cancelar?: string;
  peligro?: boolean;
};

function DialogoConfirmacion({ opciones, responder }: { opciones: OpcionesConfirmacion | null; responder: (aceptado: boolean) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (opciones && !dialogo.current?.open) {
      dialogo.current?.showModal();
      cancelar.current?.focus();
    } else if (!opciones && dialogo.current?.open) dialogo.current.close();
  }, [opciones]);
  return <dialog ref={dialogo} aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-mensaje`} onCancel={(e) => { e.preventDefault(); responder(false); }} onClose={() => responder(false)}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border-0 bg-white p-0 text-left shadow-2xl backdrop:bg-[#0f2a47]/50"
    onClick={(e) => {
      if (e.target !== e.currentTarget) return;
      const borde = e.currentTarget.getBoundingClientRect();
      if (e.clientX < borde.left || e.clientX > borde.right || e.clientY < borde.top || e.clientY > borde.bottom) responder(false);
    }}>
    {opciones && <>
      <div className="space-y-4 p-5 sm:p-6">
        <span aria-hidden="true" className={`inline-flex size-11 items-center justify-center rounded-xl ${opciones.peligro ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#eef3f8] text-marino"}`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 21h20L12 3z M12 9v5 M12 17h.01" /></svg></span>
        <h2 id={`${id}-titulo`} className="text-lg font-semibold text-marino">{opciones.titulo}</h2>
        <div id={`${id}-mensaje`} className="space-y-3 text-sm leading-relaxed"><p className="whitespace-pre-wrap break-words">{opciones.mensaje}</p>{opciones.detalle && <p className="rounded-xl bg-[#f5f8fc] p-3 text-texto-2">{opciones.detalle}</p>}</div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-borde bg-[#f8fafc] p-4 sm:flex-row sm:justify-end">
        <button ref={cancelar} type="button" onClick={() => responder(false)} className="btn-secundario min-h-11 justify-center px-5 py-2.5">{opciones.cancelar ?? "Cancelar"}</button>
        <button type="button" onClick={() => responder(true)} className={`min-h-11 rounded-lg px-5 py-2.5 text-sm font-semibold text-white ${opciones.peligro ? "bg-[#b91c1c] hover:bg-[#991b1b]" : "bg-marino hover:bg-marino-2"}`}>{opciones.aceptar ?? "Confirmar"}</button>
      </div>
    </>}
  </dialog>;
}

/** Renderiza `dialogo` junto al formulario y espera `confirmar(...)` antes de ejecutar una acción. */
export function useConfirmacion() {
  const [opciones, setOpciones] = useState<OpcionesConfirmacion | null>(null);
  const resolver = useRef<((aceptado: boolean) => void) | null>(null);
  const responder = useCallback((aceptado: boolean) => {
    const pendiente = resolver.current;
    if (!pendiente) return;
    resolver.current = null;
    setOpciones(null);
    pendiente(aceptado);
  }, []);
  const confirmar = useCallback((configuracion: OpcionesConfirmacion): Promise<boolean> => {
    if (resolver.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      resolver.current = resolve;
      setOpciones(configuracion);
    });
  }, []);
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);
  return { confirmar, dialogo: <DialogoConfirmacion opciones={opciones} responder={responder} /> };
}
