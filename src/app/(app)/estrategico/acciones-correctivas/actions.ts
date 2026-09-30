"use server";

import { exigir, permitir } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  accionesCorrectivas,
  type EstadoAccion,
  type OrigenAccion,
  type Prioridad,
} from "@/db/schema";
import { hoyISO } from "@/lib/fechas";

export type EstadoForm = { error?: string } | undefined;
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function guardarAccion(_prev: EstadoForm, f: FormData): Promise<EstadoForm> {
  const perm = await permitir("acciones");
  if (!perm.u) return { error: perm.error };
  const id = Number(f.get("id")) || null;
  const v = {
    titulo: txt(f, "titulo"),
    problema: txt(f, "problema"),
    causa: txt(f, "causa") || null,
    accion: txt(f, "accion"),
    origen: (txt(f, "origen") || "indicador") as OrigenAccion,
    indicador: txt(f, "indicador") || null,
    sedeId: Number(f.get("sedeId")) || null,
    componenteId: Number(f.get("componenteId")) || null,
    responsable: txt(f, "responsable"),
    prioridad: (txt(f, "prioridad") || "media") as Prioridad,
    estado: (txt(f, "estado") || "abierta") as EstadoAccion,
    fechaDeteccion: txt(f, "fechaDeteccion"),
    fechaLimite: txt(f, "fechaLimite"),
    resultado: txt(f, "resultado") || null,
  };

  if (!v.titulo || !v.problema || !v.accion || !v.responsable) {
    return { error: "Completa título, problema detectado, acción a realizar y responsable." };
  }
  if (!esFecha(v.fechaDeteccion) || !esFecha(v.fechaLimite)) return { error: "Revisa las fechas." };
  if (v.fechaLimite < v.fechaDeteccion) return { error: "La fecha límite no puede ser anterior a la detección." };
  if (v.estado === "cerrada" && !v.resultado) {
    return { error: "Para cerrar la acción, describe el resultado (¿se resolvió el problema?)." };
  }

  const fechaCierre = v.estado === "cerrada" ? txt(f, "fechaCierre") || hoyISO() : null;

  if (id) await db.update(accionesCorrectivas).set({ ...v, fechaCierre }).where(eq(accionesCorrectivas.id, id));
  else await db.insert(accionesCorrectivas).values({ ...v, fechaCierre });

  revalidatePath("/estrategico", "layout");
  redirect("/estrategico/acciones-correctivas");
}

export async function eliminarAccion(f: FormData) {
  await exigir("acciones");
  await db.delete(accionesCorrectivas).where(eq(accionesCorrectivas.id, Number(f.get("id"))));
  revalidatePath("/estrategico", "layout");
  redirect("/estrategico/acciones-correctivas");
}
