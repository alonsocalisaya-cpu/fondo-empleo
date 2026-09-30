"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { avisos } from "@/db/schema";
import { usuarioActual } from "@/lib/auth";

/** «Enterado» desde la página de notificaciones. */
export async function confirmarAviso(f: FormData) {
  const u = await usuarioActual();
  if (!u) return;
  const ahora = new Date();
  await db.update(avisos).set({ confirmadoEn: ahora, leidoEn: ahora }).where(and(eq(avisos.id, Number(f.get("id"))), eq(avisos.usuarioId, u.id)));
  revalidatePath("/notificaciones");
}
