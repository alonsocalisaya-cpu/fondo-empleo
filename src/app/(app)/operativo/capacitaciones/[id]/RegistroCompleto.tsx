import type { PasoRegistro } from "@/db/schema";
import { recursosDe } from "@/lib/recursos-sesion";
import type { DatosLiquidacion } from "@/lib/liquidacion";

type Archivo = { id: number; nombre: string; href: string; seccion: string };

function Campo({ titulo, valor }: { titulo: string; valor: unknown }) {
  return <div><dt className="text-xs font-semibold text-texto-2">{titulo}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{valor == null || valor === "" ? "No registrado" : String(valor)}</dd></div>;
}

function Recursos({ titulo, datos }: { titulo: string; datos: unknown }) {
  const items = recursosDe(datos);
  return <section className="space-y-2"><h4 className="font-semibold text-marino">{titulo}</h4>
    {items.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f3f6fa]"><tr><th className="p-2">Nombre</th><th className="p-2">Unidades</th><th className="p-2">Detalles</th></tr></thead><tbody>{items.map((r, i) => <tr key={i} className="border-t border-borde"><td className="p-2">{r.descripcion}</td><td className="p-2">{r.cantidad}</td><td className="whitespace-pre-wrap break-words p-2">{r.detalle || "—"}</td></tr>)}</tbody></table></div> : <p className="text-sm text-texto-2">No se solicitaron.</p>}
  </section>;
}

export default function RegistroCompleto({ clave, registro: r, archivos, liquidacion }: { clave: string; registro: PasoRegistro; archivos: Archivo[]; liquidacion?: DatosLiquidacion }) {
  if (r.liquidacion && typeof r.liquidacion === "object" && Array.isArray((r.liquidacion as DatosLiquidacion).lineas)) liquidacion = r.liquidacion as DatosLiquidacion;
  const campos: { titulo: string; valor: unknown }[] = [];
  const esRecurso = ["solicitar_recursos", "revisar_recursos", "aprobar_preparacion"].includes(clave);
  const esViaje = clave === "programa_viaje" || clave === "aprobar_preparacion";
  if (clave === "imprimir_ficha" || clave === "aprobar_preparacion") {
    campos.push({ titulo: "Lista de asistencia impresa", valor: r.listaImpresa == null ? null : r.listaImpresa ? "Sí" : "No" });
    if (r.copiasEntrada != null) campos.push({ titulo: "Copias de examen de entrada", valor: r.copiasEntrada });
    if (r.copiasSalida != null) campos.push({ titulo: "Copias de examen de salida", valor: r.copiasSalida });
  }
  if (clave === "datos_capacitacion") {
    campos.push({ titulo: "¿Se ejecutó la capacitación?", valor: r.realizada == null ? null : r.realizada ? "Sí" : "No" });
    if (r.realizada !== false) campos.push({ titulo: "Hora de inicio real", valor: r.horaInicioReal }, { titulo: "Hora de fin real", valor: r.horaFinReal });
    campos.push({ titulo: "Tipos de incidencia", valor: Array.isArray(r.tiposIncidencia) ? r.tiposIncidencia.join(", ") || "Sin tipos de incidencia" : null }, { titulo: "Incidencias / motivo de no ejecución", valor: r.incidencias || "Sin incidencias registradas" });
  }
  if (clave === "revisar_recursos" || clave === "aprobar_preparacion") campos.push({ titulo: "Coordinación con el asistente", valor: r.coordinadoAsistente == null ? null : r.coordinadoAsistente ? "Confirmada" : "No confirmada" });
  if (esViaje) {
    const corresponde = clave === "programa_viaje" ? r.corresponde : r.viajeCorresponde;
    campos.push({ titulo: "Programa de viaje", valor: corresponde == null ? null : corresponde ? "Sí corresponde" : "No corresponde" });
    if (corresponde) campos.push({ titulo: "Itinerario o detalle", valor: r.itinerario || "Presentado mediante archivo adjunto" });
  }
  if (r.obs) campos.push({ titulo: "Observaciones / comentario", valor: r.obs });
  const idsViaje = clave === "aprobar_preparacion" ? r.documentosViaje : r.documentos;
  const documentos = esViaje && Array.isArray(idsViaje) ? archivos.filter((a) => idsViaje.includes(a.id)) : clave === "escanear_subir" ? archivos.filter((a) => Array.isArray(r.documentos) ? r.documentos.includes(a.id) : ["diapositivas", "talleres", "lista_asistencia", "examen", "fotos", "video"].includes(a.seccion)) : [];
  const categorias: Record<string, string> = { diapositivas: "Diapositivas", talleres: "Talleres o prácticas", lista_asistencia: "Lista de asistencia", examen: "Exámenes", fotos: "Fotos", video: "Videos" };
  return <div className="w-full space-y-4 rounded-lg border border-borde bg-white p-4" aria-label="Información registrada en solo lectura">
    <p className="text-xs font-semibold uppercase tracking-wide text-texto-2">Registro completo · Solo lectura</p>
    {campos.length > 0 && <dl className="grid gap-4 sm:grid-cols-2">{campos.map((c) => <Campo key={c.titulo} {...c} />)}</dl>}
    {esRecurso && <>
      {clave === "revisar_recursos" && <><Recursos titulo="Recursos solicitados originalmente" datos={r.solicitados} /><Recursos titulo="Equipos solicitados originalmente" datos={r.equiposSolicitados} /></>}
      <Recursos titulo={clave === "solicitar_recursos" ? "Recursos solicitados" : "Recursos aprobados"} datos={r.recursos} />
      <Recursos titulo={clave === "solicitar_recursos" ? "Equipos solicitados" : "Equipos aprobados"} datos={r.equipos} />
    </>}
    {clave === "recursos_post" && <>
      {Array.isArray(r.retornos) ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f3f6fa]"><tr><th className="p-2">Recurso / equipo</th><th className="p-2">Llevados</th><th className="p-2">Retorno</th><th className="p-2">Detalles</th></tr></thead><tbody>{(r.retornos as { descripcion: string; llevado: number; retorno: number; detalle?: string }[]).map((x, i) => <tr key={i} className="border-t border-borde"><td className="p-2">{x.descripcion}</td><td className="p-2">{x.llevado}</td><td className="p-2">{x.retorno}</td><td className="p-2">{x.detalle || "—"}</td></tr>)}</tbody></table>{r.retornos.length === 0 && <p>No se llevaron recursos ni equipos.</p>}</div> : <><Recursos titulo="Recursos" datos={r.recursos} /><Recursos titulo="Equipos" datos={r.equipos} /><p className="text-xs text-texto-2">Este registro anterior no contiene cantidades de retorno.</p></>}
    </>}
    {(esViaje || clave === "escanear_subir") && <section className="space-y-2"><h4 className="font-semibold text-marino">Archivos registrados</h4>{documentos.length ? <ul className="space-y-2">{documentos.map((a) => <li key={a.id} className="text-sm"><span className="text-xs text-texto-2">{clave === "escanear_subir" ? `${categorias[a.seccion]} · ` : ""}</span><a className="enlace break-words" href={a.href}>⬇ {a.nombre}</a></li>)}</ul> : <p className="text-sm text-texto-2">Sin archivos adjuntos.</p>}</section>}
    {clave === "rendir_viaticos" && liquidacion && <section className="space-y-3">
      <dl className="grid gap-3 sm:grid-cols-2"><Campo titulo="Nombre de quien rinde" valor={liquidacion.nombre} /><Campo titulo="Fecha" valor={liquidacion.fecha} /><Campo titulo="Descripción" valor={liquidacion.descripcion} /></dl>
      <table className="w-full text-left text-sm"><thead className="bg-[#f3f6fa]"><tr><th className="p-2">Tipo / concepto</th><th className="p-2 text-right">Importe (S/)</th></tr></thead><tbody>{liquidacion.lineas.map((l, i) => <tr key={i} className="border-t border-borde"><td className="p-2">{l.descripcion}{l.obs && <p>{l.obs}</p>}{l.comprobante && <p>Comprobante: {l.comprobante}</p>}</td><td className="p-2 text-right">{l.monto.toFixed(2)}</td></tr>)}</tbody></table>
      <p className="font-semibold text-marino">Total de viáticos: S/ {Number(r.gastado ?? liquidacion.lineas.reduce((s, l) => s + l.monto, 0)).toFixed(2)}</p>
    </section>}
    <p className="text-sm font-semibold text-[#166534]">✓ Confirmación registrada</p>
  </div>;
}
