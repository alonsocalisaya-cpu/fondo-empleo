"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { guardarAsistencia, inscribirParticipante, quitarInscripcion } from "../actions";

type Estado = "presente" | "tarde" | "ausente" | "justificado";

export type FilaAsistencia = {
  participanteId: number;
  nombre: string;
  dni: string;
  area: string | null;
  estado: Estado | null;
  horaIngreso: string | null;
  observacion: string | null;
  notaEntrada: number | null;
  notaSalida: number | null;
};

type Examen = "entrada" | "salida" | "ambos" | null;

const OPCIONES: { v: Estado; txt: string; on: string }[] = [
  { v: "presente", txt: "Presente", on: "bg-[#166534] text-white" },
  { v: "tarde", txt: "Tarde", on: "bg-[#b45309] text-white" },
  { v: "ausente", txt: "Ausente", on: "bg-[#991b1b] text-white" },
  { v: "justificado", txt: "Justif.", on: "bg-[#334155] text-white" },
];

function Aviso({ r }: { r: { ok?: string; error?: string } | undefined }) {
  if (!r) return null;
  return r.error ? (
    <p role="alert" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-2.5 text-sm text-[#991b1b]">{r.error}</p>
  ) : (
    <p role="status" className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-2.5 text-sm text-[#166534]">{r.ok}</p>
  );
}

export default function ListaAsistencia({
  programacionId,
  filas,
  cerrada,
  examen = null,
}: {
  programacionId: number;
  filas: FilaAsistencia[];
  cerrada: boolean;
  /** Si la sesión tiene examen, se piden las notas en la misma lista */
  examen?: Examen;
}) {
  const notas: { k: "ne" | "ns"; campo: "notaEntrada" | "notaSalida"; t: string }[] = [
    ...(examen === "entrada" || examen === "ambos" ? [{ k: "ne" as const, campo: "notaEntrada" as const, t: "Nota entrada" }] : []),
    ...(examen === "salida" || examen === "ambos" ? [{ k: "ns" as const, campo: "notaSalida" as const, t: "Nota salida" }] : []),
  ];
  const [estados, setEstados] = useState<Record<number, Estado | null>>(
    Object.fromEntries(filas.map((f) => [f.participanteId, f.estado])),
  );
  const [buscar, setBuscar] = useState("");
  const [res, guardar, guardando] = useActionState(guardarAsistencia, undefined);
  const [resIns, inscribir, inscribiendo] = useActionState(inscribirParticipante, undefined);

  const formIns = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resIns?.ok) formIns.current?.reset();
  }, [resIns]);
  const alInscribir = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => inscribir(datos));
  };

  // onSubmit (y no action) para que React no borre horas/observaciones si hay un error.
  const alGuardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const boton = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (boton?.name === "quitar") {
      const datos = new FormData();
      datos.set("programacionId", String(programacionId));
      datos.set("quitar", boton.value);
      startTransition(() => quitarInscripcion(datos));
      return;
    }
    const datos = new FormData(e.currentTarget, boton);
    startTransition(() => guardar(datos));
  };

  const valores = filas.map((f) => estados[f.participanteId] ?? null);
  const cuenta = (e: Estado) => valores.filter((v) => v === e).length;
  const marcados = valores.filter(Boolean).length;
  const pct = filas.length ? Math.round(((cuenta("presente") + cuenta("tarde")) * 100) / filas.length) : 0;
  const coincide = (f: FilaAsistencia) =>
    `${f.nombre} ${f.dni}`.toLowerCase().includes(buscar.trim().toLowerCase());

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Presentes", cuenta("presente"), "text-[#166534]"],
          ["Tardanzas", cuenta("tarde"), "text-[#92400e]"],
          ["Ausentes", cuenta("ausente"), "text-[#991b1b]"],
          ["Sin marcar", filas.length - marcados, "text-texto-2"],
          ["Asistencia", `${pct}%`, "text-marino"],
        ].map(([t, n, c]) => (
          <div key={t as string} className="card flex flex-col gap-0.5 px-4 py-3.5">
            <span className="text-xs text-texto-2">{t}</span>
            <span className={`text-[26px] font-bold ${c}`}>{n}</span>
          </div>
        ))}
      </section>

      {notas.length > 0 && (
        <p className="rounded-lg border border-[#bfe3da] bg-[#eef8f5] px-4 py-2.5 text-[13px] text-acento-oscuro">
          📝 Esta sesión tiene <strong>examen de {examen === "ambos" ? "entrada y salida" : examen}</strong>: registra la nota (0 a 20) de cada
          participante que asistió, en la misma lista.
        </p>
      )}

      <form onSubmit={alGuardar} className="card flex flex-col">
        <input type="hidden" name="programacionId" value={programacionId} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <label htmlFor="buscar" className="text-[13px] text-texto-2">Buscar participante</label>
            <input id="buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre o DNI" className="campo w-64 py-2" />
          </div>
          {!cerrada && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secundario py-2"
                onClick={() => setEstados((prev) => Object.fromEntries(filas.map((f) => [f.participanteId, prev[f.participanteId] ?? "presente"])))}
              >
                Marcar sin marcar como presentes
              </button>
              <button disabled={guardando} className="btn-oscuro py-2">{guardando ? "Guardando…" : "Guardar"}</button>
              <button disabled={guardando} name="cerrar" value="1" className="btn-primario py-2">Guardar y cerrar lista</button>
            </div>
          )}
        </div>
        {res && <div className="px-5 pt-3"><Aviso r={res} /></div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th className="th w-12">N°</th><th className="th">Participante</th><th className="th">DNI</th>
                <th className="th">Área</th><th className="th">Estado</th>
                {notas.map((n) => <th key={n.k} className="th whitespace-nowrap">{n.t}</th>)}
                <th className="th">Observación</th>{!cerrada && <th className="th"><span className="sr-only">Quitar</span></th>}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={7 + notas.length} className="td py-10 text-center text-texto-2">Aún no hay participantes inscritos en esta sesión.</td></tr>
              )}
              {filas.map((f, i) => {
                const e = estados[f.participanteId];
                return (
                  <tr key={f.participanteId} className={coincide(f) ? "" : "hidden"}>
                    <td className="td text-texto-2">
                      {i + 1}
                      <input type="hidden" name="participanteId" value={f.participanteId} />
                    </td>
                    <td className="td font-medium">{f.nombre}</td>
                    <td className="td text-[#334155]">{f.dni}</td>
                    <td className="td text-[#334155]">{f.area ?? "—"}</td>
                    <td className="td">
                      <fieldset disabled={cerrada} className="inline-flex overflow-hidden rounded-lg border border-borde-fuerte">
                        <legend className="sr-only">Estado de {f.nombre}</legend>
                        {OPCIONES.map((o, k) => (
                          <label
                            key={o.v}
                            className={`cursor-pointer px-3 py-2 text-[13px] has-focus-visible:outline-2 has-focus-visible:outline-marino-2 ${
                              k ? "border-l border-borde-fuerte" : ""
                            } ${e === o.v ? `${o.on} font-semibold` : "bg-white text-[#334155] hover:bg-fondo"}`}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              name={`estado_${f.participanteId}`}
                              value={o.v}
                              checked={e === o.v}
                              onChange={() => setEstados((p) => ({ ...p, [f.participanteId]: o.v }))}
                            />
                            {o.txt}
                          </label>
                        ))}
                      </fieldset>
                    </td>
                    {notas.map((n) => {
                      const asistio = e === "presente" || e === "tarde";
                      return (
                        <td key={n.k} className="td">
                          <input
                            name={`${n.k}_${f.participanteId}`}
                            type="number"
                            min={0}
                            max={20}
                            step={0.5}
                            inputMode="decimal"
                            defaultValue={f[n.campo] ?? ""}
                            disabled={cerrada || !asistio}
                            placeholder={asistio ? "0–20" : "—"}
                            aria-label={`${n.t} de ${f.nombre}`}
                            className="campo w-20 py-1.5 text-center tabular-nums disabled:bg-[#f3f4f6]"
                          />
                        </td>
                      );
                    })}
                    <td className="td">
                      <input
                        name={`obs_${f.participanteId}`}
                        defaultValue={f.observacion ?? ""}
                        disabled={cerrada}
                        aria-label={`Observación de ${f.nombre}`}
                        className="campo py-1.5"
                      />
                    </td>
                    {!cerrada && (
                      <td className="td">
                        <button
                          type="submit"
                          name="quitar"
                          value={f.participanteId}
                          className="text-[13px] text-texto-2 hover:text-[#991b1b]"
                          aria-label={`Quitar a ${f.nombre} de la lista`}
                        >
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>

      {!cerrada && (
        <form ref={formIns} onSubmit={alInscribir} className="card flex flex-col gap-3 border-dashed px-5 py-4">
          <input type="hidden" name="programacionId" value={programacionId} />
          <h2 className="font-semibold text-marino">Inscribir participante</h2>
          <p className="text-[13px] text-texto-2">
            Escribe el DNI. Si la persona ya está registrada basta con eso; si es nueva, completa también sus datos.
          </p>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-5">
            <div><label htmlFor="i-dni" className="etiqueta">DNI</label><input id="i-dni" name="dni" required inputMode="numeric" className="campo" /></div>
            <div><label htmlFor="i-nom" className="etiqueta">Nombres (si es nuevo)</label><input id="i-nom" name="nombres" className="campo" /></div>
            <div><label htmlFor="i-ape" className="etiqueta">Apellidos (si es nuevo)</label><input id="i-ape" name="apellidos" className="campo" /></div>
            <div><label htmlFor="i-area" className="etiqueta">Área (opcional)</label><input id="i-area" name="area" className="campo" /></div>
            <button disabled={inscribiendo} className="btn-oscuro">{inscribiendo ? "Inscribiendo…" : "Inscribir"}</button>
          </div>
          <Aviso r={resIns} />
        </form>
      )}
    </>
  );
}
