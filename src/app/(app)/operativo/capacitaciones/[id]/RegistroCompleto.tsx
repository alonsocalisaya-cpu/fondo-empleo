import type { PasoRegistro } from "@/db/schema";
import { recursosDe } from "@/lib/recursos-sesion";
import type { DatosLiquidacion } from "@/lib/liquidacion";
import { resumenAsistenciaDe } from "@/lib/resumen-asistencia";
import { resumenRegistroNotas } from "@/lib/seguimiento-examenes";
import ResumenRegistroNotas from "./ResumenRegistroNotas";
import ResumenRegistroAsistencia from "./ResumenRegistroAsistencia";

type Archivo = { id: number; nombre: string; href: string; seccion: string };

const CATEGORIAS_ARCHIVO: Record<string, string> = {
  diapositivas: "Diapositivas", talleres: "Talleres o prácticas", lista_asistencia: "Lista de asistencia",
  examen: "Exámenes", fotos: "Fotos", video: "Videos", viaticos: "Viáticos", adicionales: "Entregables adicionales",
};

function ArchivosRegistrados({ documentos }: { documentos: Archivo[] }) {
  const grupos = [...new Set(documentos.map((a) => a.seccion))];
  return <section className="space-y-3" aria-label="Entregables registrados">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h4 className="font-semibold text-marino">Archivos adjuntos</h4><p className="mt-1 text-xs text-texto-2">Consulta y descarga los documentos registrados en esta actividad.</p></div>
      <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs font-medium text-marino">{documentos.length} {documentos.length === 1 ? "archivo" : "archivos"}</span>
    </div>
    {grupos.map((seccion) => {
      const lista = documentos.filter((a) => a.seccion === seccion);
      return <div key={seccion} className="grid overflow-hidden rounded-xl border border-[#dce4ee] md:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="space-y-2 bg-[#f5f8fc] p-4">
          <h5 className="text-sm font-semibold text-marino">{CATEGORIAS_ARCHIVO[seccion] ?? seccion}</h5>
          <p className="text-xs text-texto-2">{lista.length} {lista.length === 1 ? "archivo adjunto" : "archivos adjuntos"}</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f5e9] px-2.5 py-1 text-[11px] font-medium text-[#166534]"><span aria-hidden="true">✓</span> Registrado</span>
        </div>
        <ul className="min-w-0 divide-y divide-[#e8edf3] border-t border-[#dce4ee] md:border-l md:border-t-0">{lista.map((a) => {
          const formato = a.nombre.match(/\.([a-z0-9]{1,8})$/i)?.[1].toUpperCase() ?? "ARCHIVO";
          return <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3f8] text-marino"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5" /></svg></span>
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-marino">{a.nombre}</p><span className="mt-1 inline-block text-[11px] font-medium text-texto-2">{formato}</span></div>
            <a href={a.href} className="btn-secundario inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs" aria-label={`Descargar ${a.nombre}`}><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12 M7 10l5 5 5-5 M5 16v5h14v-5" /></svg>Descargar</a>
          </li>;
        })}</ul>
      </div>;
    })}
    {!documentos.length && <p className="rounded-xl border border-dashed border-borde bg-[#f8fafc] p-4 text-sm text-texto-2">Sin archivos adjuntos.</p>}
  </section>;
}

export function ResumenCierre({ pasos, archivos, programacionId, liquidacion }: { pasos: Record<string, PasoRegistro>; archivos: Archivo[]; programacionId: number; liquidacion?: DatosLiquidacion }) {
  const datos = pasos.datos_capacitacion;
  const viaticos = pasos.rendir_viaticos;
  return <section className="space-y-3 rounded-xl border border-borde bg-[#f3f6fa] p-4">
    <h4 className="font-semibold text-marino">Resumen de las fases 4 y 5</h4>
    <dl className="grid gap-3 sm:grid-cols-2">
      <Campo titulo="Desarrollo" valor={!datos ? "Pendiente" : datos.realizada === false ? "No se ejecutó la capacitación" : "Capacitación ejecutada"} />
      <Campo titulo="Devolución de recursos" valor={pasos.recursos_post ? "Cantidades de retorno confirmadas" : "Pendiente"} />
      <Campo titulo="Entregables" valor={datos?.realizada === false ? "No corresponde: capacitación no ejecutada" : pasos.escanear_subir ? `${pasos.escanear_subir.archivos} archivos adjuntos · talleres o prácticas opcionales` : "Pendiente"} />
      <Campo titulo="Total de viáticos" valor={viaticos ? `S/ ${Number(viaticos.gastado ?? 0).toFixed(2)}` : "Pendiente"} />
    </dl>
    {[["datos_capacitacion", "Desarrollo"], ["registrar_asistencia", "Asistencia de beneficiarios"], ["recursos_post", "Devolución de recursos"], ["registrar_notas", "Registro de notas"], ["escanear_subir", "Entregables"], ["rendir_viaticos", "Viáticos"]].map(([clave, titulo]) => pasos[clave] && <details key={clave} className="rounded-lg border border-borde bg-white"><summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-marino">{titulo} · Ver detalle</summary><div className="p-3 pt-0"><RegistroCompleto clave={clave} registro={pasos[clave]} archivos={archivos} programacionId={programacionId} liquidacion={liquidacion} /></div></details>)}
  </section>;
}

function Campo({ titulo, valor }: { titulo: string; valor: unknown }) {
  return <div><dt className="text-xs font-semibold text-texto-2">{titulo}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{valor == null || valor === "" ? "No registrado" : String(valor)}</dd></div>;
}

function Recursos({ titulo, datos }: { titulo: string; datos: unknown }) {
  const items = recursosDe(datos);
  return <section className="space-y-2"><h4 className="font-semibold text-marino">{titulo}</h4>
    {items.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f3f6fa]"><tr><th className="p-2">Nombre</th><th className="p-2">Unidades</th><th className="p-2">Detalles</th></tr></thead><tbody>{items.map((r, i) => <tr key={i} className="border-t border-borde"><td className="p-2">{r.descripcion}</td><td className="p-2">{r.cantidad}</td><td className="whitespace-pre-wrap break-words p-2">{r.detalle || "—"}</td></tr>)}</tbody></table></div> : <p className="text-sm text-texto-2">No se solicitaron.</p>}
  </section>;
}

export default async function RegistroCompleto({ clave, registro: r, archivos, liquidacion, programacionId, programaViajeDisponible = false }: { clave: string; registro: PasoRegistro; archivos: Archivo[]; liquidacion?: DatosLiquidacion; programacionId: number; programaViajeDisponible?: boolean }) {
  const notas = clave === "registrar_notas" ? resumenRegistroNotas(await resumenAsistenciaDe(programacionId), r.tipo === "entrada" || r.tipo === "salida" || r.tipo === "ambos" ? r.tipo : null) : null;
  const asistencia = clave === "registrar_asistencia" ? await resumenAsistenciaDe(programacionId) : null;
  if (r.liquidacion && typeof r.liquidacion === "object" && Array.isArray((r.liquidacion as DatosLiquidacion).lineas)) liquidacion = r.liquidacion as DatosLiquidacion;
  const campos: { titulo: string; valor: unknown }[] = [];
  const esRecurso = ["solicitar_recursos", "revisar_recursos", "aprobar_preparacion"].includes(clave);
  const esViaje = clave === "programa_viaje" || clave === "aprobar_preparacion";
  if (clave === "imprimir_ficha" || clave === "aprobar_preparacion") {
    campos.push({ titulo: "Lista de asistencia impresa", valor: r.listaImpresa == null ? null : r.listaImpresa ? "Sí" : "No" });
    if (r.copiasEntrada != null) campos.push({ titulo: "Copias de examen de entrada", valor: r.copiasEntrada });
    if (r.copiasSalida != null) campos.push({ titulo: "Copias de examen de salida", valor: r.copiasSalida });
    if (r.examenesImpresos != null || r.copiasEntrada != null || r.copiasSalida != null) campos.push({ titulo: "Impresión de exámenes confirmada", valor: r.examenesImpresos == null ? null : r.examenesImpresos ? "Sí" : "No" });
  }
  if (clave === "datos_capacitacion") {
    campos.push({ titulo: "¿Se ejecutó la capacitación?", valor: r.realizada == null ? null : r.realizada ? "Sí" : "No" });
    if (r.realizada !== false) {
      if (typeof r.horarioProgramado === "boolean") campos.push({ titulo: "¿Se cumplió el horario programado?", valor: r.horarioProgramado ? "Sí" : "No" });
      if (r.horarioProgramado !== true) campos.push({ titulo: "Hora de inicio real", valor: r.horaInicioReal }, { titulo: "Hora de fin real", valor: r.horaFinReal });
      if (typeof r.hayIncidencias === "boolean") campos.push({ titulo: "¿Hubo incidencias?", valor: r.hayIncidencias ? "Sí" : "No" });
    }
    campos.push({ titulo: "Tipos de incidencia", valor: Array.isArray(r.tiposIncidencia) ? r.tiposIncidencia.join(", ") || "Sin tipos de incidencia" : null }, { titulo: "Incidencias / motivo de no ejecución", valor: r.incidencias || "Sin incidencias registradas" });
  }
  if (clave === "revisar_recursos" || clave === "aprobar_preparacion") campos.push({ titulo: "Coordinación con el asistente", valor: r.coordinadoAsistente == null ? null : r.coordinadoAsistente ? "Confirmada" : "No confirmada" });
  if (esViaje) {
    const corresponde = clave === "programa_viaje" ? r.corresponde : r.viajeCorresponde;
    campos.push({ titulo: "Programa de viaje", valor: corresponde == null ? null : corresponde ? "Sí corresponde" : "No corresponde" });
    if (clave === "programa_viaje" && r.programaGenerado) campos.push({ titulo: "Consultor", valor: r.consultor }, { titulo: "Tipo de informe", valor: r.tipoInforme }, { titulo: "Fecha de programa", valor: r.fechaPrograma }, { titulo: "Empresa destino", valor: r.empresaDestino }, { titulo: "Proyecto", valor: r.proyecto });
  }
  if (r.obs) campos.push({ titulo: "Observaciones / comentario", valor: r.obs });
  if (clave === "registrar_notas" && r.motivoDiferencia) campos.push({ titulo: "Motivo de la diferencia", valor: r.motivoDiferencia });
  const tieneLista = clave === "imprimir_ficha";
  const documentos = archivos.filter((a) => {
    if (tieneLista && a.seccion === "lista_asistencia") return true;
    if (clave === "imprimir_ficha" && a.seccion === "examen") return true;
    if (clave === "escanear_subir") return a.seccion === "adicionales" || a.seccion.startsWith("Carpeta · ") || (Array.isArray(r.documentos) ? r.documentos.includes(a.id) : ["diapositivas", "talleres", "lista_asistencia", "examen", "fotos", "video"].includes(a.seccion));
    if (clave === "rendir_viaticos") return a.seccion === "viaticos";
    return false;
  });
  return <div className="w-full space-y-4 rounded-lg border border-borde bg-white p-4" aria-label="Información registrada en solo lectura">
    <p className="text-xs font-semibold uppercase tracking-wide text-texto-2">Registro completo · Solo lectura</p>
    {notas && <ResumenRegistroNotas resumen={notas} />}
    {asistencia && <ResumenRegistroAsistencia resumen={asistencia} />}
    {clave === "aprobar_cierre" && !!r.resumenCierre && <ResumenCierre pasos={r.resumenCierre as Record<string, PasoRegistro>} archivos={archivos} programacionId={programacionId} liquidacion={liquidacion} />}
    {campos.length > 0 && <dl className="grid gap-4 sm:grid-cols-2">{campos.map((c) => <Campo key={c.titulo} {...c} />)}</dl>}
    {((clave === "programa_viaje" && r.programaGenerado === true) || (clave === "aprobar_preparacion" && programaViajeDisponible)) && <a href={`/api/programaciones/${programacionId}/programa-viaje`} className="btn-oscuro inline-flex px-5 py-3">⬇ Descargar programa de viaje completado (Word)</a>}
    {clave === "programa_viaje" && Array.isArray(r.actividadesViaje) && <section className="space-y-2">
      <h4 className="font-semibold text-marino">Actividades del programa de viaje</h4>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f3f6fa]"><tr>{["Actividad", "Descripción", "Fecha", "Hora"].map((titulo) => <th key={titulo} className="p-2">{titulo}</th>)}</tr></thead><tbody>{(r.actividadesViaje as { actividad: string; descripcion: string; fecha: string; hora: string }[]).map((fila, i) => <tr key={i} className="border-t border-borde"><td className="p-2">{fila.actividad}</td><td className="whitespace-pre-wrap p-2">{fila.descripcion}</td><td className="p-2">{fila.fecha.split("-").reverse().join("/")}</td><td className="p-2">{fila.hora}</td></tr>)}</tbody></table></div>
    </section>}
    {tieneLista && <section className="space-y-2">
      <h4 className="font-semibold text-marino">Lista de asistencia</h4>
      <div className="flex flex-wrap gap-2">
        <a href={`/operativo/capacitacion/${programacionId}/excel`} className="btn-secundario px-5 py-3 text-base font-semibold">⬇ Descargar lista de asistencia (Excel)</a>
        <a href={`/operativo/capacitacion/${programacionId}/imprimir`} target="_blank" rel="noreferrer" className="btn-oscuro px-6 py-4 text-base font-bold shadow-md">🖨 Ver / imprimir lista de asistencia</a>
      </div>
    </section>}
    {esRecurso && <>
      {clave === "revisar_recursos" && <><Recursos titulo="Recursos solicitados originalmente" datos={r.solicitados} /><Recursos titulo="Equipos solicitados originalmente" datos={r.equiposSolicitados} /></>}
      <Recursos titulo={clave === "solicitar_recursos" ? "Recursos solicitados" : "Recursos aprobados"} datos={r.recursos} />
      <Recursos titulo={clave === "solicitar_recursos" ? "Equipos solicitados" : "Equipos aprobados"} datos={r.equipos} />
    </>}
    {clave === "recursos_post" && <>
      {Array.isArray(r.retornos) ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f3f6fa]"><tr><th className="p-2">Recurso / equipo</th><th className="p-2">Llevados</th><th className="p-2">Retorno</th><th className="p-2">Detalles</th></tr></thead><tbody>{(r.retornos as { descripcion: string; llevado: number; retorno: number; detalle?: string }[]).map((x, i) => <tr key={i} className="border-t border-borde"><td className="p-2">{x.descripcion}</td><td className="p-2">{x.llevado}</td><td className="p-2">{x.retorno}</td><td className="p-2">{x.detalle || "—"}</td></tr>)}</tbody></table>{r.retornos.length === 0 && <p>No se llevaron recursos ni equipos.</p>}</div> : <><Recursos titulo="Recursos" datos={r.recursos} /><Recursos titulo="Equipos" datos={r.equipos} /><p className="text-xs text-texto-2">Este registro anterior no contiene cantidades de retorno.</p></>}
    </>}
    {(clave === "escanear_subir" || documentos.length > 0) && <ArchivosRegistrados documentos={documentos} />}
    {clave === "rendir_viaticos" && liquidacion && <section className="space-y-3">
      <dl className="grid gap-3 sm:grid-cols-2"><Campo titulo="Nombre de quien rinde" valor={liquidacion.nombre} /><Campo titulo="Fecha" valor={liquidacion.fecha} /><Campo titulo="Descripción" valor={liquidacion.descripcion} /></dl>
      <table className="w-full text-left text-sm"><thead className="bg-[#f3f6fa]"><tr><th className="p-2">Tipo / concepto</th><th className="p-2 text-right">Importe (S/)</th></tr></thead><tbody>{liquidacion.lineas.map((l, i) => <tr key={i} className="border-t border-borde"><td className="p-2">{l.descripcion}{l.obs && <p>{l.obs}</p>}{l.comprobante && <p>Comprobante: {l.comprobante}</p>}</td><td className="p-2 text-right">{l.monto.toFixed(2)}</td></tr>)}</tbody></table>
      <p className="font-semibold text-marino">Total de viáticos: S/ {Number(r.gastado ?? liquidacion.lineas.reduce((s, l) => s + l.monto, 0)).toFixed(2)}</p>
      <a href={`/operativo/capacitaciones/${programacionId}/liquidacion`} className="btn-secundario inline-flex text-sm">⬇ Descargar liquidación de viáticos completada</a>
    </section>}
    <p className="text-sm font-semibold text-[#166534]">✓ Confirmación registrada</p>
  </div>;
}
