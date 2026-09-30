"use client";

import { useState } from "react";

export type LineaMaterial = {
  itemId: number;
  nombre: string;
  salio: number;
  reportado: number; // restante que declaró el asistente en la 2da sección
  stock: number | null;
  stockMinimo: number;
  unidad: string;
};
export type LineaEquipo = {
  equipoId: number;
  nombre: string;
  tipo: string;
  reporte: string;
  sugerido: "ok" | "falla" | "correccion";
  detalle: string;
  chequeos: string[];
  horas: number;
  usos: number; // sesiones anteriores en que se usó
};

const ESTADOS = [
  { v: "ok", t: "Volvió operativo" },
  { v: "falla", t: "Con falla" },
  { v: "correccion", t: "Requiere corrección" },
  { v: "no_devuelto", t: "No volvió" },
] as const;

const th = "border-b border-borde px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-texto-2";
const td = "border-b border-[#eef1f5] px-2 py-1.5";

/** Contraste del inventario: lo que salió, lo que reportó el asistente y lo que cuenta Gestión Documental. */
export default function ContrasteInventario({
  materiales,
  equipos,
  extras,
  presentes,
  inscritos,
}: {
  materiales: LineaMaterial[];
  equipos: LineaEquipo[];
  extras: string[];
  presentes: number;
  inscritos: number;
}) {
  const [contado, setContado] = useState<Record<number, number>>(Object.fromEntries(materiales.map((m) => [m.itemId, m.reportado])));
  const [estados, setEstados] = useState<Record<number, string>>(Object.fromEntries(equipos.map((q) => [q.equipoId, q.sugerido])));
  const [manual, setManual] = useState<Record<number, boolean>>({});
  const [chk, setChk] = useState<Record<string, boolean>>(
    Object.fromEntries(equipos.flatMap((q) => q.chequeos.map((_, i) => [`${q.equipoId}-${i}`, q.sugerido === "ok"]))),
  );
  const marcar = (q: LineaEquipo, i: number, v: boolean) => {
    const nuevo = { ...chk, [`${q.equipoId}-${i}`]: v };
    setChk(nuevo);
    // Si nadie cambió el resultado a mano, se sugiere según los chequeos
    if (!manual[q.equipoId]) {
      const todoOk = q.chequeos.every((_, k) => nuevo[`${q.equipoId}-${k}`]);
      setEstados((x) => ({ ...x, [q.equipoId]: todoOk ? "ok" : x[q.equipoId] === "ok" ? "falla" : x[q.equipoId] }));
    }
  };

  const difMat = materiales.filter((m) => (contado[m.itemId] ?? 0) !== m.reportado).length;
  const difEq = equipos.filter((q) => estados[q.equipoId] !== q.sugerido).length;
  const usadoTotal = materiales.reduce((a, m) => a + (m.salio - (contado[m.itemId] ?? 0)), 0);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="presentes" value={presentes} />
      <p className="text-xs text-texto-2">
        Cuenta lo que volvió y compáralo con lo que reportó el asistente. El inventario se actualiza después, cuando el Jefe de Proyecto lo apruebe.{" "}
        <strong className="text-texto">Asistieron {presentes} de {inscritos} inscritos.</strong>
      </p>

      {materiales.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-borde bg-white">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr>
                <th className={th}>Ítem</th>
                <th className={`${th} text-center`}>Salió</th>
                <th className={`${th} text-center`}>Reportó asistente</th>
                <th className={`${th} text-center`}>Contado G.D.</th>
                <th className={`${th} text-center`}>Usado</th>
                <th className={`${th} text-center`}>Por asistente</th>
                <th className={`${th} text-center`}>Diferencia</th>
                <th className={th}>Stock en Logística</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => {
                const c = contado[m.itemId] ?? 0;
                const usado = m.salio - c;
                const dif = c - m.reportado;
                const despues = m.stock === null ? null : m.stock + c;
                return (
                  <tr key={m.itemId}>
                    <td className={`${td} font-medium`}>{m.nombre}</td>
                    <td className={`${td} text-center`}>{m.salio}</td>
                    <td className={`${td} text-center`}>{m.reportado}</td>
                    <td className={`${td} text-center`}>
                      <input
                        name={`dev-${m.itemId}`}
                        type="number"
                        min={0}
                        max={m.salio}
                        value={c}
                        onChange={(e) => setContado((x) => ({ ...x, [m.itemId]: Math.max(0, Math.min(m.salio, Math.floor(Number(e.target.value) || 0))) }))}
                        aria-label={`Contado de ${m.nombre}`}
                        className="campo w-16 px-2 py-1 text-center"
                      />
                    </td>
                    <td className={`${td} text-center`}>{usado}</td>
                    <td className={`${td} text-center text-texto-2`}>{presentes ? (usado / presentes).toFixed(1) : "—"}</td>
                    <td className={`${td} text-center font-semibold ${dif ? "text-[#991b1b]" : "text-[#166534]"}`}>{dif > 0 ? `+${dif}` : dif === 0 ? "✓" : dif}</td>
                    <td className={td}>
                      {m.stock === null ? (
                        <span className="text-texto-2">—</span>
                      ) : (
                        <span className={despues! < m.stockMinimo ? "text-[#991b1b]" : ""}>
                          {m.stock} → <strong>{despues}</strong> {m.unidad}
                          {despues! < m.stockMinimo && <span className="ml-1 text-[11px]">(bajo mínimo {m.stockMinimo})</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-2 py-1.5 text-xs text-texto-2">Total usado en la sesión: {usadoTotal} unidad(es). «Por asistente» ayuda a calcular cuánto llevar la próxima vez.</p>
        </div>
      )}

      {equipos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-marino">Revisión de cada equipo llevado</p>
          {equipos.map((q) => {
            const est = estados[q.equipoId];
            const noVolvio = est === "no_devuelto";
            return (
              <fieldset key={q.equipoId} className={`flex flex-col gap-2 rounded-md border bg-white p-3 text-[13px] ${est === "ok" ? "border-borde" : "border-[#fca5a5]"}`}>
                <legend className="px-1 font-semibold text-marino">{q.nombre}</legend>
                <p className="text-xs text-texto-2">
                  {q.tipo} · usado en {q.usos} sesión(es) anteriores · Reporte del asistente: <span className={q.sugerido === "ok" ? "" : "font-semibold text-[#991b1b]"}>{q.reporte}</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="flex items-center gap-2">
                    ¿Se usó en la sesión?
                    <label className="flex items-center gap-1"><input type="radio" name={`equsado-${q.equipoId}`} value="si" defaultChecked className="accent-marino" /> Sí</label>
                    <label className="flex items-center gap-1"><input type="radio" name={`equsado-${q.equipoId}`} value="no" className="accent-marino" /> No</label>
                  </span>
                  <label className="flex items-center gap-2">
                    Horas de uso
                    <input name={`eqhoras-${q.equipoId}`} type="number" min={0} max={24} step="0.5" defaultValue={q.horas} className="campo w-20 px-2 py-1" />
                  </label>
                </div>
                {!noVolvio && (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {q.chequeos.map((c, i) => (
                      <label key={c} className={`flex items-center gap-2 ${chk[`${q.equipoId}-${i}`] ? "" : "font-semibold text-[#991b1b]"}`}>
                        <input
                          type="checkbox"
                          name={`eqchk-${q.equipoId}-${i}`}
                          checked={Boolean(chk[`${q.equipoId}-${i}`])}
                          onChange={(e) => marcar(q, i, e.target.checked)}
                          className="size-4 accent-marino"
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
                  <select
                    name={`eqest-${q.equipoId}`}
                    value={est}
                    onChange={(e) => {
                      setManual((x) => ({ ...x, [q.equipoId]: true }));
                      setEstados((x) => ({ ...x, [q.equipoId]: e.target.value }));
                    }}
                    aria-label={`Resultado de ${q.nombre}`}
                    className={`campo py-1.5 ${est !== "ok" ? "font-semibold text-[#991b1b]" : ""}`}
                  >
                    {ESTADOS.map((x) => <option key={x.v} value={x.v}>{x.t}</option>)}
                  </select>
                  <input name={`eqobs-${q.equipoId}`} defaultValue={q.detalle} placeholder="Qué falló / qué corregir (obligatorio si no está operativo)" aria-label={`Observación de ${q.nombre}`} className="campo py-1.5" />
                </div>
              </fieldset>
            );
          })}
        </div>
      )}

      {materiales.length === 0 && equipos.length === 0 && <p className="text-[13px] text-texto-2">La ficha no tiene ítems del inventario ni equipos.</p>}
      {extras.length > 0 && <p className="text-xs text-texto-2">Extras comprados aparte (no afectan el inventario): {extras.join(", ")}.</p>}

      {(difMat > 0 || difEq > 0) && (
        <p role="alert" className="rounded-md bg-[#fef3c7] px-3 py-2 text-[13px] text-[#92400e]">
          Hay {difMat + difEq} diferencia(s) con lo que reportó el asistente: explícalas en la observación.
        </p>
      )}
      <input name="obs" placeholder={difMat || difEq ? "Explica las diferencias (obligatorio)" : "Observación (opcional)"} aria-label="Observación" className="campo py-2" />
    </div>
  );
}
