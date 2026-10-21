import { exigirUsuario, puedeVerSesion } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cargarExpediente } from "@/lib/preparacion";
import { combinadas } from "@/lib/consultas";
import { fechaLarga, hora, TURNO_LABEL } from "@/lib/fechas";
import { nombreCompleto } from "@/components/ui";
import BotonImprimir from "@/components/BotonImprimir";
import { resumenRegistroNotas } from "@/lib/seguimiento-examenes";
import { recursosDe } from "@/lib/recursos-sesion";
import { ENTREGABLES, fotosEntregadas, MINIMO_FOTOS } from "@/lib/entregables";
import { seccionDe } from "@/lib/documentos";
import FichaResumen, { type ResumenFicha } from "./FichaResumen";
import "./ficha.css";

export const metadata = { title: "Ficha de capacitación" };
const texto = (valor: unknown) => valor == null || valor === "" ? "—" : typeof valor === "boolean" ? valor ? "Sí" : "No" : String(valor);

export default async function Ficha({ params }: PageProps<"/operativo/capacitaciones/[id]/ficha">) {
  await connection();
  const e = await cargarExpediente(Number((await params).id));
  if (!e || !puedeVerSesion(await exigirUsuario(), e.p)) notFound();
  const { p, ctx } = e;
  const pasos = ctx.pasos;
  const aprobacion = pasos.revisar_recursos;
  const datos = pasos.datos_capacitacion;
  const asistencia = e.resumenAsistencia;
  const asistentes = asistencia.presentes + asistencia.tardanzas;
  const notas = resumenRegistroNotas(asistencia, ctx.examen);
  const devolucion = pasos.recursos_post;
  const retornos = Array.isArray(devolucion?.retornos) ? devolucion.retornos as { grupo: string; descripcion: string; retorno: number }[] : [];
  const documentos = e.docs.filter((d) => d.programacionId === p.id);
  const liq = e.liquidacion.guardada ? e.liquidacion.datos : null;
  const modulo = p.sesion.modulo;
  const horario = `${hora(p.horaInicio)} – ${hora(p.horaFin)}`;
  const notasCorresponden = !!ctx.examen && datos?.realizada !== false;

  const ficha: ResumenFicha = {
    numero: String(p.id).padStart(5, "0"),
    generales: [
      { titulo: "Componente", valor: `${modulo.actividad.componente.codigo} · ${modulo.actividad.componente.nombre}` },
      { titulo: "Actividad", valor: `${modulo.actividad.codigo} · ${modulo.actividad.nombre}` },
      { titulo: "Módulo", valor: `${modulo.codigo} · ${modulo.nombre}` },
      { titulo: "Sesión", valor: `${p.sesion.codigo} · ${[p.sesion.nombre, ...combinadas(p)].join(" + ")}` },
      { titulo: "Fecha", valor: fechaLarga(p.fecha) },
      { titulo: "Horario programado", valor: horario },
      { titulo: "Sede / aula", valor: `${p.sede.nombre} · ${p.aula || "Sin aula"}` },
      { titulo: "Turno", valor: TURNO_LABEL[p.turno] },
      { titulo: "Capacitador", valor: nombreCompleto(p.capacitador) },
      { titulo: "Asistente", valor: nombreCompleto(p.asistente) },
    ],
    recursosAprobados: !!aprobacion,
    devolucionRegistrada: !!devolucion,
    recursos: [{ grupo: "recurso", items: recursosDe(aprobacion?.recursos) }, { grupo: "equipo", items: recursosDe(aprobacion?.equipos) }].flatMap(({ grupo, items }) => {
      const devueltos = retornos.filter((r) => r.grupo === grupo);
      return items.map((item, i) => ({ nombre: item.descripcion, cantidad: item.cantidad, unidad: item.unidad, detalle: item.detalle, retorno: devueltos[i]?.descripcion === item.descripcion ? devueltos[i].retorno : null }));
    }),
    ejecucion: [
      { titulo: "¿Se ejecutó?", valor: texto(datos?.realizada) },
      { titulo: "Horario real", valor: datos?.realizada === false ? "No corresponde" : datos?.horarioProgramado === true ? horario : datos ? `${texto(datos.horaInicioReal)} – ${texto(datos.horaFinReal)}` : "Pendiente" },
      { titulo: "Incidencias / motivo de no ejecución", valor: texto(datos?.incidencias || (datos?.hayIncidencias === false ? "Sin incidencias" : null)) },
      { titulo: "Observaciones de devolución", valor: texto(devolucion?.obs) },
    ],
    asistencia: [
      { titulo: "Programados", valor: String(asistencia.programados) },
      { titulo: "Asistencias", valor: String(asistentes) },
      { titulo: "Porcentaje de asistencia", valor: asistencia.programados ? `${((asistentes * 100) / asistencia.programados).toFixed(1)}%` : "Sin programados" },
    ],
    notas: notasCorresponden ? [
      { titulo: "Examen / registro", valor: `${ctx.examen === "ambos" ? "Entrada y salida" : ctx.examen === "entrada" ? "Entrada" : "Salida"} · ${pasos.registrar_notas ? "Confirmado" : "Pendiente"}` },
      { titulo: "Con notas completas / faltantes", valor: `${notas.conNotas} / ${notas.diferencia}` },
    ] : [
      { titulo: "Examen / registro", valor: "No corresponde" },
      { titulo: "Con notas completas / faltantes", valor: "No corresponde" },
    ],
    entregables: ENTREGABLES.map((categoria) => {
      const archivos = documentos.filter((d) => seccionDe(d) === categoria.seccion);
      const cantidad = categoria.seccion === "fotos" ? fotosEntregadas(archivos) : archivos.length;
      const noCorresponde = (categoria.seccion === "examen" && !ctx.examen) || (datos?.realizada === false && categoria.seccion !== "viaticos");
      const completo = categoria.seccion === "fotos" ? cantidad >= MINIMO_FOTOS : categoria.seccion === "examen" && ctx.examen === "ambos" ? ["examen_entrada", "examen_salida"].every((tipo) => archivos.some((a) => a.tipo === tipo)) : categoria.seccion === "viaticos" ? !!liq || cantidad > 0 : cantidad > 0;
      return { titulo: categoria.titulo, valor: noCorresponde ? "No corresponde" : completo ? `✓ OK${cantidad ? ` · ${cantidad} ${categoria.seccion === "fotos" ? "fotos" : "archivo(s)"}` : " · Liquidación registrada"}` : categoria.seccion === "talleres" && !cantidad ? "Opcional · Sin archivos" : `☐ Pendiente${categoria.seccion === "fotos" ? ` · ${cantidad}/${MINIMO_FOTOS} fotos` : ""}` };
    }),
    gastos: liq ? liq.lineas.map((l) => ({ concepto: `${l.descripcion}${l.obs ? ` · ${l.obs}` : ""}`, monto: Number(l.monto) })) : null,
    cierre: pasos.aprobar_cierre ? "Aprobado por Gestión Documental" : "Pendiente de aprobación",
  };

  return <div className="mx-auto w-full max-w-4xl">
    <div className="mb-5 flex flex-wrap justify-between gap-3 print:hidden"><Link href={`/operativo/capacitaciones/${p.id}`} className="btn-secundario">← Volver a actividades de la sesión</Link><BotonImprimir /></div>
    <FichaResumen ficha={ficha} />
  </div>;
}
