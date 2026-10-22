"use client";

import { useState } from "react";

const ESTADOS = [
  { valor: "programada", texto: "Programada" },
  { valor: "confirmada", texto: "Confirmada" },
  { valor: "reprogramada", texto: "Reprogramada" },
  { valor: "finalizada", texto: "Finalizada" },
  { valor: "cancelada", texto: "Cancelada" },
];

export default function FiltroEstadosProgramacion({ seleccionados }: { seleccionados: string[] }) {
  const [elegidos, setElegidos] = useState(seleccionados);
  return <div>
    <span id="estados-programacion" className="etiqueta">Estados de programación</span>
    <details className="relative z-40">
      <summary aria-labelledby="estados-programacion" className="campo cursor-pointer list-none">{elegidos.length ? `${elegidos.length} seleccionado(s)` : "Todos los estados activos"} ▾</summary>
      <div className="absolute left-0 z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-borde bg-white p-3 shadow-lg">
        {ESTADOS.map(({ valor, texto }) => <label key={valor} className="flex cursor-pointer items-center gap-2 text-sm"><input name="estados" type="checkbox" value={valor} checked={elegidos.includes(valor)} onChange={(e) => setElegidos((lista) => e.target.checked ? [...lista, valor] : lista.filter((x) => x !== valor))} className="size-4 accent-marino" />{texto}</label>)}
        <button type="button" onClick={() => setElegidos([])} className="text-xs text-acento hover:underline">Quitar selección</button>
        <p className="text-xs text-texto-2">Sin selección se muestran todos, excepto canceladas. Selecciona Cancelada para incluirlas y pulsa Filtrar.</p>
      </div>
    </details>
  </div>;
}
