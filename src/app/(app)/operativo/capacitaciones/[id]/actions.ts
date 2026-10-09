"use server";

import { and, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { validarDisponibilidad } from "@/lib/disponibilidad";
import {
  avisos,
  asistencias,
  capacitadores,
  inscripciones,
  documentos,
  equipos,
  fichaItems,
  insumos,
  personal,
  preparaciones,
  programaciones,
  revisionesEquipo,
  type CategoriaFicha,
  type PasoRegistro,
} from "@/db/schema";
import { DIAS_ANTICIPACION_COMUNICACION, PASO, PASOS, ROLES, estadoPaso, rolDe } from "@/lib/flujo-pre";
import { autorizarFicha, autorizarSesion } from "@/lib/auth";
import { puedeRegistrarPaso } from "@/lib/permisos";
import { contexto, examenDe, examenes } from "@/lib/preparacion";
import { fechaCorta, hora, sumarDias } from "@/lib/fechas";
import { CHEQUEOS_EQUIPO, TIPOS_EQUIPO } from "@/lib/inventario";
import { DOCUMENTOS_REVISION, ENTREGABLES, GASTOS, PREGUNTAS_PREPARACION, type Ficha2 } from "@/lib/ficha2";
import { moverStock } from "@/lib/stock";
import { destinatariosDe } from "@/lib/avisos";
import { borrarArchivo } from "@/lib/archivos";
import { guardarLiquidacionDb, leerLiquidacion } from "@/lib/liquidacion-db";
import { saldo, totalGastos } from "@/lib/liquidacion";
import { leerRecursos, leerEquipos, recursosDe } from "@/lib/recursos-sesion";

export type Res = { ok?: string; error?: string } | undefined;

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const nombre = (x: { nombres: string; apellidos: string } | undefined | null) => (x ? `${x.nombres} ${x.apellidos}`.trim() : null);

async function cargar(id: number) {
  const p = await db.query.programaciones.findFirst({
    where: eq(programaciones.id, id),
    with: { sede: true, preparacion: true, sesion: true, combinadas: true },
  });
  if (!p) return null;
  const ex = await examenes([p.sesionId, ...p.combinadas.map((c) => c.sesionId)]);
  return { p, ctx: contexto(p.preparacion?.pasos, p.sede.fueraDeArequipa, examenDe(p, ex)) };
}

async function guardarPasos(programacionId: number, pasos: Record<string, PasoRegistro>) {
  await db
    .insert(preparaciones)
    .values({ programacionId, pasos })
    .onConflictDoUpdate({ target: preparaciones.programacionId, set: { pasos, actualizadoEn: sql`now()` } });
}

function refrescar(id: number) {
  revalidatePath(`/operativo/capacitaciones/${id}`);
  revalidatePath("/", "layout");
}

/** Archivos ya subidos (con barra de avance) para esta sesión: ids que llegan en «docId». */
function docsSubidos(f: FormData) {
  return [...new Set(f.getAll("docId").map(Number).filter((n) => n > 0))];
}
async function asociarDocs(ids: number[], programacionId: number, cambios: Partial<typeof documentos.$inferInsert>) {
  if (!ids.length) return 0;
  const r = await db
    .update(documentos)
    .set(cambios)
    .where(and(inArray(documentos.id, ids), eq(documentos.programacionId, programacionId)))
    .returning({ id: documentos.id });
  return r.length;
}

/** Error de stock: se lanza dentro de la transacción para deshacerla. */
class SinStock extends Error {}

async function motivoDe(id: number) {
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, id), with: { sesion: true, sede: true } });
  return p ? `Ficha ${p.sesion.codigo} · ${p.sede.nombre} · ${fechaCorta(p.fecha)}` : `Ficha de sesión #${id}`;
}

/** Cantidades pedidas del inventario: campos «inv-<id>» del formulario. */
function lineasInventario(f: FormData) {
  return [...f.entries()]
    .filter(([k]) => k.startsWith("inv-"))
    .map(([k, v]) => ({ insumoId: Number(k.slice(4)), cantidad: Math.floor(Number(v)) }))
    .filter((l) => l.insumoId > 0 && l.cantidad > 0);
}

/** Registra (completa) una actividad del flujo. */
export async function registrarPaso(_prev: Res, f: FormData): Promise<Res> {
  const id = Number(f.get("programacionId"));
  const clave = txt(f, "clave");
  const def = PASO[clave];
  if (!def) return { error: "Actividad no válida." };
  const perm = await autorizarSesion(id);
  if (!perm.u) return { error: perm.error };
  // Queda registrado a nombre de quien ingresó al sistema
  const por = perm.u.nombre;

  if (Number(f.get("subiendo")) > 0) return { error: "Espera a que terminen de subirse los archivos." };
  const x = await cargar(id);
  if (!x) return { error: "La sesión ya no existe." };
  const { p, ctx } = x;
  if (!puedeRegistrarPaso(perm.u.roles, [rolDe(def, ctx), ...(def.rolesAlternos ?? [])])) {
    return { error: `Esta actividad la registra: ${[rolDe(def, ctx), ...(def.rolesAlternos ?? [])].map((r) => ROLES[r]).join(" o ")}.` };
  }
  const estado = estadoPaso(clave, ctx);
  if (estado === "hecho") return { error: "Esta actividad ya fue registrada." };
  if (estado !== "disponible") return { error: "Primero deben completarse las actividades anteriores." };

  const pasos = { ...ctx.pasos };
  const reg: PasoRegistro = { en: new Date().toISOString(), por };
  const decision = txt(f, "decision");
  const siNo = decision === "si" ? true : decision === "no" ? false : null;

  switch (clave) {
    case "validar_programacion": {
      if (txt(f, "programacionValidada") !== "si") return { error: "Confirma que has revisado los datos de programación." };
      if (!p.capacitadorId || !p.asistenteId) return { error: "Completa el capacitador y el asistente en el cronograma antes de validar." };
      reg.programacionValidada = true;
      reg.obs = txt(f, "obs") || null;
      const dest = await destinatariosDe({ capacitadorId: p.capacitadorId, asistenteId: p.asistenteId });
      const conAcceso = dest.filter((d) => d.conAcceso && d.usuarioId);
      const etiquetaSesion = `${p.sesion.nombre} · ${p.sede.nombre}, ${fechaCorta(p.fecha)} ${hora(p.horaInicio)}`;
      if (conAcceso.length) {
        await db.delete(avisos).where(and(eq(avisos.programacionId, id), eq(avisos.origen, "validar_programacion")));
        await db.insert(avisos).values(conAcceso.map((d) => ({
          usuarioId: d.usuarioId!,
          programacionId: id,
          origen: "validar_programacion",
          titulo: `Programación aprobada: ${etiquetaSesion}`,
          mensaje: `El Jefe de Proyecto validó la programación. Tu rol es ${d.rol.toLowerCase()}. Revisa los detalles de la sesión.`,
          href: `/operativo/capacitaciones/${id}?vista=pre&paso=validar_programacion`,
          de: por,
        })));
      }
      reg.notificados = conAcceso.map((d) => `${d.nombre} (${d.rol.toLowerCase()})`);
      reg.sinAcceso = dest.filter((d) => !d.conAcceso).map((d) => `${d.nombre} (${d.rol.toLowerCase()})`);
      break;
    }
    case "confirmar_sede": {
      if (siNo === null) return { error: "Indica si el local quedó confirmado." };
      reg.localConfirmado = siNo;
      reg.contacto = txt(f, "contacto") || null;
      reg.obs = txt(f, "obs") || null;
      if (!siNo && !reg.obs) return { error: "Indica el motivo por el que no se confirmó el local." };
      if (!siNo) await db.update(programaciones).set({ estado: "reprogramada" }).where(eq(programaciones.id, id));
      break;
    }

    case "comunicar": {
      // 1) Validar (o cambiar) el personal asignado al programar la sesión
      const capId = Number(f.get("capacitadorId")) || null;
      const asiId = Number(f.get("asistenteId")) || null;
      if (!capId || !asiId) return { error: "Elige el capacitador y el asistente. Si no hay disponibilidad, revisa otras personas o reprograma." };
      const [sinDisp, cap, asi] = await Promise.all([
        validarDisponibilidad({ capacitadorId: capId, asistenteId: asiId }, p, id),
        db.query.capacitadores.findFirst({ where: eq(capacitadores.id, capId) }),
        db.query.personal.findFirst({ where: eq(personal.id, asiId) }),
      ]);
      if (sinDisp) return { error: sinDisp };
      reg.cambioPersonal = capId !== p.capacitadorId || asiId !== p.asistenteId;
      if (reg.cambioPersonal) await db.update(programaciones).set({ capacitadorId: capId, asistenteId: asiId }).where(eq(programaciones.id, id));
      reg.capacitador = nombre(cap);
      reg.asistente = nombre(asi);
      // 2) Comunicar
      const limite = sumarDias(p.fecha, -DIAS_ANTICIPACION_COMUNICACION);
      reg.limite = limite;
      reg.aTiempo = reg.en.slice(0, 10) <= limite;
      reg.obs = txt(f, "obs") || null;
      // La comunicación se envía por el sistema: le aparece en la campana al capacitador y al asistente
      const mensaje = txt(f, "mensaje");
      const dest = await destinatariosDe({ capacitadorId: capId, asistenteId: asiId });
      const titulo = `Sesión asignada: ${p.sesion.nombre} · ${p.sede.nombre}, ${fechaCorta(p.fecha)} ${hora(p.horaInicio)}`;
      const conAcceso = dest.filter((d) => d.conAcceso && d.usuarioId);
      if (conAcceso.length) {
        await db.delete(avisos).where(and(eq(avisos.programacionId, id), eq(avisos.origen, "comunicar")));
        await db.insert(avisos).values(
          conAcceso.map((d) => ({
            usuarioId: d.usuarioId!,
            programacionId: id,
            origen: "comunicar",
            titulo,
            mensaje: `Te toca como ${d.rol.toLowerCase()}.${mensaje ? `\n${mensaje}` : ""}`,
            href: `/operativo/capacitaciones/${id}?vista=pre`,
            de: por,
          })),
        );
      }
      reg.mensaje = mensaje || null;
      reg.notificados = conAcceso.map((d) => `${d.nombre} (${d.rol.toLowerCase()})`);
      reg.sinAcceso = dest.filter((d) => !d.conAcceso).map((d) => `${d.nombre} (${d.rol.toLowerCase()})`);
      break;
    }

    case "personalizar": {
      if (siNo === null) return { error: "Indica si se personalizó el contenido." };
      reg.personalizado = siNo;
      reg.detalle = txt(f, "detalle") || null;
      if (!siNo) break;
      if (!reg.detalle) return { error: "Describe qué se personalizó." };
      // El material personalizado ya se subió (con barra de avance) y queda solo para ESTA fecha programada
      const tipoDoc = (["diapositiva", "taller", "otro"] as const).find((t) => t === txt(f, "tipoDoc")) ?? "diapositiva";
      const n = await asociarDocs(docsSubidos(f), id, { subidoPor: por, version: "personalizada", tipo: tipoDoc });
      if (!n) return { error: "Sube el archivo del material personalizado." };
      reg.archivos = n;
      break;
    }

    case "dinamicas": {
      if (txt(f, "impresionCoordinada") !== "si") return { error: "Confirma que ya comunicaste y/o coordinaste la impresión de las dinámicas de esta sesión." };
      reg.impresionCoordinada = true;
      break;
    }

    case "examen":
      if (txt(f, "examenCoordinado") !== "si") return { error: "Confirma que ya coordinaste con el asistente la impresión del examen." };
      reg.tipo = ctx.examen;
      reg.examenCoordinado = true;
      break;

    case "guardar_material":
      reg.medio = txt(f, "medio");
      if (!reg.medio) return { error: "Indica el medio seguro donde se guardó el material." };
      reg.talleresImpresos = f.get("talleresImpresos") === "on";
      break;

    case "imprimir_ficha":
      if (txt(f, "listaImpresa") !== "si") return { error: "Confirma que ya imprimiste la lista de asistencia." };
      reg.listaImpresa = true;
      for (const tipo of ["entrada", "salida"] as const) {
        if (ctx.examen !== tipo && ctx.examen !== "ambos") continue;
        const campo = tipo === "entrada" ? "copiasEntrada" : "copiasSalida";
        const copias = Number(f.get(campo));
        if (!Number.isSafeInteger(copias) || copias < 1) return { error: `Indica un número entero de copias impresas mayor que cero para el examen de ${tipo}.` };
        reg[campo] = copias;
      }
      break;

    case "solicitar_recursos": {
      const solicitud = leerRecursos(f);
      if (solicitud.error) return { error: solicitud.error };
      const equipos = leerEquipos(f);
      if (equipos.error) return { error: equipos.error };
      reg.recursos = solicitud.recursos;
      reg.equipos = equipos.equipos;
      break;
    }

    case "revisar_recursos": {
      const aprobacion = leerRecursos(f);
      if (aprobacion.error) return { error: aprobacion.error };
      const equipos = leerEquipos(f);
      if (equipos.error) return { error: equipos.error };
      if (txt(f, "coordinadoAsistente") !== "si") return { error: "Confirma que ya coordinaste los requerimientos con el asistente." };
      if (txt(f, "recursosAprobados") !== "si") return { error: "Confirma la aprobación de los requerimientos." };
      const originales = recursosDe(pasos.solicitar_recursos?.recursos);
      reg.recursos = aprobacion.recursos;
      reg.solicitados = originales;
      reg.equipos = equipos.equipos;
      reg.equiposSolicitados = recursosDe(pasos.solicitar_recursos?.equipos);
      reg.modificados = JSON.stringify(originales) !== JSON.stringify(aprobacion.recursos) || JSON.stringify(reg.equiposSolicitados) !== JSON.stringify(equipos.equipos);
      reg.obs = txt(f, "obs") || null;
      reg.coordinadoAsistente = true;
      reg.aprobado = true;
      break;
    }

    case "programa_viaje": {
      const decisionViaje = txt(f, "viajeCorresponde");
      if (decisionViaje !== "si" && decisionViaje !== "no") return { error: "Indica si corresponde presentar el programa de viaje." };
      reg.corresponde = decisionViaje === "si";
      reg.itinerario = reg.corresponde ? txt(f, "itinerario") : null;
      if (String(reg.itinerario ?? "").length > 5000) return { error: "El programa de viaje admite un máximo de 5000 caracteres." };
      if (reg.corresponde) {
        const ids = docsSubidos(f);
        const n = await asociarDocs(ids, id, { subidoPor: por, tipo: "otro", version: "programa_viaje" });
        if (!reg.itinerario && !n) return { error: "Sube el archivo del programa de viaje o completa el itinerario." };
        reg.archivos = n;
        reg.documentos = ids;
      }
      break;
    }

    case "aprobar_preparacion":
      if (txt(f, "conforme") !== "si") return { error: "Confirma que la lista, los requerimientos aprobados y el programa de viaje son conformes." };
      reg.conforme = true;
      reg.listaImpresa = Boolean(pasos.imprimir_ficha);
      reg.copiasEntrada = pasos.imprimir_ficha?.copiasEntrada ?? null;
      reg.copiasSalida = pasos.imprimir_ficha?.copiasSalida ?? null;
      reg.recursos = recursosDe(pasos.revisar_recursos?.recursos);
      reg.equipos = recursosDe(pasos.revisar_recursos?.equipos);
      reg.coordinadoAsistente = pasos.revisar_recursos?.coordinadoAsistente === true;
      reg.viajeCorresponde = pasos.programa_viaje?.corresponde === true;
      reg.itinerario = pasos.programa_viaje?.itinerario ?? null;
      reg.documentosViaje = pasos.programa_viaje?.documentos ?? [];
      break;

    case "alistar_material": {
      const [{ pendientes }] = await db
        .select({ pendientes: sql<number>`count(*) filter (where not ${fichaItems.listo})::int` })
        .from(fichaItems)
        .where(eq(fichaItems.programacionId, id));
      if (pendientes > 0) return { error: `Faltan ${pendientes} ítems de la ficha por marcar como listos.` };
      break;
    }

    case "probar_equipos":
      reg.resultado = txt(f, "resultado") || "ok";
      reg.obs = txt(f, "obs") || null;
      if (reg.resultado === "observado" && !reg.obs) return { error: "Describe qué equipo falló o qué se observó." };
      break;

    case "solicitar_viaticos": {
      const monto = Number(f.get("monto"));
      if (!(monto > 0)) return { error: "Indica el monto solicitado." };
      reg.monto = monto;
      reg.concepto = txt(f, "concepto") || null;
      break;
    }

    case "entregar_viaticos": {
      const monto = Number(f.get("monto"));
      if (!(monto > 0)) return { error: "Indica el monto entregado." };
      reg.monto = monto;
      reg.tipo = ctx.fueraDeArequipa ? "viaje" : "movilidad";
      break;
    }

    case "llenar_ficha": {
      // La 1ra sección se edita en «Alistar material»; aquí solo se verifica que esté lista
      const [{ pendientes, total }] = await db
        .select({ pendientes: sql<number>`count(*) filter (where not ${fichaItems.listo})::int`, total: sql<number>`count(*)::int` })
        .from(fichaItems)
        .where(eq(fichaItems.programacionId, id));
      if (pendientes > 0) return { error: `Faltan ${pendientes} ítems de la 1ra sección por marcar como listos.` };
      reg.items = total;
      reg.obs = txt(f, "obs") || null;
      break;
    }

    case "revisar_ficha": {
      if (siNo === null) return { error: "Indica si la ficha está correcta." };
      if (!siNo) {
        const obs = txt(f, "obs");
        if (!obs) return { error: "Escribe las observaciones para el asistente." };
        // Vuelve al asistente: se reabre "llenar ficha"
        delete pasos.llenar_ficha;
        const historial = Array.isArray(pasos.observaciones_ficha?.lista) ? (pasos.observaciones_ficha.lista as unknown[]) : [];
        pasos.observaciones_ficha = { en: reg.en, por, lista: [...historial, { en: reg.en, por, obs }] };
        await guardarPasos(id, pasos);
        refrescar(id);
        return { ok: "Ficha devuelta al asistente con observaciones." };
      }
      reg.correcto = true;
      break;
    }

    case "lista":
      if (p.estado !== "cancelada") {
        await db.update(programaciones).set({ estado: "confirmada" }).where(eq(programaciones.id, id));
      }
      break;

    /* ── Post-capacitación ── */
    case "sesion_realizada": {
      if (siNo === null) return { error: "Indica si la sesión se realizó." };
      reg.realizada = siNo;
      reg.obs = txt(f, "obs") || null;
      if (!siNo) {
        if (!reg.obs) return { error: "Indica el motivo por el que no se realizó." };
        await db.update(programaciones).set({ estado: "reprogramada" }).where(eq(programaciones.id, id));
      }
      break;
    }

    case "solicitar_entregables":
      reg.obs = txt(f, "obs") || null;
      break;

    case "corregir_examenes":
      reg.cantidad = Number(f.get("cantidad")) || 0;
      reg.promedio = txt(f, "promedio") || null;
      reg.obs = txt(f, "obs") || null;
      break;

    case "enviar_examenes":
      reg.archivos = await asociarDocs(docsSubidos(f), id, { subidoPor: por });
      reg.obs = txt(f, "obs") || null;
      break;

    case "reportar_incidencias":
      reg.incidencias = txt(f, "incidencias") || null;
      reg.sinIncidencias = !reg.incidencias;
      break;

    case "llenar_ficha2": {
      reg.horaLlegada = txt(f, "horaLlegada") || null;
      reg.horaInicioReal = txt(f, "horaInicioReal");
      reg.horaFinReal = txt(f, "horaFinReal");
      // Las incidencias ya se reportaron en la actividad anterior: se copian a la ficha
      reg.incidencias = ((ctx.pasos.reportar_incidencias as Record<string, unknown> | undefined)?.incidencias as string | null) ?? null;
      reg.obsCapacitador = txt(f, "obsCapacitador") || null;
      if (!reg.horaInicioReal || !reg.horaFinReal) return { error: "Indica la hora de inicio y de término reales." };

      // Asistencia: programados (inscritos del turno) y asistentes → % automático
      const [{ programados }] = await db.select({ programados: sql<number>`count(*)::int` }).from(inscripciones).where(eq(inscripciones.programacionId, id));
      const asistentes = Math.floor(Number(f.get("asistentes")));
      if (txt(f, "asistentes") === "" || !(asistentes >= 0)) return { error: "Indica cuántos asistentes hubo." };
      if (programados && asistentes > programados) return { error: `Los asistentes (${asistentes}) no pueden ser más que los programados (${programados}).` };
      reg.programados = programados;
      reg.asistentes = asistentes;
      reg.pctAsistencia = programados ? Math.round((asistentes * 100) / programados) : null;

      // Entregables presentados
      reg.entregables = Object.fromEntries(
        ENTREGABLES.map((x) => [
          x.k,
          "siCorresponde" in x && !ctx.examen ? "no_corresponde" : f.get(`ent-${x.k}`) === "on" ? "completo" : "incompleto",
        ]),
      );

      // Preparación de la capacitación: Sí/No + detalle
      const prep: Record<string, { hubo: boolean; detalle: string | null }> = {};
      for (const q of PREGUNTAS_PREPARACION) {
        const v = txt(f, `prep-${q.k}`);
        if (v !== "si" && v !== "no") return { error: `Responde Sí o No: ${q.t}` };
        const detalle = txt(f, `prepdet-${q.k}`) || null;
        if (v === "si" && !detalle) return { error: `Detalla: ${q.t}` };
        prep[q.k] = { hubo: v === "si", detalle };
      }
      reg.preparacion = prep;
      reg.feedback = txt(f, "feedback") || null;

      // Restante a devolver (material del inventario) y estado de los equipos llevados
      const items = await db.select().from(fichaItems).where(eq(fichaItems.programacionId, id));
      const devoluciones = [];
      const eqs = [];
      for (const it of items) {
        if (it.insumoId) {
          const n = Math.floor(Number(f.get(`dev-${it.id}`)) || 0);
          if (n < 0 || n > it.cantidad) return { error: `${it.descripcion}: lo que resta debe estar entre 0 y ${it.cantidad}.` };
          devoluciones.push({ itemId: it.id, insumoId: it.insumoId, nombre: it.descripcion, salio: it.cantidad, cantidad: n });
        }
        if (it.equipoId) {
          const falla = txt(f, `eqfalla-${it.equipoId}`) === "si";
          const correccion = txt(f, `eqcorr-${it.equipoId}`) === "si";
          const detalle = txt(f, `eqdet-${it.equipoId}`) || null;
          if ((falla || correccion) && !detalle) return { error: `Describe la falla o corrección de ${it.descripcion}.` };
          eqs.push({ equipoId: it.equipoId, equipo: it.descripcion, falla, correccion, detalle });
        }
      }
      reg.devoluciones = devoluciones;
      reg.equipos = eqs;

      // Gastos de la sesión
      const gastos: Record<string, number> = {};
      for (const g of GASTOS) {
        const v = Number(f.get(`gasto-${g.k}`) || 0);
        if (!(v >= 0)) return { error: `Monto no válido en ${g.t}.` };
        if (v) gastos[g.k] = Math.round(v * 100) / 100;
      }
      reg.gastos = gastos;
      reg.totalGastos = Math.round(Object.values(gastos).reduce((a, v) => a + v, 0) * 100) / 100;
      reg.gastosDetalle = txt(f, "gastosDetalle") || null;
      break;
    }

    case "registrar_asistencia": {
      const [{ n, presentes }] = await db
        .select({ n: sql<number>`count(*)::int`, presentes: sql<number>`count(*) filter (where ${asistencias.estado} in ('presente','tarde'))::int` })
        .from(asistencias)
        .where(eq(asistencias.programacionId, id));
      reg.registros = n;
      reg.presentes = presentes;
      reg.sinParticipantes = f.get("sinParticipantes") === "on";
      reg.obs = txt(f, "obs") || null;
      if (!n && !reg.sinParticipantes) return { error: "Aún no hay asistencia registrada: ábrela con «Lista de asistencia» y regístrala." };
      // Debe coincidir con los asistentes declarados en la 2da sección de la ficha
      const declarados = (ctx.pasos.llenar_ficha2 as Ficha2 | undefined)?.asistentes;
      if (n && declarados != null && declarados !== presentes && !reg.obs) {
        return { error: `En la 2da sección se declararon ${declarados} asistentes y en la lista hay ${presentes} presentes: corrige la lista o explica la diferencia.` };
      }
      break;
    }

    case "rendir_viaticos": {
      // La liquidación (formato ACIDE-A&A-F-02) se llena en el mismo paso y queda guardada para descargarla
      const liq = leerLiquidacion(txt(f, "liquidacion"));
      if (typeof liq === "string") return { error: liq };
      if (!liq.nombre) return { error: "Indica el nombre de quien rinde los viáticos." };
      await guardarLiquidacionDb(id, liq, por);
      reg.entregado = liq.presupuestado;
      reg.gastado = totalGastos(liq);
      reg.saldo = saldo(liq);
      reg.lineas = liq.lineas.length;
      reg.sinComprobante = liq.lineas.filter((l) => !l.comprobante).length;
      break;
    }

    case "recibir_rendicion":
      reg.obs = txt(f, "obs") || null;
      break;

    case "escanear_subir": {
      const n = await asociarDocs(docsSubidos(f), id, { subidoPor: por });
      if (!n) return { error: "Sube al menos un archivo (formatos escaneados, fotos o video)." };
      reg.archivos = n;
      break;
    }

    case "imprimir_ficha_digital":
      break;

    case "revisar_documentacion": {
      // Cada documento: revisado o «no corresponde» (sesiones sin examen, sin viáticos, etc.)
      const docsRev: Record<string, "revisado" | "no_corresponde"> = {};
      const sinMarcar: string[] = [];
      for (const x of DOCUMENTOS_REVISION) {
        const v = txt(f, `doc-${x.k}`);
        if (v === "revisado" || v === "no_corresponde") docsRev[x.k] = v;
        else sinMarcar.push(x.t);
      }
      if (sinMarcar.length) return { error: `Indica si está revisado o no corresponde: ${sinMarcar.join(", ")}.` };
      if (!Object.values(docsRev).includes("revisado")) return { error: "Marca al menos un documento revisado." };
      reg.documentos = docsRev;
      reg.obs = txt(f, "obs") || null;
      break;
    }

    case "elaborar_entregable":
      reg.entregadoA = txt(f, "entregadoA") || null;
      reg.obs = txt(f, "obs") || null;
      break;

    case "contrastar_inventario": {
      // Solo se registra el contraste: el inventario se actualiza en «Actualizar el inventario»
      const f2 = (ctx.pasos.llenar_ficha2 ?? {}) as Ficha2;
      const items = await db.select().from(fichaItems).where(eq(fichaItems.programacionId, id));
      const eqInfo = new Map(
        (await db.select().from(equipos).where(inArray(equipos.id, items.map((i) => i.equipoId ?? 0)))).map((q) => [q.id, q]),
      );
      const devoluciones = [];
      const equiposRev = [];
      let diferencias = 0;
      for (const it of items) {
        if (it.insumoId) {
          const n = Math.floor(Number(f.get(`dev-${it.id}`)) || 0);
          if (n < 0 || n > it.cantidad) return { error: `${it.descripcion}: lo contado debe estar entre 0 y ${it.cantidad}.` };
          const reportado = f2.devoluciones?.find((x) => x.itemId === it.id)?.cantidad ?? 0;
          if (n !== reportado) diferencias++;
          devoluciones.push({ itemId: it.id, insumoId: it.insumoId, nombre: it.descripcion, salio: it.cantidad, reportado, cantidad: n, usado: it.cantidad - n, diferencia: n - reportado });
        }
        if (it.equipoId) {
          const q = eqInfo.get(it.equipoId);
          const tipo = q?.tipo ?? "otro";
          const estado = (["ok", "falla", "correccion", "no_devuelto"] as const).find((x) => x === txt(f, `eqest-${it.equipoId}`)) ?? "ok";
          const obs = txt(f, `eqobs-${it.equipoId}`) || null;
          const chequeos = Object.fromEntries(CHEQUEOS_EQUIPO[tipo].map((c, i) => [c, f.get(`eqchk-${it.equipoId}-${i}`) === "on"]));
          if (estado !== "ok" && !obs) return { error: `Describe qué pasó con ${it.descripcion}.` };
          const rep = f2.equipos?.find((x) => x.equipoId === it.equipoId);
          const sugerido = rep?.falla ? "falla" : rep?.correccion ? "correccion" : "ok";
          if (estado !== sugerido) diferencias++;
          equiposRev.push({
            equipoId: it.equipoId,
            equipo: it.descripcion,
            estado,
            falla: estado !== "ok",
            usado: txt(f, `equsado-${it.equipoId}`) !== "no",
            horas: Math.max(0, Number(f.get(`eqhoras-${it.equipoId}`)) || 0),
            chequeos,
            obs,
          });
        }
      }
      reg.devoluciones = devoluciones;
      reg.equipos = equiposRev;
      reg.presentes = Number(f.get("presentes")) || null;
      reg.diferencias = diferencias;
      reg.obs = txt(f, "obs") || null;
      // ¿Cuadra? (misma actividad: antes era un paso aparte)
      if (siNo === null) return { error: "Indica si el contraste cuadra." };
      if (!siNo) {
        if (!reg.obs) return { error: "Escribe qué no cuadra para el asistente." };
        // Vuelve al asistente: «Revisar toda la documentación» y lo que sigue se vuelve a hacer
        for (const k of ["revisar_documentacion", "elaborar_entregable"]) delete pasos[k];
        const historial = Array.isArray(pasos.observaciones_contraste?.lista) ? (pasos.observaciones_contraste.lista as unknown[]) : [];
        pasos.observaciones_contraste = { en: reg.en, por, lista: [...historial, { en: reg.en, por, obs: reg.obs }] };
        await guardarPasos(id, pasos);
        refrescar(id);
        return { ok: "No cuadra: vuelve al asistente para revisar toda la documentación." };
      }
      if (diferencias && !reg.obs) return { error: `Hay ${diferencias} diferencia(s) con lo que reportó el asistente: explícalas en la observación.` };
      reg.cuadra = true;
      break;
    }

    case "actualizar_inventario": {
      reg.obs = txt(f, "obs") || null;
      const c = (ctx.pasos.contrastar_inventario ?? {}) as Record<string, unknown>;
      const lineas = ((c.devoluciones as { insumoId: number; cantidad: number }[] | undefined) ?? []).filter((l) => l.cantidad > 0);
      type Rev = { equipoId: number; estado?: string; falla: boolean; usado?: boolean; horas?: number; chequeos?: Record<string, boolean>; obs: string | null };
      const revisados = (c.equipos as Rev[] | undefined) ?? [];
      if (lineas.length) {
        const motivo = `Devolución · ${await motivoDe(id)}`;
        await db.transaction(async (tx) => {
          await moverStock(tx, "entrada", lineas, id, motivo);
        });
      }
      const tras = `(tras sesión del ${fechaCorta(p.fecha)})`;
      for (const q of revisados) {
        const estado = q.estado ?? (q.falla ? "falla" : "ok");
        if (estado !== "ok") {
          await db
            .update(equipos)
            .set({
              estado: estado === "no_devuelto" ? "de_baja" : "en_reparacion",
              observacion: `${estado === "no_devuelto" ? "No volvió" : estado === "correccion" ? "Requiere corrección" : "Falla"}: ${q.obs ?? ""} ${tras}`.slice(0, 300),
            })
            .where(eq(equipos.id, q.equipoId));
        }
      }
      // Historial de uso y revisión de cada equipo (se ve en Mantenimiento)
      await db.delete(revisionesEquipo).where(eq(revisionesEquipo.programacionId, id));
      if (revisados.length) {
        await db.insert(revisionesEquipo).values(
          revisados.map((q) => ({
            equipoId: q.equipoId,
            programacionId: id,
            fecha: p.fecha,
            usado: q.usado ?? true,
            horasUso: q.horas != null ? String(q.horas) : null,
            chequeos: q.chequeos ?? {},
            resultado: q.estado ?? (q.falla ? "falla" : "ok"),
            observacion: q.obs,
            revisadoPor: (c.por as string | null) ?? null,
          })),
        );
      }
      reg.devuelto = lineas.reduce((a, l) => a + l.cantidad, 0);
      reg.lineas = lineas;
      reg.fallas = revisados.filter((q) => (q.estado ?? (q.falla ? "falla" : "ok")) !== "ok").length;
      revalidatePath("/soporte/logistica");
      revalidatePath("/soporte/mantenimiento");
      break;
    }

    case "gestionar_carpeta":
      reg.ubicacion = txt(f, "ubicacion") || null;
      await db.update(programaciones).set({ estado: "finalizada" }).where(eq(programaciones.id, id));
      break;

    default:
      reg.obs = txt(f, "obs") || null;
  }

  pasos[clave] = reg;
  await guardarPasos(id, pasos);
  refrescar(id);
  return { ok: `✓ ${def.titulo}` };
}

/** Deshace una actividad registrada por error (solo si ninguna actividad posterior depende de ella). */
export async function deshacerPaso(f: FormData) {
  const id = Number(f.get("programacionId"));
  const clave = txt(f, "clave");
  const perm = await autorizarSesion(id);
  if (!perm.u) return;
  const x = await cargar(id);
  if (!x || !PASO[clave]) return;
  // Solo quien puede registrar la actividad (o el administrador / Jefe de Proyecto) la deshace
  const def = PASO[clave];
  const roles = [rolDe(def, x.ctx), ...(def.rolesAlternos ?? [])];
  if (!puedeRegistrarPaso(perm.u.roles, roles) && !perm.u.roles.includes("jefe_proyecto")) return;
  const dependientes = PASOS.filter((d) => d.requiere.includes(clave) && x.ctx.pasos[d.clave]);
  if (dependientes.length) return;

  const pasos = { ...x.ctx.pasos };
  const previo = pasos[clave];
  delete pasos[clave];
  if (clave === "confirmar_sede" && previo?.localConfirmado === false) {
    await db.update(programaciones).set({ estado: "programada" }).where(eq(programaciones.id, id));
  }
  if (clave === "sesion_realizada" && previo?.realizada === false) {
    await db.update(programaciones).set({ estado: "confirmada" }).where(eq(programaciones.id, id));
  }
  if (clave === "actualizar_inventario") {
    const lineas = (previo?.lineas as { insumoId: number; cantidad: number }[] | undefined) ?? [];
    if (lineas.length) {
      try {
        await db.transaction(async (tx) => {
          const err = await moverStock(tx, "salida", lineas, id, "Se deshizo la actualización del inventario");
          if (err) throw new SinStock(err);
        });
      } catch {
        return; // el stock devuelto ya se usó: no se puede deshacer
      }
    }
  }
  if (clave === "actualizar_inventario") {
    await db.delete(revisionesEquipo).where(eq(revisionesEquipo.programacionId, id));
  }
  if (clave === "gestionar_carpeta") {
    await db.update(programaciones).set({ estado: "confirmada" }).where(eq(programaciones.id, id));
  }
  if (clave === "escanear_subir" || clave === "enviar_examenes") {
    const tipos = clave === "escanear_subir" ? ["evidencia"] : ["examen_entrada", "examen_salida"];
    const borrados = await db
      .delete(documentos)
      .where(and(eq(documentos.programacionId, id), inArray(documentos.tipo, tipos as ("evidencia" | "examen_entrada" | "examen_salida")[])))
      .returning();
    await Promise.all(borrados.map((d) => borrarArchivo(d.archivo)));
  }
  if (clave === "comunicar") {
    await db.delete(avisos).where(and(eq(avisos.programacionId, id), eq(avisos.origen, "comunicar")));
  }
  if (clave === "validar_programacion") {
    await db.delete(avisos).where(and(eq(avisos.programacionId, id), eq(avisos.origen, "validar_programacion")));
  }
  if (clave === "personalizar") {
    const borrados = await db.delete(documentos).where(and(eq(documentos.programacionId, id), eq(documentos.version, "personalizada"))).returning();
    await Promise.all(borrados.map((d) => borrarArchivo(d.archivo)));
  }
  if (clave === "dinamicas") {
    const motivo = `Devolución · ${await motivoDe(id)} · se deshizo «dinámicas»`;
    await db.transaction(async (tx) => {
      const borrados = await tx
        .delete(fichaItems)
        .where(and(eq(fichaItems.programacionId, id), eq(fichaItems.categoria, "dinamica")))
        .returning();
      const lineas = borrados.filter((b) => b.insumoId).map((b) => ({ insumoId: b.insumoId!, cantidad: b.cantidad }));
      await moverStock(tx, "entrada", lineas, id, motivo);
    });
  }
  await guardarPasos(id, pasos);
  refrescar(id);
}

/* ── 1ra sección de la ficha ─────────────────────────────── */

export async function agregarItem(_prev: Res, f: FormData): Promise<Res> {
  const id = Number(f.get("programacionId"));
  const perm = await autorizarFicha(id);
  if (!perm.u) return { error: perm.error };
  const insumoId = Number(f.get("insumoId")) || null;
  const categoria = txt(f, "categoria") as CategoriaFicha;
  const cantidad = Math.max(1, Math.floor(Number(f.get("cantidad"))) || 1);
  let descripcion = txt(f, "descripcion");
  if (!["material_capacitador", "dinamica", "refrigerio", "tecnologico"].includes(categoria)) return { error: "Categoría no válida." };

  if (!insumoId) {
    if (!descripcion) return { error: "Escribe el ítem o elígelo del inventario." };
    await db.insert(fichaItems).values({ programacionId: id, categoria, descripcion: descripcion.slice(0, 200), cantidad });
    refrescar(id);
    return { ok: "Ítem extra agregado." };
  }

  const motivo = await motivoDe(id);
  try {
    await db.transaction(async (tx) => {
      const [i] = await tx.select().from(insumos).where(eq(insumos.id, insumoId));
      if (!i) throw new SinStock("Ese ítem ya no está en el inventario.");
      const err = await moverStock(tx, "salida", [{ insumoId, cantidad }], id, motivo);
      if (err) throw new SinStock(err);
      descripcion = descripcion ? `${i.nombre} · ${descripcion}` : i.nombre;
      await tx.insert(fichaItems).values({ programacionId: id, categoria, descripcion: descripcion.slice(0, 200), cantidad, insumoId });
    });
  } catch (e) {
    if (e instanceof SinStock) return { error: e.message };
    throw e;
  }
  refrescar(id);
  revalidatePath("/soporte/logistica");
  return { ok: `Descontado del inventario: ${cantidad} × ${descripcion}.` };
}

export async function alternarItem(f: FormData) {
  const itemId = Number(f.get("itemId"));
  const [dueño] = await db.select({ programacionId: fichaItems.programacionId }).from(fichaItems).where(eq(fichaItems.id, itemId));
  if (!dueño || (await autorizarFicha(dueño.programacionId)).error) return;
  const [it] = await db
    .update(fichaItems)
    .set({ listo: sql`not ${fichaItems.listo}` })
    .where(eq(fichaItems.id, itemId))
    .returning();
  if (it) refrescar(it.programacionId);
}

export async function eliminarItem(f: FormData) {
  const itemId = Number(f.get("itemId"));
  const [dueño] = await db.select({ programacionId: fichaItems.programacionId }).from(fichaItems).where(eq(fichaItems.id, itemId));
  if (!dueño || (await autorizarFicha(dueño.programacionId)).error) return;
  const it = await db.transaction(async (tx) => {
    const [b] = await tx.delete(fichaItems).where(eq(fichaItems.id, itemId)).returning();
    if (b?.insumoId) {
      // Vuelve al inventario lo que se había descontado
      await moverStock(tx, "entrada", [{ insumoId: b.insumoId, cantidad: b.cantidad }], b.programacionId, `Devolución · quitado de la ficha (${b.descripcion})`);
    }
    return b;
  });
  if (it) refrescar(it.programacionId);
}

/* ── Asistente: refrigerio y equipos desde los inventarios ── */

/** Asigna insumos de refrigerio del inventario de Logística (descuenta el stock). */
export async function asignarRefrigerio(_prev: Res, f: FormData): Promise<Res> {
  const id = Number(f.get("programacionId"));
  const perm = await autorizarFicha(id);
  if (!perm.u) return { error: perm.error };
  const lineas = lineasInventario(f);
  if (!lineas.length) return { error: "Indica la cantidad de al menos un insumo." };
  const items = await db.select().from(insumos).where(inArray(insumos.id, lineas.map((l) => l.insumoId)));
  const nombres = new Map(items.map((i) => [i.id, i.nombre]));
  const motivo = `${await motivoDe(id)} · refrigerio`;
  try {
    await db.transaction(async (tx) => {
      const err = await moverStock(tx, "salida", lineas, id, motivo);
      if (err) throw new SinStock(err);
      await tx.insert(fichaItems).values(
        lineas.map((l) => ({ programacionId: id, categoria: "refrigerio" as CategoriaFicha, cantidad: l.cantidad, insumoId: l.insumoId, descripcion: nombres.get(l.insumoId) ?? "Refrigerio", listo: true })), // lo asigna el asistente: ya queda listo ✓
      );
    });
  } catch (e) {
    if (e instanceof SinStock) return { error: e.message };
    throw e;
  }
  refrescar(id);
  return { ok: `Refrigerio asignado: ${lineas.map((l) => `${l.cantidad} ${nombres.get(l.insumoId)}`).join(", ")}.` };
}

/** Asigna equipos del inventario de Mantenimiento (solo operativos y sin cruce de horario). */
export async function asignarEquipos(_prev: Res, f: FormData): Promise<Res> {
  const id = Number(f.get("programacionId"));
  const perm = await autorizarFicha(id);
  if (!perm.u) return { error: perm.error };
  const ids = [...new Set(f.getAll("equipoId").map(Number).filter((n) => n > 0))];
  if (!ids.length) return { error: "Marca al menos un equipo." };
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, id) });
  if (!p) return { error: "La sesión ya no existe." };
  const eqs = await db.select().from(equipos).where(inArray(equipos.id, ids));
  const noOperativo = eqs.find((q) => q.estado !== "operativo");
  if (noOperativo) return { error: `${noOperativo.codigo} no está operativo según Mantenimiento.` };
  // ¿Ya está asignado aquí o en otra sesión que se cruza?
  const usados = await db
    .select({ equipoId: fichaItems.equipoId, progId: fichaItems.programacionId, sede: programaciones.sedeId, hi: programaciones.horaInicio, hf: programaciones.horaFin })
    .from(fichaItems)
    .innerJoin(programaciones, eq(fichaItems.programacionId, programaciones.id))
    .where(
      and(
        inArray(fichaItems.equipoId, ids),
        or(
          eq(programaciones.id, id),
          and(eq(programaciones.fecha, p.fecha), lt(programaciones.horaInicio, p.horaFin), gt(programaciones.horaFin, p.horaInicio), ne(programaciones.estado, "cancelada")),
        ),
      ),
    );
  const choque = usados[0];
  if (choque) {
    const q = eqs.find((x) => x.id === choque.equipoId)!;
    return {
      error: choque.progId === id
        ? `${q.codigo} ya está asignado a esta sesión.`
        : `${q.codigo} ya está asignado a otra sesión de ${choque.hi.slice(0, 5)} a ${choque.hf.slice(0, 5)} ese día.`,
    };
  }
  await db.insert(fichaItems).values(
    eqs.map((q) => ({
      programacionId: id,
      categoria: "tecnologico" as CategoriaFicha,
      cantidad: 1,
      equipoId: q.id,
      descripcion: `${TIPOS_EQUIPO[q.tipo].singular} ${q.codigo}${q.nombre && q.nombre !== "—" ? ` · ${q.nombre}` : ""}`.slice(0, 200),
    })),
  );
  refrescar(id);
  return { ok: `${eqs.length} equipo(s) asignado(s): ${eqs.map((q) => q.codigo).join(", ")}.` };
}

/** Guarda la liquidación de viáticos como borrador (sin registrar el paso), p. ej. antes de descargarla. */
export async function guardarLiquidacion(f: FormData): Promise<Res> {
  const id = Number(f.get("programacionId"));
  const perm = await autorizarSesion(id);
  if (!perm.u) return { error: perm.error };
  const liq = leerLiquidacion(txt(f, "liquidacion"));
  if (typeof liq === "string") return { error: liq };
  await guardarLiquidacionDb(id, liq, perm.u.nombre);
  revalidatePath(`/operativo/capacitaciones/${id}`);
  return { ok: "Liquidación guardada." };
}
