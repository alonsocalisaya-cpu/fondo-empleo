import SiPuede from "@/components/SiPuede";
import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { insumos, movimientosInsumo, type CategoriaInsumo } from "@/db/schema";
import { Encabezado, Kpi, Vacio } from "@/components/ui";
import FormAlta from "@/components/FormAlta";
import { actualizarMinimo, alternarInsumo, crearInsumo, crearRefrigerioInicial } from "@/lib/acciones-inventario";
import { CATEGORIAS_INSUMO } from "@/lib/inventario";
import FormMovimiento from "./FormMovimiento";
import BotonEliminar from "@/components/BotonEliminar";
import { eliminarInsumo } from "@/lib/acciones-maestros";
import Link from "next/link";

export const metadata = { title: "Logística · Inventario" };

const MOV = {
  entrada: { txt: "Entrada", cls: "bg-[#dcfce7] text-[#166534]" },
  salida: { txt: "Salida", cls: "bg-[#fee2e2] text-[#991b1b]" },
  ajuste: { txt: "Ajuste", cls: "bg-[#e0e7ff] text-[#3730a3]" },
} as const;

const fechaHora = (d: Date) =>
  d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });

export default async function Logistica() {
  await connection();
  const [items, movs] = await Promise.all([
    db.select().from(insumos).orderBy(insumos.categoria, insumos.nombre),
    db
      .select({ m: movimientosInsumo, nombre: insumos.nombre, unidad: insumos.unidad })
      .from(movimientosInsumo)
      .innerJoin(insumos, eq(movimientosInsumo.insumoId, insumos.id))
      .orderBy(desc(movimientosInsumo.creadoEn), desc(movimientosInsumo.id)),
  ]);
  const activos = items.filter((i) => i.activo);
  const sinStock = activos.filter((i) => i.stock === 0).length;
  const bajo = activos.filter((i) => i.stock > 0 && i.stock < i.stockMinimo).length;

  return (
    <>
      <Encabezado antetitulo="Soporte · Logística" titulo="Inventario de materiales y refrigerios" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Ítems en inventario" valor={activos.length} />
        <Kpi etiqueta="Bajo el stock mínimo" valor={bajo} tono={bajo ? "alerta" : "ok"} detalle="Conviene reponer" />
        <Kpi etiqueta="Sin stock" valor={sinStock} tono={sinStock ? "alerta" : "ok"} />
      </section>

      <SiPuede modulo="logistica">
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold text-marino">Stock de refrigerios para las sesiones</h2>
          <p className="text-sm text-texto-2">Registra gaseosas y galletas en unidades individuales. Las solicitudes muestran lo disponible; la aprobación descuenta el stock y la devolución confirmada suma el retorno. Para ítems existentes, usa Entrada para reponer o Ajuste para indicar el conteo físico actual.</p>
          {["Gaseosas", "Galletas"].some((nombre) => !items.some((i) => i.nombre.toLowerCase() === nombre.toLowerCase())) && <FormAlta titulo="Registrar stock inicial de refrigerios" accion={crearRefrigerioInicial} boton="Guardar stock inicial" campos={[
            { name: "nombre", label: "Refrigerio", opciones: ["Gaseosas", "Galletas"].filter((nombre) => !items.some((i) => i.nombre.toLowerCase() === nombre.toLowerCase())).map((nombre) => ({ valor: nombre, texto: nombre })) },
            { name: "stock", label: "Stock inicial (unidades)", type: "number", required: true, inputMode: "numeric" },
          ]} />}
        </section>
      </SiPuede>

      {(Object.keys(CATEGORIAS_INSUMO) as CategoriaInsumo[]).map((cat) => {
        const lista = items.filter((i) => i.categoria === cat);
        return (
          <section key={cat} className="card overflow-hidden">
            <h2 className="border-b border-borde px-5 py-3 font-semibold text-marino">{CATEGORIAS_INSUMO[cat]}</h2>
            {lista.length === 0 ? <Vacio>No hay ítems en esta categoría.</Vacio> : (
              <div className="divide-y divide-borde">
                  {lista.map((i) => {
                    const alerta = i.activo && i.stock < i.stockMinimo;
                    const historial = movs.filter(({ m }) => m.insumoId === i.id);
                    return (
                      <details key={i.id} className="group">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                          <span aria-hidden="true" className="text-texto-2 transition-transform group-open:rotate-90">▶</span>
                          <span className={`min-w-32 flex-1 font-semibold ${i.activo ? "text-marino" : "text-texto-2"}`}>{i.nombre}{!i.activo && " (inactivo)"}<span className="mt-1 block text-xs font-normal text-texto-2">Mínimo: {i.stockMinimo} {i.unidad}</span></span>
                          <span className="whitespace-nowrap rounded-lg bg-slate-50 px-3 py-2">
                          <span className={`text-base font-bold ${alerta ? "text-[#991b1b]" : "text-marino"}`}>{i.stock}</span>{" "}
                          <span className="text-xs text-texto-2">{i.unidad}</span>
                          {alerta && (
                            <span className="ml-2 rounded-full bg-[#fee2e2] px-2 py-0.5 text-[11px] font-semibold text-[#991b1b]">
                              {i.stock === 0 ? "Sin stock" : "Reponer"}
                            </span>
                          )}
                          </span>
                          <span className="text-xs font-medium text-texto-2">{historial.length} movimiento{historial.length !== 1 ? "s" : ""} · Ver detalle</span>
                        </summary>
                        <div className="space-y-5 border-t border-borde bg-slate-50/50 p-4 sm:p-5">
                          <SiPuede modulo="logistica"><div className="flex flex-wrap items-start justify-between gap-5 rounded-lg border border-borde bg-white p-4">
                        <div><p className="etiqueta">Stock mínimo</p>
                          <SiPuede modulo="logistica" sino={i.stockMinimo}>
                          <form action={actualizarMinimo} className="flex gap-1.5">
                            <input type="hidden" name="id" value={i.id} />
                            <input name="stockMinimo" type="number" min={0} defaultValue={i.stockMinimo} aria-label={`Stock mínimo de ${i.nombre}`} className="campo w-20 py-1.5" />
                            <button className="enlace text-[13px]">Guardar</button>
                          </form>
                          </SiPuede>
                        </div>
                        <div className="min-w-0 flex-1">{i.activo && <><p className="etiqueta">Registrar movimiento</p><FormMovimiento insumoId={i.id} nombre={i.nombre} /></>}</div>
                        <div>
                          <SiPuede modulo="logistica">
                          <div className="flex items-start justify-end gap-4">
                            <form action={alternarInsumo}>
                              <input type="hidden" name="id" value={i.id} />
                              <button className="enlace text-[13px]">{i.activo ? "Desactivar" : "Activar"}</button>
                            </form>
                            <BotonEliminar
                              accion={eliminarInsumo}
                              campos={{ id: i.id }}
                              pregunta={`¿Eliminar ${i.nombre} del inventario?`}
                              detalle="Se borran sus movimientos de stock. En las fichas queda como ítem extra."
                            />
                          </div>
                          </SiPuede>
                        </div>
                          </div></SiPuede>
                          <div className="overflow-hidden rounded-lg border border-borde bg-white">
                            <h3 className="border-b border-borde px-4 py-3 text-sm font-semibold text-marino">Movimientos de {i.nombre}</h3>
                            {historial.length === 0 ? <Vacio>Aún no hay movimientos para este ítem.</Vacio> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
                              <thead><tr><th className="th">Fecha</th><th className="th">Movimiento</th><th className="th">Cantidad</th><th className="th">Stock resultante</th><th className="th">Motivo / sesión</th></tr></thead>
                              <tbody>{historial.map(({ m }) => <tr key={m.id}>
                                <td className="td whitespace-nowrap">{fechaHora(m.creadoEn)}</td>
                                <td className="td"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MOV[m.tipo].cls}`}>{MOV[m.tipo].txt}</span></td>
                                <td className="td whitespace-nowrap">{m.tipo === "ajuste" ? "Conteo: " : m.tipo === "entrada" ? "+" : "−"}{m.cantidad} {i.unidad}</td>
                                <td className="td font-semibold">{m.stockResultante} {i.unidad}</td>
                                <td className="td text-texto-2">{m.motivo ?? "—"}{m.programacionId && <Link className="enlace mt-1 block text-xs" href={`/operativo/capacitaciones/${m.programacionId}`}>Ver sesión #{m.programacionId}</Link>}</td>
                              </tr>)}</tbody>
                            </table></div>}
                          </div>
                        </div>
                      </details>
                    );
                  })}
              </div>
            )}
          </section>
        );
      })}

      <SiPuede modulo="logistica">
      <FormAlta
        titulo="Agregar ítem al inventario"
        accion={crearInsumo}
        boton="Agregar ítem"
        campos={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "categoria", label: "Categoría", opciones: Object.entries(CATEGORIAS_INSUMO).map(([valor, texto]) => ({ valor, texto })) },
          { name: "unidad", label: "Unidad (unidades, cajas…)" },
          { name: "stock", label: "Stock inicial", type: "number", inputMode: "numeric" },
          { name: "stockMinimo", label: "Stock mínimo", type: "number", inputMode: "numeric" },
        ]}
      />
      </SiPuede>

      <details className="card overflow-x-auto">
        <summary className="cursor-pointer border-b border-borde px-5 py-3 font-semibold text-marino">Últimos movimientos de todo el inventario</summary>
        {movs.length === 0 ? <Vacio>Aún no se registran movimientos.</Vacio> : (
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr><th className="th">Fecha</th><th className="th">Ítem</th><th className="th">Movimiento</th><th className="th">Cantidad</th><th className="th">Stock resultante</th><th className="th">Motivo</th></tr></thead>
            <tbody>
              {movs.slice(0, 25).map(({ m, nombre, unidad }) => (
                <tr key={m.id}>
                  <td className="td whitespace-nowrap">{fechaHora(m.creadoEn)}</td>
                  <td className="td font-medium">{nombre}</td>
                  <td className="td"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MOV[m.tipo].cls}`}>{MOV[m.tipo].txt}</span></td>
                  <td className="td">{m.tipo === "ajuste" ? `conteo: ${m.cantidad}` : m.cantidad} {unidad}</td>
                  <td className="td">{m.stockResultante}</td>
                  <td className="td text-texto-2">{m.motivo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </>
  );
}
