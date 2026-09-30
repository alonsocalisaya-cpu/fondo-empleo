import { exigirUsuario, puedeVerSesion } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cargarExpediente } from "@/lib/preparacion";
import { ruta, combinadas } from "@/lib/consultas";
import { fechaLarga, hora, TURNO_LABEL } from "@/lib/fechas";
import { nombreCompleto } from "@/components/ui";
import BotonImprimir from "@/components/BotonImprimir";
import { ENTREGABLES, GASTOS, PREGUNTAS_PREPARACION, type Ficha2 } from "@/lib/ficha2";

export const metadata = { title: "Ficha de capacitación" };

const CATEGORIAS = {
  material_capacitador: "Material solicitado por el capacitador",
  dinamica: "Material para dinámicas",
  refrigerio: "Insumos de refrigerio",
  tecnologico: "Equipos tecnológicos",
} as const;

const celda = "border border-[#94a3b8] px-2 py-1.5";

export default async function Ficha({ params }: PageProps<"/operativo/capacitaciones/[id]/ficha">) {
  await connection();
  const e = await cargarExpediente(Number((await params).id));
  if (!e || !puedeVerSesion(await exigirUsuario(), e.p)) notFound();
  const { p, ctx } = e;
  const d = (k: string) => (ctx.pasos[k] ?? {}) as Record<string, unknown>;
  const f2 = d("llenar_ficha2") as Ficha2;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 bg-white p-8 text-[13px] print:max-w-none print:p-0">
      <div className="flex justify-between print:hidden">
        <Link href={`/operativo/capacitaciones/${p.id}`} className="btn-secundario">← Volver al expediente</Link>
        <BotonImprimir />
      </div>

      <header className="flex items-end justify-between border-b-2 border-marino pb-3">
        <div>
          <h1 className="text-2xl font-bold text-marino">Ficha de capacitación</h1>
          <p>{ruta(p, "completa")}</p>
          <p className="text-base font-semibold">{p.sesion.codigo} · {[p.sesion.nombre, ...combinadas(p)].join(" + ")}</p>
        </div>
        <p className="text-right text-xs text-texto-2">N.° {String(p.id).padStart(5, "0")}</p>
      </header>

      <table className="w-full border-collapse">
        <tbody>
          <tr><th className={`${celda} w-40 bg-[#eef1f5] text-left`}>Fecha y horario</th><td className={celda}>{fechaLarga(p.fecha)} · {hora(p.horaInicio)} – {hora(p.horaFin)}</td></tr>
          <tr><th className={`${celda} bg-[#eef1f5] text-left`}>Sede / aula</th><td className={celda}>{p.sede.nombre} · {p.aula ?? "—"}</td></tr>
          <tr><th className={`${celda} bg-[#eef1f5] text-left`}>Capacitador</th><td className={celda}>{nombreCompleto(p.capacitador)}</td></tr>
          <tr><th className={`${celda} bg-[#eef1f5] text-left`}>Asistente</th><td className={celda}>{nombreCompleto(p.asistente)}</td></tr>
          <tr><th className={`${celda} bg-[#eef1f5] text-left`}>Programados</th><td className={celda}>{e.inscritos} beneficiarios · turno {TURNO_LABEL[p.turno].toLowerCase()}</td></tr>
        </tbody>
      </table>

      {(p.sesion.contenido || p.sesion.recursoMetodologico || p.sesion.perfilSalida) && (
        <table className="w-full border-collapse">
          <tbody>
            {p.sesion.contenido && (
              <tr><th className={`${celda} w-40 bg-[#eef1f5] text-left align-top`}>Contenido</th><td className={`${celda} whitespace-pre-line`}>{p.sesion.contenido}</td></tr>
            )}
            {p.sesion.recursoMetodologico && (
              <tr><th className={`${celda} bg-[#eef1f5] text-left align-top`}>Recurso metodológico</th><td className={`${celda} whitespace-pre-line`}>{p.sesion.recursoMetodologico}</td></tr>
            )}
            {p.sesion.perfilSalida && (
              <tr><th className={`${celda} bg-[#eef1f5] text-left align-top`}>Perfil de salida</th><td className={celda}>{p.sesion.perfilSalida}</td></tr>
            )}
          </tbody>
        </table>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-marino">1ra sección · Material e insumos</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#eef1f5]">
              <th className={`${celda} text-left`}>Categoría</th>
              <th className={`${celda} w-16`}>Cant.</th>
              <th className={`${celda} text-left`}>Descripción</th>
              <th className={`${celda} w-20`}>Listo</th>
              <th className={`${celda} w-24`}>Devuelto</th>
            </tr>
          </thead>
          <tbody>
            {e.items.length === 0 && (
              <tr><td colSpan={5} className={`${celda} text-center text-texto-2`}>Sin ítems registrados</td></tr>
            )}
            {e.items.map((i) => (
              <tr key={i.id}>
                <td className={celda}>{CATEGORIAS[i.categoria]}</td>
                <td className={`${celda} text-center`}>{i.cantidad}</td>
                <td className={celda}>{i.descripcion}</td>
                <td className={`${celda} text-center`}>{i.listo ? "✓" : "☐"}</td>
                <td className={`${celda} text-center`}>{f2.devoluciones?.find((x) => x.itemId === i.id)?.cantidad ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Viáticos: solicitado S/ {Number(d("solicitar_viaticos").monto ?? 0).toFixed(2)} · entregado S/ {Number(d("entregar_viaticos").monto ?? 0).toFixed(2)} ·
          Equipos probados: {ctx.pasos.probar_equipos ? (d("probar_equipos").resultado === "observado" ? `con observaciones (${d("probar_equipos").obs})` : "operativos") : "pendiente"}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-marino">2da sección · Post-capacitación</h2>
        <table className="w-full border-collapse">
          <tbody>
            {(
              [
                ["Programados", f2.programados ?? (ctx.pasos.llenar_ficha2 ? "" : null)],
                ["Asistentes", f2.asistentes],
                ["% de asistencia", f2.pctAsistencia != null ? `${f2.pctAsistencia}%` : null],
                ["Hora de llegada a sede", f2.horaLlegada],
                ["Hora de inicio real", f2.horaInicioReal],
                ["Hora de término real", f2.horaFinReal],
                ["Incidencias", f2.incidencias],
                ["Observaciones del capacitador", f2.obsCapacitador],
              ] as const
            ).map(([t, v]) => (
              <tr key={t}>
                <th className={`${celda} w-56 bg-[#eef1f5] text-left`}>{t}</th>
                <td className={`${celda} h-9 whitespace-pre-line`}>{v ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-2 font-semibold">Marque con un aspa (x) los entregables presentados</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#eef1f5]"><th className={`${celda} text-left`}>Ítem</th><th className={`${celda} w-28`}>Completo</th></tr>
          </thead>
          <tbody>
            {ENTREGABLES.map((x) => {
              const v = f2.entregables?.[x.k];
              return (
                <tr key={x.k}>
                  <td className={celda}>{x.t}</td>
                  <td className={`${celda} text-center`}>{v === "completo" ? "X" : v === "no_corresponde" ? "N/C" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-2 font-semibold">Preparación de la capacitación</p>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#eef1f5]"><th className={`${celda} text-left`}>Ítem</th><th className={`${celda} w-20`}>Sí o No</th><th className={`${celda} text-left`}>Detalle</th></tr>
          </thead>
          <tbody>
            {PREGUNTAS_PREPARACION.map((q) => {
              const v = f2.preparacion?.[q.k];
              return (
                <tr key={q.k}>
                  <td className={celda}>{q.t}</td>
                  <td className={`${celda} text-center`}>{v ? (v.hubo ? "Sí" : "No") : ""}</td>
                  <td className={celda}>{v?.detalle ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <table className="mt-2 w-full border-collapse">
          <tbody>
            <tr>
              <th className={`${celda} w-56 bg-[#eef1f5] text-left align-top`}>Recomendación o feedback</th>
              <td className={`${celda} h-12 whitespace-pre-line`}>{f2.feedback ?? ""}</td>
            </tr>
          </tbody>
        </table>

        {(f2.devoluciones?.length ?? 0) > 0 && (
          <>
            <p className="mt-2 font-semibold">Restante a devolver</p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#eef1f5]"><th className={`${celda} text-left`}>Ítem</th><th className={`${celda} w-24`}>Salió</th><th className={`${celda} w-24`}>Restante</th></tr>
              </thead>
              <tbody>
                {f2.devoluciones!.map((x) => (
                  <tr key={x.itemId}><td className={celda}>{x.nombre}</td><td className={`${celda} text-center`}>{x.salio}</td><td className={`${celda} text-center`}>{x.cantidad}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {(f2.equipos?.length ?? 0) > 0 && (
          <>
            <p className="mt-2 font-semibold">Equipos llevados</p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#eef1f5]"><th className={`${celda} text-left`}>Equipo</th><th className={`${celda} w-24`}>¿Fallas?</th><th className={`${celda} w-28`}>¿Corrección?</th><th className={`${celda} text-left`}>Detalle</th></tr>
              </thead>
              <tbody>
                {f2.equipos!.map((x) => (
                  <tr key={x.equipoId}>
                    <td className={celda}>{x.equipo}</td>
                    <td className={`${celda} text-center`}>{x.falla ? "Sí" : "No"}</td>
                    <td className={`${celda} text-center`}>{x.correccion ? "Sí" : "No"}</td>
                    <td className={celda}>{x.detalle ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p className="mt-2 font-semibold">Gastos</p>
        <table className="w-full border-collapse">
          <tbody>
            {GASTOS.map((g) => (
              <tr key={g.k}>
                <td className={celda}>{g.t}</td>
                <td className={`${celda} w-32 text-right`}>{f2.gastos?.[g.k] ? `S/ ${f2.gastos[g.k].toFixed(2)}` : ""}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={`${celda} bg-[#eef1f5]`}>Total{f2.gastosDetalle ? ` · ${f2.gastosDetalle}` : ""}</td>
              <td className={`${celda} bg-[#eef1f5] text-right`}>{ctx.pasos.llenar_ficha2 ? `S/ ${Number(f2.totalGastos ?? 0).toFixed(2)}` : ""}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="mt-10 grid grid-cols-3 gap-10 text-center">
        <div className="border-t border-texto pt-2">Asistente de capacitación</div>
        <div className="border-t border-texto pt-2">Encargado de Gestión Documental<br />(revisión)</div>
        <div className="border-t border-texto pt-2">Jefe de Proyecto<br />(aprobación)</div>
      </div>
    </div>
  );
}
