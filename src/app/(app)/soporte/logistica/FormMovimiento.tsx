"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { registrarMovimiento } from "@/lib/acciones-inventario";

/** Registrar entrada / salida / ajuste de un ítem del inventario. */
export default function FormMovimiento({ insumoId, nombre }: { insumoId: number; nombre: string }) {
  const [res, enviar, enviando] = useActionState(registrarMovimiento, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const alEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => enviar(datos));
  };
  useEffect(() => {
    if (res?.ok) ref.current?.reset();
  }, [res]);

  return (
    <form ref={ref} onSubmit={alEnviar} className="flex flex-col gap-1">
      <input type="hidden" name="insumoId" value={insumoId} />
      <div className="flex flex-wrap gap-2">
        <select name="tipo" defaultValue="salida" aria-label={`Movimiento de ${nombre}`} className="campo w-32 py-1.5">
          <option value="entrada">Entrada</option>
          <option value="salida">Salida</option>
          <option value="ajuste">Ajuste (conteo)</option>
        </select>
        <input name="cantidad" type="number" min={0} required placeholder="Cant." aria-label={`Cantidad de ${nombre}`} className="campo w-20 py-1.5" />
        <input name="motivo" placeholder="Motivo / sesión / proveedor" aria-label={`Motivo del movimiento de ${nombre}`} className="campo w-52 py-1.5" />
        <button disabled={enviando} className="btn-secundario py-1.5 text-[13px]">{enviando ? "…" : "Registrar"}</button>
      </div>
      {res?.error && <p role="alert" className="text-xs text-[#991b1b]">{res.error}</p>}
      {res?.ok && <p role="status" className="text-xs text-[#166534]">{res.ok}</p>}
    </form>
  );
}
