"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { autorizarSesion } from "@/lib/auth";
import { asistencias, inscripciones, participantes, programaciones, type EstadoAsis } from "@/db/schema";

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
      estado: txt(form, `estado_${pid}`) as EstadoAsis,
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
  if ((await autorizarSesion(id)).error) return;
  await db.update(programaciones).set({ listaCerrada: false }).where(eq(programaciones.id, id));
  revalidatePath("/", "layout");
}

/** Inscribe a un participante por DNI. Si no existe, lo crea con los datos del formulario. */
export async function inscribirParticipante(_prev: Resultado, form: FormData): Promise<Resultado> {
  const programacionId = Number(form.get("programacionId"));
  const perm = await autorizarSesion(programacionId);
  if (!perm.u) return { error: perm.error };
  const dni = txt(form, "dni");
  if (!/^\d{8,12}$/.test(dni)) return { error: "Ingresa un DNI válido (solo números)." };

  let p = await db.query.participantes.findFirst({ where: eq(participantes.dni, dni) });
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

export async function quitarInscripcion(form: FormData) {
  const programacionId = Number(form.get("programacionId"));
  if ((await autorizarSesion(programacionId)).error) return;
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
