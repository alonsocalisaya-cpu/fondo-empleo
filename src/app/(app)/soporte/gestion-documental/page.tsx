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
import { TIPO_DOC } from "@/lib/documentos";
import { Desplegable, ArchivosRepositorio } from "./PresentacionRepositorio";

export const metadata = { title: "Repositorio documental" };

const TIPO = TIPO_DOC;
const TIPOS_ACADEMICOS = new Set(["diapositiva", "taller", "examen_entrada", "examen_salida", "otro"]);

export default async function GestionDocumental({ searchParams }: PageProps<"/soporte/gestion-documental">) {
  await connection();
  const sp = await searchParams;
  const sesionSolicitada = Number(sp.sesion) || 0;
  const parte = sp.parte === "sesiones" ? "sesiones" : sp.parte === "fichas" ? "fichas" : "academico";
  const detalleEntregables = parte === "sesiones" && Number(sp.programacion) > 0;

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
  const porRevisar = proximasProyecto.filter((p) => estadoPaso("revisar_recursos", ctxs.get(p.id)!) === "disponible");

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
          Requerimientos por revisar <span className="ml-1 rounded-full bg-[#fce7f3] px-2 py-0.5 text-xs text-[#9d174d]">{porRevisar.length}</span>
        </Link>
      </nav>

      {parte === "fichas" && (
      <Desplegable titulo="Requerimientos por revisar" cantidad={String(porRevisar.length)}>
        {porRevisar.length === 0 ? (
          <Vacio>No hay requerimientos esperando revisión.</Vacio>
        ) : (
          <ul>
            {porRevisar.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-6 py-3 last:border-0">
                <span className="text-sm"><strong>{fechaCorta(p.fecha)}</strong> · {p.sesion.nombre} · {p.sede.nombre}</span>
                <Link href={`/operativo/capacitaciones/${p.id}?vista=pre&paso=revisar_recursos`} className="btn-secundario py-2 text-[13px]">Revisar requerimientos</Link>
              </li>
            ))}
          </ul>
        )}
      </Desplegable>
      )}

      {parte !== "fichas" && <>
      <h2 className="mt-2 text-xl font-bold text-marino">{parte === "academico" ? "Material Académico y exámenes" : "Entregable de sesiones"}</h2>
      {!detalleEntregables && <p className="-mt-4 text-sm text-texto-2">
        {parte === "academico"
          ? "Material organizado por componente, actividad, módulo y sesión. Cada archivo queda asociado a la sesión correspondiente."
          : "Entregables organizados por sesión, fecha y sede: diapositivas, talleres o prácticas, asistencia, exámenes cuando correspondan, fotos, videos y viáticos."}
      </p>}

      {!detalleEntregables && <form key={`${proyecto?.id}:${parte}:${sesionSel}`} className="flex items-end gap-3">
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
      </form>}

      {parte === "academico" ? (
        <div className="space-y-4">
          {arbol.length === 0 ? <Vacio>Este proyecto todavía no tiene estructura de capacitaciones.</Vacio> : arbol.map((c) => (
            <Desplegable key={c.id} titulo={`Componente ${c.codigo} · ${c.nombre}`}>
              <div className="divide-y divide-borde px-4">
                {c.actividades.map((a) => (
                  <Desplegable key={a.id} titulo={`Actividad ${a.codigo} · ${a.nombre}`}>
                    <div className="space-y-3">
                      {a.modulos.map((m) => (
                        <Desplegable key={m.id} titulo={`${m.codigo} · ${m.nombre}`}>
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
                                <Desplegable key={s.id} titulo={`${s.codigo} · ${s.nombre}`} cantidad={`${documentosSesion.length} archivo(s)`}>
                                  <div className="flex flex-wrap content-start items-center gap-2 px-3 py-3 text-sm">
                                    {(examen === "entrada" || examen === "ambos") && <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-semibold text-[#5b21b6]">Examen de entrada</span>}
                                    {(examen === "salida" || examen === "ambos") && <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-semibold text-[#5b21b6]">Examen de salida</span>}
                                    <span className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-[11px] text-texto-2">{documentosSesion.length} archivo(s)</span>
                                  </div>
                                  <div className="min-w-0 space-y-3">
                                    {documentosSesion.length ? (
                                      <ArchivosRepositorio docs={documentosSesion} />
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
                                </Desplegable>
                              );
                            })}
                          </div>
                        </Desplegable>
                      ))}
                    </div>
                  </Desplegable>
                ))}
              </div>
            </Desplegable>
          ))}
        </div>
      ) : (
        <EntregablesSesiones arbol={arbol} docs={docs} sesionSel={sesionSel} examenPorSesion={examenPorSesion} proyectoId={proyecto?.id} programacionSel={Number(sp.programacion) || 0} />
      )}
      </>}
    </>
  );
}
