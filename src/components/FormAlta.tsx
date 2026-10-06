"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

type Res = { ok?: string; error?: string } | undefined;
export type Campo = {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  inputMode?: "numeric" | "email" | "tel";
  opciones?: { valor: string; texto: string; grupo?: string }[]; // si se indica, el campo es un desplegable
  accept?: string; // para type="file"
  multiple?: boolean; // para type="file"
  ayuda?: string; // texto pequeño bajo el campo
};

/** Formulario genérico de alta (sedes, capacitadores, participantes). */
export default function FormAlta({
  titulo,
  campos,
  accion,
  boton = "Agregar",
}: {
  titulo: string;
  campos: Campo[];
  accion: (prev: Res, f: FormData) => Promise<Res>;
  boton?: string;
}) {
  const [res, enviar, enviando] = useActionState(accion, undefined);
  const ref = useRef<HTMLFormElement>(null);
  // onSubmit en lugar de action: así React no borra lo escrito si hay un error.
  const alEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => enviar(datos));
  };
  useEffect(() => {
    if (res?.ok) ref.current?.reset();
  }, [res]);

  return (
    <form ref={ref} onSubmit={alEnviar} className="card flex flex-col gap-3 border-dashed px-5 py-4">
      <h2 className="font-semibold text-marino">{titulo}</h2>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {campos.map((c) => (
          <div key={c.name}>
            <label htmlFor={`alta-${c.name}`} className="etiqueta">
              {c.label}{c.required ? " *" : ""}
            </label>
            {c.opciones ? (
              <select id={`alta-${c.name}`} name={c.name} required={c.required} className="campo">
                {[...new Set(c.opciones.map((o) => o.grupo ?? ""))].map((grupo) => {
                  const opciones = c.opciones!.filter((o) => (o.grupo ?? "") === grupo);
                  return grupo
                    ? <optgroup key={grupo} label={grupo}>{opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}</optgroup>
                    : opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>);
                })}
              </select>
            ) : (
              <input id={`alta-${c.name}`} name={c.name} required={c.required} type={c.type ?? "text"} inputMode={c.inputMode} accept={c.accept} multiple={c.multiple} className="campo" />
            )}
            {c.ayuda && <p className="mt-0.5 text-[11px] text-texto-2">{c.ayuda}</p>}
          </div>
        ))}
        <button disabled={enviando} className="btn-oscuro">{enviando ? "Guardando…" : boton}</button>
      </div>
      {res?.error && <p role="alert" className="text-sm text-[#991b1b]">{res.error}</p>}
      {res?.ok && <p role="status" className="text-sm text-[#166534]">{res.ok}</p>}
    </form>
  );
}
