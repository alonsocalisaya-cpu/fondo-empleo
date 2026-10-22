"use client";

import { useState, useTransition } from "react";
import SubirArchivos from "@/components/SubirArchivos";
import { ENTREGABLES } from "@/lib/entregables";
import { tamanoLegible, type Seccion } from "@/lib/documentos";
import { type CarpetaEntregable, versionCarpeta } from "@/lib/carpetas-entregables";
import { crearCarpetaEntregable } from "./carpetas-actions";

type Archivo = { id: number; nombre: string; href: string; tamano: number | null; seccion: Seccion; tipo: string; version?: string | null };
const FORMATOS: Record<string, string> = {
  diapositivas: "PDF, PowerPoint, Word, Excel, imágenes o ZIP",
  talleres: "PDF, PowerPoint, Word, Excel, imágenes o ZIP",
  lista_asistencia: "PDF, Word, Excel, imágenes o ZIP",
  examen: "PDF, Word o imágenes",
  fotos: "JPG, PNG o HEIC",
  video: "MP4, MOV, AVI o 3GP",
};
const ICONOS: Record<string, string> = {
  diapositivas: "M4 4h16v12H4z M8 21l4-5 4 5 M8 8h8 M8 12h5",
  talleres: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
  lista_asistencia: "M8 4h12v16H8z M3 7l1 1 2-2 M11 8h6 M11 12h6 M11 16h6",
  examen: "M5 3h14v18H5z M8 8l2 2 5-5 M8 14h8 M8 18h5",
  fotos: "M3 5h18v14H3z M3 16l5-5 4 4 4-6 5 7 M8 8h.01",
  video: "M3 5h18v14H3z M10 9l5 3-5 3z",
};

export default function EntregablesPost({ programacionId, examen, archivos, carpetas: iniciales = [], soloAdicionales = false }: { programacionId: number; examen: "entrada" | "salida" | "ambos" | null; archivos: Archivo[]; carpetas?: CarpetaEntregable[]; soloAdicionales?: boolean }) {
  const [nuevos, setNuevos] = useState<Record<string, number>>({});
  const [agregadas, setAgregadas] = useState<CarpetaEntregable[]>([]);
  const carpetas = [...iniciales, ...agregadas.filter((c) => !iniciales.some((i) => i.id === c.id))];
  const [mostrarCarpeta, setMostrarCarpeta] = useState(false);
  const [nombreCarpeta, setNombreCarpeta] = useState("");
  const [descripcionCarpeta, setDescripcionCarpeta] = useState("");
  const [errorCarpeta, setErrorCarpeta] = useState("");
  const [creando, crear] = useTransition();
  const agregarCarpeta = () => crear(async () => {
    setErrorCarpeta("");
    try {
      const resultado = await crearCarpetaEntregable(programacionId, nombreCarpeta, descripcionCarpeta);
      if (resultado.error) { setErrorCarpeta(resultado.error); return; }
      if (resultado.carpeta) setAgregadas((lista) => [...lista, resultado.carpeta]);
      setNombreCarpeta(""); setDescripcionCarpeta(""); setMostrarCarpeta(false);
    } catch { setErrorCarpeta("No se pudo crear la carpeta. Inténtalo nuevamente."); }
  });
  const categorias = ENTREGABLES.filter((c) => c.seccion !== "viaticos");
  const tiposExamen = (["entrada", "salida"] as const).filter((tipo) => examen === tipo || examen === "ambos");
  const cantidad = (seccion: string) => archivos.filter((a) => a.seccion === seccion).length + (seccion === "examen" ? tiposExamen.reduce((n, tipo) => n + (nuevos[`examen_${tipo}`] ?? 0), 0) : nuevos[seccion] ?? 0);
  const completa = (seccion: string) => seccion === "examen"
    ? tiposExamen.every((tipo) => archivos.some((a) => a.seccion === "examen" && a.tipo === `examen_${tipo}`) || (nuevos[`examen_${tipo}`] ?? 0) > 0)
    : cantidad(seccion) > 0;
  const aplicables = categorias.filter((c) => c.seccion !== "talleres" && (c.seccion !== "examen" || examen));
  const completadas = aplicables.filter((c) => completa(c.seccion)).length;
  const porcentaje = Math.round(completadas * 100 / aplicables.length);
  return <div className="space-y-4">
    {!soloAdicionales && <>
    <div className="rounded-xl border border-borde bg-[#f3f6fa] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold text-marino">Documentos de la sesión</h4><p className="mt-1 text-xs text-texto-2">Agrega los archivos en la categoría que corresponde. Los talleres o prácticas son opcionales.</p></div><span aria-live="polite" className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-marino">{completadas} de {aplicables.length} categorías obligatorias adjuntadas</span></div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dde5ee]" role="progressbar" aria-label="Categorías con archivos adjuntos" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-[#16a34a] transition-[width]" style={{ width: `${porcentaje}%` }} /></div>
    </div>
    <div className="space-y-3">{categorias.map((categoria) => {
      const noAplica = categoria.seccion === "examen" && !examen;
      const lista = archivos.filter((a) => a.seccion === categoria.seccion);
      const adjuntado = !noAplica && completa(categoria.seccion);
      return <section key={categoria.seccion} className="grid overflow-hidden rounded-xl border border-borde bg-white md:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="space-y-3 bg-[#f8fafc] p-4 md:p-5">
          <span className="inline-flex size-10 items-center justify-center rounded-xl border border-[#e1e8f0] bg-white text-marino"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={ICONOS[categoria.seccion]} /></svg></span>
          <div><h4 className="font-semibold text-marino">{categoria.titulo}</h4>{categoria.seccion === "talleres" && <p className="mt-1 text-xs font-medium text-texto-2">Opcional</p>}<p className="mt-1 text-xs leading-relaxed text-texto-2">{FORMATOS[categoria.seccion]}</p></div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${noAplica || (categoria.seccion === "talleres" && !adjuntado) ? "bg-[#e9edf2] text-texto-2" : adjuntado ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fff2df] text-[#9a3412]"}`}>{noAplica ? "No corresponde" : adjuntado ? "✓ Adjuntado" : categoria.seccion === "talleres" ? "Opcional · sin adjuntos" : "Pendiente"}</span>
          {!noAplica && <p aria-live="polite" className="text-xs text-texto-2">{cantidad(categoria.seccion)} archivo(s) adjunto(s)</p>}
        </div>
        <div className="min-w-0 space-y-3 border-t border-borde p-4 md:border-l md:border-t-0 md:p-5">
          {noAplica ? <p className="py-3 text-sm text-texto-2">Esta sesión no requiere exámenes.</p> : <>
            {categoria.seccion === "examen" ? tiposExamen.map((tipo) => <SubirArchivos key={tipo} destacado programacionId={programacionId} tipo={`examen_${tipo}`} seccion="examen" etiqueta={`Examen de ${tipo}`} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" alCambiarCantidad={(n) => setNuevos((prev) => ({ ...prev, [`examen_${tipo}`]: n }))} />) : <SubirArchivos destacado programacionId={programacionId} tipo={categoria.tipo} seccion={categoria.seccion} etiqueta={`Archivos de ${categoria.titulo.toLowerCase()}`} accept={categoria.accept ?? ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"} alCambiarCantidad={(n) => setNuevos((prev) => ({ ...prev, [categoria.seccion]: n }))} />}
            {lista.length > 0 && <ul className="space-y-2">{lista.map((a) => <li key={a.id} className="flex items-center gap-3 rounded-lg border border-borde px-3 py-2.5"><span aria-hidden="true" className="text-[#166534]">✓</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-marino">{a.nombre}</p>{a.tamano != null && <p className="text-xs text-texto-2">{tamanoLegible(a.tamano)}</p>}</div><a href={a.href} className="enlace shrink-0 text-xs" aria-label={`Descargar ${a.nombre}`}>Descargar</a></li>)}</ul>}
          </>}
        </div>
      </section>;
    })}</div>
    </>}
    <section className="space-y-3" aria-label="Carpetas adicionales de entregables">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold text-marino">Carpetas adicionales</h4><p className="text-xs text-texto-2">Opcionales, solo para esta sesión. No afectan los requisitos de cierre.</p></div><button type="button" className="btn-secundario" onClick={() => setMostrarCarpeta(true)}>+ Agregar carpeta de entregables</button></div>
      {mostrarCarpeta && <div className="space-y-3 rounded-xl border border-borde bg-[#f8fafc] p-4">
        <label className="etiqueta">Nombre de la carpeta<input value={nombreCarpeta} onChange={(e) => setNombreCarpeta(e.target.value)} maxLength={80} className="campo mt-1" placeholder="Ej. Material complementario" disabled={creando} /></label>
        <label className="etiqueta">Descripción (opcional)<textarea value={descripcionCarpeta} onChange={(e) => setDescripcionCarpeta(e.target.value)} maxLength={300} className="campo mt-1" disabled={creando} /></label>
        {errorCarpeta && <p role="alert" className="text-sm text-[#991b1b]">{errorCarpeta}</p>}
        <div className="flex gap-2"><button type="button" disabled={creando || !nombreCarpeta.trim()} onClick={agregarCarpeta} className="btn-oscuro">{creando ? "Creando…" : "Crear carpeta"}</button><button type="button" disabled={creando} onClick={() => { setMostrarCarpeta(false); setErrorCarpeta(""); }} className="btn-secundario">Cancelar</button></div>
      </div>}
      {carpetas.map((carpeta) => {
        const lista = archivos.filter((a) => a.seccion === "adicionales" && a.version === versionCarpeta(carpeta.id));
        return <section key={carpeta.id} className="space-y-3 rounded-xl border border-borde bg-white p-4">
          <div><h5 className="font-semibold text-marino">📁 {carpeta.nombre} <span className="text-xs font-normal text-texto-2">· Opcional</span></h5>{carpeta.descripcion && <p className="mt-1 whitespace-pre-wrap text-sm text-texto-2">{carpeta.descripcion}</p>}</div>
          <SubirArchivos destacado programacionId={programacionId} tipo="otro" seccion="adicionales" version={versionCarpeta(carpeta.id)} etiqueta={`Archivos de ${carpeta.nombre}`} />
          {lista.length > 0 && <ul className="space-y-2">{lista.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-borde p-3"><span className="min-w-0 break-words text-sm">{a.nombre}{a.tamano != null && <small className="block text-texto-2">{tamanoLegible(a.tamano)}</small>}</span><a href={a.href} className="enlace text-xs" aria-label={`Descargar ${a.nombre}`}>Descargar</a></li>)}</ul>}
        </section>;
      })}
    </section>
    {!soloAdicionales && <label className="flex items-start gap-3 rounded-xl border border-borde bg-[#f3f6fa] p-4 text-sm"><input type="checkbox" name="entregablesConfirmados" value="si" required className="mt-0.5 size-5 shrink-0 accent-marino" /><span>Confirmo que adjunté los documentos entregables que corresponden a esta capacitación.</span></label>}
  </div>;
}
