"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export default function DesplegablePersistente({ titulo, children, className, cantidad, persistencia }: { titulo: ReactNode; children: ReactNode; className: string; cantidad?: string; persistencia?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const clave = useRef("");
  useLayoutEffect(() => {
    const proyecto = new URLSearchParams(window.location.search).get("proyecto") ?? "";
    clave.current = `repositorio:desplegable:${proyecto}:${persistencia ?? String(titulo)}`;
    try { if (ref.current) ref.current.open = sessionStorage.getItem(clave.current) === "abierto"; } catch { /* El desplegable sigue funcionando sin almacenamiento. */ }
  }, [titulo, persistencia]);
  return <details ref={ref} className={`group/desplegable overflow-hidden rounded-xl border border-[#dce4ee] bg-white ${className}`} onToggle={(e) => { if (!clave.current) return; try { sessionStorage.setItem(clave.current, e.currentTarget.open ? "abierto" : "cerrado"); } catch { /* Almacenamiento no disponible. */ } }}>
    <summary className="flex cursor-pointer list-none items-center gap-3 bg-[#f5f8fc] px-4 py-3 hover:bg-[#edf2f8]">
      <svg aria-hidden="true" className="shrink-0 text-texto-2 transition-transform group-open/desplegable:rotate-90" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 5 7 7-7 7" /></svg>
      <span className="min-w-0 flex-1 text-sm font-semibold text-marino">{titulo}</span>
      {cantidad && <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-texto-2">{cantidad}</span>}
    </summary>
    <div className="space-y-3 border-t border-borde p-3 sm:p-4">{children}</div>
  </details>;
}
