"use client";

import { useRef, useState } from "react";

function aLatina(iso: string) {
  const [anio, mes, dia] = iso.split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : "";
}

function aISO(latina: string) {
  const m = latina.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, dia, mes, anio] = m;
  const fecha = new Date(`${anio}-${mes}-${dia}T12:00:00Z`);
  return fecha.getUTCFullYear() === Number(anio) && fecha.getUTCMonth() + 1 === Number(mes) && fecha.getUTCDate() === Number(dia)
    ? `${anio}-${mes}-${dia}`
    : "";
}

/** Campo de fecha en formato peruano; internamente envía YYYY-MM-DD. */
export default function CampoFecha({ id, name, value, required = false, onChange }: { id: string; name: string; value?: string; required?: boolean; onChange?: (iso: string) => void }) {
  const [texto, setTexto] = useState(aLatina(value ?? ""));
  const calendario = useRef<HTMLInputElement>(null);
  const campoTexto = useRef<HTMLInputElement>(null);
  return <>
    <input type="hidden" name={name} value={aISO(texto)} />
    <div className="relative flex items-center gap-1">
    <input
      id={id}
      ref={campoTexto}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      value={texto}
      required={required}
      pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
      title="Escribe la fecha como día/mes/año, por ejemplo 05/10/2026."
      className="campo"
      onChange={(e) => {
        const texto = e.target.value.replace(/[^\d/]/g, "").slice(0, 10);
        setTexto(texto);
        onChange?.(aISO(texto));
        e.target.setCustomValidity(texto && !aISO(texto) ? "Escribe una fecha válida como día/mes/año, por ejemplo 05/10/2026." : "");
      }}
    />
    <button type="button" className="btn-secundario shrink-0 px-2" aria-label="Elegir fecha en el calendario" onClick={() => calendario.current?.showPicker()}>📅</button>
    <input ref={calendario} type="date" lang="es-PE" tabIndex={-1} aria-label="Calendario" value={aISO(texto)} className="pointer-events-none absolute right-0 bottom-0 h-px w-px opacity-0" onChange={(e) => { setTexto(aLatina(e.target.value)); campoTexto.current?.setCustomValidity(""); onChange?.(e.target.value); }} />
    </div>
  </>;
}
