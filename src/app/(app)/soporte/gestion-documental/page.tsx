import SiPuede from "@/components/SiPuede";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { componentes, programaciones } from "@/db/schema";
import { listarProgramaciones } from "@/lib/consultas";
import { contextosDe, examenes } from "@/lib/preparacion";
import { estadoPaso } from "@/lib/flujo-pre";
import { fechaCorta, hoyISO, sumarDias } from "@/lib/fechas";
import { Encabezado, Vacio } from "@/components/ui";
import FormSubirDocumento from "./FormSubirDocumento";
import EntregablesSesiones from "./EntregablesSesiones";
import { eliminarDocumento } from "@/lib/acciones-maestros";
import BotonEliminar from "@/components/BotonEliminar";
import { TIPO_DOC, enlaceDoc, tamanoLegible } from "@/lib/documentos";

export const metadata = { title: "Repositorio documental" };

const TIPO = TIPO_DOC;
const TIPOS_ACADEMICOS = new Set(["diapositiva", "taller", "examen_entrada", "examen_salida", "otro"]);

export default async function GestionDocumental({ searchParams }: PageProps<"/soporte/gestion-documental">) {
  await connection();
  const sp = await searchParams;
  const sesionSolicitada = Number(sp.sesion) || 0;
  const parte = sp.parte === "sesiones" ? "sesiones" : sp.parte === "fichas" ? "fichas" : "academico";

  const estructuras = await db.query.estructuras.findMany({ orderBy: (t, { asc }) => [asc(t.orden), asc(t.id)] });
  const proyectoSolicitado = Number(sp.proyecto) || Number(sp.estructura) || estructuras[0]?.id;
  const proyecto = estructuras.find((e) => e.id === proyectoSolicitado) ?? estructuras[0];

  const [arbol, docs, proximas] = await Promise.all([
    db.query.componentes.findMany({
      where: proyecto ? eq(componentes.estructuraId, proyecto.id) : undefined,
      orderBy: (t, { asc }) => [asc(t.orden)],
      with: {
        actividades: {
          orderBy: (t, { asc }) => [asc(t.orden)],
          with: { modulos: { orderBy: (t, { asc }) => [asc(t.orden)], with: { sesiones: { orderBy: (t, { asc }) => [asc(t.orden)] } } } },
        },
      },
    }),
    db.query.documentos.findMany({ with: { sesion: true, programacion: { with: { sede: true } } }, orderBy: (t) => [t.sesionId, t.tipo, t.nombre] }),
    listarProgramaciones(and(gte(programaciones.fecha, sumarDias(hoyISO(), -7)), ne(programaciones.estado, "cancelada"))),
  ]);

  const sesiones = arbol.flatMap((c) =>
    c.actividades.flatMap((a) => a.modulos.flatMap((m) => m.sesiones.map((s) => ({ ...s, grupo: `${c.nombre} › ${a.nombre} › ${m.nombre}` })))),
  );
  const sesionSel = sesiones.some((s) => s.id === sesionSolicitada) ? sesionSolicitada : 0;
  const idsSesiones = new Set(sesiones.map((s) => s.id));
  const examenPorSesion = await examenes(sesiones.map((s) => s.id));
  const proximasProyecto = proyecto
    ? proximas.filter((p) => p.sesion.modulo.actividad.componente.estructuraId === proyecto.id)
    : proximas;

  // Bandeja: fichas esperando revisión de Gestión Documental, dentro del proyecto seleccionado
  const ctxs = await contextosDe(proximasProyecto);
  const porRevisar = proximasProyecto.filter((p) => estadoPaso("revisar_ficha", ctxs.get(p.id)!) === "disponible");

  const visibles = docs.filter((d) => {
    const academico = !d.programacionId && TIPOS_ACADEMICOS.has(d.tipo);
    const idSesion = d.sesionId ?? d.programacion?.sesionId ?? null;
    return idSesion != null && idsSesiones.has(idSesion) && (sesionSel === 0 || idSesion === sesionSel) && (parte === "academico" ? academico : parte === "sesiones" && !academico);
  });
  const docsPorSesion = new Map<number, typeof visibles>();
  for (const d of visibles) {
    const idSesion = d.sesionId ?? d.programacion?.sesionId ?? null;
    if (idSesion != null) docsPorSesion.set(idSesion, [...(docsPorSesion.get(idSesion) ?? []), d]);
  }
  const hrefParte = (nombre: "academico" | "sesiones" | "fichas") => `/soporte/gestion-documental?${proyecto ? `proyecto=${proyecto.id}&` : ""}parte=${nombre}${sesionSel ? `&sesion=${sesionSel}` : ""}`;

  return (
    <>
      <Encabezado antetitulo="Soporte" titulo="Repositorio documental" />

      {estructuras.length > 1 && (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border-l-4 border-l-marino bg-[#f3f6fa] px-3 py-2.5 sm:px-4">
          <div className="min-w-32">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-texto-2">Proyecto</p>
            {proyecto && <p className="text-sm font-bold text-marino">{proyecto.nombre}</p>}
          </div>
          <nav aria-label="Proyectos del repositorio" className="flex flex-wrap gap-2">
            {estructuras.map((e) => {
              const seleccionado = proyecto?.id === e.id;
              return (
                <Link
                  key={e.id}
                  href={`/soporte/gestion-documental?proyecto=${e.id}&parte=${parte}`}
                  aria-current={seleccionado ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${seleccionado ? "border-marino bg-marino text-white shadow-sm" : "border-[#cbd5e1] bg-white text-marino hover:border-marino hover:bg-[#e8eef5]"}`}
                >
                  <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${seleccionado ? "bg-white/20" : "bg-[#e8eef5]"}`}>{seleccionado ? "✓" : "⌖"}</span>
                  {e.nombre}
                  {seleccionado && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Actual</span>}
                </Link>
              );
            })}
          </nav>
        </section>
      )}

      <nav role="tablist" aria-label="Partes del repositorio" className="flex flex-wrap gap-2 border-b border-borde">
        <Link
          role="tab"
          aria-selected={parte === "academico"}
          href={hrefParte("academico")}
          className={`rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${parte === "academico" ? "border-b-2 border-marino bg-white text-marino" : "text-texto-2 hover:bg-[#eef1f5] hover:text-marino"}`}
        >
          Material Académico y exámenes
        </Link>
        <Link
          role="tab"
          aria-selected={parte === "sesiones"}
          href={hrefParte("sesiones")}
          className={`rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${parte === "sesiones" ? "border-b-2 border-marino bg-white text-marino" : "text-texto-2 hover:bg-[#eef1f5] hover:text-marino"}`}
        >
          Entregable de sesiones
        </Link>
        <Link
          role="tab"
          aria-selected={parte === "fichas"}
          href={hrefParte("fichas")}
          className={`rounded-t-lg px-4 py-3 text-sm font-semibold transition-colors ${parte === "fichas" ? "border-b-2 border-marino bg-white text-marino" : "text-texto-2 hover:bg-[#eef1f5] hover:text-marino"}`}
        >
          Fichas por revisar <span className="ml-1 rounded-full bg-[#fce7f3] px-2 py-0.5 text-xs text-[#9d174d]">{porRevisar.length}</span>
        </Link>
      </nav>

      {parte === "fichas" && (
      <section className="card">
        <h2 className="border-b border-borde px-6 py-4 text-lg font-semibold text-marino">
          Fichas por revisar <span className="ml-1 rounded-full bg-[#fce7f3] px-2 py-0.5 text-sm text-[#9d174d]">{porRevisar.length}</span>
        </h2>
        {porRevisar.length === 0 ? (
          <Vacio>No hay fichas de capacitación esperando revisión.</Vacio>
        ) : (
          <ul>
            {porRevisar.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-6 py-3 last:border-0">
                <span className="text-sm"><strong>{fechaCorta(p.fecha)}</strong> · {p.sesion.nombre} · {p.sede.nombre}</span>
                <Link href={`/operativo/capacitaciones/${p.id}#ficha`} className="btn-secundario py-2 text-[13px]">Revisar ficha</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {parte !== "fichas" && <>
      <h2 className="mt-2 text-xl font-bold text-marino">{parte === "academico" ? "Material Académico y exámenes" : "Entregable de sesiones"}</h2>
      <p className="-mt-4 text-sm text-texto-2">
        {parte === "academico"
          ? "Material organizado por componente, actividad, módulo y sesión. Cada archivo queda asociado a la sesión correspondiente."
          : "Entregables organizados por sesión, fecha y sede: diapositivas, talleres o prácticas, asistencia, exámenes cuando correspondan, fotos, videos y viáticos."}
      </p>

      <form key={`${proyecto?.id}:${parte}:${sesionSel}`} className="flex items-end gap-3">
        <input type="hidden" name="parte" value={parte} />
        {proyecto && <input type="hidden" name="proyecto" value={proyecto.id} />}
        <div className="w-96">
          <label htmlFor="gd-ses" className="etiqueta">Filtrar por sesión</label>
          <select id="gd-ses" name="sesion" defaultValue={sesionSel || ""} className="campo">
            <option value="">Todas</option>
            {sesiones.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}
          </select>
        </div>
        <button className="btn-secundario">Filtrar</button>
      </form>

      {parte === "academico" ? (
        <div className="space-y-4">
          {arbol.length === 0 ? <Vacio>Este proyecto todavía no tiene estructura de capacitaciones.</Vacio> : arbol.map((c) => (
            <section key={c.id} className="card overflow-hidden">
              <header className="border-b border-borde bg-[#eef2f7] px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-texto-2">Componente {c.codigo}</p>
                <h3 className="font-semibold text-marino">{c.nombre}</h3>
              </header>
              <div className="divide-y divide-borde px-4">
                {c.actividades.map((a) => (
                  <section key={a.id} className="py-4">
                    <h4 className="mb-3 text-sm font-bold text-marino">Actividad {a.codigo} · {a.nombre}</h4>
                    <div className="space-y-3">
                      {a.modulos.map((m) => (
                        <section key={m.id} className="rounded-lg border border-[#dce3ec] bg-[#fafbfd] p-3">
                          <h5 className="mb-2 text-[13px] font-semibold text-texto-2">{m.codigo} · {m.nombre}</h5>
                          <div className="space-y-2">
                            {m.sesiones.filter((s) => !sesionSel || s.id === sesionSel).map((s) => {
                              const examen = examenPorSesion.get(s.id);
                              const documentosSesion = docsPorSesion.get(s.id) ?? [];
                              const tiposSesion = Object.entries(TIPO).filter(([valor]) => {
                                if (!TIPOS_ACADEMICOS.has(valor)) return false;
                                if (valor === "examen_entrada") return examen === "entrada" || examen === "ambos";
                                if (valor === "examen_salida") return examen === "salida" || examen === "ambos";
                                return true;
                              }).map(([valor, texto]) => ({ valor, texto }));
                              return (
                                <div key={s.id} className="grid rounded-md border border-[#dce3ec] bg-white lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                                  <div className="flex flex-wrap content-start items-center gap-2 px-3 py-3 text-sm">
                                    <span className="text-xs font-bold text-marino">{s.codigo}</span>
                                    <span className="w-full font-semibold">{s.nombre}</span>
                                    {(examen === "entrada" || examen === "ambos") && <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-semibold text-[#5b21b6]">Examen de entrada</span>}
                                    {(examen === "salida" || examen === "ambos") && <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-semibold text-[#5b21b6]">Examen de salida</span>}
                                    <span className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-[11px] text-texto-2">{documentosSesion.length} archivo(s)</span>
                                  </div>
                                  <div className="min-w-0 space-y-3 border-t border-[#e6ebf1] p-3 lg:border-l lg:border-t-0">
                                    {documentosSesion.length ? (
                                      <ul className="divide-y divide-[#eef1f5] rounded-md border border-[#e6ebf1]">
                                        {documentosSesion.map((d) => (
                                          <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                                            <span className="rounded bg-[#eef1f5] px-2 py-0.5 text-xs font-semibold text-texto-2">{TIPO[d.tipo]}</span>
                                            <a href={enlaceDoc(d)} target={d.archivo ? undefined : "_blank"} rel="noreferrer" className="enlace min-w-0 flex-1">{d.archivo ? "⬇" : "↗"} {d.nombre}</a>
                                            {d.version && <span className="text-xs text-texto-2">{d.version}</span>}
                                            {d.tamano != null && <span className="text-xs text-texto-2">{tamanoLegible(d.tamano)}</span>}
                                            <SiPuede modulo="documental">
                                              <BotonEliminar accion={eliminarDocumento} campos={{ id: d.id }} etiqueta="Quitar" pregunta={`¿Quitar «${d.nombre}»?`} detalle={d.archivo ? "Se borra el archivo guardado." : undefined} />
                                            </SiPuede>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : <p className="text-xs text-texto-2">Todavía no hay documentos para esta sesión.</p>}
                                    <SiPuede modulo="documental">
                                      <FormSubirDocumento
                                        key={s.id}
                                        sesionInicial={String(s.id)}
                                        tipos={tiposSesion}
                                        sesiones={[]}
                                      />
                                    </SiPuede>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EntregablesSesiones arbol={arbol} docs={docs} sesionSel={sesionSel} examenPorSesion={examenPorSesion} proyectoId={proyecto?.id} programacionSel={Number(sp.programacion) || 0} />
      )}
      </>}
    </>
  );
}
