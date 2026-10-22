"use client";

import { useState } from "react";

export default function FiltroPersonas({ personas, seleccionadas }: { personas: { id: string; nombre: string }[]; seleccionadas: string[] }) {
  const [elegidas, setElegidas] = useState(seleccionadas);
  const [busqueda, setBusqueda] = useState("");
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const visibles = personas.filter((p) => normalizar(p.nombre).includes(normalizar(busqueda.trim())));
  return <div>
    <span id="f-personas-etiqueta" className="etiqueta">Persona</span>
    <details className="relative z-40">
      <summary aria-labelledby="f-personas-etiqueta" className="campo cursor-pointer list-none">{elegidas.length ? `${elegidas.length} persona(s)` : "Todas las personas"} ▾</summary>
      <div className="absolute left-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border border-borde bg-white p-3 shadow-lg">
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar persona…" aria-label="Buscar persona en el selector" className="campo" />
        <div className="max-h-64 space-y-2 overflow-y-auto">{visibles.map((p) => <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={elegidas.includes(p.id)} onChange={(e) => setElegidas((lista) => e.target.checked ? [...lista, p.id] : lista.filter((id) => id !== p.id))} className="size-4 shrink-0 accent-marino" />{p.nombre}</label>)}{!visibles.length && <p className="text-xs text-texto-2">No se encontraron personas.</p>}</div>
        <button type="button" onClick={() => setElegidas([])} className="text-xs text-acento hover:underline">Quitar selección</button>
        <p className="text-xs text-texto-2">Selecciona una o varias personas y pulsa Filtrar. Sin selección se muestran todas.</p>
      </div>
    </details>
    {elegidas.map((id) => <input key={id} type="hidden" name="persona" value={id} />)}
  </div>;
}
