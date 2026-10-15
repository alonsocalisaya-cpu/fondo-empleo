import SiPuede from "@/components/SiPuede";
import { connection } from "next/server";
import { db } from "@/db";
import { insumos, type CategoriaInsumo } from "@/db/schema";
import { Encabezado, Kpi, Vacio } from "@/components/ui";
import FormAlta from "@/components/FormAlta";
import { alternarInsumo, crearInsumo, crearRefrigerioInicial } from "@/lib/acciones-inventario";
import { CATEGORIAS_INSUMO } from "@/lib/inventario";
import FormMovimiento from "./FormMovimiento";
import BotonEliminar from "@/components/BotonEliminar";
import { eliminarInsumo } from "@/lib/acciones-maestros";
import Link from "next/link";

export const metadata = { title: "Logística · Inventario" };

export default async function Logistica() {
  await connection();
  const items = await db.select().from(insumos).orderBy(insumos.categoria, insumos.nombre);
  const activos = items.filter((i) => i.activo);
  const sinStock = activos.filter((i) => i.stock === 0).length;
  const materiales = activos.filter((i) => i.categoria === "material").length;
  const refrigerios = activos.filter((i) => i.categoria === "refrigerio").length;

  return (
    <>
      <Encabezado antetitulo="Soporte · Logística" titulo="Inventario de materiales y refrigerios" />

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi etiqueta="Ítems en inventario" valor={activos.length} />
        <Kpi etiqueta="Materiales" valor={materiales} />
        <Kpi etiqueta="Refrigerios" valor={refrigerios} />
        <Kpi etiqueta="Sin stock" valor={sinStock} tono={sinStock ? "alerta" : "ok"} />
      </section>

      <div className="flex justify-end">
        <Link href="/soporte/logistica/movimientos" className="btn-secundario">Ver movimientos de inventario</Link>
      </div>

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
                {lista.map((i) => (
                  <details key={i.id} className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      <span aria-hidden="true" className="text-texto-2 transition-transform group-open:rotate-90">▶</span>
                      <span className={`min-w-32 flex-1 font-semibold ${i.activo ? "text-marino" : "text-texto-2"}`}>{i.nombre}{!i.activo && " (inactivo)"}</span>
                      <span className="whitespace-nowrap rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-base font-bold text-marino">{i.stock}</span>{" "}
                        <span className="text-xs text-texto-2">{i.unidad}</span>
                        {i.activo && i.stock === 0 && <span className="ml-2 rounded-full bg-[#fee2e2] px-2 py-0.5 text-[11px] font-semibold text-[#991b1b]">Sin stock</span>}
                      </span>
                      <span className="text-xs font-medium text-texto-2">Abrir ficha</span>
                    </summary>
                    <div className="space-y-4 border-t border-borde bg-slate-50/50 p-4 sm:p-5">
                      <SiPuede modulo="logistica">
                        <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-borde bg-white p-4">
                          {i.activo && <details className="min-w-0 flex-1 rounded-lg border border-borde p-3">
                            <summary className="cursor-pointer font-semibold text-marino">Registrar movimiento</summary>
                            <div className="mt-3"><FormMovimiento insumoId={i.id} nombre={i.nombre} /></div>
                          </details>}
                          <div className="flex items-start justify-end gap-4">
                            <form action={alternarInsumo}>
                              <input type="hidden" name="id" value={i.id} />
                              <button className="enlace text-[13px]">{i.activo ? "Desactivar" : "Activar"}</button>
                            </form>
                            <BotonEliminar accion={eliminarInsumo} campos={{ id: i.id }} pregunta={`¿Eliminar ${i.nombre} del inventario?`} detalle="Se borran sus movimientos de stock. En las fichas queda como ítem extra." />
                          </div>
                        </div>
                      </SiPuede>
                      <Link href={`/soporte/logistica/movimientos?insumo=${i.id}`} className="enlace text-sm">Ver movimientos de {i.nombre}</Link>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <SiPuede modulo="logistica">
        <FormAlta titulo="Agregar ítem al inventario" accion={crearInsumo} boton="Agregar ítem" campos={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "categoria", label: "Categoría", opciones: Object.entries(CATEGORIAS_INSUMO).map(([valor, texto]) => ({ valor, texto })) },
          { name: "unidad", label: "Unidad (unidades, cajas…)" },
          { name: "stock", label: "Stock inicial", type: "number", inputMode: "numeric" },
        ]} />
      </SiPuede>
    </>
  );
}
