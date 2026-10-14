"use client";

import { useId, useState } from "react";
import type { RecursoSesion } from "@/lib/recursos-sesion";
import EquiposSolicitados from "./EquiposSolicitados";

type Insumo = { id: number; nombre: string; stock: number; unidad: string; categoria: string };

export default function SolicitudRecursos({ iniciales = [], equiposIniciales = [], revision = false, inventario = [] }: { iniciales?: RecursoSesion[]; equiposIniciales?: RecursoSesion[]; revision?: boolean; inventario?: Insumo[] }) {
  const id = useId();
  const catalogo = inventario.filter((i) => ["unidad", "unidades"].includes(i.unidad.toLowerCase().trim()));
  const [vinculos, setVinculos] = useState<Record<number, number>>(() => Object.fromEntries(["Gaseosas", "Galletas"].map((nombre, i) => [i, iniciales.find((r) => r.descripcion.toLowerCase() === nombre.toLowerCase())?.insumoId ?? catalogo.find((r) => r.nombre.toLowerCase() === nombre.toLowerCase() && r.categoria === "refrigerio")?.id ?? 0])));
  const [cantidades, setCantidades] = useState<Record<number, number>>(() => Object.fromEntries(["Gaseosas", "Galletas"].map((nombre, i) => [i, iniciales.find((r) => r.descripcion.toLowerCase() === nombre.toLowerCase())?.cantidad ?? 1])));
  const [sinRecursos, setSinRecursos] = useState(revision && iniciales.length === 0);
  const [filas, setFilas] = useState(() => {
    const obligatorios = ["Gaseosas", "Galletas"].map((descripcion, i) => ({
      descripcion,
      cantidad: iniciales.find((r) => r.descripcion.toLowerCase() === descripcion.toLowerCase())?.cantidad ?? 1,
      unidad: "unidad",
      detalle: iniciales.find((r) => r.descripcion.toLowerCase() === descripcion.toLowerCase())?.detalle ?? "",
      id: i,
    }));
    const extras = iniciales.filter((r) => !["gaseosas", "galletas"].includes(r.descripcion.toLowerCase())).map((r, i) => ({ ...r, id: i + 2 }));
    return [...obligatorios, ...extras];
  });
  const [siguiente, setSiguiente] = useState(filas.length);
  return <div className="space-y-3">
    <div className="rounded-lg border border-borde bg-slate-50 p-3 text-sm">{revision ? "La aprobación descuenta los refrigerios del inventario. El responsable de Logística gestiona el stock y las reposiciones." : "Indica los recursos y cantidades que necesitas. Puedes enviar tu solicitud aunque falte stock; el responsable de Logística gestiona el abastecimiento."}</div>
    <p className="text-sm text-texto-2">{revision ? "Revisa los recursos de refrigerio y/o materiales de capacitación solicitados en cada apartado." : "Indica las cantidades de refrigerios y/o agrega los materiales de capacitación que necesitas en sus respectivos apartados."}</p>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="sinRecursos" value="si" checked={sinRecursos} onChange={(e) => setSinRecursos(e.target.checked)} />
      No necesito recursos de refrigerio ni materiales.
    </label>
    <fieldset disabled={sinRecursos} hidden={sinRecursos} className="space-y-3">
      {["refrigerios", "materiales"].map((grupo) => <section key={grupo} className="space-y-4 rounded-xl border border-borde bg-white p-4">
        <div><h3 className="font-semibold text-marino">{grupo === "refrigerios" ? "Recursos de refrigerio" : "Materiales de capacitación"}</h3><p className="mt-1 text-xs text-texto-2">{grupo === "refrigerios" ? (revision ? "Gaseosas y galletas: verifica el ítem de Logística y las unidades solicitadas." : "Indica cuántas unidades de gaseosas y galletas necesitas solicitar.") : "Agrega papelotes, plumones, hojas u otros materiales que se usarán en la capacitación."}</p></div>
      {filas.filter((r) => grupo === "refrigerios" ? r.id < 2 : r.id >= 2).map((r, i) => <div key={r.id} className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_auto]">
        <div><label htmlFor={`${id}-${r.id}-nombre`} className="etiqueta">{r.id < 2 ? "Refrigerio" : `Material ${i + 1}`}</label><input id={`${id}-${r.id}-nombre`} name="recursoDescripcion" defaultValue={r.descripcion} readOnly={r.id < 2} required maxLength={200} placeholder="Papelotes u otro material…" className="campo" /></div>
        <div><label htmlFor={`${id}-${r.id}-cantidad`} className="etiqueta">Unidades</label><input id={`${id}-${r.id}-cantidad`} name="recursoCantidad" type="number" min={1} step={1} defaultValue={r.cantidad} onChange={(e) => setCantidades((v) => ({ ...v, [r.id]: Number(e.target.value) }))} required className="campo" /></div>
        <div><label htmlFor={`${id}-${r.id}-detalle`} className="etiqueta">Detalles (opcional)</label><input id={`${id}-${r.id}-detalle`} name="recursoDetalle" defaultValue={r.detalle ?? ""} maxLength={1000} placeholder="Tamaño, características u observaciones…" className="campo" /></div>
        {r.id >= 2 && <button type="button" className="btn-secundario" aria-label={`Quitar recurso adicional ${i - 1}`} onClick={() => setFilas((f) => f.filter((x) => x.id !== r.id))}>Quitar</button>}
        {r.id < 2 ? <div className="md:col-span-4">
          {revision ? <><label className="etiqueta" htmlFor={`${id}-${r.id}-stock`}>Ítem de Logística</label><select id={`${id}-${r.id}-stock`} name="recursoInsumoId" required className="campo" value={vinculos[r.id] || ""} onChange={(e) => setVinculos((v) => ({ ...v, [r.id]: Number(e.target.value) }))}><option value="">Selecciona el refrigerio del inventario</option>{catalogo.filter((x) => x.categoria === "refrigerio").map((x) => <option key={x.id} value={x.id}>{x.nombre} · {x.stock} unidades disponibles</option>)}</select></> : <input type="hidden" name="recursoInsumoId" value={vinculos[r.id] || ""} />}
          {(() => {
            const item = catalogo.find((x) => x.id === vinculos[r.id]);
            if (!item) return <p className="mt-1 text-xs text-texto-2">{revision ? "Pendiente de vincular con el inventario. Logística debe registrar el ítem y su stock." : "Disponibilidad pendiente de confirmar por Logística. Puedes enviar la solicitud."}</p>;
            const saldo = item.stock - filas.filter((x) => vinculos[x.id] === item.id).reduce((total, x) => total + (cantidades[x.id] ?? x.cantidad), 0);
            return <p className={`mt-1 text-xs ${saldo < 0 ? "text-red-700" : "text-texto-2"}`}>Disponible: {item.stock} unidades · {saldo < 0 ? `Faltan ${-saldo} unidades. ${revision ? "Logística debe reponer antes de aprobar." : "Logística gestionará el abastecimiento; puedes solicitarlo."}` : `Saldo después de aprobar: ${saldo} unidades.`}</p>;
          })()}
        </div> : <input type="hidden" name="recursoInsumoId" value="" />}
      </div>)}
      {grupo === "materiales" && <>
        {!filas.some((r) => r.id >= 2) && <p className="text-sm text-texto-2">No has agregado materiales de capacitación.</p>}
        <button type="button" className="btn-secundario" onClick={() => { setFilas((f) => [...f, { id: siguiente, descripcion: "", cantidad: 1, unidad: "unidad" }]); setSiguiente((n) => n + 1); }}>+ Agregar material de capacitación</button>
      </>}
      </section>)}
    </fieldset>
    <EquiposSolicitados iniciales={equiposIniciales} />
  </div>;
}
