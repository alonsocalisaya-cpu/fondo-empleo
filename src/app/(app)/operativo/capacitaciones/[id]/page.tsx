import Link from "next/link";
import { CHEQUEOS_EQUIPO, TIPOS_EQUIPO } from "@/lib/inventario";
import { SECCIONES, TIPO_DOC, enlaceDoc, origenDoc, seccionDe, tamanoLegible } from "@/lib/documentos";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { PasoRegistro } from "@/db/schema";
import { cargarExpediente } from "@/lib/preparacion";
import { exigirUsuario, puedeVerSesion, type Usuario } from "@/lib/auth";
import { puede, puedeEditarFicha, puedeRegistrarPaso } from "@/lib/permisos";
import { ruta, combinadas } from "@/lib/consultas";
import { ETAPAS, FASES, PASO, ROLES, etapaActual, resumenFlujo, type Etapa, type Vista } from "@/lib/flujo-pre";
import { fechaCorta, fechaLarga, hora, TURNO_LABEL } from "@/lib/fechas";
import { ChipEstado, Encabezado, nombreCompleto } from "@/components/ui";
import { BarraAvance, ChipRol } from "@/components/flujo";
import LineaProceso from "@/components/LineaProceso";
import SubirArchivos from "@/components/SubirArchivos";
import ContrasteInventario from "./ContrasteInventario";
import CampoAsistentes from "./CampoAsistentes";
import { DOCUMENTOS_REVISION, ENTREGABLES, GASTOS, PREGUNTAS_PREPARACION, type Ficha2 } from "@/lib/ficha2";
import FormPaso, { BotonesDecision, FormAccion, FormItem } from "./FormPaso";
import FormLiquidacion from "./FormLiquidacion";
import { alternarItem, asignarEquipos, asignarRefrigerio, deshacerPaso, eliminarItem } from "./actions";

export const metadata = { title: "Expediente de pre-capacitación" };

type Exp = NonNullable<Awaited<ReturnType<typeof cargarExpediente>>>;
type EstadoItem = ReturnType<typeof resumenFlujo>["estados"][number];

const CATEGORIAS = {
  material_capacitador: "Material solicitado por el capacitador",
  dinamica: "Material para dinámicas",
  refrigerio: "Insumos de refrigerio",
  tecnologico: "Equipos tecnológicos",
} as const;

const EXAMEN = { entrada: "de entrada", salida: "de salida", ambos: "de entrada y de salida" } as const;
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" }).format(new Date(iso));

/* ── Resumen de lo registrado ────────────────────────────── */
function Resumen({ clave, r }: { clave: string; r: PasoRegistro }) {
  const d = r as Record<string, unknown>;
  const partes: string[] = [];
  switch (clave) {
    case "confirmar_sede":
      partes.push(d.localConfirmado ? "Local confirmado" : "Local NO confirmado → reprogramar");
      if (d.contacto) partes.push(`Contacto: ${d.contacto}`);
      break;
    case "comunicar":
      if (d.capacitador) partes.push(`Capacitador: ${d.capacitador}`, `Asistente: ${d.asistente}${d.cambioPersonal ? " (cambiado respecto a la programación)" : ""}`);
      partes.push(d.aTiempo ? "Comunicado a tiempo" : `Comunicado fuera de plazo (límite ${fechaCorta(String(d.limite))})`);
      if ((d.notificados as string[] | undefined)?.length) partes.push(`Notificado por el sistema a ${(d.notificados as string[]).join(" y ")}`);
      if ((d.sinAcceso as string[] | undefined)?.length) partes.push(`⚠ Sin acceso (avisar por otro medio): ${(d.sinAcceso as string[]).join(", ")}`);
      if (d.mensaje) partes.push(`Mensaje: «${d.mensaje}»`);
      break;
    case "personalizar":
      partes.push(d.personalizado ? `Personalizado: ${d.detalle}${d.archivos ? ` · ${d.archivos} material(es) subido(s)` : ""}` : "Sin personalizar");
      break;
    case "dinamicas":
      partes.push(
        d.requiere
          ? d.delInventario !== undefined
            ? `Solicitó ${d.delInventario} ítem(s) del inventario y ${d.extras} extra(s)`
            : `Solicitó ${d.items} ítem(s) al asistente`
          : "No requiere material",
      );
      break;
    case "examen":
      partes.push(`Examen ${EXAMEN[d.tipo as keyof typeof EXAMEN] ?? ""} impreso${d.cantidad ? ` (${d.cantidad})` : ""}`);
      break;
    case "guardar_material":
      partes.push(`Medio: ${d.medio}`, d.talleresImpresos ? "Talleres impresos" : "Talleres sin imprimir");
      break;
    case "probar_equipos":
      partes.push(d.resultado === "observado" ? "Con observaciones" : "Todo operativo");
      break;
    case "solicitar_viaticos":
    case "entregar_viaticos":
      partes.push(`S/ ${Number(d.monto).toFixed(2)}${d.tipo ? ` · ${d.tipo === "viaje" ? "viaje" : "movilidad"}` : ""}${d.concepto ? ` · ${d.concepto}` : ""}`);
      break;
    case "llenar_ficha":
      partes.push(`1ra sección completa (${d.items ?? 0} ítems) · comunicada a Gestión Documental`);
      break;
    case "revisar_ficha":
      partes.push("Ficha correcta");
      break;
    case "sesion_realizada":
      partes.push(d.realizada ? "Sesión realizada" : "Sesión NO realizada → reprogramar");
      break;
    case "corregir_examenes":
      partes.push(`${d.cantidad ?? 0} exámenes corregidos${d.promedio ? ` · promedio ${d.promedio}` : ""}`);
      break;
    case "enviar_examenes":
      partes.push(Number(d.archivos) ? `Enviados · ${d.archivos} archivo(s) subido(s)` : "Enviados por NextCloud");
      break;
    case "reportar_incidencias":
      partes.push(d.incidencias ? `Incidencias: ${d.incidencias}` : "Sin incidencias");
      break;
    case "llenar_ficha2": {
      const f2 = d as Ficha2;
      const ent = Object.values(f2.entregables ?? {});
      const prob = Object.values(f2.preparacion ?? {}).filter((x) => x.hubo).length;
      partes.push(
        `Inicio ${f2.horaInicioReal} · Término ${f2.horaFinReal}`,
        f2.asistentes != null ? `Asistieron ${f2.asistentes} de ${f2.programados} (${f2.pctAsistencia}%)` : "",
        `Entregables ${ent.filter((x) => x === "completo").length}/${ent.filter((x) => x !== "no_corresponde").length} completos`,
        prob ? `${prob} problema(s) en la preparación` : "Sin problemas en la preparación",
        `Gastos S/ ${Number(f2.totalGastos ?? 0).toFixed(2)}`,
      );
      break;
    }
    case "registrar_asistencia":
      partes.push(Number(d.registros) ? `${d.presentes ?? d.registros} presentes de ${d.registros} registrados` : "Sin participantes inscritos");
      break;
    case "rendir_viaticos":
      partes.push(
        `Presupuestado S/ ${Number(d.entregado ?? 0).toFixed(2)} · Gastado S/ ${Number(d.gastado).toFixed(2)} · Saldo S/ ${Number(d.saldo).toFixed(2)}`,
        d.lineas != null ? `${d.lineas} gasto(s)${Number(d.sinComprobante) ? `, ${d.sinComprobante} sin comprobante` : ""}` : d.comprobantes ? String(d.comprobantes) : "",
      );
      break;
    case "recibir_rendicion":
      partes.push("Liquidación recibida");
      break;
    case "escanear_subir":
      partes.push(`${d.archivos} archivo(s) subido(s)`);
      break;
    case "revisar_documentacion": {
      const docs = Object.values((d.documentos as Record<string, string> | undefined) ?? {});
      partes.push(
        docs.length
          ? `${docs.filter((x) => x === "revisado").length} documento(s) revisados · ${docs.filter((x) => x === "no_corresponde").length} no corresponden`
          : "Documentación revisada",
      );
      break;
    }
    case "elaborar_entregable":
      partes.push(`Entregable entregado${d.entregadoA ? ` a ${d.entregadoA}` : ""}`);
      break;
    case "contrastar_inventario": {
      const lineas = (d.devoluciones as { cantidad: number; usado?: number; diferencia?: number }[] | undefined) ?? [];
      const dev = lineas.reduce((a, x) => a + x.cantidad, 0);
      const usado = lineas.reduce((a, x) => a + (x.usado ?? 0), 0);
      const difs = lineas.filter((x) => x.diferencia).length;
      const eqs = (d.equipos as { estado?: string; falla: boolean }[] | undefined) ?? [];
      const mal = eqs.filter((x) => x.falla).length;
      partes.push(
        `Volvieron ${dev} · usados ${usado}`,
        difs ? `${difs} diferencia(s) con lo reportado` : "Coincide con lo reportado",
        mal ? `${mal} equipo(s) con observación` : eqs.length ? "Equipos operativos" : "",
        "Cuadra",
      );
      break;
    }
    case "actualizar_inventario":
      partes.push(`2da sección aprobada · stock +${d.devuelto ?? 0}${Number(d.fallas) ? ` · ${d.fallas} equipo(s) a reparación` : ""}`);
      break;
    case "gestionar_carpeta":
      partes.push(`Sesión cerrada${d.ubicacion ? ` · carpeta: ${d.ubicacion}` : ""}`);
      break;
  }
  if (d.obs) partes.push(`Obs.: ${d.obs}`);
  return (
    <p className="text-[13px] text-[#166534]">
      {partes.join(" · ")}
      <span className="block text-xs text-texto-2">
        {fechaHora(r.en)}{r.por ? ` · ${r.por}` : ""}
      </span>
    </p>
  );
}

/** Capacitador y asistente: vienen de la programación; solo se ofrecen personas sin cruce de horario. */
function CamposPersonal({ e }: { e: Exp }) {
  // Solo se ofrecen personas SIN cruce de horario ese día
  const caps = e.consultores.filter((c) => !e.ocupadosCap.has(c.id));
  const asistentes = e.personal.filter((x) => x.rol === "asistente");
  const asisLibres = asistentes.filter((a) => !e.ocupadosAsis.has(a.id));
  // Una línea por persona (aunque figure como consultor y como asistente)
  const noDisp = [...new Set([
    ...e.consultores.filter((c) => e.ocupadosCap.has(c.id)).map((c) => `${nombreCompleto(c)} (ya es ${e.ocupadosCap.get(c.id)})`),
    ...asistentes.filter((a) => e.ocupadosAsis.has(a.id)).map((a) => `${nombreCompleto(a)} (ya es ${e.ocupadosAsis.get(a.id)})`),
  ])];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div>
        <label htmlFor="f-cap" className="etiqueta">Capacitador ({caps.length} disponibles)</label>
        <select id="f-cap" name="capacitadorId" defaultValue={caps.some((c) => c.id === e.p.capacitadorId) ? e.p.capacitadorId! : ""} className="campo py-2">
          <option value="">{caps.length ? "Elegir…" : "Ninguno disponible en este horario"}</option>
          {caps.map((c) => <option key={c.id} value={c.id}>{nombreCompleto(c)}{c.especialidad ? ` — ${c.especialidad}` : ""}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-asi" className="etiqueta">Asistente ({asisLibres.length} disponibles)</label>
        <select id="f-asi" name="asistenteId" defaultValue={asisLibres.some((a) => a.id === e.p.asistenteId) ? e.p.asistenteId! : ""} className="campo py-2">
          <option value="">{asisLibres.length ? "Elegir…" : "Ninguno disponible en este horario"}</option>
          {asisLibres.map((a) => <option key={a.id} value={a.id}>{nombreCompleto(a)}</option>)}
        </select>
      </div>
      <p className="text-xs text-texto-2 sm:col-span-2">
        Solo se muestran las personas sin otra sesión que se cruce el {fechaCorta(e.p.fecha)} de {hora(e.p.horaInicio)} a {hora(e.p.horaFin)}.
        {asistentes.length === 0 && " No hay asistentes registrados: agrégalos en Soporte › Recursos humanos."}
      </p>
      {noDisp.length > 0 && (
        <details className="text-xs text-texto-2 sm:col-span-2">
          <summary className="cursor-pointer">No disponibles por cruce de horario ({noDisp.length})</summary>
          <ul className="mt-1 list-disc pl-5">{noDisp.map((n) => <li key={n}>{n}</li>)}</ul>
        </details>
      )}
      {(caps.length === 0 || asisLibres.length === 0) && (
        <p role="alert" className="rounded-md bg-[#fef3c7] px-3 py-2 text-[13px] text-[#92400e] sm:col-span-2">
          ¿Hay disponibilidad? <strong>No</strong>: registra más personal en Recursos humanos o cambia el horario en Editar programación.
        </p>
      )}
    </div>
  );
}

/* ── Campos del formulario de cada actividad ─────────────── */
function Campos({ clave, e }: { clave: string; e: Exp }) {
  const pasos = e.ctx.pasos;
  switch (clave) {
    case "confirmar_sede":
      return (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input name="contacto" defaultValue={e.p.sede.contacto ?? ""} placeholder="Persona de contacto en la sede" aria-label="Contacto en la sede" className="campo py-2" />
            <input name="obs" placeholder="Observación (obligatoria si NO se confirma)" aria-label="Observación" className="campo py-2" />
          </div>
          <p className="text-[13px] font-semibold text-marino">¿Local confirmado?</p>
          <BotonesDecision si="Sí, confirmado" no="No, reprogramar" />
        </>
      );
    case "comunicar": {
      const sin = e.destinatarios.filter((d) => !d.conAcceso);
      return (
        <>
          <CamposPersonal e={e} />
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="self-center text-texto-2">Asignados al programar:</span>
            {e.destinatarios.map((d) => (
              <span key={d.rol} className={`rounded-full px-2.5 py-1 font-semibold ${d.conAcceso ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef3c7] text-[#92400e]"}`}>
                {d.conAcceso ? "🔔" : "⚠"} {d.nombre} · {d.rol}
              </span>
            ))}
          </div>
          {sin.length > 0 && (
            <p className="text-xs text-[#92400e]">
              {sin.map((d) => d.nombre).join(" y ")} no {sin.length > 1 ? "tienen" : "tiene"} acceso al sistema: dale acceso en{" "}
              <Link href="/personal" className="underline">Personal</Link> o avísale por otro medio.
            </p>
          )}
          <label htmlFor="f-mensaje" className="etiqueta -mb-2">Mensaje (opcional)</label>
          <textarea
            id="f-mensaje"
            name="mensaje"
            rows={2}
            placeholder="Indicaciones: llegar 30 min antes, llevar laptop, material a recoger…"
            className="campo resize-y py-2 text-[13px]"
          />
          <input name="obs" placeholder="Observación interna (opcional)" aria-label="Observación" className="campo py-2" />
        </>
      );
    }
    case "descargar_material": {
      const mat = e.docs.filter((d) => !d.programacionId && (d.tipo === "diapositiva" || d.tipo === "taller"));
      return mat.length === 0 ? (
        <p className="text-[13px] text-[#92400e]">
          Aún no hay diapositivas ni talleres de esta sesión en Gestión documental.{" "}
          <Link href={`/soporte/gestion-documental?sesion=${e.p.sesionId}`} className="enlace">Subirlos en Gestión documental</Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {mat.map((d) => (
            <a
              key={d.id}
              href={enlaceDoc(d)}
              target={d.archivo ? undefined : "_blank"}
              rel="noreferrer"
              className="btn-secundario flex-col items-start gap-0 py-1.5 text-[13px]"
            >
              <span>⬇ {d.nombre}</span>
              <span className="text-[11px] font-normal text-texto-2">
                {TIPO_DOC[d.tipo]}{d.version ? ` · v${d.version}` : ""}{d.tamano != null ? ` · ${tamanoLegible(d.tamano)}` : ""}
              </span>
            </a>
          ))}
        </div>
      );
    }
    case "personalizar":
      return (
        <>
          <input name="detalle" placeholder="Si personalizas: ¿qué cambiaste?" aria-label="Detalle de la personalización" className="campo py-2" />
          <div className="grid grid-cols-1 gap-2 rounded-md border border-dashed border-borde-fuerte p-3 sm:grid-cols-[150px_1fr]">
            <p className="text-[13px] font-semibold text-marino sm:col-span-2">
              Material personalizado <span className="font-normal text-texto-2">(obligatorio si personalizas · queda solo para esta fecha)</span>
            </p>
            <select name="tipoDoc" aria-label="Tipo de material personalizado" defaultValue="diapositiva" className="campo py-2">
              <option value="diapositiva">Diapositivas</option>
              <option value="taller">Taller</option>
              <option value="otro">Otro</option>
            </select>
            <SubirArchivos
              programacionId={e.p.id}
              tipoCampo="tipoDoc"
              version="personalizada"
              etiqueta="Archivos del material personalizado"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.odp,.odt,.jpg,.jpeg,.png,.zip,.rar,.mp4"
            />
          </div>
          <p className="text-[13px] font-semibold text-marino">¿Necesitas personalizar el contenido?</p>
          <BotonesDecision si="Sí, subir lo personalizado" no="No es necesario" />
        </>
      );
    case "dinamicas": {
      const materiales = e.inventario.filter((i) => i.categoria === "material");
      return (
        <>
          <p className="text-[13px] font-semibold text-marino">Del inventario de Logística <span className="font-normal text-texto-2">(se descuenta del stock)</span></p>
          {materiales.length === 0 ? (
            <p className="text-xs text-texto-2">No hay materiales en el inventario. <Link href="/soporte/logistica" className="enlace">Ir a Logística</Link></p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {materiales.map((i) => (
                <label key={i.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[13px] ${i.stock === 0 ? "border-[#fecaca] text-texto-2" : "border-borde"}`}>
                  <input name={`inv-${i.id}`} type="number" min={0} max={i.stock} placeholder="0" disabled={i.stock === 0} aria-label={`Cantidad de ${i.nombre}`} className="campo w-16 px-2 py-1" />
                  <span className="flex flex-col leading-tight">
                    <span>{i.nombre}</span>
                    <span className={`text-[11px] ${i.stock < i.stockMinimo ? "text-[#991b1b]" : "text-texto-2"}`}>stock {i.stock} {i.unidad}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <label htmlFor="f-extras" className="text-[13px] font-semibold text-marino">Extras que no están en el inventario</label>
          <textarea
            id="f-extras"
            name="items"
            rows={2}
            placeholder={"Uno por línea con cantidad:\n20 vasos descartables\n10 hojas de colores"}
            className="campo py-2"
          />
          <p className="text-[13px] font-semibold text-marino">¿Requiere material para dinámicas?</p>
          <BotonesDecision si="Sí, solicitar al asistente" no="No requiere" />
        </>
      );
    }
    case "examen": {
      const doc = e.docs.find((d) => d.tipo === (e.ctx.examen === "salida" ? "examen_salida" : "examen_entrada"));
      return (
        <div className="flex flex-wrap items-end gap-3 text-[13px]">
          <p className="w-full">
            Esta es la <strong>{e.ctx.examen === "entrada" ? "primera" : e.ctx.examen === "salida" ? "última" : "única"}</strong> sesión: imprimir examen {EXAMEN[e.ctx.examen ?? "entrada"]}.
            {doc ? <> <a href={enlaceDoc(doc)} target={doc.archivo ? undefined : "_blank"} rel="noreferrer" className="enlace">⬇ {doc.nombre}</a></> : " (No hay examen en el repositorio.)"}
          </p>
          <div className="w-full sm:w-40">
            <label htmlFor="f-cant" className="etiqueta">Copias impresas</label>
            <input id="f-cant" name="cantidad" type="number" min={0} defaultValue={e.inscritos} className="campo py-2" />
          </div>
        </div>
      );
    }
    case "guardar_material":
      return (
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-full sm:w-48">
            <label htmlFor="f-medio" className="etiqueta">Medio seguro</label>
            <select id="f-medio" name="medio" className="campo py-2" defaultValue="USB">
              <option>USB</option><option>Nube</option><option>WhatsApp</option><option>Otro</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pt-5 text-[13px]">
            <input type="checkbox" name="talleresImpresos" defaultChecked className="size-4 accent-marino" /> Talleres impresos
          </label>
        </div>
      );
    case "imprimir_ficha":
      return (
        <div className="flex flex-wrap gap-3 text-[13px]">
          <Link href={`/operativo/capacitaciones/${e.p.id}/ficha`} target="_blank" className="enlace">🖨 Ficha de capacitación</Link>
          <Link href={`/operativo/capacitacion/${e.p.id}/imprimir`} target="_blank" className="enlace">🖨 Lista de asistencia</Link>
        </div>
      );
    case "alistar_material": {
      const pend = e.items.filter((i) => !i.listo).length;
      return (
        <p className={`text-[13px] ${pend ? "text-[#92400e]" : "text-[#166534]"}`}>
          {e.items.length === 0
            ? "La ficha no tiene ítems. Agrégalos aquí abajo en «Ficha de capacitación · 1ra sección»."
            : pend
              ? `Faltan ${pend} de ${e.items.length} ítems por marcar como listos (aquí abajo, en la ficha).`
              : `Los ${e.items.length} ítems de la ficha están listos.`}
        </p>
      );
    }
    case "probar_equipos": {
      // Se prueban los equipos asignados en la ficha; si no hay, los de la sede e itinerantes
      const asignados = new Set(e.items.map((i) => i.equipoId).filter(Boolean));
      const lista = asignados.size
        ? e.equipos.filter((q) => asignados.has(q.id))
        : e.equipos.filter((q) => q.sedeId === e.p.sedeId || q.sedeId === null);
      const malos = lista.filter((q) => q.estado !== "operativo");
      return (
        <>
          <p className="text-xs text-texto-2">{asignados.size ? "Equipos asignados en la ficha:" : "Aún no se asignan equipos en la ficha. Equipos de la sede e itinerantes:"}</p>
          {lista.length === 0 ? (
            <p className="text-[13px] text-texto-2">
              No hay equipos registrados para esta sede. <Link href="/soporte/mantenimiento" className="enlace">Registrar en Mantenimiento</Link>
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 text-[13px] sm:grid-cols-2">
              {lista.map((q) => (
                <li key={q.id} className={q.estado === "operativo" ? "" : "font-semibold text-[#991b1b]"}>
                  {q.estado === "operativo" ? "✓" : "✕"} {TIPOS_EQUIPO[q.tipo].singular} · {q.nombre} ({q.codigo}) · {q.sede?.nombre ?? "itinerante"} · {q.estado.replace("_", " ")}
                </li>
              ))}
            </ul>
          )}
          {malos.length > 0 && <p className="text-[13px] text-[#991b1b]">⚠ {malos.length} equipo(s) no están operativos según Mantenimiento.</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
            <select name="resultado" aria-label="Resultado de la prueba" className="campo py-2" defaultValue="ok">
              <option value="ok">Todo operativo</option>
              <option value="observado">Con observaciones</option>
            </select>
            <input name="obs" placeholder="Observaciones de la prueba" aria-label="Observaciones" className="campo py-2" />
          </div>
        </>
      );
    }
    case "solicitar_viaticos":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr]">
          <div>
            <label htmlFor="f-monto" className="etiqueta">Monto (S/)</label>
            <input id="f-monto" name="monto" type="number" min={0} step="0.10" required className="campo py-2" />
          </div>
          <div>
            <label htmlFor="f-conc" className="etiqueta">Concepto</label>
            <input id="f-conc" name="concepto" defaultValue={e.p.sede.fueraDeArequipa ? "Pasajes y alimentación" : "Movilidad local"} className="campo py-2" />
          </div>
        </div>
      );
    case "entregar_viaticos": {
      const sol = pasos.solicitar_viaticos as Record<string, unknown> | undefined;
      return (
        <div className="flex flex-wrap items-end gap-3 text-[13px]">
          <p className="w-full">
            Sede {e.p.sede.fueraDeArequipa ? "FUERA" : "dentro"} de Arequipa → viáticos para <strong>{e.p.sede.fueraDeArequipa ? "viaje" : "movilidad"}</strong>. Solicitado: S/ {Number(sol?.monto ?? 0).toFixed(2)}
          </p>
          <div className="w-full sm:w-40">
            <label htmlFor="f-ent" className="etiqueta">Monto entregado (S/)</label>
            <input id="f-ent" name="monto" type="number" min={0} step="0.10" defaultValue={Number(sol?.monto ?? 0) || ""} required className="campo py-2" />
          </div>
        </div>
      );
    }
    case "llenar_ficha": {
      const obs = (pasos.observaciones_ficha?.lista as { obs: string; en: string; por?: string }[] | undefined) ?? [];
      const ultima = obs.at(-1);
      const pend = e.items.filter((i) => !i.listo).length;
      return (
        <>
          {ultima && (
            <p className="rounded-md bg-[#fef3c7] px-3 py-2 text-[13px] text-[#92400e]">
              Observación de Gestión Documental ({fechaHora(ultima.en)}): {ultima.obs} — corrígelo en la ficha de «Alistar material».
            </p>
          )}
          <p className={`text-[13px] ${pend ? "text-[#92400e]" : "text-[#166534]"}`}>
            1ra sección: {e.items.length} ítems{pend ? ` · faltan ${pend} por marcar como listos` : " · todos listos"}.{" "}
            <a href="#ficha" className="enlace">Ver la ficha</a>
          </p>
          <input name="obs" placeholder="Comentario para el encargado (opcional)" aria-label="Comentario" className="campo py-2" />
        </>
      );
    }
    /* ── Post-capacitación ── */
    case "sesion_realizada":
      return (
        <>
          <input name="obs" placeholder="Motivo (obligatorio si NO se realizó)" aria-label="Observación" className="campo py-2" />
          <BotonesDecision si="Sí, se realizó" no="No se realizó → reprogramar" />
        </>
      );
    case "solicitar_entregables":
      return <input name="obs" placeholder="Observación (opcional)" aria-label="Observación" className="campo py-2" />;
    case "corregir_examenes":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label htmlFor="f-exc" className="etiqueta">Exámenes corregidos</label>
            <input id="f-exc" name="cantidad" type="number" min={0} defaultValue={e.inscritos} className="campo py-2" />
          </div>
          <div>
            <label htmlFor="f-prom" className="etiqueta">Nota promedio</label>
            <input id="f-prom" name="promedio" placeholder="Opcional" className="campo py-2" />
          </div>
          <div>
            <label htmlFor="f-exo" className="etiqueta">Observación</label>
            <input id="f-exo" name="obs" placeholder="Opcional" className="campo py-2" />
          </div>
        </div>
      );
    case "enviar_examenes":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SubirArchivos
            programacionId={e.p.id}
            tipo={e.ctx.examen === "salida" ? "examen_salida" : "examen_entrada"}
            version="corregido"
            etiqueta="Exámenes escaneados (opcional)"
            accept=".pdf,.jpg,.jpeg,.png,.zip"
          />
          <div>
            <label htmlFor="f-exn" className="etiqueta">Observación</label>
            <input id="f-exn" name="obs" placeholder="Enviado por NextCloud…" className="campo py-2" />
          </div>
        </div>
      );
    case "reportar_incidencias":
      return <textarea name="incidencias" rows={2} placeholder="Incidencias de la sesión (déjalo vacío si no hubo)" aria-label="Incidencias" className="campo py-2" />;
    case "llenar_ficha2": {
      const inc = (pasos.reportar_incidencias as Record<string, unknown> | undefined)?.incidencias as string | undefined;
      const delInv = e.items.filter((i) => i.insumoId);
      const eqs = e.items.filter((i) => i.equipoId);
      const entregado = Number((pasos.entregar_viaticos as Record<string, unknown> | undefined)?.monto ?? 0);
      const sub = "text-[13px] font-semibold text-marino";
      return (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className={sub}>Horario real</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                ["horaLlegada", "Llegada a sede", false],
                ["horaInicioReal", "Inicio real", true],
                ["horaFinReal", "Término real", true],
              ].map(([n, l, req]) => (
                <div key={String(n)}>
                  <label htmlFor={`f2-${n}`} className="etiqueta">{l}{req ? " *" : ""}</label>
                  <input id={`f2-${n}`} name={String(n)} type="time" required={Boolean(req)} className="campo py-2" />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className={sub}>Asistencia (turno {TURNO_LABEL[e.p.turno].toLowerCase()})</legend>
            <CampoAsistentes programados={e.inscritos} inicial={e.presentes || null} />
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={sub}>Marque con un aspa (x) los entregables presentados</legend>
            <div className="grid grid-cols-1 gap-y-1">
              {ENTREGABLES.map((x) =>
                "siCorresponde" in x && !e.ctx.examen ? (
                  <span key={x.k} className="flex items-center gap-2 text-[13px] text-texto-2">
                    <span className="inline-block size-4 rounded border border-dashed border-borde-fuerte" /> {x.t} — no corresponde
                  </span>
                ) : (
                  <label key={x.k} className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox" name={`ent-${x.k}`} className="size-4 accent-marino" /> {x.t} <span className="text-xs text-texto-2">(completo)</span>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={sub}>Preparación de la capacitación</legend>
            {PREGUNTAS_PREPARACION.map((q) => (
              <div key={q.k} className="flex flex-col gap-1 border-b border-[#eef1f5] pb-2 text-[13px] last:border-0">
                <span>{q.t}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1"><input type="radio" name={`prep-${q.k}`} value="si" required className="accent-marino" /> Sí</label>
                  <label className="flex items-center gap-1"><input type="radio" name={`prep-${q.k}`} value="no" className="accent-marino" /> No</label>
                  <input name={`prepdet-${q.k}`} placeholder="Detalle (obligatorio si es Sí)" aria-label={`Detalle: ${q.t}`} className="campo min-w-0 flex-1 py-1.5" />
                </div>
              </div>
            ))}
          </fieldset>

          <div className="grid grid-cols-1 gap-2">
            <p className="rounded-md bg-[#f8fafc] px-3 py-2 text-[13px]">
              <span className="font-semibold">Incidencias</span> (reportadas en la actividad anterior): {inc || "Sin incidencias"}
            </p>
            <textarea name="obsCapacitador" rows={2} placeholder="Observaciones del capacitador" aria-label="Observaciones del capacitador" className="campo py-2" />
            <textarea name="feedback" rows={2} placeholder="Recomendación o feedback" aria-label="Recomendación o feedback" className="campo py-2" />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={sub}>Restante a devolver (inventario de Logística)</legend>
            {delInv.length === 0 ? (
              <p className="text-[13px] text-texto-2">No salió material del inventario para esta sesión.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {delInv.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-[13px]">
                    <input name={`dev-${i.id}`} type="number" min={0} max={i.cantidad} defaultValue={0} aria-label={`Restante de ${i.descripcion}`} className="campo w-16 px-2 py-1" />
                    <span>{i.descripcion} <span className="text-xs text-texto-2">restante de {i.cantidad} que salieron</span></span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={sub}>Equipos llevados (inventario de Mantenimiento)</legend>
            {eqs.length === 0 ? (
              <p className="text-[13px] text-texto-2">No se asignaron equipos a esta sesión.</p>
            ) : (
              eqs.map((i) => (
                <div key={i.id} className="flex flex-col gap-1.5 border-b border-[#eef1f5] pb-2 text-[13px] last:border-0">
                  <span className="font-medium">{i.descripcion}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    ¿Presentó fallas?
                    <label className="flex items-center gap-1"><input type="radio" name={`eqfalla-${i.equipoId}`} value="si" className="accent-marino" /> Sí</label>
                    <label className="flex items-center gap-1"><input type="radio" name={`eqfalla-${i.equipoId}`} value="no" defaultChecked className="accent-marino" /> No</label>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    ¿Requiere corrección?
                    <label className="flex items-center gap-1"><input type="radio" name={`eqcorr-${i.equipoId}`} value="si" className="accent-marino" /> Sí</label>
                    <label className="flex items-center gap-1"><input type="radio" name={`eqcorr-${i.equipoId}`} value="no" defaultChecked className="accent-marino" /> No</label>
                  </span>
                  <input name={`eqdet-${i.equipoId}`} placeholder="Qué falló o qué corregir" aria-label={`Detalle de ${i.descripcion}`} className="campo py-1.5" />
                </div>
              ))
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={sub}>Gastos de la sesión (S/)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {GASTOS.map((g) => (
                <div key={g.k}>
                  <label htmlFor={`g-${g.k}`} className="etiqueta">{g.t}</label>
                  <input id={`g-${g.k}`} name={`gasto-${g.k}`} type="number" min={0} step="0.10" placeholder="0.00" className="campo py-1.5" />
                </div>
              ))}
            </div>
            <input name="gastosDetalle" placeholder="Detalle de los gastos (opcional)" aria-label="Detalle de los gastos" className="campo py-1.5" />
            <p className="text-xs text-texto-2">Viáticos entregados: S/ {entregado.toFixed(2)} · estos gastos pasan solos a la liquidación de viáticos.</p>
          </fieldset>
        </div>
      );
    }
    case "registrar_asistencia": {
      const declarados = (pasos.llenar_ficha2 as Ficha2 | undefined)?.asistentes;
      return (
        <>
          <p className="text-[13px]">
            <Link href={`/operativo/capacitacion/${e.p.id}`} className="enlace">Abrir la lista de asistencia</Link> y registrar a los participantes.{" "}
            <span className="text-texto-2">({e.inscritos} programados · {e.presentes} presentes registrados{declarados != null ? ` · ${declarados} declarados en la 2da sección` : ""})</span>
          </p>
          {declarados != null && e.presentes > 0 && declarados !== e.presentes && (
            <p className="rounded-md bg-[#fef3c7] px-3 py-2 text-[13px] text-[#92400e]">
              No coincide: la 2da sección dice {declarados} asistentes y la lista tiene {e.presentes} presentes.
            </p>
          )}
          {e.inscritos === 0 && (
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="sinParticipantes" className="size-4 accent-marino" /> No hubo participantes inscritos en el sistema
            </label>
          )}
          <input name="obs" placeholder="Observación (obligatoria si no coincide con la 2da sección)" aria-label="Observación" className="campo py-2" />
        </>
      );
    }
    case "rendir_viaticos":
      return (
        <>
          <FormLiquidacion programacionId={e.p.id} inicial={e.liquidacion.datos} guardada={e.liquidacion.guardada} />
          <p className="text-xs text-texto-2">
            {e.liquidacion.guardada ? "Se muestra la liquidación guardada." : "Viene llena con los datos del sistema (asistente, sesión, monto entregado y gastos de la 2da sección)."} Al enviarla queda
            registrada y Administración la puede descargar.
          </p>
        </>
      );
    case "recibir_rendicion":
      return (
        <>
          <FormLiquidacion programacionId={e.p.id} inicial={e.liquidacion.datos} guardada soloLectura />
          <input name="obs" placeholder="Observación (opcional)" aria-label="Observación" className="campo py-2" />
        </>
      );
    case "escanear_subir":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-texto-2">
            Cada grupo se guarda en su subcarpeta de esta fecha. Puedes elegir varios archivos a la vez (documentos y fotos hasta 50 MB, videos hasta 300 MB).
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <SubirArchivos
              programacionId={e.p.id}
              tipo="evidencia"
              seccion="lista_asistencia"
              etiqueta="📋 Lista de asistencia y formatos escaneados"
              accept=".pdf,.jpg,.jpeg,.png,.heic,.zip,.doc,.docx,.xls,.xlsx"
            />
            <SubirArchivos
              programacionId={e.p.id}
              tipo="evidencia"
              seccion="fotos"
              etiqueta="📷 Fotos (registro fotográfico)"
              accept=".jpg,.jpeg,.png,.heic,.zip"
            />
            <SubirArchivos
              programacionId={e.p.id}
              tipo="evidencia"
              seccion="video"
              etiqueta="🎥 Video (10 min)"
              accept=".mp4,.mov,.avi,.3gp"
            />
          </div>
        </div>
      );
    case "imprimir_ficha_digital":
      return (
        <p className="text-[13px]">
          <Link href={`/operativo/capacitaciones/${e.p.id}/ficha`} target="_blank" className="enlace">🖨 Ficha de capacitación (1ra y 2da sección)</Link>
        </p>
      );
    case "revisar_documentacion": {
      const obs = (pasos.observaciones_contraste?.lista as { obs: string; en: string }[] | undefined)?.at(-1);
      const f2 = (pasos.llenar_ficha2 ?? {}) as Ficha2;
      const viaticos = Number((pasos.entregar_viaticos as Record<string, unknown> | undefined)?.monto ?? 0) > 0;
      const DECLARADO = { completo: "Completo", incompleto: "Incompleto", no_corresponde: "No corresponde" } as const;
      // ¿La sesión contempla este documento? Según la 2da sección de la ficha (o si hubo examen / viáticos)
      const contempla = (k: string) => {
        if (k === "viaticos") return viaticos;
        const dec = f2.entregables?.[k];
        if (dec) return dec !== "no_corresponde";
        return !(k === "evaluaciones" || k === "notas") || e.ctx.examen !== null;
      };
      return (
        <>
          {obs && <p className="rounded-md bg-[#fef3c7] px-3 py-2 text-[13px] text-[#92400e]">No cuadró ({fechaHora(obs.en)}): {obs.obs}</p>}
          <div className="overflow-x-auto rounded-md border border-borde bg-white">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-texto-2">
                  <th className="px-2 py-1.5">Documento</th>
                  <th className="px-2 py-1.5">Declarado en la 2da sección</th>
                  <th className="px-2 py-1.5 text-center">Revisado</th>
                  <th className="px-2 py-1.5 text-center">No corresponde</th>
                </tr>
              </thead>
              <tbody>
                {DOCUMENTOS_REVISION.map((x) => {
                  const dec = f2.entregables?.[x.k];
                  const si = contempla(x.k);
                  return (
                    <tr key={x.k} className={`border-t border-[#eef1f5] ${!si ? "text-texto-2" : dec === "incompleto" ? "bg-[#fef2f2] font-semibold text-[#991b1b]" : ""}`}>
                      <td className="px-2 py-1.5">{x.t}</td>
                      <td className="px-2 py-1.5 text-xs">{dec ? DECLARADO[dec] : x.k === "viaticos" ? (viaticos ? "Hubo viáticos" : "Sin viáticos") : "—"}</td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="radio"
                          name={`doc-${x.k}`}
                          value="revisado"
                          defaultChecked={si && (dec ? dec === "completo" : x.k === "viaticos" ? Boolean(pasos.rendir_viaticos) : x.k !== "ficha" || Boolean(pasos.imprimir_ficha_digital))}
                          aria-label={`${x.t}: revisado`}
                          className="size-4 accent-marino"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <input type="radio" name={`doc-${x.k}`} value="no_corresponde" defaultChecked={!si} aria-label={`${x.t}: no corresponde`} className="size-4 accent-marino" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-texto-2">
            Viene marcado según la 2da sección: lo completo como «Revisado» y lo que la sesión no contempla como «No corresponde». Lo que se declaró incompleto (en rojo) hay que completarlo y marcarlo.
          </p>
          <input name="obs" placeholder="Observación (opcional)" aria-label="Observación" className="campo py-2" />
        </>
      );
    }
    case "elaborar_entregable": {
      const gd = e.personal.filter((x) => x.rol === "gestion_documental");
      return (
        <>
          <p className="text-xs text-texto-2">Entregable: la mica con toda la documentación (ficha de capacitación, exámenes…).</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select name="entregadoA" aria-label="Entregado a" className="campo py-2" defaultValue="">
              <option value="">Entregado a (Gestión Documental)…</option>
              {gd.map((x) => <option key={x.id} value={nombreCompleto(x)}>{nombreCompleto(x)}</option>)}
            </select>
            <input name="obs" placeholder="Observación (opcional)" aria-label="Observación" className="campo py-2" />
          </div>
        </>
      );
    }
    case "contrastar_inventario": {
      const f2 = (pasos.llenar_ficha2 ?? {}) as Ficha2;
      const aMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
      const duracionHoras = Math.max(0, Math.round((aMin(e.p.horaFin) - aMin(e.p.horaInicio)) / 30) / 2);
      const materiales = e.items
        .filter((i) => i.insumoId)
        .map((i) => {
          const ins = e.stockInsumos.get(i.insumoId!);
          return {
            itemId: i.id,
            nombre: i.descripcion,
            salio: i.cantidad,
            reportado: f2.devoluciones?.find((x) => x.itemId === i.id)?.cantidad ?? 0,
            stock: ins?.stock ?? null,
            stockMinimo: ins?.stockMinimo ?? 0,
            unidad: ins?.unidad ?? "",
          };
        });
      const equipos = e.items
        .filter((i) => i.equipoId)
        .map((i) => {
          const r = f2.equipos?.find((x) => x.equipoId === i.equipoId);
          const eq = e.equipos.find((x) => x.id === i.equipoId);
          const tipo = eq?.tipo ?? "otro";
          return {
            equipoId: i.equipoId!,
            nombre: i.descripcion,
            tipo: TIPOS_EQUIPO[tipo].singular,
            chequeos: CHEQUEOS_EQUIPO[tipo],
            horas: duracionHoras,
            usos: e.usosEquipo.get(i.equipoId!) ?? 0,
            reporte: !r ? "Sin reporte" : r.falla ? `Con falla${r.detalle ? `: ${r.detalle}` : ""}` : r.correccion ? `Requiere corrección${r.detalle ? `: ${r.detalle}` : ""}` : "Operativo",
            sugerido: (r?.falla ? "falla" : r?.correccion ? "correccion" : "ok") as "ok" | "falla" | "correccion",
            detalle: r?.detalle ?? "",
          };
        });
      const extras = e.items.filter((i) => !i.insumoId && !i.equipoId).map((i) => `${i.cantidad} ${i.descripcion}`);
      return (
        <>
          <ContrasteInventario materiales={materiales} equipos={equipos} extras={extras} presentes={e.presentes} inscritos={e.inscritos} />
          <p className="text-[13px] font-semibold text-marino">¿Cuadra con la 2da sección de la ficha?</p>
          <BotonesDecision si="Sí, cuadra: registrar contraste" no="No cuadra (vuelve al asistente)" />
        </>
      );
    }
    case "actualizar_inventario": {
      const c = (pasos.contrastar_inventario ?? {}) as Record<string, unknown>;
      const f2 = (pasos.llenar_ficha2 ?? {}) as Record<string, unknown>;
      const dev = (c.devoluciones as { nombre: string; cantidad: number; salio: number; reportado?: number; usado?: number; diferencia?: number }[] | undefined) ?? [];
      const eqs = (c.equipos as { equipo: string; falla: boolean; estado?: string; obs: string | null; horas?: number; chequeos?: Record<string, boolean> }[] | undefined) ?? [];
      const ESTADO_EQ: Record<string, string> = { ok: "operativo", falla: "con falla", correccion: "requiere corrección", no_devuelto: "NO VOLVIÓ" };
      const devolver = dev.filter((x) => x.cantidad > 0);
      const fallas = eqs.filter((x) => x.falla);
      return (
        <>
          <div className="grid grid-cols-1 gap-1 rounded-md bg-[#f8fafc] px-3 py-2 text-[13px] sm:grid-cols-2">
            <span>2da sección: inicio {String(f2.horaInicioReal ?? "—")} · término {String(f2.horaFinReal ?? "—")}</span>
            <span>{f2.incidencias ? `Incidencias: ${f2.incidencias}` : "Sin incidencias"}</span>
            {ENTREGABLES.map((x) => {
              const v = (f2.entregables as Ficha2["entregables"])?.[x.k];
              return v && v !== "no_corresponde" ? (
                <span key={x.k} className={v === "completo" ? "" : "font-semibold text-[#991b1b]"}>{v === "completo" ? "☒" : "☐"} {x.t.replace(" (si corresponde)", "")}</span>
              ) : null;
            })}
            <span>Gastos declarados: S/ {Number(f2.totalGastos ?? 0).toFixed(2)}</span>
            {dev.map((x) => (
              <span key={x.nombre} className={x.diferencia ? "font-semibold text-[#991b1b]" : ""}>
                {x.nombre}: salieron {x.salio}, volvieron {x.cantidad}, usados {x.usado ?? x.salio - x.cantidad}
                {x.diferencia ? ` (el asistente reportó ${x.reportado})` : ""}
              </span>
            ))}
            {eqs.map((x) => {
              const malos = Object.entries(x.chequeos ?? {}).filter(([, ok]) => !ok).map(([k]) => k);
              return (
                <span key={x.equipo} className={x.falla ? "font-semibold text-[#991b1b]" : ""}>
                  {x.equipo}: {ESTADO_EQ[x.estado ?? (x.falla ? "falla" : "ok")]}{x.horas ? ` · ${x.horas} h de uso` : ""}
                  {malos.length ? ` · revisar: ${malos.join(", ")}` : ""}{x.obs ? ` (${x.obs})` : ""}
                </span>
              );
            })}
            {c.obs ? <span className="sm:col-span-2">Obs. G.D.: {String(c.obs)}</span> : null}
          </div>
          <p className="text-[13px]">
            <Link href={`/operativo/capacitaciones/${e.p.id}/ficha`} target="_blank" className="enlace">Ver ficha completa</Link> · Al aprobar:{" "}
            {devolver.length ? `vuelve al stock de Logística ${devolver.map((x) => `${x.cantidad} ${x.nombre}`).join(", ")}` : "no hay material que devolver al stock"};{" "}
            {fallas.length
              ? `Mantenimiento: ${fallas.map((x) => `${x.equipo} → ${x.estado === "no_devuelto" ? "de baja (no volvió)" : "en reparación"}`).join(", ")}`
              : "todos los equipos volvieron operativos"}
            . Se guarda la revisión y el uso de cada equipo en su historial.
          </p>
          <input name="obs" placeholder="Observación de la aprobación (opcional)" aria-label="Observación" className="campo py-2" />
        </>
      );
    }
    case "gestionar_carpeta":
      return (
        <>
          <input name="ubicacion" placeholder="Ubicación de la carpeta física (ej. Archivador 3 · 2026)" aria-label="Ubicación de la carpeta" className="campo py-2" />
          <p className="text-xs text-texto-2">Al registrar, la sesión queda cerrada («Finalizada»).</p>
        </>
      );
    case "revisar_ficha":
      return (
        <>
          <p className="text-[13px]">
            <Link href={`/operativo/capacitaciones/${e.p.id}/ficha`} target="_blank" className="enlace">Ver ficha</Link> · {e.items.length} ítems en la 1ra sección
          </p>
          <input name="obs" placeholder="Observaciones (obligatorias si NO está correcta)" aria-label="Observaciones" className="campo py-2" />
          <p className="text-[13px] font-semibold text-marino">¿Todo correcto?</p>
          <BotonesDecision si="Sí, correcta" no="No, devolver al asistente" />
        </>
      );
    default:
      return null;
  }
}

/** Refrigerio desde el inventario de Logística. */
function AsignarRefrigerio({ e }: { e: Exp }) {
  const lista = e.inventario.filter((i) => i.categoria === "refrigerio");
  if (!lista.length) return <p className="mt-1 text-xs text-texto-2">No hay refrigerio en el inventario. <Link href="/soporte/logistica" className="enlace">Logística</Link></p>;
  return (
    <FormAccion accion={asignarRefrigerio} programacionId={e.p.id} boton="Asignar refrigerio">
      <p className="text-xs text-texto-2">Del inventario de Logística ({e.inscritos} inscritos) · se descuenta del stock</p>
      <div className="grid grid-cols-2 gap-1.5">
        {lista.map((i) => (
          <label key={i.id} className={`flex items-center gap-2 text-[13px] ${i.stock === 0 ? "text-texto-2" : ""}`}>
            <input name={`inv-${i.id}`} type="number" min={0} max={i.stock} placeholder="0" disabled={i.stock === 0} aria-label={`Cantidad de ${i.nombre}`} className="campo w-16 px-2 py-1" />
            <span className="leading-tight">
              {i.nombre}
              <span className={`block text-[11px] ${i.stock < i.stockMinimo ? "text-[#991b1b]" : "text-texto-2"}`}>stock {i.stock} {i.unidad}</span>
            </span>
          </label>
        ))}
      </div>
    </FormAccion>
  );
}

/** Equipos desde el inventario de Mantenimiento: solo operativos y sin cruce de horario. */
function AsignarEquipos({ e }: { e: Exp }) {
  const yaAqui = new Set(e.items.map((i) => i.equipoId).filter(Boolean));
  const libres = e.operativos.filter((q) => !yaAqui.has(q.id) && !e.equiposOcupados.has(q.id));
  const ocupados = e.operativos.filter((q) => e.equiposOcupados.has(q.id));
  const tipos = [...new Set(libres.map((q) => q.tipo))];
  return (
    <FormAccion accion={asignarEquipos} programacionId={e.p.id} boton="Asignar equipos">
      <p className="text-xs text-texto-2">Del inventario de Mantenimiento · solo equipos operativos y libres en este horario</p>
      {libres.length === 0 ? (
        <p className="text-[13px] text-[#92400e]">No hay equipos disponibles. <Link href="/soporte/mantenimiento" className="enlace">Mantenimiento</Link></p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tipos.map((t) => (
            <fieldset key={t} className="flex flex-wrap gap-x-3 gap-y-1">
              <legend className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-texto-2">{TIPOS_EQUIPO[t].plural}</legend>
              {libres.filter((q) => q.tipo === t).map((q) => (
                <label key={q.id} className="flex items-center gap-1.5 text-[13px]" title={q.nombre}>
                  <input type="checkbox" name="equipoId" value={q.id} className="size-4 accent-marino" />
                  {q.codigo}
                  {q.sede && <span className="text-[11px] text-texto-2">({q.sede.nombre})</span>}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
      {ocupados.length > 0 && (
        <details className="text-xs text-texto-2">
          <summary className="cursor-pointer">Ocupados en este horario ({ocupados.length})</summary>
          <ul className="mt-1 list-disc pl-5">{ocupados.map((q) => <li key={q.id}>{q.codigo}: {e.equiposOcupados.get(q.id)}</li>)}</ul>
        </details>
      )}
    </FormAccion>
  );
}

/* ── Ficha de capacitación · 1ra sección (dentro del carril del asistente) ── */
function FichaPrimera({ e, editable }: { e: Exp; editable: boolean }) {
  const { p } = e;
  return (
        <div id="ficha" className="flex flex-col gap-2 rounded-lg border border-[#99f6e4] bg-[#f0fdfa]/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
            <div>
              <h4 className="text-sm font-semibold text-marino">Ficha de capacitación · 1ra sección</h4>
              <p className="text-[13px] font-semibold">Programados: {e.inscritos} beneficiarios · turno {TURNO_LABEL[e.p.turno].toLowerCase()}</p>
              <p className="text-xs text-texto-2">
                El asistente asigna refrigerio (inventario de Logística) y equipos (inventario de Mantenimiento). Lo que sale de Logística se descuenta del stock y vuelve si se quita; los «Extra» se compran aparte.
              </p>
            </div>
            <Link href={`/operativo/capacitaciones/${p.id}/ficha`} className="enlace text-sm">🖨 Imprimir ficha</Link>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-4 py-3 2xl:grid-cols-2">
            {Object.entries(CATEGORIAS).map(([k, t]) => ({ k, t, items: e.items.filter((i) => i.categoria === k) })).map(({ k, t, items }) => (
              <div key={k}>
                <h3 className="mb-1.5 text-[13px] font-semibold text-marino">{t}</h3>
                {items.length === 0 ? (
                  <p className="text-xs text-texto-2">Sin ítems.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {items.map((i) => (
                      <li key={i.id} className="flex items-center gap-2 text-sm">
                        {editable ? (<form action={alternarItem}>
                          <input type="hidden" name="itemId" value={i.id} />
                          <button
                            aria-label={`${i.listo ? "Desmarcar" : "Marcar como listo"}: ${i.descripcion}`}
                            aria-pressed={i.listo}
                            className={`flex size-5 items-center justify-center rounded border text-xs ${i.listo ? "border-[#16a34a] bg-[#16a34a] text-white" : "border-borde-fuerte bg-white"}`}
                          >
                            {i.listo ? "✓" : ""}
                          </button>
                        </form>) : <span aria-hidden="true" className="w-5 text-center text-xs text-[#16a34a]">{i.listo ? "✓" : "·"}</span>}
                        <span className={`flex-1 ${i.listo ? "text-texto-2 line-through" : ""}`}>{i.cantidad} × {i.descripcion}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${i.insumoId || i.equipoId ? "bg-[#e0e7ff] text-[#3730a3]" : "bg-[#fef3c7] text-[#92400e]"}`}>
                          {i.equipoId ? "Mantenimiento" : i.insumoId ? "Inventario" : "Extra"}
                        </span>
                        {editable && (<form action={eliminarItem}>
                          <input type="hidden" name="itemId" value={i.id} />
                          <button aria-label={`Quitar ${i.descripcion}`} className="text-xs text-texto-2 hover:text-[#991b1b]">Quitar</button>
                        </form>)}
                      </li>
                    ))}
                  </ul>
                )}
                {editable && k === "refrigerio" && <AsignarRefrigerio e={e} />}
                {editable && k === "tecnologico" && <AsignarEquipos e={e} />}
              </div>
            ))}
          </div>
          {editable && <p className="px-4 text-xs font-semibold text-marino">Agregar material del capacitador u otro ítem extra</p>}
          {editable && <FormItem programacionId={p.id} inventario={e.inventario.map((i) => ({ id: i.id, nombre: i.nombre, stock: i.stock, unidad: i.unidad, categoria: i.categoria }))} />}
        </div>
  );
}

const DECISIONES = new Set(["confirmar_sede", "personalizar", "dinamicas", "revisar_ficha", "sesion_realizada", "contrastar_inventario"]);
const BOTON: Record<string, string> = {
  solicitar_entregables: "Entregables solicitados",
  corregir_examenes: "Exámenes corregidos",
  enviar_examenes: "Exámenes enviados",
  reportar_incidencias: "Reportar",
  llenar_ficha2: "Guardar 2da sección",
  registrar_asistencia: "Asistencia registrada",
  rendir_viaticos: "Enviar liquidación a Administración",
  recibir_rendicion: "Rendición recibida",
  escanear_subir: "Subir al sistema",
  imprimir_ficha_digital: "Ficha impresa",
  revisar_documentacion: "Documentación revisada",
  elaborar_entregable: "Entregable entregado",
  actualizar_inventario: "Aprobar y actualizar inventario",
  gestionar_carpeta: "✓ Registrar sesión cerrada",
  comunicar: "Validar y comunicar",
  descargar_material: "Material descargado",
  examen: "Examen impreso",
  guardar_material: "Registrar",
  imprimir_ficha: "Impresión realizada",
  alistar_material: "Material alistado",
  probar_equipos: "Registrar prueba",
  solicitar_viaticos: "Solicitar viáticos",
  entregar_viaticos: "Registrar entrega",
  llenar_ficha: "Ficha completa: comunicar a G.D.",
  aprobar_ficha: "Aprobar ficha",
  lista: "✓ Sesión lista, sale a sede",
};

function Tarjeta({ s, n, e, est, u, href }: { s: EstadoItem; n: number; e: Exp; est: Map<string, string>; u: Usuario; href?: string }) {
  const mio = puedeRegistrarPaso(u.roles, s.roles);
  const reg = e.ctx.pasos[s.clave];
  const icono = { hecho: "✓", disponible: String(n), bloqueado: String(n), no_aplica: "–" }[s.estado];
  const circulo = {
    hecho: "bg-[#16a34a] text-white",
    disponible: "bg-acento text-white",
    bloqueado: "bg-[#e6ebf1] text-texto-2",
    no_aplica: "bg-[#e6ebf1] text-texto-2",
  }[s.estado];
  const faltan = s.requiere.filter((r) => !["hecho", "no_aplica"].includes(est.get(r) ?? "")).map((r) => PASO[r].titulo);

  return (
    <li
      id={`paso-${s.clave}`}
      className={`card flex scroll-mt-4 gap-3 p-4 ${s.estado === "disponible" ? "border-acento shadow-sm" : ""} ${s.estado === "bloqueado" || s.estado === "no_aplica" ? "opacity-70" : ""}`}
      aria-label={`${s.titulo}: ${s.estado.replace("_", " ")}`}
    >
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${circulo}`} aria-hidden="true">{icono}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-marino">
            {href ? <Link href={href} className="hover:underline">{s.titulo}</Link> : s.titulo}
          </h3>
          <span className="flex flex-wrap gap-1">{s.roles.map((r) => <ChipRol key={r} rol={r} />)}</span>
        </div>
        <p className="text-xs text-texto-2">{s.descripcion}</p>
        {s.nota && <p className="text-xs italic text-[#6b7280]">📝 {s.nota}</p>}

        {s.estado === "hecho" && reg && (
          <div className="flex items-start justify-between gap-2">
            <Resumen clave={s.clave} r={reg} />
            {(mio || u.roles.includes("jefe_proyecto")) && <form action={deshacerPaso}>
              <input type="hidden" name="programacionId" value={e.p.id} />
              <input type="hidden" name="clave" value={s.clave} />
              <button className="text-xs text-texto-2 underline hover:text-[#991b1b]" title="Deshacer (solo si nada posterior depende de esto)">Deshacer</button>
            </form>}
          </div>
        )}
        {s.clave === "comunicar" && s.estado === "hecho" && e.avisosComunicar.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {e.avisosComunicar.map((a) => (
              <span key={a.id} className={`rounded-full px-2.5 py-1 font-semibold ${a.confirmadoEn ? "bg-[#dcfce7] text-[#166534]" : "bg-[#eef1f5] text-texto-2"}`}>
                {a.confirmadoEn ? `✓ ${a.nombre} confirmó · ${fechaHora(a.confirmadoEn.toISOString())}` : a.leidoEn ? `👁 ${a.nombre} lo vio, falta «Enterado»` : `⏳ ${a.nombre} aún no lo ve`}
              </span>
            ))}
          </div>
        )}
        {(s.clave === "rendir_viaticos" || s.clave === "recibir_rendicion") && s.estado === "hecho" && e.liquidacion.guardada && (
          <a href={`/operativo/capacitaciones/${e.p.id}/liquidacion`} className="btn-secundario self-start py-1.5 text-[13px]">
            ⬇ Descargar liquidación de viáticos (formato lleno)
          </a>
        )}
        {s.clave === "alistar_material" && <FichaPrimera e={e} editable={est.get("llenar_ficha") !== "hecho" && puedeEditarFicha(u.roles)} />}
        {s.estado === "disponible" && !mio && (
          <p className="rounded-md bg-[#eef1f5] px-3 py-2 text-xs text-texto-2">Pendiente · la registra {s.roles.map((r) => ROLES[r]).join(" o ")}.</p>
        )}
        {s.estado === "disponible" && mio && (
          <FormPaso programacionId={e.p.id} clave={s.clave} personas={[]} boton={DECISIONES.has(s.clave) ? "" : BOTON[s.clave] ?? "Registrar"}>
            <Campos clave={s.clave} e={e} />
          </FormPaso>
        )}
        {s.estado === "bloqueado" && faltan.length > 0 && <p className="text-xs text-texto-2">Espera: {faltan.join(" · ")}</p>}
        {s.estado === "no_aplica" && <p className="text-xs text-texto-2">No aplica: no es la primera ni la última sesión de la capacitación.</p>}
      </div>
    </li>
  );
}

const VISTAS: { v: Vista; label: string }[] = [
  { v: "pre", label: "Pre-capacitación" },
  { v: "post", label: "Post-capacitación" },
  { v: "completo", label: "Completo" },
];

export default async function Expediente({ params, searchParams }: PageProps<"/operativo/capacitaciones/[id]">) {
  await connection();
  const e = await cargarExpediente(Number((await params).id));
  if (!e) notFound();
  const u = await exigirUsuario();
  if (!puedeVerSesion(u, e.p)) notFound();
  const { p } = e;
  const sp = await searchParams;
  const vista: Vista = VISTAS.some((x) => x.v === sp.vista) ? (sp.vista as Vista) : etapaActual(e.ctx);
  const etapas: Etapa[] = vista === "completo" ? ["pre", "post"] : [vista];
  const todo = resumenFlujo(e.ctx, "completo");
  const rVista = resumenFlujo(e.ctx, vista);
  const rPre = resumenFlujo(e.ctx, "pre");
  const rPost = resumenFlujo(e.ctx, "post");
  const porEtapa = { pre: rPre, post: rPost };
  const est = new Map<string, string>(todo.estados.map((s) => [s.clave, s.estado]));
  // Numeración propia de cada etapa (Pre 1…19 · Post 1…9)
  const num = new Map([rPre, rPost].flatMap((r) => r.estados.map((s, i) => [s.clave, i + 1] as const)));
  // ── Navegación por actividad: el gráfico y las flechas abren una actividad a la vez ──
  const orden = etapas.flatMap((et) => porEtapa[et].estados);
  const hrefPaso = (c: string) => `/operativo/capacitaciones/${p.id}?vista=${vista}&paso=${c}`;
  const pedida = typeof sp.paso === "string" ? orden.find((s) => s.clave === sp.paso) : undefined;
  const pendiente = orden.find((s) => s.estado === "disponible" && puedeRegistrarPaso(u.roles, s.roles)) ?? orden.find((s) => s.estado === "disponible");
  const foco = pedida ?? pendiente;
  const iFoco = foco ? orden.findIndex((s) => s.clave === foco.clave) : -1;
  const anterior = iFoco > 0 ? orden[iFoco - 1] : undefined;
  const siguiente = iFoco >= 0 && iFoco < orden.length - 1 ? orden[iFoco + 1] : undefined;

  const lista = (items: EstadoItem[]) => (
    <ol className="flex flex-col gap-3">
      {items.map((s) =>
        s.clave === foco?.clave ? (
          <li key={s.clave} className="rounded-lg border border-dashed border-acento px-4 py-2.5 text-[13px] text-acento-oscuro">
            <a href="#foco" className="font-semibold hover:underline">↑ {s.titulo} — abierta arriba</a>
          </li>
        ) : (
          <Tarjeta key={s.clave} s={s} n={num.get(s.clave)!} e={e} est={est} u={u} href={`${hrefPaso(s.clave)}#foco`} />
        ),
      )}
    </ol>
  );
  const infoDe = (estados: EstadoItem[]) =>
    Object.fromEntries(
      estados.map((s) => {
        const reg = e.ctx.pasos[s.clave];
        if (s.estado === "hecho" && reg) return [s.clave, `${fechaHora(reg.en)}${reg.por ? ` por ${reg.por}` : ""}`];
        if (s.estado === "disponible") return [s.clave, `le toca a ${s.roles.map((x) => ROLES[x]).join(" o ")}`];
        if (s.estado === "bloqueado") {
          const faltan = s.requiere.filter((q) => !["hecho", "no_aplica"].includes(est.get(q) ?? "")).map((q) => PASO[q].corto);
          return [s.clave, faltan.length ? `espera: ${faltan.join(", ")}` : ""];
        }
        return [s.clave, ""];
      }),
    );

  /** Tarjetas de una etapa, fase por fase (las fases con capacitador y asistente van en dos columnas). */
  const BloqueEtapa = ({ et }: { et: Etapa }) => {
    const estados = porEtapa[et].estados;
    const fases = [...new Set(estados.map((s) => s.fase))];
    return (
      <>
        {fases.map((f) => {
          const deFase = estados.filter((s) => s.fase === f);
          const cap = deFase.filter((s) => s.carril === "capacitador");
          const otros = deFase.filter((s) => s.carril !== "capacitador");
          const paralelo = cap.length > 0 && otros.length > 0;
          const hechas = deFase.filter((s) => s.estado === "hecho" || s.estado === "no_aplica").length;
          const enCurso = deFase.some((s) => s.estado === "disponible");
          return (
            <details key={f} id={`fase-${et}-${f}`} open={f === foco?.fase || !foco} className="group/fase flex flex-col gap-3">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-1 hover:bg-[#eef1f5]">
                <span className="text-xs text-texto-2 transition-transform group-open/fase:rotate-90">▶</span>
                <h2 className="text-[15px] font-semibold text-marino">
                  Fase {f} · {FASES[f]} {paralelo && <span className="text-sm font-normal text-texto-2">(en paralelo)</span>}
                </h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${hechas === deFase.length ? "bg-[#dcfce7] text-[#166534]" : enCurso ? "bg-[#ffedd5] text-[#9a3412]" : "bg-[#eef1f5] text-texto-2"}`}>
                  {hechas}/{deFase.length}{enCurso ? " · en curso" : ""}
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-3">
              {paralelo ? (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-[#9a3412]">Capacitador</h3>
                    {lista(cap)}
                  </div>
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-[#115e59]">Asistente y áreas de apoyo</h3>
                    {lista(otros)}
                  </div>
                </div>
              ) : (
                lista(deFase)
              )}
              </div>
            </details>
          );
        })}
      </>
    );
  };

  const opciones = [
    { href: `/operativo/capacitaciones/${p.id}/ficha`, t: "🖨 Imprimir ficha" },
    { href: `/operativo/capacitacion/${p.id}`, t: "📋 Lista de asistencia" },
    ...(puede(u.roles, "cronograma", "editar") ? [{ href: `/estrategico/cronograma/${p.id}`, t: "✎ Editar programación" }] : []),
    ...(puede(u.roles, "documental") ? [{ href: `/soporte/gestion-documental?sesion=${p.sesionId}`, t: "📁 Gestión documental" }] : []),
  ];
  const hayContenido = !!(p.sesion.contenido || p.sesion.recursoMetodologico || p.sesion.perfilSalida || p.sesion.objetivo);
  const flecha = "flex size-8 items-center justify-center rounded-full border border-borde bg-white text-marino hover:bg-[#eef1f5]";

  return (
    <>
      <Encabezado
        antetitulo={<><Link href="/operativo/capacitaciones" className="hover:underline">Capacitaciones</Link> › {ruta(p)}</>}
        titulo={[p.sesion.nombre, ...combinadas(p)].join(" + ")}
        acciones={
          <details className="relative">
            <summary className="btn-secundario cursor-pointer list-none py-2">Opciones ▾</summary>
            <div className="absolute right-0 z-20 mt-1 flex w-56 flex-col rounded-lg border border-borde bg-white py-1 shadow-lg">
              {opciones.map((o) => (
                <Link key={o.href} href={o.href} className="px-3.5 py-2 text-sm text-marino hover:bg-[#eef1f5]">{o.t}</Link>
              ))}
            </div>
          </details>
        }
      />

      {/* Datos de la sesión en una sola línea */}
      <p className="-mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-texto-2">
        <span>📅 <strong className="text-texto">{fechaLarga(p.fecha)}</strong> · {hora(p.horaInicio)}–{hora(p.horaFin)}</span>
        <span>📍 <strong className="text-texto">{p.sede.nombre}</strong>{p.aula ? ` · ${p.aula}` : ""}</span>
        <span>👤 <strong className="text-texto">{nombreCompleto(p.capacitador)}</strong> · <strong className="text-texto">{nombreCompleto(p.asistente)}</strong></span>
        <span>{e.inscritos} inscritos</span>
        <ChipEstado estado={p.estado} sinCapacitador={!p.capacitador} />
      </p>

      {rPre.reprogramada && (
        <p role="alert" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          <strong>Reprogramar sesión:</strong> el local no fue confirmado. Cambia la fecha en Opciones › Editar programación y luego usa «Deshacer» en «Confirmar con la sede».
        </p>
      )}
      {rPost.noRealizada && (
        <p role="alert" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          <strong>Sesión no realizada:</strong> reprograma la fecha en Opciones › Editar programación y luego usa «Deshacer» en «¿Se realizó la sesión?».
        </p>
      )}
      {rPost.cerrada ? (
        <p role="status" className="rounded-lg bg-[#f0fdf4] px-4 py-2.5 text-sm font-semibold text-[#166534]">✓ Sesión cerrada: pre y post-capacitación completas.</p>
      ) : (
        rPre.terminado && vista === "pre" && (
          <p role="status" className="rounded-lg bg-[#f0fdf4] px-4 py-2.5 text-sm font-semibold text-[#166534]">
            ✓ Pre-capacitación completa.{" "}
            <Link href={`/operativo/capacitaciones/${p.id}?vista=post`} className="underline">Continuar con la post-capacitación →</Link>
          </p>
        )
      )}

      {/* Proceso: etapa, avance y gráfico (cada punto abre su actividad debajo) */}
      <section aria-label="Seguimiento de la sesión" className="card flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Etapa del proceso" className="flex rounded-lg bg-[#eef1f5] p-0.5">
            {VISTAS.map(({ v, label }) => {
              const r = v === "completo" ? todo : porEtapa[v];
              const activo = v === vista;
              return (
                <Link
                  key={v}
                  href={`/operativo/capacitaciones/${p.id}?vista=${v}`}
                  aria-current={activo ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${activo ? "bg-white text-marino shadow-sm" : "text-texto-2 hover:text-marino"}`}
                >
                  {label.replace("-capacitación", "")} <span className="font-normal text-texto-2">{r.hechos}/{r.total}</span>
                </Link>
              );
            })}
          </nav>
          <div className="w-full sm:w-56">
            <BarraAvance porcentaje={rVista.porcentaje} etiqueta={`${rVista.hechos} de ${rVista.total} actividades`} />
          </div>
        </div>
        {etapas.map((et, i) => (
          <div key={et} className={i > 0 ? "border-t border-[#eef1f5] pt-3" : ""}>
            <LineaProceso
              titulo={ETAPAS[et]}
              pasos={porEtapa[et].estados}
              detenido={et === "pre" ? rPre.reprogramada : rPost.noRealizada}
              info={infoDe(porEtapa[et].estados)}
              enlace={hrefPaso}
              seleccionado={foco?.clave}
            />
          </div>
        ))}
      </section>

      {/* La actividad abierta, con flechas para pasar a la anterior o la siguiente */}
      {foco && (
        <section id="foco" aria-label="Actividad abierta" className="flex scroll-mt-4 flex-col gap-2">
          <div className="flex items-center gap-2 text-[13px] text-texto-2">
            {anterior ? (
              <Link href={hrefPaso(anterior.clave)} scroll={false} className={flecha} title={`Anterior: ${anterior.titulo}`} aria-label="Actividad anterior">‹</Link>
            ) : (
              <span className={`${flecha} opacity-30`} aria-hidden="true">‹</span>
            )}
            <span>
              {ETAPAS[foco.etapa]} · {num.get(foco.clave)} de {porEtapa[foco.etapa].estados.length} · {FASES[foco.fase]}
            </span>
            {siguiente ? (
              <Link href={hrefPaso(siguiente.clave)} scroll={false} className={flecha} title={`Siguiente: ${siguiente.titulo}`} aria-label="Actividad siguiente">›</Link>
            ) : (
              <span className={`${flecha} opacity-30`} aria-hidden="true">›</span>
            )}
            {pendiente && pendiente.clave !== foco.clave && (
              <Link href={hrefPaso(pendiente.clave)} scroll={false} className="ml-auto font-semibold text-acento-oscuro hover:underline">
                Ir a lo pendiente →
              </Link>
            )}
          </div>
          <ol>
            <Tarjeta s={foco} n={num.get(foco.clave)!} e={e} est={est} u={u} />
          </ol>
        </section>
      )}

      {/* Lo demás, plegado */}
      <div className="flex flex-col gap-3">
        {(hayContenido || e.docs.length > 0) && (
          <details className="card group/mas">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold text-marino">
              <span className="text-xs text-texto-2 transition-transform group-open/mas:rotate-90">▶</span>
              Contenido y material de la sesión
              <span className="font-normal text-texto-2">· {e.docs.length} documento(s)</span>
            </summary>
            <div className="flex flex-col gap-4 border-t border-borde px-5 py-4 text-sm">
              {p.sesion.objetivo && <p>{p.sesion.objetivo}</p>}
              {hayContenido && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  {[
                    ["Contenido", p.sesion.contenido],
                    ["Recurso metodológico", p.sesion.recursoMetodologico],
                  ].map(([t, v]) => (
                    <div key={t}>
                      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-texto-2">{t}</h3>
                      {v ? <ul className="list-disc space-y-0.5 pl-4">{v.split("\n").map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="text-texto-2">—</p>}
                    </div>
                  ))}
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-texto-2">Perfil de salida</h3>
                    <p>{p.sesion.perfilSalida ?? "—"}</p>
                  </div>
                </div>
              )}
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-texto-2">Material</h3>
                {e.docs.length === 0 ? (
                  <p className="text-[13px] text-[#92400e]">Aún no hay documentos para esta sesión.</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-x-8 gap-y-1 text-[13px] md:grid-cols-2">
                    {e.docs.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2">
                        <a href={enlaceDoc(d)} target={d.archivo ? undefined : "_blank"} rel="noreferrer" className="enlace">{d.archivo ? "⬇" : "↗"} {d.nombre}</a>
                        <span className="text-texto-2">{TIPO_DOC[d.tipo]}{d.tamano != null ? ` · ${tamanoLegible(d.tamano)}` : ""}</span>
                        {origenDoc(d) && <span className="rounded-full bg-[#ffedd5] px-2 py-0.5 text-[11px] font-semibold text-[#9a3412]">{origenDoc(d)}</span>}
                        {d.programacionId && <span className="text-[11px] text-texto-2">📁 {SECCIONES[seccionDe(d)]}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        )}

        <details id="todas" className="card group/todas" open={!foco}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold text-marino">
            <span className="text-xs text-texto-2 transition-transform group-open/todas:rotate-90">▶</span>
            Todas las actividades
            <span className="font-normal text-texto-2">· {rVista.hechos}/{rVista.total} hechas</span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-borde px-5 py-4">
            {etapas.map((et) => (
              <div key={et} className="flex flex-col gap-3">
                {vista === "completo" && <h2 className="text-base font-bold text-marino">{ETAPAS[et]}</h2>}
                <BloqueEtapa et={et} />
              </div>
            ))}
          </div>
        </details>
      </div>
    </>
  );
}
