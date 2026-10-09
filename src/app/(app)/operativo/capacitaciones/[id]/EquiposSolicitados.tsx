"use client";

import { useId, useState } from "react";
import type { RecursoSesion } from "@/lib/recursos-sesion";

export default function EquiposSolicitados({ iniciales = [] }: { iniciales?: RecursoSesion[] }) {
  const id = useId();
  const [filas, setFilas] = useState(() => [
    ...["Laptop", "Proyector"].map((descripcion, i) => ({ id: i, descripcion, cantidad: iniciales.find((r) => r.descripcion.toLowerCase() === descripcion.toLowerCase())?.cantidad ?? 0, detalle: iniciales.find((r) => r.descripcion.toLowerCase() === descripcion.toLowerCase())?.detalle ?? "" })),
    ...iniciales.filter((r) => !["laptop", "proyector"].includes(r.descripcion.toLowerCase())).map((r, i) => ({ ...r, id: i + 2 })),
  ]);
  const [siguiente, setSiguiente] = useState(filas.length);
  return <fieldset className="space-y-3 rounded-lg border border-borde bg-[#f3f6fa] p-4">
    <legend className="px-1 text-sm font-semibold text-marino">Equipos de cómputo</legend>
    <p className="text-xs text-texto-2">Indica las unidades de laptop, proyector u otros equipos. Deja 0 en los equipos que no necesites.</p>
    {filas.map((r, i) => <div key={r.id} className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_auto]">
      <div><label htmlFor={`${id}-${r.id}-nombre`} className="etiqueta">{r.id < 2 ? "Equipo" : `Equipo adicional ${i - 1}`}</label><input id={`${id}-${r.id}-nombre`} name="equipoDescripcion" defaultValue={r.descripcion} readOnly={r.id < 2} required maxLength={200} placeholder="Otro equipo…" className="campo" /></div>
      <div><label htmlFor={`${id}-${r.id}-cantidad`} className="etiqueta">Unidades</label><input id={`${id}-${r.id}-cantidad`} name="equipoCantidad" type="number" min={0} step={1} required defaultValue={r.cantidad} className="campo" /></div>
      <div><label htmlFor={`${id}-${r.id}-detalle`} className="etiqueta">Detalles (opcional)</label><input id={`${id}-${r.id}-detalle`} name="equipoDetalle" defaultValue={r.detalle ?? ""} maxLength={1000} placeholder="Características, conexiones u observaciones…" className="campo" /></div>
      {r.id >= 2 && <button type="button" className="btn-secundario" aria-label={`Quitar equipo adicional ${i - 1}`} onClick={() => setFilas((f) => f.filter((x) => x.id !== r.id))}>Quitar</button>}
    </div>)}
    <button type="button" className="btn-secundario" onClick={() => { setFilas((f) => [...f, { id: siguiente, descripcion: "", cantidad: 1, detalle: "" }]); setSiguiente((n) => n + 1); }}>+ Agregar equipo</button>
  </fieldset>;
}
