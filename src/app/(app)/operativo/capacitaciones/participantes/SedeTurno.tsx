"use client";

import { useState, useTransition } from "react";
import { cambiarSedeTurno } from "@/lib/acciones-maestros";

type Opcion = { id: number; nombre: string };

/** Cambia la sede desde la tabla y conserva la asignación interna del turno. */
export default function SedeTurno({ id, sedeId, turno, sedes }: { id: number; sedeId: number | null; turno: string | null; sedes: Opcion[] }) {
  const [sede, setSede] = useState(String(sedeId ?? ""));
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pendiente, iniciar] = useTransition();
  const cambiado = sede !== String(sedeId ?? "");

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
      <input type="hidden" name="turno" value={turno ?? "ambos"} />
      {cambiado && (
        <button disabled={pendiente} className="btn-primario px-3 py-1 text-[13px]">{pendiente ? "Guardando…" : "Guardar"}</button>
      )}
      {msg?.error && <span role="alert" className="w-full text-xs text-[#b91c1c]">{msg.error}</span>}
      {msg?.ok && !cambiado && <span role="status" className="w-full text-xs text-acento-oscuro">✓ {msg.ok}</span>}
    </form>
  );
}
