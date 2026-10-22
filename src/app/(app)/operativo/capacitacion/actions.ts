"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { autorizarSesion } from "@/lib/auth";
import { puedeReabrirAsistencia } from "@/lib/permisos";
import { asistencias, incorporacionesExcepcionales, inscripciones, participantes, programacionSesiones, programaciones, type EstadoAsis } from "@/db/schema";

export type Resultado = { ok?: string; error?: string } | undefined;

const ESTADOS: EstadoAsis[] = ["presente", "tarde", "ausente", "justificado"];
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
/** Nota del examen: vacío → null; fuera de 0–20 o no numérica → NaN (se rechaza). */
const nota = (f: FormData, k: string) => {
  const v = txt(f, k).replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 20 ? Math.round(n * 10) / 10 : NaN;
};

/** Guarda (o actualiza) la asistencia de todos los inscritos. Opcionalmente cierra la lista. */
export async function guardarAsistencia(_prev: Resultado, form: FormData): Promise<Resultado> {
  const programacionId = Number(form.get("programacionId"));
  const perm = await autorizarSesion(programacionId);
  if (!perm.u) return { error: perm.error };
  const cerrar = form.get("cerrar") === "1";

  const prog = await db.query.programaciones.findFirst({ where: eq(programaciones.id, programacionId) });
  if (!prog) return { error: "La programación no existe." };
  if (prog.listaCerrada) return { error: "La lista está cerrada. Reábrela para editarla." };

  const ids = form.getAll("participanteId").map(Number);
  const filas = ids
    .map((pid) => ({
      programacionId,
      participanteId: pid,
      estado: (txt(form, `estado_${pid}`) || "ausente") as EstadoAsis,
      observacion: txt(form, `obs_${pid}`) || null,
      notaEntrada: nota(form, `ne_${pid}`),
      notaSalida: nota(form, `ns_${pid}`),
    }))
    .filter((f) => ESTADOS.includes(f.estado))
    // Solo quien asistió puede tener nota
    .map((f) => (f.estado === "presente" || f.estado === "tarde" ? f : { ...f, notaEntrada: null, notaSalida: null }));

  const malas = filas.filter((f) => Number.isNaN(f.notaEntrada) || Number.isNaN(f.notaSalida));
  if (malas.length) return { error: `Hay ${malas.length} nota(s) no válidas: deben ser números de 0 a 20.` };

  if (cerrar && filas.length < ids.length) {
    return { error: `Faltan ${ids.length - filas.length} participantes por marcar antes de cerrar la lista.` };
  }

  await db.transaction(async (tx) => {
    if (filas.length) {
      await tx
        .insert(asistencias)
        .values(filas)
        .onConflictDoUpdate({
          target: [asistencias.programacionId, asistencias.participanteId],
          set: {
            estado: sql`excluded.estado`,
            observacion: sql`excluded.observacion`,
            notaEntrada: sql`excluded.nota_entrada`,
            notaSalida: sql`excluded.nota_salida`,
            registradoEn: sql`now()`,
          },
        });
    }
    if (cerrar) {
      await tx
        .update(programaciones)
        .set({ listaCerrada: true, estado: prog.estado === "cancelada" ? "cancelada" : "finalizada" })
        .where(eq(programaciones.id, programacionId));
    }
  });

  revalidatePath("/", "layout");
  return { ok: cerrar ? "Lista guardada y cerrada." : `Asistencia guardada (${filas.length} registros).` };
}

export async function reabrirLista(form: FormData) {
  const id = Number(form.get("programacionId"));
  const permiso = await autorizarSesion(id);
  if (!permiso.u || !puedeReabrirAsistencia(permiso.u.roles)) return;
  await db.update(programaciones).set({ listaCerrada: false }).where(eq(programaciones.id, id));
  revalidatePath("/", "layout");
}

/** Inscribe por ID existente o DNI. Si el DNI no existe, lo crea con los datos del formulario. */
export async function inscribirParticipante(_prev: Resultado, form: FormData): Promise<Resultado> {
  const programacionId = Number(form.get("programacionId"));
  const perm = await autorizarSesion(programacionId);
  if (!perm.u) return { error: perm.error };
  const dni = txt(form, "dni");
  const lista = await db.query.programaciones.findFirst({ where: eq(programaciones.id, programacionId) });
  if (!lista || lista.listaCerrada) return { error: "La lista está cerrada. Solicita su reapertura al administrador o a Gestión Documental." };
  const participanteId = Number(form.get("participanteId"));
  const porId = Number.isSafeInteger(participanteId) && participanteId > 0;
  if (!porId && !/^\d{8,12}$/.test(dni)) return { error: "Ingresa un DNI válido (solo números)." };

  let p = await db.query.participantes.findFirst({ where: porId ? eq(participantes.id, participanteId) : eq(participantes.dni, dni) });
  if (porId && !p) return { error: "El beneficiario ya no existe." };
  if (!p) {
    const nombres = txt(form, "nombres");
    const apellidos = txt(form, "apellidos");
    if (!nombres || !apellidos) {
      return { error: "Ese DNI no está registrado. Completa nombres y apellidos para crearlo." };
    }
    [p] = await db
      .insert(participantes)
      .values({ dni, nombres, apellidos, area: txt(form, "area") || null })
      .returning();
  }

  const r = await db
    .insert(inscripciones)
    .values({ programacionId, participanteId: p.id })
    .onConflictDoNothing()
    .returning();

  revalidatePath(`/operativo/capacitacion/${programacionId}`);
  return r.length
    ? { ok: `${p.nombres} ${p.apellidos} fue inscrito.` }
    : { error: `${p.nombres} ${p.apellidos} ya estaba inscrito.` };
}

/**
 * Incorpora a una persona que estaba en otra lista,
 * esté abierta o cerrada la lista de destino. Es una incorporación puntual:
 * la inscripción habitual del beneficiario y sus asistencias anteriores quedan intactas.
 */
export async function incorporarExcepcional(_prev: Resultado, form: FormData): Promise<Resultado> {
  const destinoProgramacionId = Number(form.get("programacionId"));
  const movimiento = txt(form, "movimiento").split(":");
  const participanteId = Number(movimiento[0]);
  const origenProgramacionId = Number(movimiento[1]);
  const motivo = txt(form, "motivo");
  const perm = await autorizarSesion(destinoProgramacionId);
  if (!perm.u) return { error: perm.error };
  if (!Number.isSafeInteger(origenProgramacionId) || !Number.isSafeInteger(participanteId)) {
    return { error: "Selecciona la lista de origen y la persona que se incorporará." };
  }
  const motivoRegistrado = motivo || "Sin motivo especificado";
  if (motivoRegistrado.length > 300) return { error: "El motivo no puede superar 300 caracteres." };

  const [destino, origen] = await Promise.all([
    db.query.programaciones.findFirst({ where: eq(programaciones.id, destinoProgramacionId) }),
    db.query.programaciones.findFirst({ where: eq(programaciones.id, origenProgramacionId) }),
  ]);
  if (!destino || !origen) return { error: "La sesión indicada ya no existe." };
  if (destinoProgramacionId === origenProgramacionId) {
    return { error: "La lista de origen debe ser otra sesión." };
  }
  if (origen.estado === "cancelada" || destino.estado === "cancelada") return { error: "No se puede incorporar una sesión cancelada." };

  const [persona, origenInscrito, destinoInscrito, movimientoPrevio] = await Promise.all([
    db.query.participantes.findFirst({ where: eq(participantes.id, participanteId) }),
    db.query.inscripciones.findFirst({ where: and(eq(inscripciones.programacionId, origenProgramacionId), eq(inscripciones.participanteId, participanteId)) }),
    db.query.inscripciones.findFirst({ where: and(eq(inscripciones.programacionId, destinoProgramacionId), eq(inscripciones.participanteId, participanteId)) }),
    db.query.incorporacionesExcepcionales.findFirst({ where: and(eq(incorporacionesExcepcionales.destinoProgramacionId, destinoProgramacionId), eq(incorporacionesExcepcionales.participanteId, participanteId)) }),
  ]);
  if (!persona) return { error: "El beneficiario ya no existe." };
  if (!origenInscrito) return { error: "El beneficiario no pertenece a la lista de origen seleccionada." };
  if (destinoInscrito || movimientoPrevio) return { error: "El beneficiario ya está incorporado en esta lista." };

  // Evita registrar dos veces el mismo tema, aunque las sesiones sean de sedes distintas.
  const sesionesDestino = await db.query.programacionSesiones.findMany({
    where: eq(programacionSesiones.programacionId, destinoProgramacionId),
    columns: { sesionId: true },
  });
  const temasDestino = [destino.sesionId, ...sesionesDestino.map((x) => x.sesionId)];
  const asistenciaMismoDia = await db
    .select({ id: asistencias.id })
    .from(asistencias)
    .innerJoin(programaciones, eq(asistencias.programacionId, programaciones.id))
    .where(and(
      eq(asistencias.participanteId, participanteId),
      ne(programaciones.estado, "cancelada"),
      sql`${asistencias.estado} in ('presente', 'tarde')`,
      sql`(
        ${programaciones.sesionId} in (${sql.join(temasDestino.map((tema) => sql`${tema}`), sql`, `)})
        or exists (
          select 1 from programacion_sesiones ps
          where ps.programacion_id = ${programaciones.id}
            and ps.sesion_id in (${sql.join(temasDestino.map((tema) => sql`${tema}`), sql`, `)})
        )
      )`,
    ))
    .limit(1);
  if (asistenciaMismoDia.length) return { error: "Este beneficiario ya tiene una asistencia presente o tarde registrada en otra sesión de esta fecha." };

  await db.transaction(async (tx) => {
    await tx.insert(inscripciones).values({ programacionId: destinoProgramacionId, participanteId });
    await tx.insert(incorporacionesExcepcionales).values({
      destinoProgramacionId,
      origenProgramacionId,
      participanteId,
      motivo: motivoRegistrado,
      registradoPor: perm.u.nombre,
    });
  });

  revalidatePath(`/operativo/capacitacion/${destinoProgramacionId}`);
  revalidatePath("/", "layout");
  return { ok: `${persona.nombres} ${persona.apellidos} fue incorporado excepcionalmente a esta lista.` };
}

export async function quitarInscripcion(form: FormData) {
  const programacionId = Number(form.get("programacionId"));
  if ((await autorizarSesion(programacionId)).error) return;
  const lista = await db.query.programaciones.findFirst({ where: eq(programaciones.id, programacionId) });
  if (!lista || lista.listaCerrada) return;
  const participanteId = Number(form.get("quitar"));
  await db.transaction(async (tx) => {
    await tx
      .delete(asistencias)
      .where(and(eq(asistencias.programacionId, programacionId), eq(asistencias.participanteId, participanteId)));
    await tx
      .delete(inscripciones)
      .where(and(eq(inscripciones.programacionId, programacionId), eq(inscripciones.participanteId, participanteId)));
  });
  revalidatePath(`/operativo/capacitacion/${programacionId}`);
}
