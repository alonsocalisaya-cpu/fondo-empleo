"use client";

import { useId, useState } from "react";
import type { RecursoSesion } from "@/lib/recursos-sesion";
import EquiposSolicitados from "./EquiposSolicitados";

type Categoria = "refrigerio" | "material";
type Insumo = { id: number; nombre: string; stock: number; unidad: string; categoria: string };
type Fila = { id: number; categoria: Categoria; descripcion: string; cantidad: number; detalle: string; insumoId: number; otro: boolean };

export default function SolicitudRecursos({ iniciales = [], equiposIniciales = [], revision = false, inventario = [] }: { iniciales?: RecursoSesion[]; equiposIniciales?: RecursoSesion[]; revision?: boolean; inventario?: Insumo[] }) {
  const id = useId();
  const [filas, setFilas] = useState<Fila[]>(() => iniciales.map((r, i) => {
    const item = inventario.find((x) => x.id === r.insumoId)
      ?? inventario.find((x) => x.nombre.toLowerCase() === r.descripcion.toLowerCase());
    const categoria: Categoria = r.categoria ?? item?.categoria as Categoria
      ?? (["gaseosas", "galletas"].includes(r.descripcion.toLowerCase()) ? "refrigerio" : "material");
    return { id: i, categoria, descripcion: r.descripcion, cantidad: r.cantidad, detalle: r.detalle ?? "", insumoId: item?.id ?? r.insumoId ?? 0, otro: !item };
  }));
  const [siguiente, setSiguiente] = useState(filas.length);
  const [sinRecursos, setSinRecursos] = useState(revision && iniciales.length === 0);

  function agregar(categoria: Categoria) {
    setFilas((actuales) => [...actuales, { id: siguiente, categoria, descripcion: "", cantidad: 1, detalle: "", insumoId: 0, otro: false }]);
    setSiguiente((n) => n + 1);
  }

  function actualizar(idFila: number, cambios: Partial<Fila>) {
    setFilas((actuales) => actuales.map((fila) => fila.id === idFila ? { ...fila, ...cambios } : fila));
  }

  return <div className="space-y-3">
    <div className="rounded-lg border border-borde bg-slate-50 p-3 text-sm">{revision ? "Revisa los insumos solicitados. Al aprobar, los artículos vinculados se descuentan del inventario; Logística gestiona el stock y las reposiciones." : "Selecciona los refrigerios y materiales que necesitas. Puedes enviar la solicitud aunque falte stock; Logística gestiona el abastecimiento."}</div>
    <p className="text-sm text-texto-2">Elige cada artículo del inventario. Si todavía no está registrado, selecciona «Otro» y escribe qué necesitas.</p>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="sinRecursos" value="si" checked={sinRecursos} onChange={(e) => setSinRecursos(e.target.checked)} />
      No necesito refrigerios ni materiales de capacitación.
    </label>
    <fieldset disabled={sinRecursos} hidden={sinRecursos} className="space-y-3">
      {(["refrigerio", "material"] as const).map((categoria) => {
        const lista = filas.filter((fila) => fila.categoria === categoria);
        const opciones = inventario.filter((item) => item.categoria === categoria);
        const titulo = categoria === "refrigerio" ? "Refrigerios" : "Materiales de capacitación";
        return <section key={categoria} className="space-y-4 rounded-xl border border-borde bg-white p-4">
          <div>
            <h3 className="font-semibold text-marino">{titulo}</h3>
            <p className="mt-1 text-xs text-texto-2">{categoria === "refrigerio" ? "Selecciona bebidas, alimentos u otros insumos de refrigerio." : "Selecciona papelotes, plumones, hojas u otros materiales para la capacitación."}</p>
          </div>
          {lista.map((fila, indice) => {
            const item = inventario.find((x) => x.id === fila.insumoId && x.categoria === categoria);
            const descripcion = fila.otro ? fila.descripcion : item?.nombre ?? "";
            return <div key={fila.id} className="rounded-lg border border-borde bg-slate-50/70 p-3">
              <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_8rem_auto]">
                <div>
                  <label htmlFor={`${id}-${fila.id}-insumo`} className="etiqueta">{categoria === "refrigerio" ? `Refrigerio ${indice + 1}` : `Material ${indice + 1}`}</label>
                  <select id={`${id}-${fila.id}-insumo`} className="campo" value={fila.otro ? "otro" : fila.insumoId || ""} required onChange={(e) => {
                    if (e.target.value === "otro") actualizar(fila.id, { insumoId: 0, otro: true, descripcion: "" });
                    else {
                      const seleccionado = opciones.find((x) => x.id === Number(e.target.value));
                      actualizar(fila.id, { insumoId: seleccionado?.id ?? 0, otro: false, descripcion: seleccionado?.nombre ?? "" });
                    }
                  }}>
                    <option value="">Selecciona del inventario</option>
                    {opciones.map((x) => <option key={x.id} value={x.id}>{x.nombre}{revision ? ` · ${x.stock} ${x.unidad} disponibles` : ""}</option>)}
                    <option value="otro">Otro (especificar)</option>
                  </select>
                  {fila.otro && <input aria-label={`Nombre del ${categoria === "refrigerio" ? "refrigerio" : "material"}`} name="recursoDescripcion" value={fila.descripcion} onChange={(e) => actualizar(fila.id, { descripcion: e.target.value })} required maxLength={200} placeholder="Escribe el artículo que necesitas" className="campo mt-2" />}
                  {!fila.otro && <input type="hidden" name="recursoDescripcion" value={descripcion} />}
                  <input type="hidden" name="recursoInsumoId" value={item?.id ?? ""} />
                  <input type="hidden" name="recursoCategoria" value={categoria} />
                  <input type="hidden" name="recursoUnidad" value={item?.unidad ?? "unidad"} />
                  {revision && item && <p className="mt-1 text-xs text-texto-2">Disponible: {item.stock} {item.unidad}</p>}
                </div>
                <div>
                  <label htmlFor={`${id}-${fila.id}-cantidad`} className="etiqueta">Cantidad{item ? ` (${item.unidad})` : ""}</label>
                  <input id={`${id}-${fila.id}-cantidad`} name="recursoCantidad" type="number" min={1} step={1} value={fila.cantidad} onChange={(e) => actualizar(fila.id, { cantidad: Number(e.target.value) })} required className="campo" />
                </div>
                <button type="button" className="btn-secundario" aria-label={`Quitar ${titulo.toLowerCase()} ${indice + 1}`} onClick={() => setFilas((actuales) => actuales.filter((x) => x.id !== fila.id))}>Quitar</button>
              </div>
              <input type="hidden" name="recursoDetalle" value={fila.detalle} />
            </div>;
          })}
          {!lista.length && <p className="text-sm text-texto-2">No has agregado {categoria === "refrigerio" ? "refrigerios" : "materiales"}.</p>}
          <button type="button" className="btn-secundario" onClick={() => agregar(categoria)}>+ Agregar {categoria === "refrigerio" ? "refrigerio" : "material de capacitación"}</button>
        </section>;
      })}
    </fieldset>
    <EquiposSolicitados iniciales={equiposIniciales} revision={revision} />
    {!revision && <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmarSolicitudRecursos" value="si" required className="mt-1" />Confirmo que mi solicitud de refrigerios, materiales y equipos de cómputo está completa y corresponde a lo que necesito.</label>}
  </div>;
}
