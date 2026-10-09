"use client";

import { useState } from "react";

export default function MaterialesAdicionales() {
  const [filas, setFilas] = useState<number[]>([]);
  const [siguiente, setSiguiente] = useState(0);

  const agregar = () => {
    setFilas((actuales) => [...actuales, siguiente]);
    setSiguiente((actual) => actual + 1);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-[13px] font-semibold text-marino">Material adicional para el asistente (opcional)</legend>
      <p className="text-xs text-texto-2">Agrega una fila por cada material que necesites y especifica la cantidad.</p>
      {filas.map((fila, indice) => (
        <div key={fila} className="grid grid-cols-[minmax(0,1fr)_auto_8rem_2.5rem] items-center gap-2">
          <p className="col-span-4 text-xs font-semibold text-marino">Material {indice + 1}</p>
          <label htmlFor={`material-adicional-${fila}`} className="sr-only">Descripción del material {indice + 1}</label>
          <input id={`material-adicional-${fila}`} name="materialAdicional" maxLength={200} placeholder="Describe el material" className="campo min-w-0 py-2" />
          <span aria-hidden="true" className="text-sm font-semibold text-texto-2">×</span>
          <label htmlFor={`cantidad-adicional-${fila}`} className="sr-only">Cantidad del material {indice + 1}</label>
          <input id={`cantidad-adicional-${fila}`} name="cantidadAdicional" type="number" min={1} step={1} placeholder="Cantidad" className="campo min-w-0 py-2" />
          <button type="button" onClick={() => setFilas((actuales) => actuales.filter((id) => id !== fila))} className="flex size-10 items-center justify-center rounded-md border border-borde text-texto-2 hover:border-[#fecaca] hover:bg-[#fef2f2] hover:text-[#991b1b]" aria-label={`Quitar material ${indice + 1}`} title="Quitar material">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2m3 0-.9 14H5.9L5 6m4 4v6m6-6v6" />
            </svg>
          </button>
        </div>
      ))}
      <button type="button" onClick={agregar} className="btn-secundario self-start py-2 text-[13px]">
        + Agregar otro material
      </button>
    </fieldset>
  );
}
