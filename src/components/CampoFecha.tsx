"use client";

import { useState } from "react";

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
export default function CampoFecha({ id, name, value, required = false }: { id: string; name: string; value?: string; required?: boolean }) {
  const [texto, setTexto] = useState(aLatina(value ?? ""));
  return <>
    <input type="hidden" name={name} value={aISO(texto)} />
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      value={texto}
      required={required}
      pattern="\\d{2}/\\d{2}/\\d{4}"
      title="Escribe la fecha como día/mes/año, por ejemplo 05/10/2026."
      className="campo"
      onChange={(e) => setTexto(e.target.value.replace(/[^\d/]/g, "").slice(0, 10))}
    />
  </>;
}
