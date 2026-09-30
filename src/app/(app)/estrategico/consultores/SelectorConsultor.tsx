"use client";

import { useState, useTransition } from "react";
import { asignarAsistente, asignarConsultor } from "./actions";

type Opcion = { id: number; nombre: string; ocupado: boolean };

export default function SelectorConsultor({
  programacionId,
  actual,
  opciones,
  etiqueta,
  rol = "capacitador",
}: {
  rol?: "capacitador" | "asistente";
  programacionId: number;
  actual: number | null;
  opciones: Opcion[];
  etiqueta: string;
}) {
  const [valor, setValor] = useState(actual ? String(actual) : "");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const cambiar = (nuevo: string) => {
    const anterior = valor;
    setValor(nuevo);
    setError(null);
    setGuardado(false);
    iniciar(async () => {
      const r = await (rol === "asistente" ? asignarAsistente : asignarConsultor)(programacionId, nuevo ? Number(nuevo) : null);
      if (r.error) {
        setError(r.error);
        setValor(anterior);
      } else {
        setGuardado(true);
      }
    });
  };

  return (
    <div className="flex min-w-56 flex-col gap-1">
      <select
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        disabled={pendiente}
        aria-label={etiqueta}
        className={`campo py-2 ${valor ? "" : "border-[#fca5a5] bg-[#fef2f2]"}`}
      >
        <option value="">{rol === "asistente" ? "— Sin asistente —" : "— Sin consultor —"}</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}{o.ocupado && String(o.id) !== valor ? " (cruce de horario)" : ""}
          </option>
        ))}
      </select>
      <span aria-live="polite" className="min-h-4 text-xs">
        {pendiente && <span className="text-texto-2">Guardando…</span>}
        {error && <span className="text-[#991b1b]">{error}</span>}
        {guardado && !pendiente && <span className="text-[#166534]">✓ Guardado</span>}
      </span>
    </div>
  );
}
