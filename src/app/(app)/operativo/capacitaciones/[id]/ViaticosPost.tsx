"use client";

import { useState } from "react";
import type { DatosLiquidacion } from "@/lib/liquidacion";

const TIPOS = ["Pasajes", "Alimentación", "Hospedaje", "Materiales", "Otros"];

export default function ViaticosPost({ inicial }: { inicial: DatosLiquidacion }) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [filas, setFilas] = useState(() => inicial.lineas.length ? inicial.lineas.map((l, id) => ({ id, tipo: l.descripcion === "Recursos" ? "Materiales" : TIPOS.includes(l.descripcion) ? l.descripcion : "Otros", monto: String(l.monto) })) : TIPOS.map((tipo, id) => ({ id, tipo, monto: "" })));
  const [siguiente, setSiguiente] = useState(filas.length);
  const total = filas.reduce((s, f) => s + Math.round((Number(f.monto) || 0) * 100), 0) / 100;
  const liquidacion = { ...inicial, nombre, lineas: filas.filter((f) => Number(f.monto) > 0).map((f) => ({ descripcion: f.tipo, monto: Number(f.monto), cantidad: null, unidad: "", comprobante: "", obs: "" })) };
  return <div className="space-y-3">
    <label className="etiqueta">Nombre de quien rinde los viáticos<input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="campo" /></label>
    <p className="text-xs text-texto-2">Selecciona el tipo de gasto e indica su importe en soles. Deja 0 si no hubo gasto.</p>
    {filas.map((f) => <div key={f.id} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
      <label className="etiqueta">Tipo de viático<select value={f.tipo} onChange={(e) => setFilas((l) => l.map((x) => x.id === f.id ? { ...x, tipo: e.target.value } : x))} className="campo">{TIPOS.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></label>
      <label className="etiqueta">Importe (S/)<input type="number" min={0} step="0.01" value={f.monto} placeholder="0.00" onChange={(e) => setFilas((l) => l.map((x) => x.id === f.id ? { ...x, monto: e.target.value } : x))} className="campo" /></label>
      {f.id >= TIPOS.length && <button type="button" className="btn-secundario" onClick={() => setFilas((l) => l.filter((x) => x.id !== f.id))}>Quitar</button>}
    </div>)}
    <button type="button" className="btn-secundario" onClick={() => { setFilas((l) => [...l, { id: siguiente, tipo: "Otros", monto: "" }]); setSiguiente((n) => n + 1); }}>+ Agregar gasto</button>
    <p className="rounded-lg bg-[#f3f6fa] p-3 font-semibold text-marino" aria-live="polite">Total de viáticos: S/ {total.toFixed(2)}</p>
    <input type="hidden" name="liquidacion" value={JSON.stringify(liquidacion)} />
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="viaticosConfirmados" value="si" required className="mt-1" />Confirmo los tipos, importes y total de viáticos registrados.</label>
  </div>;
}
