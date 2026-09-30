"use client";

import { useActionState, useState } from "react";

type Res = { ok?: string; error?: string } | undefined | void;

/**
 * Botón «Eliminar» con confirmación en dos pasos (sin ventanas emergentes).
 * La acción recibe los `campos` ocultos; si devuelve { error }, se muestra debajo.
 */
export default function BotonEliminar({
  accion,
  campos,
  etiqueta = "Eliminar",
  pregunta = "¿Eliminar definitivamente?",
  detalle,
  grande = false,
}: {
  accion: (f: FormData) => Promise<Res>;
  campos: Record<string, string | number>;
  etiqueta?: string;
  pregunta?: string;
  /** Qué más se borra o cambia al eliminar */
  detalle?: string;
  grande?: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [res, enviar, enviando] = useActionState(async (_p: Res, f: FormData) => (await accion(f)) ?? undefined, undefined);
  const base = grande ? "btn px-3 py-2 text-[13px]" : "text-[13px]";

  return (
    <form action={enviar} className="inline-flex flex-col items-end gap-1 text-right">
      {Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className={`${base} ${grande ? "border border-[#fecaca] bg-white text-[#991b1b] hover:bg-[#fef2f2]" : "text-texto-2 hover:text-[#991b1b]"}`}
        >
          {etiqueta}
        </button>
      ) : (
        <span role="group" aria-label="Confirmar eliminación" className="flex flex-col items-end gap-1 rounded-md border border-[#fecaca] bg-[#fef2f2] px-2 py-1.5">
          <span className="text-xs font-semibold text-[#991b1b]">{pregunta}</span>
          {detalle && <span className="max-w-64 text-[11px] text-[#991b1b]">{detalle}</span>}
          <span className="flex gap-2">
            <button type="button" onClick={() => setConfirmando(false)} className="text-xs text-texto-2 hover:underline">
              Cancelar
            </button>
            <button disabled={enviando} className="rounded bg-[#dc2626] px-2 py-0.5 text-xs font-semibold text-white hover:bg-[#b91c1c]">
              {enviando ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </span>
        </span>
      )}
      {res && "error" in res && res.error && <span role="alert" className="max-w-64 text-xs text-[#991b1b]">{res.error}</span>}
    </form>
  );
}
