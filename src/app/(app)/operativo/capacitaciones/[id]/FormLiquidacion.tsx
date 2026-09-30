"use client";

import { useState, useTransition } from "react";
import { MAX_LINEAS, importeEnLetras, saldo, totalGastos, type DatosLiquidacion, type LineaGasto } from "@/lib/liquidacion";
import { guardarLiquidacion } from "./actions";

const vacia = (): LineaGasto => ({ descripcion: "", cantidad: 1, unidad: "", monto: 0, comprobante: "", obs: "" });
const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Espacios del formato «Liquidación de viáticos» (ACIDE-A&A-F-02). Va dentro del formulario del paso:
 * todo viaja en el campo oculto «liquidacion». Se puede guardar como borrador y descargar el Excel lleno.
 */
export default function FormLiquidacion({
  programacionId,
  inicial,
  guardada,
  soloLectura = false,
}: {
  programacionId: number;
  inicial: DatosLiquidacion;
  guardada: boolean;
  soloLectura?: boolean;
}) {
  const [d, setD] = useState<DatosLiquidacion>(() => ({ ...inicial, lineas: inicial.lineas.length ? inicial.lineas : [vacia()] }));
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pendiente, iniciar] = useTransition();
  const [sinGuardar, setSinGuardar] = useState(!guardada);

  const set = <K extends keyof DatosLiquidacion>(k: K, v: DatosLiquidacion[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setSinGuardar(true);
    setMsg(undefined);
  };
  const setLinea = (i: number, cambio: Partial<LineaGasto>) =>
    set("lineas", d.lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)));

  const total = totalGastos(d);
  const s = saldo(d);
  const json = JSON.stringify(d);

  const guardar = (y?: () => void) => {
    const fd = new FormData();
    fd.set("programacionId", String(programacionId));
    fd.set("liquidacion", json);
    iniciar(async () => {
      const r = await guardarLiquidacion(fd);
      setMsg(r);
      if (r?.ok) {
        setSinGuardar(false);
        y?.();
      }
    });
  };
  const descargar = () => {
    const url = `/operativo/capacitaciones/${programacionId}/liquidacion`;
    if (soloLectura || !sinGuardar) window.location.href = url;
    else guardar(() => (window.location.href = url));
  };

  const campo = "campo py-1.5 text-[13px]";
  const celda = "border border-borde px-1 py-0.5";
  const entrada = "w-full bg-transparent px-1 py-1 text-[13px] outline-none focus:bg-[#f0f7f5]";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-borde bg-white p-3">
      <input type="hidden" name="liquidacion" value={json} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-marino">
          Liquidación de viáticos <span className="font-normal text-texto-2">· formato ACIDE-A&amp;A-F-02</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {!soloLectura && (
            <button type="button" disabled={pendiente} onClick={() => guardar()} className="btn-secundario py-1.5 text-[13px]">
              {pendiente ? "Guardando…" : "💾 Guardar borrador"}
            </button>
          )}
          <button type="button" disabled={pendiente} onClick={descargar} className="btn-secundario py-1.5 text-[13px]">
            ⬇ Descargar formato lleno (Excel)
          </button>
        </div>
      </div>

      <fieldset disabled={soloLectura} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="lq-osft">OS/FT</label>
          <input id="lq-osft" value={d.osft} onChange={(e) => set("osft", e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="lq-fecha">Fecha</label>
          <input id="lq-fecha" value={d.fecha} onChange={(e) => set("fecha", e.target.value)} placeholder="dd/mm/aaaa" className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="lq-monto">Monto presupuestado (S/)</label>
          <input id="lq-monto" type="number" min={0} step="0.10" value={d.presupuestado || ""} onChange={(e) => set("presupuestado", Number(e.target.value) || 0)} className={campo} />
        </div>
        <div className="sm:col-span-3">
          <label className="etiqueta" htmlFor="lq-nombre">Nombre</label>
          <input id="lq-nombre" value={d.nombre} onChange={(e) => set("nombre", e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-3">
          <label className="etiqueta" htmlFor="lq-puesto">Puesto</label>
          <input id="lq-puesto" value={d.puesto} onChange={(e) => set("puesto", e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-4">
          <label className="etiqueta" htmlFor="lq-desc">Descripción de servicio</label>
          <input id="lq-desc" value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} className={campo} />
        </div>
        <div className="sm:col-span-2">
          <label className="etiqueta" htmlFor="lq-cliente">Cliente</label>
          <input id="lq-cliente" value={d.cliente} onChange={(e) => set("cliente", e.target.value)} className={campo} />
        </div>
      </fieldset>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#eef1f5] text-[11px] font-semibold text-texto-2">
              <th className={`${celda} w-8`}>N°</th>
              <th className={celda}>Descripción</th>
              <th className={`${celda} w-16`}>Cant.</th>
              <th className={`${celda} w-16`}>Und.</th>
              <th className={`${celda} w-24`}>Monto S/</th>
              <th className={`${celda} w-32`}>N° comprobante</th>
              <th className={celda}>Observaciones</th>
              {!soloLectura && <th className={`${celda} w-8`}><span className="sr-only">Quitar</span></th>}
            </tr>
          </thead>
          <tbody>
            {d.lineas.map((l, i) => (
              <tr key={i}>
                <td className={`${celda} text-center text-texto-2`}>{i + 1}</td>
                <td className={celda}><input aria-label={`Descripción del gasto ${i + 1}`} disabled={soloLectura} value={l.descripcion} onChange={(e) => setLinea(i, { descripcion: e.target.value })} placeholder="Pasaje, alimentación, movilidad…" className={entrada} /></td>
                <td className={celda}><input aria-label={`Cantidad ${i + 1}`} disabled={soloLectura} type="number" min={0} step="1" value={l.cantidad ?? ""} onChange={(e) => setLinea(i, { cantidad: e.target.value === "" ? null : Number(e.target.value) })} className={`${entrada} text-center`} /></td>
                <td className={celda}><input aria-label={`Unidad ${i + 1}`} disabled={soloLectura} value={l.unidad} onChange={(e) => setLinea(i, { unidad: e.target.value })} placeholder="UND" className={`${entrada} text-center`} /></td>
                <td className={celda}><input aria-label={`Monto ${i + 1}`} disabled={soloLectura} type="number" min={0} step="0.10" value={l.monto || ""} onChange={(e) => setLinea(i, { monto: Number(e.target.value) || 0 })} className={`${entrada} text-right tabular-nums`} /></td>
                <td className={celda}><input aria-label={`Comprobante ${i + 1}`} disabled={soloLectura} value={l.comprobante} onChange={(e) => setLinea(i, { comprobante: e.target.value })} placeholder="B001-123 / sin comp." className={entrada} /></td>
                <td className={celda}><input aria-label={`Observaciones ${i + 1}`} disabled={soloLectura} value={l.obs} onChange={(e) => setLinea(i, { obs: e.target.value })} className={entrada} /></td>
                {!soloLectura && (
                  <td className={`${celda} text-center`}>
                    <button type="button" onClick={() => set("lineas", d.lineas.filter((_, j) => j !== i))} aria-label={`Quitar gasto ${i + 1}`} className="text-texto-2 hover:text-[#991b1b]">✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className={celda} colSpan={4}>Importe total <span className="text-[11px] font-normal text-texto-2">({importeEnLetras(total)})</span></td>
              <td className={`${celda} text-right tabular-nums`}>{soles(total)}</td>
              <td className={celda} colSpan={soloLectura ? 2 : 3} />
            </tr>
            <tr className="font-semibold">
              <td className={celda} colSpan={4}>Saldo <span className="text-[11px] font-normal text-texto-2">(presupuestado − gastado{s >= 0 ? ": a devolver" : ": a reembolsar"})</span></td>
              <td className={`${celda} text-right tabular-nums ${s < 0 ? "text-[#991b1b]" : ""}`}>{soles(s)}</td>
              <td className={celda} colSpan={soloLectura ? 2 : 3} />
            </tr>
          </tfoot>
        </table>
      </div>
      {!soloLectura && d.lineas.length < MAX_LINEAS && (
        <button type="button" onClick={() => set("lineas", [...d.lineas, vacia()])} className="self-start text-[13px] font-semibold text-acento-oscuro hover:underline">
          + Agregar gasto
        </button>
      )}
      <p className="text-xs text-texto-2">
        Solo se llenan los espacios del formato; su diseño no cambia. Firmas (Vo. Bo., Autoriza, Solicitante) van a mano en el formato impreso.
        {sinGuardar && !soloLectura && " · Hay cambios sin guardar."}
      </p>
      {msg?.error && <p role="alert" className="text-[13px] text-[#991b1b]">{msg.error}</p>}
      {msg?.ok && <p role="status" className="text-[13px] text-[#166534]">✓ {msg.ok}</p>}
    </div>
  );
}
