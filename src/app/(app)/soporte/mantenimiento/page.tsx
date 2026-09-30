import SiPuede from "@/components/SiPuede";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/db";
import type { EstadoEquipo, TipoEquipo } from "@/db/schema";
import { Encabezado, Vacio } from "@/components/ui";
import FormAlta from "@/components/FormAlta";
import { cambiarEstadoEquipo, eliminarEquipo } from "@/lib/acciones-maestros";
import BotonEliminar from "@/components/BotonEliminar";
import { crearEquipo } from "@/lib/acciones-inventario";
import { TIPOS_EQUIPO } from "@/lib/inventario";
import { fechaCorta } from "@/lib/fechas";

export const metadata = { title: "Mantenimiento · Inventario de equipos" };

const ESTADO: Record<EstadoEquipo, { txt: string; cls: string }> = {
  operativo: { txt: "Operativo", cls: "bg-[#dcfce7] text-[#166534]" },
  en_reparacion: { txt: "En reparación", cls: "bg-[#fef3c7] text-[#92400e]" },
  de_baja: { txt: "De baja", cls: "bg-[#fee2e2] text-[#991b1b]" },
};

const TIPOS = Object.keys(TIPOS_EQUIPO) as TipoEquipo[];
const RESULTADO: Record<string, string> = { ok: "operativo", falla: "con falla", correccion: "requiere corrección", no_devuelto: "no volvió" };

export default async function Mantenimiento({ searchParams }: PageProps<"/soporte/mantenimiento">) {
  await connection();
  const sp = await searchParams;
  const filtro = TIPOS.includes(sp.tipo as TipoEquipo) ? (sp.tipo as TipoEquipo) : null;
  const [todos, sedes] = await Promise.all([
    db.query.equipos.findMany({
      with: {
        sede: true,
        revisiones: { orderBy: (t, { desc }) => [desc(t.fecha), desc(t.id)], with: { programacion: { with: { sede: true } } } },
      },
      orderBy: (t) => [t.tipo, t.codigo],
    }),
    db.query.sedes.findMany({ orderBy: (t) => t.nombre }),
  ]);
  const eqs = filtro ? todos.filter((q) => q.tipo === filtro) : todos;
  // Tarjetas: los 7 tipos principales siempre; «Otro» solo si hay alguno
  const tarjetas = TIPOS.filter((t) => t !== "otro" || todos.some((q) => q.tipo === "otro"));

  return (
    <>
      <Encabezado antetitulo="Soporte · Mantenimiento" titulo="Inventario de equipos" />
      <p className="-mt-3 max-w-3xl text-sm text-texto-2">
        Cada equipo con su código y estado. El asistente lo contrasta al «Probar equipos tecnológicos» en la pre-capacitación.
      </p>

      <section aria-label="Resumen por tipo" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {tarjetas.map((t) => {
          const lista = todos.filter((q) => q.tipo === t);
          const ok = lista.filter((q) => q.estado === "operativo").length;
          const rep = lista.filter((q) => q.estado === "en_reparacion").length;
          const activa = filtro === t;
          return (
            <Link
              key={t}
              href={activa ? "/soporte/mantenimiento" : `/soporte/mantenimiento?tipo=${t}`}
              aria-current={activa ? "true" : undefined}
              className={`card flex flex-col gap-1 p-4 transition-colors hover:border-marino-2 ${activa ? "border-2 border-acento" : ""}`}
            >
              <span className="text-[13px] text-texto-2">{TIPOS_EQUIPO[t].plural}</span>
              <span className="text-2xl font-bold text-marino">{lista.length}</span>
              <span className="text-[11px] text-texto-2">
                <span className="text-[#166534]">{ok} operativos</span>
                {rep > 0 && <span className="text-[#92400e]"> · {rep} en reparación</span>}
              </span>
            </Link>
          );
        })}
      </section>

      <SiPuede modulo="mantenimiento">
      <FormAlta
        titulo="Registrar equipo"
        accion={crearEquipo}
        boton="Agregar equipo"
        campos={[
          { name: "tipo", label: "Tipo", required: true, opciones: TIPOS.map((t) => ({ valor: t, texto: TIPOS_EQUIPO[t].singular })) },
          { name: "codigo", label: "Código (ej. LAP-01)", required: true },
          { name: "nombre", label: "Marca / modelo" },
          { name: "serie", label: "N.° de serie" },
          {
            name: "sedeId",
            label: "Ubicación",
            opciones: [{ valor: "", texto: "Itinerante (se lleva a la sede)" }, ...sedes.map((s) => ({ valor: String(s.id), texto: s.nombre }))],
          },
          { name: "observacion", label: "Observación" },
        ]}
      />
      </SiPuede>

      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-borde px-5 py-3">
          <h2 className="font-semibold text-marino">{filtro ? TIPOS_EQUIPO[filtro].plural : "Todos los equipos"} ({eqs.length})</h2>
          {filtro && <Link href="/soporte/mantenimiento" className="enlace text-[13px]">Ver todos</Link>}
        </div>
        {eqs.length === 0 ? (
          <Vacio>No hay equipos registrados{filtro ? " de este tipo" : ""}.</Vacio>
        ) : (
          <table className="w-full min-w-[1100px] text-sm">
            <thead><tr><th className="th">Código</th><th className="th">Tipo</th><th className="th">Marca / modelo</th><th className="th">Serie</th><th className="th">Ubicación</th><th className="th">Estado</th><th className="th">Uso y revisiones</th><th className="th">Actualizar estado</th></tr></thead>
            <tbody>
              {eqs.map((q) => (
                <tr key={q.id}>
                  <td className="td font-medium">{q.codigo}</td>
                  <td className="td">{TIPOS_EQUIPO[q.tipo].singular}</td>
                  <td className="td">
                    <div className="flex flex-col"><span>{q.nombre}</span>{q.observacion && <span className="text-xs text-texto-2">{q.observacion}</span>}</div>
                  </td>
                  <td className="td">{q.serie ?? "—"}</td>
                  <td className="td">{q.sede?.nombre ?? "Itinerante"}</td>
                  <td className="td"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO[q.estado].cls}`}>{ESTADO[q.estado].txt}</span></td>
                  <td className="td">
                    {q.revisiones.length === 0 ? (
                      <span className="text-xs text-texto-2">Sin uso registrado</span>
                    ) : (
                      <details className="text-[13px]">
                        <summary className="cursor-pointer">
                          {q.revisiones.filter((r) => r.usado).length} sesión(es) ·{" "}
                          {q.revisiones.reduce((a, r) => a + Number(r.horasUso ?? 0), 0)} h ·{" "}
                          <span className={q.revisiones[0].resultado === "ok" ? "text-[#166534]" : "font-semibold text-[#991b1b]"}>
                            última: {RESULTADO[q.revisiones[0].resultado] ?? q.revisiones[0].resultado}
                          </span>
                        </summary>
                        <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-borde pl-2 text-xs">
                          {q.revisiones.slice(0, 8).map((r) => {
                            const malos = Object.entries(r.chequeos).filter(([, ok]) => !ok).map(([k]) => k);
                            return (
                              <li key={r.id}>
                                <strong>{fechaCorta(r.fecha)}</strong>
                                {r.programacion ? ` · ${r.programacion.sede.nombre}` : ""} · {r.usado ? `${Number(r.horasUso ?? 0)} h` : "no se usó"} ·{" "}
                                <span className={r.resultado === "ok" ? "text-[#166534]" : "font-semibold text-[#991b1b]"}>{RESULTADO[r.resultado] ?? r.resultado}</span>
                                {malos.length > 0 && <span className="text-[#991b1b]"> · {malos.join(", ")}</span>}
                                {r.observacion && <span className="text-texto-2"> · {r.observacion}</span>}
                                {r.revisadoPor && <span className="text-texto-2"> · revisó {r.revisadoPor}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td className="td">
                    <SiPuede modulo="mantenimiento" sino={<span className="text-xs text-texto-2">{q.observacion ?? "—"}</span>}>
                    <form action={cambiarEstadoEquipo} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={q.id} />
                      <select name="estado" defaultValue={q.estado} aria-label={`Estado de ${q.codigo}`} className="campo w-40 py-1.5">
                        {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.txt}</option>)}
                      </select>
                      <input name="observacion" defaultValue={q.observacion ?? ""} placeholder="Observación" aria-label={`Observación de ${q.codigo}`} className="campo w-48 py-1.5" />
                      <button className="btn-secundario py-1.5 text-[13px]">Guardar</button>
                    </form>
                    </SiPuede>
                    <SiPuede modulo="mantenimiento">
                    <div className="mt-1">
                      <BotonEliminar
                        accion={eliminarEquipo}
                        campos={{ id: q.id }}
                        pregunta={`¿Eliminar ${q.codigo}?`}
                        detalle={q.revisiones.length ? `Se borra su historial (${q.revisiones.length} revisión/es). Si solo está dañado, mejor márcalo «De baja».` : "Si solo está dañado, mejor márcalo «De baja»."}
                      />
                    </div>
                    </SiPuede>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
