"use client";

import { useId, useState } from "react";
import type { RecursoSesion } from "@/lib/recursos-sesion";
import EquiposSolicitados from "./EquiposSolicitados";

export default function SolicitudRecursos({ iniciales = [], equiposIniciales = [], revision = false }: { iniciales?: RecursoSesion[]; equiposIniciales?: RecursoSesion[]; revision?: boolean }) {
  const id = useId();
  const [sinRecursos, setSinRecursos] = useState(revision && iniciales.length === 0);
  const [filas, setFilas] = useState(() => {
    const obligatorios = ["Gaseosas", "Galletas"].map((descripcion, i) => ({
      descripcion,
      cantidad: iniciales.find((r) => r.descripcion.toLowerCase() === descripcion.toLowerCase())?.cantidad ?? 1,
      unidad: "unidad",
      detalle: iniciales.find((r) => r.descripcion.toLowerCase() === descripcion.toLowerCase())?.detalle ?? "",
      id: i,
    }));
    const extras = iniciales.filter((r) => !["gaseosas", "galletas"].includes(r.descripcion.toLowerCase())).map((r, i) => ({ ...r, id: i + 2 }));
    return [...obligatorios, ...extras];
  });
  const [siguiente, setSiguiente] = useState(filas.length);
  return <div className="space-y-3">
    <p className="text-xs text-texto-2">{revision ? "Revisa las unidades de gaseosas y galletas. Puedes ajustar, agregar o quitar los recursos adicionales, o confirmar que no se necesitan recursos." : "Si necesitas recursos, indica las unidades de gaseosas y galletas, y agrega los demás materiales. Si no necesitas ninguno, marca la casilla."}</p>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="sinRecursos" value="si" checked={sinRecursos} onChange={(e) => setSinRecursos(e.target.checked)} />
      No necesito recursos de refrigerio ni materiales.
    </label>
    <fieldset disabled={sinRecursos} hidden={sinRecursos} className="space-y-3">
      {filas.map((r, i) => <div key={r.id} className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_auto]">
        <div><label htmlFor={`${id}-${r.id}-nombre`} className="etiqueta">{r.id < 2 ? "Recurso obligatorio" : `Recurso adicional ${i - 1}`}</label><input id={`${id}-${r.id}-nombre`} name="recursoDescripcion" defaultValue={r.descripcion} readOnly={r.id < 2} required maxLength={200} placeholder="Papelotes u otro material…" className="campo" /></div>
        <div><label htmlFor={`${id}-${r.id}-cantidad`} className="etiqueta">Unidades</label><input id={`${id}-${r.id}-cantidad`} name="recursoCantidad" type="number" min={1} step={1} defaultValue={r.cantidad} required className="campo" /></div>
        <div><label htmlFor={`${id}-${r.id}-detalle`} className="etiqueta">Detalles (opcional)</label><input id={`${id}-${r.id}-detalle`} name="recursoDetalle" defaultValue={r.detalle ?? ""} maxLength={1000} placeholder="Tamaño, características u observaciones…" className="campo" /></div>
        {r.id >= 2 && <button type="button" className="btn-secundario" aria-label={`Quitar recurso adicional ${i - 1}`} onClick={() => setFilas((f) => f.filter((x) => x.id !== r.id))}>Quitar</button>}
      </div>)}
      <button type="button" className="btn-secundario" onClick={() => { setFilas((f) => [...f, { id: siguiente, descripcion: "", cantidad: 1, unidad: "unidad" }]); setSiguiente((n) => n + 1); }}>+ Agregar recurso</button>
    </fieldset>
    <EquiposSolicitados iniciales={equiposIniciales} />
  </div>;
}
