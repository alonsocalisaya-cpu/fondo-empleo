"use server";

import { exigir } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { componentes, actividades, estructuras, modulos, sesiones, type Modalidad } from "@/db/schema";

export type Tipo = "c" | "a" | "m" | "s";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, def: number) => {
  const n = Number(f.get(k));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : def;
};

function volver(nodo?: string, error?: string, estructura?: number): never {
  const q = new URLSearchParams();
  if (estructura) q.set("estructura", String(estructura));
  if (nodo) q.set("nodo", nodo);
  if (error) q.set("error", error);
  revalidatePath("/estrategico/cronograma/estructura");
  redirect(`/estrategico/cronograma/estructura${q.size ? `?${q}` : ""}`);
}

/** Crea o actualiza un componente, actividad, módulo o sesión. */
export async function guardarNodo(form: FormData) {
  await exigir("cronograma");
  const tipo = txt(form, "tipo") as Tipo;
  const id = Number(form.get("id")) || null;
  const padreId = Number(form.get("padreId")) || null;
  const codigo = txt(form, "codigo").toUpperCase();
  const nombre = txt(form, "nombre");
  const descripcion = txt(form, "descripcion") || null;
  const orden = num(form, "orden", 0);
  const volverA = id ? `${tipo}-${id}` : padreId ? `${padreDe(tipo)}-${padreId}` : undefined;

  if (!["c", "a", "m", "s"].includes(tipo)) volver(undefined, "Tipo no válido.");
  if (!codigo || !nombre) volver(volverA, "El código y el nombre son obligatorios.");
  if (!id && tipo !== "c" && !padreId) volver(undefined, "Falta el elemento superior.");

  let nuevoId = 0;
  try {
    switch (tipo) {
      case "c": {
        const v = { codigo, nombre, descripcion, orden };
        const estructuraId = Number(form.get("estructuraId")) || 0;
        if (!id && !estructuraId) throw new Error("Falta la estructura");
        nuevoId = id
          ? (await db.update(componentes).set(v).where(eq(componentes.id, id)).returning())[0].id
          : (await db.insert(componentes).values({ ...v, estructuraId }).returning())[0].id;
        break;
      }
      case "a": {
        const v = { codigo, nombre, descripcion, orden };
        nuevoId = id
          ? (await db.update(actividades).set(v).where(eq(actividades.id, id)).returning())[0].id
          : (await db.insert(actividades).values({ ...v, componenteId: padreId! }).returning())[0].id;
        break;
      }
      case "m": {
        const v = { codigo, nombre, descripcion, orden };
        nuevoId = id
          ? (await db.update(modulos).set(v).where(eq(modulos.id, id)).returning())[0].id
          : (await db.insert(modulos).values({ ...v, actividadId: padreId! }).returning())[0].id;
        break;
      }
      case "s": {
        const v = {
          codigo,
          nombre,
          objetivo: descripcion,
          contenido: txt(form, "contenido") || null,
          recursoMetodologico: txt(form, "recursoMetodologico") || null,
          perfilSalida: txt(form, "perfilSalida") || null,
          orden,
          duracionMin: num(form, "duracionMin", 120),
          modalidad: (txt(form, "modalidad") || "presencial") as Modalidad,
          asistenciaMinima: Math.min(100, num(form, "asistenciaMinima", 80)),
        };
        nuevoId = id
          ? (await db.update(sesiones).set(v).where(eq(sesiones.id, id)).returning())[0].id
          : (await db.insert(sesiones).values({ ...v, moduloId: padreId! }).returning())[0].id;
        break;
      }
      default:
        throw new Error("Tipo no válido");
    }
  } catch (e) {
    const msg = String((e as { cause?: { code?: string } })?.cause?.code) === "23505"
      ? `Ya existe un registro con el código ${codigo}.`
      : "No se pudo guardar. Revisa los datos.";
    volver(volverA, msg);
  }
  volver(`${tipo}-${nuevoId}`);
}

export async function eliminarNodo(form: FormData) {
  await exigir("cronograma");
  const tipo = txt(form, "tipo") as Tipo;
  const id = Number(form.get("id"));
  const padre = txt(form, "padre") || undefined;
  const estructura = Number(form.get("estructura")) || undefined;
  try {
    const tabla = { c: componentes, a: actividades, m: modulos, s: sesiones }[tipo];
    await db.delete(tabla).where(eq(tabla.id, id));
  } catch {
    volver(`${tipo}-${id}`, "No se puede eliminar: tiene sesiones programadas. Elimina primero esas programaciones.");
  }
  volver(padre, undefined, estructura);
}

/* ── Estructuras (p. ej. Arequipa, Lima…) ─────────────────── */

/** Crea o renombra una estructura del programa. */
export async function guardarEstructura(form: FormData) {
  await exigir("cronograma");
  const id = Number(form.get("id")) || null;
  const nombre = txt(form, "nombre");
  const proyecto = txt(form, "proyecto") || null;
  const descripcion = txt(form, "descripcion") || null;
  if (!nombre) volver(undefined, "Escribe el nombre de la estructura.", id ?? undefined);
  let nuevo = id ?? 0;
  try {
    if (id) await db.update(estructuras).set({ nombre, proyecto, descripcion }).where(eq(estructuras.id, id));
    else nuevo = (await db.insert(estructuras).values({ nombre, proyecto, descripcion, orden: 99 }).returning())[0].id;
  } catch {
    volver(undefined, `Ya existe una estructura llamada «${nombre}».`, id ?? undefined);
  }
  volver(undefined, undefined, nuevo);
}

/** Elimina una estructura vacía (sin componentes). */
export async function eliminarEstructura(form: FormData) {
  await exigir("cronograma");
  const id = Number(form.get("id"));
  const [c] = await db.select({ id: componentes.id }).from(componentes).where(eq(componentes.estructuraId, id)).limit(1);
  if (c) volver(undefined, "Para eliminar una estructura, primero elimina sus componentes.", id);
  await db.delete(estructuras).where(eq(estructuras.id, id));
  volver();
}

function padreDe(t: Tipo): Tipo {
  return ({ a: "c", m: "a", s: "m", c: "c" } as const)[t];
}
