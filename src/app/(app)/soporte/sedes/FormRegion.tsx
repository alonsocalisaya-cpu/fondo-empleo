"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { crearRegion } from "@/lib/acciones-maestros";

export default function FormRegion() {
  const [res, action, pendiente] = useActionState(crearRegion, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (res?.ok) ref.current?.reset(); }, [res]);
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(() => action(new FormData(e.currentTarget)));
  };
  return <form ref={ref} onSubmit={enviar} className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(16rem,2fr)_auto]">
    <div><label className="etiqueta" htmlFor="region-nombre">Región *</label><input id="region-nombre" name="nombre" required maxLength={120} placeholder="Ej. Cusco" className="campo" /></div>
    <div><label className="etiqueta" htmlFor="region-proyecto">Nombre del proyecto</label><input id="region-proyecto" name="proyecto" maxLength={500} placeholder="Opcional" className="campo" /></div>
    <button disabled={pendiente} className="btn-oscuro">{pendiente ? "Creando…" : "Crear región"}</button>
    {res?.error && <p role="alert" className="sm:col-span-3 text-sm text-red-700">{res.error}</p>}
    {res?.ok && <p role="status" className="sm:col-span-3 text-sm text-green-700">{res.ok}</p>}
  </form>;
}
