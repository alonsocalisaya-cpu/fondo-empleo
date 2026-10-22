"use client";

import { useState } from "react";
import CampoFecha from "./CampoFecha";

/** Fechas visibles en formato peruano; mantiene el rango en orden al cambiar un extremo. */
export default function FiltrosFecha({ inicio, fin, prefijo, className }: { inicio: string; fin: string; prefijo: string; className?: string }) {
  const [desde, setDesde] = useState(inicio);
  const [hasta, setHasta] = useState(fin);
  return <>
    <div className={className}>
      <label htmlFor={`${prefijo}-desde`} className="etiqueta">Desde</label>
      <CampoFecha id={`${prefijo}-desde`} name="desde" value={desde} required onChange={(fecha) => {
        if (!fecha) return;
        setDesde(fecha);
        if (fecha > hasta) setHasta(fecha);
      }} />
    </div>
    <div className={className}>
      <label htmlFor={`${prefijo}-hasta`} className="etiqueta">Hasta</label>
      <CampoFecha id={`${prefijo}-hasta`} name="hasta" value={hasta} required onChange={(fecha) => {
        if (!fecha) return;
        setHasta(fecha);
        if (fecha < desde) setDesde(fecha);
      }} />
    </div>
  </>;
}
