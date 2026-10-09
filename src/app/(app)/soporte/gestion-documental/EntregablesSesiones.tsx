import Link from "next/link";
import type { documentos } from "@/db/schema";
import { listarProgramaciones } from "@/lib/consultas";
import { examenDe } from "@/lib/preparacion";
import { fechaCorta } from "@/lib/fechas";
import { enlaceDoc, seccionDe, tamanoLegible } from "@/lib/documentos";
import { ENTREGABLES, MINIMO_FOTOS, fotosEntregadas } from "@/lib/entregables";
import { eliminarDocumento } from "@/lib/acciones-maestros";
import SiPuede from "@/components/SiPuede";
import BotonEliminar from "@/components/BotonEliminar";
import { Vacio } from "@/components/ui";
import FormSubirDocumento from "./FormSubirDocumento";

type Nodo = { id: number; codigo: string; nombre: string };
type Arbol = (Nodo & { actividades: (Nodo & { modulos: (Nodo & { sesiones: Nodo[] })[] })[] })[];
type Documento = typeof documentos.$inferSelect;
type Examen = "entrada" | "salida" | "ambos" | null;

function Archivos({ documentos: docs }: { documentos: Documento[] }) {
  return <ul className="space-y-2">
    {docs.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
      <a href={enlaceDoc(d)} target={d.archivo ? undefined : "_blank"} rel="noreferrer" className="enlace min-w-0 flex-1 break-words">{d.archivo ? "⬇" : "↗"} {d.nombre}</a>
      {d.tamano != null && <span className="text-xs text-texto-2">{tamanoLegible(d.tamano)}</span>}
      <SiPuede modulo="documental"><BotonEliminar accion={eliminarDocumento} campos={{ id: d.id }} etiqueta="Quitar" pregunta={`¿Quitar «${d.nombre}»?`} detalle={d.archivo ? "Se borra el archivo guardado." : undefined} /></SiPuede>
    </li>)}
  </ul>;
}

export default async function EntregablesSesiones({ arbol, docs, sesionSel, examenPorSesion, proyectoId, programacionSel }: {
  arbol: Arbol; docs: Documento[]; sesionSel: number; examenPorSesion: Map<number, Examen>; proyectoId?: number; programacionSel: number;
}) {
  const programadas = await listarProgramaciones(undefined);
  const porSesion = new Map<number, typeof programadas>();
  for (const p of programadas) {
    for (const id of new Set([p.sesionId, ...p.combinadas.map((c) => c.sesionId)])) {
      porSesion.set(id, [...(porSesion.get(id) ?? []), p]);
    }
  }
  const porProgramacion = new Map<number, Documento[]>();
  for (const d of docs) if (d.programacionId) porProgramacion.set(d.programacionId, [...(porProgramacion.get(d.programacionId) ?? []), d]);
  const visibles = arbol.map((c) => ({ ...c, actividades: c.actividades.map((a) => ({ ...a,
    modulos: a.modulos.map((m) => ({ ...m, sesiones: m.sesiones.filter((s) => !sesionSel || s.id === sesionSel) })).filter((m) => m.sesiones.length),
  })).filter((a) => a.modulos.length) })).filter((c) => c.actividades.length);

  return <div className="space-y-4">
    {!visibles.length && <Vacio>Este proyecto todavía no tiene sesiones.</Vacio>}
    {visibles.map((c) => <section key={c.id} className="card overflow-hidden">
      <header className="border-b border-borde bg-[#eef2f7] px-5 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-texto-2">Componente {c.codigo}</p>
        <h3 className="font-semibold text-marino">{c.nombre}</h3>
      </header>
      <div className="divide-y divide-borde px-4">
        {c.actividades.map((a) => <section key={a.id} className="py-4">
          <h4 className="mb-3 text-sm font-bold text-marino">Actividad {a.codigo} · {a.nombre}</h4>
          <div className="space-y-3">{a.modulos.map((m) => <section key={m.id} className="rounded-lg border border-[#dce3ec] bg-[#fafbfd] p-3">
            <h5 className="mb-2 text-[13px] font-semibold text-texto-2">{m.codigo} · {m.nombre}</h5>
            <div className="space-y-2">{m.sesiones.map((s) => {
              const fechas = porSesion.get(s.id) ?? [];
              const sinFecha = docs.filter((d) => !d.programacionId && d.sesionId === s.id && !["diapositiva", "taller", "examen_entrada", "examen_salida", "otro"].includes(d.tipo));
              return <div key={s.id} className="grid rounded-md border border-[#dce3ec] bg-white lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="space-y-1 px-3 py-3 text-sm">
                  <p className="text-xs font-bold text-marino">{s.codigo}</p>
                  <p className="font-semibold">{s.nombre}</p>
                  <p className="text-xs text-texto-2">{fechas.length} programación(es)</p>
                </div>
                <div className="min-w-0 space-y-2 border-t border-[#e6ebf1] p-3 lg:border-l lg:border-t-0">
                  {!fechas.length && <p className="text-xs text-texto-2">Todavía no hay fechas programadas para esta sesión.</p>}
                  {fechas.map((p) => {
                    const archivos = porProgramacion.get(p.id) ?? [];
                    const examen = examenDe(p, examenPorSesion);
                    const nFotos = fotosEntregadas(archivos);
                    return <div key={p.id} className="rounded-md border border-borde">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm text-marino">
                        <div>
                        <strong>{fechaCorta(p.fecha)}</strong> · {p.sede.nombre} · {p.horaInicio.slice(0, 5)}–{p.horaFin.slice(0, 5)}
                        <span className="mt-1 block text-xs text-texto-2">{archivos.length} archivo(s) · Fotos: {nFotos}/{MINIMO_FOTOS}{p.combinadas.length ? " · Sesión combinada" : ""}{p.estado === "cancelada" ? " · Cancelada" : ""}</span>
                        </div>
                        <Link
                          href={`/soporte/gestion-documental?parte=sesiones${proyectoId ? `&proyecto=${proyectoId}` : ""}&sesion=${s.id}${programacionSel === p.id ? "" : `&programacion=${p.id}`}`}
                          className="btn-secundario text-xs"
                          aria-expanded={programacionSel === p.id}
                        >{programacionSel === p.id ? "Ocultar entregables" : "Ver entregables"}</Link>
                      </div>
                      {programacionSel === p.id && <div className="space-y-2 border-t border-borde p-3">
                        <Link href={`/operativo/capacitaciones/${p.id}?vista=post`} className="enlace text-xs">Abrir flujo de la sesión</Link>
                        {ENTREGABLES.filter((e) => e.seccion !== "examen" || examen).map((e) => {
                          const documentosCategoria = archivos.filter((d) => seccionDe(d) === e.seccion);
                          const tipos = e.seccion === "examen"
                            ? [
                              ...(examen === "entrada" || examen === "ambos" ? [{ valor: "examen_entrada", texto: "Examen de entrada" }] : []),
                              ...(examen === "salida" || examen === "ambos" ? [{ valor: "examen_salida", texto: "Examen de salida" }] : []),
                            ] : [{ valor: e.tipo, texto: e.titulo }];
                          return <details key={e.seccion} className="rounded-md border border-[#e6ebf1]">
                            <summary className="cursor-pointer px-3 py-2 text-sm">
                              <span className="font-semibold">{e.titulo}</span>
                              <span className="ml-2 text-xs text-texto-2">{e.seccion === "fotos" ? `${nFotos}/${MINIMO_FOTOS} fotos · ${nFotos >= MINIMO_FOTOS ? "Mínimo cumplido" : `Faltan ${MINIMO_FOTOS - nFotos}`}` : `${documentosCategoria.length} archivo(s)`}</span>
                            </summary>
                            <div className="space-y-3 border-t border-[#e6ebf1] p-3">
                              {e.seccion === "examen" && <p className="text-xs text-texto-2">Corresponde examen de {examen === "ambos" ? "entrada y salida" : examen}.</p>}
                              {e.seccion === "fotos" && <p className="text-xs text-texto-2">Mínimo de {MINIMO_FOTOS} fotos por programación. Puedes agregarlas en varias subidas.</p>}
                              {documentosCategoria.length ? <Archivos documentos={documentosCategoria} /> : <p className="text-xs text-texto-2">Sin archivos subidos.</p>}
                              {p.estado !== "cancelada" && <SiPuede modulo="documental"><FormSubirDocumento sesiones={[]} sesionInicial={String(p.sesionId)} programacionId={p.id} seccion={e.seccion} tipos={tipos} accept={e.accept} /></SiPuede>}
                            </div>
                          </details>;
                        })}
                      </div>}
                    </div>;
                  })}
                  {sinFecha.length > 0 && <details className="rounded-md border border-borde">
                    <summary className="cursor-pointer px-3 py-2 text-sm">Archivos anteriores sin fecha programada ({sinFecha.length})</summary>
                    <div className="border-t border-borde p-3"><Archivos documentos={sinFecha} /></div>
                  </details>}
                </div>
              </div>;
            })}</div>
          </section>)}</div>
        </section>)}
      </div>
    </section>)}
  </div>;
}
