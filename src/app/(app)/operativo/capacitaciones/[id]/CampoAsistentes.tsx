"use client";

import { useState } from "react";

/** N.° de asistentes de la sesión con el % de asistencia calculado sobre los programados. */
export default function CampoAsistentes({ programados, inicial }: { programados: number; inicial: number | null }) {
  const [n, setN] = useState<string>(inicial !== null ? String(inicial) : "");
  const num = Number(n);
  const pct = programados && n !== "" ? Math.round((num * 100) / programados) : null;
  return (
    <div className="flex flex-wrap items-end gap-3 text-[13px]">
      <div>
        <span className="etiqueta">Programados</span>
        <span className="block rounded-lg border border-borde bg-[#f8fafc] px-3 py-2 font-semibold">{programados}</span>
      </div>
      <div>
        <label htmlFor="f2-asistentes" className="etiqueta">Asistentes *</label>
        <input
          id="f2-asistentes"
          name="asistentes"
          type="number"
          min={0}
          required
          value={n}
          onChange={(e) => setN(e.target.value)}
          className="campo w-24 py-2"
        />
      </div>
      <div>
        <span className="etiqueta">% de asistencia</span>
        <span className={`block rounded-lg border px-3 py-2 font-bold ${pct === null ? "border-borde text-texto-2" : pct >= 80 ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]" : "border-[#fca5a5] bg-[#fef2f2] text-[#991b1b]"}`}>
          {pct === null ? "—" : `${pct}%`}
        </span>
      </div>
    </div>
  );
}
