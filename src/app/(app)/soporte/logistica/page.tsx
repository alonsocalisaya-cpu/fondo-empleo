import SiPuede from "@/components/SiPuede";
import { connection } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { insumos, movimientosInsumo, type CategoriaInsumo } from "@/db/schema";
import { Encabezado, Kpi, Vacio } from "@/components/ui";
import FormAlta from "@/components/FormAlta";
import { actualizarMinimo, alternarInsumo, crearInsumo } from "@/lib/acciones-inventario";
import { CATEGORIAS_INSUMO } from "@/lib/inventario";
import FormMovimiento from "./FormMovimiento";
import BotonEliminar from "@/components/BotonEliminar";
import { eliminarInsumo } from "@/lib/acciones-maestros";

export const metadata = { title: "Logística · Inventario" };

const MOV = {
  entrada: { txt: "Entrada", cls: "bg-[#dcfce7] text-[#166534]" },
  salida: { txt: "Salida", cls: "bg-[#fee2e2] text-[#991b1b]" },
  ajuste: { txt: "Ajuste", cls: "bg-[#e0e7ff] text-[#3730a3]" },
} as const;

const fechaHora = (d: Date) =>
  d.toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });

export default async function Logistica() {
  await connection();
  const [items, movs] = await Promise.all([
    db.select().from(insumos).orderBy(insumos.categoria, insumos.nombre),
    db
      .select({ m: movimientosInsumo, nombre: insumos.nombre, unidad: insumos.unidad })
      .from(movimientosInsumo)
      .innerJoin(insumos, eq(movimientosInsumo.insumoId, insumos.id))
      .orderBy(desc(movimientosInsumo.creadoEn), desc(movimientosInsumo.id))
      .limit(25),
  ]);
  const activos = items.filter((i) => i.activo);
  const sinStock = activos.filter((i) => i.stock === 0).length;
  const bajo = activos.filter((i) => i.stock > 0 && i.stock < i.stockMinimo).length;

  return (
    <>
      <Encabezado antetitulo="Soporte · Logística" titulo="Inventario de materiales" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Ítems en inventario" valor={activos.length} />
        <Kpi etiqueta="Bajo el stock mínimo" valor={bajo} tono={bajo ? "alerta" : "ok"} detalle="Conviene reponer" />
        <Kpi etiqueta="Sin stock" valor={sinStock} tono={sinStock ? "alerta" : "ok"} />
      </section>

      {(Object.keys(CATEGORIAS_INSUMO) as CategoriaInsumo[]).map((cat) => {
        const lista = items.filter((i) => i.categoria === cat);
        return (
          <section key={cat} className="card overflow-x-auto">
            <h2 className="border-b border-borde px-5 py-3 font-semibold text-marino">{CATEGORIAS_INSUMO[cat]}</h2>
            {lista.length === 0 ? <Vacio>No hay ítems en esta categoría.</Vacio> : (
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr><th className="th">Ítem</th><th className="th">Stock</th><th className="th">Mínimo</th><th className="th">Registrar movimiento</th><th className="th"></th></tr>
                </thead>
                <tbody>
                  {lista.map((i) => {
                    const alerta = i.activo && i.stock < i.stockMinimo;
                    return (
                      <tr key={i.id} className={i.activo ? "" : "text-texto-2"}>
                        <td className="td font-medium">{i.nombre}{!i.activo && " (inactivo)"}</td>
                        <td className="td whitespace-nowrap">
                          <span className={`text-base font-bold ${alerta ? "text-[#991b1b]" : "text-marino"}`}>{i.stock}</span>{" "}
                          <span className="text-xs text-texto-2">{i.unidad}</span>
                          {alerta && (
                            <span className="ml-2 rounded-full bg-[#fee2e2] px-2 py-0.5 text-[11px] font-semibold text-[#991b1b]">
                              {i.stock === 0 ? "Sin stock" : "Reponer"}
                            </span>
                          )}
                        </td>
                        <td className="td">
                          <SiPuede modulo="logistica" sino={i.stockMinimo}>
                          <form action={actualizarMinimo} className="flex gap-1.5">
                            <input type="hidden" name="id" value={i.id} />
                            <input name="stockMinimo" type="number" min={0} defaultValue={i.stockMinimo} aria-label={`Stock mínimo de ${i.nombre}`} className="campo w-20 py-1.5" />
                            <button className="enlace text-[13px]">Guardar</button>
                          </form>
                          </SiPuede>
                        </td>
                        <td className="td py-2">{i.activo && <SiPuede modulo="logistica"><FormMovimiento insumoId={i.id} nombre={i.nombre} /></SiPuede>}</td>
                        <td className="td text-right">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

      <section className="card overflow-x-auto">
        <h2 className="border-b border-borde px-5 py-3 font-semibold text-marino">Últimos movimientos</h2>
        {movs.length === 0 ? <Vacio>Aún no se registran movimientos.</Vacio> : (
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr><th className="th">Fecha</th><th className="th">Ítem</th><th className="th">Movimiento</th><th className="th">Cantidad</th><th className="th">Stock resultante</th><th className="th">Motivo</th></tr></thead>
            <tbody>
              {movs.map(({ m, nombre, unidad }) => (
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
      </section>
    </>
  );
}
