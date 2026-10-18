"use client";

import { useId, useState, type ReactNode } from "react";
import { MAX_ACTIVIDADES_VIAJE } from "@/lib/actividades-viaje";
import CampoFecha from "@/components/CampoFecha";

export default function ProgramaViaje({ plantillas, fecha }: { plantillas: ReactNode; fecha: string }) {
  const id = useId();
  const [corresponde, setCorresponde] = useState<boolean | null>(null);
  const [filas, setFilas] = useState([{ id: 0, actividad: "", descripcion: "", fecha, hora: "" }]);
  const [siguiente, setSiguiente] = useState(1);
  const actividades = filas.map(({ actividad, descripcion, fecha: dia, hora }) => ({ actividad, descripcion, fecha: dia, hora }));
  return <fieldset className="space-y-3">
    <legend className="mb-2 text-sm font-semibold">¿Corresponde presentar un programa de viaje?</legend>
    <label className="flex items-center gap-2 text-sm"><input type="radio" name="viajeCorresponde" value="si" required checked={corresponde === true} onChange={() => setCorresponde(true)} />Sí, presentar programa de viaje.</label>
    <label className="flex items-center gap-2 text-sm"><input type="radio" name="viajeCorresponde" value="no" required checked={corresponde === false} onChange={() => setCorresponde(false)} />No es necesario.</label>
    {corresponde && <div className="space-y-3">
      <section className="space-y-3 rounded-lg border border-borde p-4">
        <h4 className="font-semibold text-marino">Completar programa de viaje en Word</h4>
        <p className="rounded-lg border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]">El programa de viaje admite un máximo de <strong>{MAX_ACTIVIDADES_VIAJE} actividades</strong>. Actividades registradas: {filas.length}/{MAX_ACTIVIDADES_VIAJE}.</p>
        <div className="space-y-3">{filas.map((fila, i) => <div key={fila.id} className="grid gap-3 rounded-lg border border-borde p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_10rem_7rem]">
          <p className="text-left text-sm font-normal text-marino md:col-span-4">Actividad {i + 1}</p>
          <label className="etiqueta">Actividad<input required maxLength={120} value={fila.actividad} onChange={(e) => setFilas((l) => l.map((f) => f.id === fila.id ? { ...f, actividad: e.target.value } : f))} className="campo text-left font-normal" /></label>
          <label className="etiqueta">Descripción<textarea required maxLength={500} rows={2} value={fila.descripcion} onChange={(e) => setFilas((l) => l.map((f) => f.id === fila.id ? { ...f, descripcion: e.target.value } : f))} className="campo text-left font-normal" /></label>
          <div><label htmlFor={`${id}-fecha-${fila.id}`} className="etiqueta">Fecha</label><CampoFecha id={`${id}-fecha-${fila.id}`} name={`fecha-viaje-${fila.id}`} value={fila.fecha} required onChange={(dia) => setFilas((l) => l.map((f) => f.id === fila.id ? { ...f, fecha: dia } : f))} /></div>
          <label className="etiqueta">Hora<input type="time" required value={fila.hora} onChange={(e) => setFilas((l) => l.map((f) => f.id === fila.id ? { ...f, hora: e.target.value } : f))} className="campo" /></label>
          {filas.length > 1 && <button type="button" className="btn-secundario justify-self-start" onClick={() => setFilas((l) => l.filter((f) => f.id !== fila.id))}>Quitar actividad</button>}
        </div>)}</div>
        <button type="button" disabled={filas.length >= MAX_ACTIVIDADES_VIAJE} className="btn-secundario" onClick={() => { setFilas((l) => [...l, { id: siguiente, actividad: "", descripcion: "", fecha, hora: "" }]); setSiguiente((n) => n + 1); }}>+ Agregar actividad</button>
        <input type="hidden" name="actividadesViaje" value={JSON.stringify(actividades)} />
      </section>
      {plantillas}
    </div>}
  </fieldset>;
}
