"use client";

import { useId, useState } from "react";
import type { RecursoSesion } from "@/lib/recursos-sesion";

type TipoEquipoSolicitud = "Laptop" | "Proyector" | "Otro";
type FilaEquipo = { id: number; tipo: TipoEquipoSolicitud | ""; descripcion: string; cantidad: number; detalle: string };

export default function EquiposSolicitados({ iniciales = [], revision = false }: { iniciales?: RecursoSesion[]; revision?: boolean }) {
  const id = useId();
  const [filas, setFilas] = useState<FilaEquipo[]>(() => iniciales.map((r, i) => {
    const tipo = (["laptop", "proyector"].includes(r.descripcion.toLowerCase())
      ? r.descripcion[0].toUpperCase() + r.descripcion.slice(1).toLowerCase()
      : "Otro") as TipoEquipoSolicitud;
    return { id: i, tipo, descripcion: tipo === "Otro" ? r.descripcion : "", cantidad: r.cantidad, detalle: r.detalle ?? "" };
  }));
  const [siguiente, setSiguiente] = useState(filas.length);
  const [sinEquipos, setSinEquipos] = useState(revision && iniciales.length === 0);

  function actualizar(idFila: number, cambios: Partial<FilaEquipo>) {
    setFilas((actuales) => actuales.map((fila) => fila.id === idFila ? { ...fila, ...cambios } : fila));
  }

  return <fieldset className="space-y-3 rounded-lg border border-borde bg-[#f3f6fa] p-4">
    <legend className="px-1 text-sm font-semibold text-marino">Equipos de cómputo</legend>
    <p className="text-xs text-texto-2">Indica qué equipo necesitas y la cantidad. No se muestra disponibilidad de stock.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sinEquipos" value="si" checked={sinEquipos} onChange={(e) => setSinEquipos(e.target.checked)} />No necesito equipos de cómputo.</label>
    <fieldset disabled={sinEquipos} hidden={sinEquipos} className="space-y-3">
    {!filas.length && <p className="text-sm text-texto-2">No has agregado equipos de cómputo.</p>}
    {filas.map((fila, i) => <div key={fila.id} className="rounded-lg border border-borde bg-white p-3">
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_8rem_auto]">
        <div>
          <label htmlFor={`${id}-${fila.id}-tipo`} className="etiqueta">Equipo {i + 1}</label>
          <select id={`${id}-${fila.id}-tipo`} className="campo" value={fila.tipo} required onChange={(e) => {
            const tipo = e.target.value as TipoEquipoSolicitud | "";
            actualizar(fila.id, { tipo, descripcion: tipo === "Otro" ? fila.descripcion : "" });
          }}>
            <option value="">Selecciona un equipo</option>
            <option value="Laptop">Laptop</option>
            <option value="Proyector">Proyector</option>
            <option value="Otro">Otro</option>
          </select>
          {fila.tipo === "Otro"
            ? <input aria-label="Nombre de otro equipo" name="equipoDescripcion" value={fila.descripcion} onChange={(e) => actualizar(fila.id, { descripcion: e.target.value })} required maxLength={200} placeholder="Especifica el equipo" className="campo mt-2" />
            : <input type="hidden" name="equipoDescripcion" value={fila.tipo} />}
        </div>
        <div>
          <label htmlFor={`${id}-${fila.id}-cantidad`} className="etiqueta">Cantidad</label>
          <input id={`${id}-${fila.id}-cantidad`} name="equipoCantidad" type="number" min={1} step={1} required value={fila.cantidad} onChange={(e) => actualizar(fila.id, { cantidad: Number(e.target.value) })} className="campo" />
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor={`${id}-${fila.id}-detalle`} className="etiqueta">Detalle (opcional)</label>
        <input id={`${id}-${fila.id}-detalle`} name="equipoDetalle" value={fila.detalle} onChange={(e) => actualizar(fila.id, { detalle: e.target.value })} maxLength={1000} placeholder="Características o especificaciones del equipo" className="campo" />
      </div>
      <button type="button" className="btn-secundario mt-3" aria-label={`Quitar equipo ${i + 1}`} onClick={() => setFilas((actuales) => actuales.filter((x) => x.id !== fila.id))}>Quitar</button>
    </div>)}
    <button type="button" className="btn-secundario" onClick={() => {
      setFilas((actuales) => [...actuales, { id: siguiente, tipo: "", descripcion: "", cantidad: 1, detalle: "" }]);
      setSiguiente((n) => n + 1);
    }}>+ Agregar equipo de cómputo</button>
    </fieldset>
  </fieldset>;
}
