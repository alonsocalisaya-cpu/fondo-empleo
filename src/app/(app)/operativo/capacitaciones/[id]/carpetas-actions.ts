"use server";

import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { preparaciones } from "@/db/schema";
import { autorizarSesion } from "@/lib/auth";
import { puedeRegistrarPaso } from "@/lib/permisos";
import { PASO } from "@/lib/flujo-pre";
import { carpetasEntregables } from "@/lib/carpetas-entregables";

export async function crearCarpetaEntregable(programacionId: number, nombre: string, descripcion: string) {
  if (!Number.isSafeInteger(programacionId) || programacionId <= 0) return { error: "Sesión no válida." };
  const permiso = await autorizarSesion(programacionId);
  const actividad = PASO.escanear_subir;
  if (!permiso.u || typeof actividad.rol !== "string" || !puedeRegistrarPaso(permiso.u.roles, [actividad.rol, ...(actividad.rolesAlternos ?? [])])) return { error: "No tienes permiso para agregar entregables a esta sesión." };
  nombre = nombre.replace(/\s+/g, " ").trim();
  descripcion = descripcion.trim();
  if (!nombre || nombre.length > 80) return { error: "Escribe un nombre de hasta 80 caracteres." };
  if (descripcion.length > 300) return { error: "La descripción admite hasta 300 caracteres." };
  const carpeta = { id: randomBytes(6).toString("hex"), nombre, descripcion };
  const error = await db.transaction(async (tx) => {
    await tx.insert(preparaciones).values({ programacionId }).onConflictDoNothing();
    const [preparacion] = await tx.select().from(preparaciones).where(eq(preparaciones.programacionId, programacionId)).for("update");
    const carpetas = carpetasEntregables(preparacion.pasos.carpetas_entregables);
    if (carpetas.some((c) => c.nombre.toLocaleLowerCase("es") === nombre.toLocaleLowerCase("es"))) return "Ya existe una carpeta con ese nombre en esta sesión.";
    const registro = { en: new Date().toISOString(), carpetas: [...carpetas, carpeta] };
    await tx.update(preparaciones).set({ pasos: { ...preparacion.pasos, carpetas_entregables: registro }, actualizadoEn: sql`now()` }).where(eq(preparaciones.programacionId, programacionId));
    return null;
  });
  if (error) return { error };
  revalidatePath(`/operativo/capacitaciones/${programacionId}`);
  return { carpeta };
}
