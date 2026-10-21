"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { guardarAsistencia, inscribirParticipante, quitarInscripcion } from "../actions";
import { useConfirmacion } from "@/components/Confirmacion";

type Estado = "presente" | "tarde" | "ausente" | "justificado";

export type FilaAsistencia = {
  participanteId: number;
  nombre: string;
  dni: string | null;
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
  pendientes,
  cerrada,
  examen = null,
}: {
  programacionId: number;
  filas: FilaAsistencia[];
  pendientes: { participanteId: number; nombres: string; apellidos: string; dni: string | null }[];
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
  const [buscarPendiente, setBuscarPendiente] = useState("");
  const { confirmar, dialogo } = useConfirmacion();
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
  const alGuardar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const boton = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (boton?.name === "quitar") {
      const persona = filas.find((f) => String(f.participanteId) === boton.value);
      const aceptado = await confirmar({
        titulo: "Quitar de esta sesión",
        mensaje: `¿Quieres quitar a ${persona?.nombre ?? "esta persona"} de la lista de esta sesión?`,
        detalle: "Se retirará únicamente de esta sesión y se eliminará su asistencia registrada aquí, si la tiene. Su registro como beneficiario y sus otras sesiones se conservarán.",
        aceptar: "Sí, quitar de esta sesión",
        peligro: true,
      });
      if (!aceptado) return;
      const datos = new FormData();
      datos.set("programacionId", String(programacionId));
      datos.set("quitar", boton.value);
      startTransition(() => quitarInscripcion(datos));
      return;
    }
    const datos = new FormData(e.currentTarget, boton);
    if (boton?.name === "cerrar" && !await confirmar({
      titulo: "Guardar y cerrar lista",
      mensaje: "Una vez cerrada la lista, ya no podrás editar la asistencia de esta sesión.",
      detalle: "Solo el administrador o el encargado de Gestión Documental podrán reabrirla para permitir cambios. Los beneficiarios sin marcar se guardarán como ausentes.",
      aceptar: "Sí, guardar y cerrar",
    })) return;
    startTransition(() => guardar(datos));
  };

  const valores = filas.map((f) => estados[f.participanteId] ?? "ausente");
  const cuenta = (e: Estado) => valores.filter((v) => v === e).length;
  const pct = filas.length ? Math.round(((cuenta("presente") + cuenta("tarde")) * 100) / filas.length) : 0;
  const coincide = (f: FilaAsistencia) =>
    `${f.nombre} ${f.dni}`.toLowerCase().includes(buscar.trim().toLowerCase());
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const pendientesVisibles = pendientes.filter((p) => normalizar(buscarPendiente).trim().split(/\s+/).every((palabra) => normalizar(`${p.nombres} ${p.apellidos} ${p.dni}`).includes(palabra)));

  return (
    <>
      {dialogo}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Presentes", cuenta("presente"), "text-[#166534]"],
          ["Tardanzas", cuenta("tarde"), "text-[#92400e]"],
          ["Ausentes", cuenta("ausente"), "text-[#991b1b]"],
          ["Justificados", cuenta("justificado"), "text-texto-2"],
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

      <form id="registro-asistencia" onSubmit={alGuardar} className="card flex scroll-mt-20 flex-col">
        <p className="border-b border-borde bg-[#f5f8fc] px-5 py-3 text-sm text-texto-2">Marca Presente, Tarde o Justificado. Al guardar, quienes no tengan una opción seleccionada se registrarán como ausentes.</p>
        {notas.length > 0 && <p id="rango-notas" className="px-5 pt-3 text-sm text-texto-2">Las notas de entrada y salida deben estar entre 0 y 20. Puedes usar un decimal, por ejemplo 15.5. Deja vacío si todavía no se registró la nota.</p>}
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
                      {!cerrada && e && e !== "ausente" && <button type="button" onClick={() => setEstados((prev) => ({ ...prev, [f.participanteId]: null }))} className="ml-2 text-xs text-texto-2 underline" aria-label={`Desmarcar a ${f.nombre}`}>Desmarcar</button>}
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
                            step={0.1}
                            inputMode="decimal"
                            defaultValue={f[n.campo] ?? ""}
                            disabled={cerrada || !asistio}
                            placeholder={asistio ? "0–20" : "—"}
                            aria-label={`${n.t} de ${f.nombre}`}
                            aria-describedby="rango-notas"
                            onChange={(event) => {
                              const campo = event.currentTarget;
                              campo.setCustomValidity("");
                              if (campo.validity.badInput || (campo.value !== "" && (!Number.isFinite(campo.valueAsNumber) || campo.valueAsNumber < 0 || campo.valueAsNumber > 20))) {
                                campo.setCustomValidity("La nota debe ser un número entre 0 y 20.");
                              }
                            }}
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
                          formNoValidate
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
        <section className="card space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-marino">Beneficiarios pendientes de inscripción</h2><p className="mt-1 text-xs text-texto-2">Personas de la sede y turno de esta sesión que todavía no están en la lista.</p></div><span className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs text-marino">{pendientes.length} pendientes</span></div>
          <label className="etiqueta" htmlFor="buscar-pendiente">Buscar por DNI o nombre<input id="buscar-pendiente" value={buscarPendiente} onChange={(e) => setBuscarPendiente(e.target.value)} placeholder="Escribe el DNI, nombres o apellidos" className="campo mt-1" /></label>
          <div className="max-h-96 space-y-2 overflow-y-auto">{pendientesVisibles.map((p) => <form key={p.participanteId} onSubmit={alInscribir} className="flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-[#f8fafc] p-3">
            <input type="hidden" name="programacionId" value={programacionId} /><input type="hidden" name="dni" value={p.dni ?? ""} /><input type="hidden" name="participanteId" value={p.participanteId} />
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-marino">{p.apellidos}, {p.nombres}</p><p className="mt-1 text-xs text-texto-2">DNI: {p.dni}</p></div>
            <button disabled={inscribiendo} className="btn-secundario shrink-0 px-4 py-2 text-sm">+ Agregar a la lista</button>
          </form>)}{!pendientesVisibles.length && <p className="rounded-lg bg-[#f5f8fc] p-4 text-sm text-texto-2">{pendientes.length ? "No se encontraron beneficiarios con esa búsqueda." : "Todos los beneficiarios de esta sede y turno están inscritos."}</p>}</div>
          <Aviso r={resIns} />
        </section>
      )}
      {!cerrada && (
        <form ref={formIns} onSubmit={alInscribir} className="card flex flex-col gap-3 border-dashed px-5 py-4">
          <input type="hidden" name="programacionId" value={programacionId} />
          <h2 className="font-semibold text-marino">Registrar e inscribir a una persona nueva</h2>
          <p className="text-[13px] text-texto-2">
            Si la persona aún no está registrada en el sistema, completa su DNI, nombres y apellidos para agregarla a esta sesión.
          </p>
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-5">
            <div><label htmlFor="i-dni" className="etiqueta">DNI</label><input id="i-dni" name="dni" required inputMode="numeric" className="campo" /></div>
            <div><label htmlFor="i-nom" className="etiqueta">Nombres</label><input id="i-nom" name="nombres" required className="campo" /></div>
            <div><label htmlFor="i-ape" className="etiqueta">Apellidos</label><input id="i-ape" name="apellidos" required className="campo" /></div>
            <div><label htmlFor="i-area" className="etiqueta">Área (opcional)</label><input id="i-area" name="area" className="campo" /></div>
            <button disabled={inscribiendo} className="btn-oscuro">{inscribiendo ? "Inscribiendo…" : "Registrar e inscribir"}</button>
          </div>
          <Aviso r={resIns} />
        </form>
      )}
    </>
  );
}
