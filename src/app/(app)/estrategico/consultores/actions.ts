"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { equivalencias, validarDisponibilidad } from "@/lib/disponibilidad";
import { permitir } from "@/lib/auth";
import { programaciones } from "@/db/schema";

export type ResAsignar = { ok?: boolean; error?: string };

/** Asigna (o quita) el consultor de una programación, validando cruces de horario. */
export async function asignarConsultor(programacionId: number, consultorId: number | null): Promise<ResAsignar> {
  const perm = await permitir("consultores");
  if (!perm.u) return { error: perm.error };
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, programacionId) });
  if (!p) return { error: "La sesión ya no existe." };

  if (consultorId) {
    // Revisa cruces en cualquiera de sus roles (también si figura como asistente en otra sesión)
    const eqv = await equivalencias();
    if (p.asistenteId && eqv.personalDe(consultorId).includes(p.asistenteId)) {
      return { error: "Esa persona ya es el asistente de esta sesión." };
    }
    const sinDisp = await validarDisponibilidad({ capacitadorId: consultorId }, p, p.id, eqv);
    if (sinDisp) return { error: sinDisp.replace("Sin disponibilidad: el capacitador", "Cruce: el consultor") };
  }

  await db.update(programaciones).set({ capacitadorId: consultorId }).where(eq(programaciones.id, programacionId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Asigna (o quita) el asistente de una programación, validando cruces de horario en cualquiera de sus roles. */
export async function asignarAsistente(programacionId: number, asistenteId: number | null): Promise<ResAsignar> {
  const perm = await permitir("consultores");
  if (!perm.u) return { error: perm.error };
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, programacionId) });
  if (!p) return { error: "La sesión ya no existe." };

  if (asistenteId) {
    const eqv = await equivalencias();
    if (p.capacitadorId && eqv.capacitadoresDe(asistenteId).includes(p.capacitadorId)) {
      return { error: "Esa persona ya es el capacitador de esta sesión." };
    }
    const sinDisp = await validarDisponibilidad({ asistenteId }, p, p.id, eqv);
    if (sinDisp) return { error: sinDisp.replace("Sin disponibilidad: el asistente", "Cruce: el asistente") };
  }

  await db.update(programaciones).set({ asistenteId }).where(eq(programaciones.id, programacionId));
  revalidatePath("/", "layout");
  return { ok: true };
}
