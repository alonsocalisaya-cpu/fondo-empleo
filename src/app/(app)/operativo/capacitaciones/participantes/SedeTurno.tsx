"use client";

import { useState, useTransition } from "react";
import { cambiarSedeTurno } from "@/lib/acciones-maestros";

type Opcion = { id: number; nombre: string };
const TURNOS = [
  { valor: "manana", texto: "Mañana" },
  { valor: "tarde", texto: "Tarde" },
  { valor: "ambos", texto: "Único / ambos" },
];

/** Cambia sede y turno de un beneficiario desde la misma fila de la tabla. */
export default function SedeTurno({ id, sedeId, turno, sedes }: { id: number; sedeId: number | null; turno: string | null; sedes: Opcion[] }) {
  const [sede, setSede] = useState(String(sedeId ?? ""));
  const [t, setT] = useState(turno ?? "ambos");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pendiente, iniciar] = useTransition();
  const cambiado = sede !== String(sedeId ?? "") || t !== (turno ?? "ambos");

  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        iniciar(async () => setMsg(await cambiarSedeTurno(undefined, fd)));
      }}
    >
      <input type="hidden" name="id" value={id} />
      <select name="sedeId" value={sede} onChange={(e) => (setSede(e.target.value), setMsg(undefined))} aria-label="Sede" className="campo w-auto py-1 text-[13px]">
        <option value="">Sin sede</option>
        {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <select name="turno" value={t} onChange={(e) => (setT(e.target.value), setMsg(undefined))} aria-label="Turno" className="campo w-auto py-1 text-[13px]">
        {TURNOS.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
      </select>
      {cambiado && (
        <button disabled={pendiente} className="btn-primario px-3 py-1 text-[13px]">{pendiente ? "Guardando…" : "Guardar"}</button>
      )}
      {msg?.error && <span role="alert" className="w-full text-xs text-[#b91c1c]">{msg.error}</span>}
      {msg?.ok && !cambiado && <span role="status" className="w-full text-xs text-acento-oscuro">✓ {msg.ok}</span>}
    </form>
  );
}
