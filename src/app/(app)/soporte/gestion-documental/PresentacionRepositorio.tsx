import type { ReactNode } from "react";
import type { documentos } from "@/db/schema";
import { enlaceDoc, tamanoLegible, TIPO_DOC } from "@/lib/documentos";
import { eliminarDocumento } from "@/lib/acciones-maestros";
import SiPuede from "@/components/SiPuede";
import BotonEliminar from "@/components/BotonEliminar";
import DesplegablePersistente from "./DesplegablePersistente";

export function Desplegable({ titulo, children, className = "", cantidad, persistencia }: { titulo?: ReactNode; children: ReactNode; className?: string; cantidad?: string; persistencia?: string }) {
  if (!titulo) return <div className={className}>{children}</div>;
  return <DesplegablePersistente titulo={titulo} className={className} cantidad={cantidad} persistencia={persistencia}>{children}</DesplegablePersistente>;
}

export function ArchivosRepositorio({ docs }: { docs: (typeof documentos.$inferSelect)[] }) {
  return <ul className="space-y-2">{docs.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dce4ee] bg-white px-3 py-3">
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3f8] text-marino"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5" /></svg></span>
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-marino">{d.nombre}</p><p className="mt-1 text-[11px] text-texto-2">{TIPO_DOC[d.tipo]}{d.version ? ` · ${d.version}` : ""}{d.tamano != null ? ` · ${tamanoLegible(d.tamano)}` : ""}</p></div>
    <a href={enlaceDoc(d)} target={d.archivo ? undefined : "_blank"} rel="noreferrer" className="btn-secundario shrink-0 px-3 py-2 text-xs" aria-label={`${d.archivo ? "Descargar" : "Abrir"} ${d.nombre}`}>{d.archivo ? "↓ Descargar" : "↗ Abrir"}</a>
    <SiPuede modulo="documental"><BotonEliminar accion={eliminarDocumento} campos={{ id: d.id }} etiqueta="Quitar" pregunta={`¿Quitar «${d.nombre}»?`} detalle={d.archivo ? "Se borra el archivo guardado." : undefined} /></SiPuede>
  </li>)}</ul>;
}
