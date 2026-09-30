"use server";

import { exigir, permitir } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { equipos, insumos, movimientosInsumo, tipoEquipoEnum, type TipoEquipo } from "@/db/schema";

export type Res = { ok?: string; error?: string } | undefined;
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const entero = (f: FormData, k: string) => {
  const n = Number(f.get(k));
  return Number.isInteger(n) ? n : NaN;
};
const duplicado = (e: unknown) => (e as { cause?: { code?: string } })?.cause?.code === "23505";

/* ── Logística: materiales e insumos ─────────────────────── */

export async function crearInsumo(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("logistica");
  if (!perm.u) return { error: perm.error };
  const nombre = txt(f, "nombre");
  const categoria = txt(f, "categoria");
  const stock = entero(f, "stock") || 0;
  const stockMinimo = entero(f, "stockMinimo") || 0;
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (categoria !== "material" && categoria !== "refrigerio") return { error: "Elige la categoría." };
  if (stock < 0 || stockMinimo < 0) return { error: "Las cantidades no pueden ser negativas." };
  try {
    await db.transaction(async (tx) => {
      const [i] = await tx
        .insert(insumos)
        .values({ nombre, categoria, unidad: txt(f, "unidad") ?? "unidades", stock, stockMinimo })
        .returning();
      if (stock > 0) {
        await tx.insert(movimientosInsumo).values({ insumoId: i.id, tipo: "entrada", cantidad: stock, stockResultante: stock, motivo: "Stock inicial" });
      }
    });
  } catch (e) {
    return { error: duplicado(e) ? "Ya existe un ítem con ese nombre." : "No se pudo guardar." };
  }
  revalidatePath("/soporte/logistica");
  return { ok: `«${nombre}» agregado al inventario.` };
}

/** Entrada (compra/reposición), salida (uso en capacitación) o ajuste (conteo físico). */
export async function registrarMovimiento(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("logistica");
  if (!perm.u) return { error: perm.error };
  const insumoId = Number(f.get("insumoId"));
  const tipo = txt(f, "tipo");
  const cantidad = entero(f, "cantidad");
  const motivo = txt(f, "motivo")?.slice(0, 200) ?? null;
  const programacionId = Number(f.get("programacionId")) || null;
  if (tipo !== "entrada" && tipo !== "salida" && tipo !== "ajuste") return { error: "Elige el tipo de movimiento." };
  if (Number.isNaN(cantidad) || cantidad < 0 || (tipo !== "ajuste" && cantidad === 0)) {
    return { error: tipo === "ajuste" ? "Indica el stock contado (0 o más)." : "Indica una cantidad mayor a 0." };
  }

  try {
    const r = await db.transaction(async (tx) => {
      const [i] = await tx.select().from(insumos).where(eq(insumos.id, insumoId)).for("update");
      if (!i) return { error: "El ítem ya no existe." };
      const nuevo = tipo === "entrada" ? i.stock + cantidad : tipo === "salida" ? i.stock - cantidad : cantidad;
      if (nuevo < 0) return { error: `Stock insuficiente: solo hay ${i.stock} ${i.unidad} de ${i.nombre}.` };
      await tx.update(insumos).set({ stock: nuevo }).where(eq(insumos.id, i.id));
      await tx.insert(movimientosInsumo).values({ insumoId: i.id, tipo, cantidad, stockResultante: nuevo, programacionId, motivo });
      const verbo = tipo === "entrada" ? `+${cantidad}` : tipo === "salida" ? `−${cantidad}` : "ajustado";
      return { ok: `${i.nombre}: ${verbo} → stock ${nuevo} ${i.unidad}.` };
    });
    revalidatePath("/soporte/logistica");
    return r;
  } catch {
    return { error: "No se pudo registrar el movimiento." };
  }
}

export async function actualizarMinimo(f: FormData) {
  await exigir("logistica");
  const min = Number(f.get("stockMinimo"));
  if (!Number.isInteger(min) || min < 0) return;
  await db.update(insumos).set({ stockMinimo: min }).where(eq(insumos.id, Number(f.get("id"))));
  revalidatePath("/soporte/logistica");
}

export async function alternarInsumo(f: FormData) {
  await exigir("logistica");
  await db.update(insumos).set({ activo: sql`not ${insumos.activo}` }).where(eq(insumos.id, Number(f.get("id"))));
  revalidatePath("/soporte/logistica");
}

/* ── Mantenimiento: equipos ──────────────────────────────── */

export async function crearEquipo(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("mantenimiento");
  if (!perm.u) return { error: perm.error };
  const codigo = txt(f, "codigo")?.toUpperCase() ?? null;
  const tipo = txt(f, "tipo") as TipoEquipo;
  if (!tipoEquipoEnum.enumValues.includes(tipo)) return { error: "Elige el tipo de equipo." };
  if (!codigo) return { error: "El código es obligatorio." };
  const nombre = txt(f, "nombre") ?? "—";
  try {
    await db.insert(equipos).values({
      codigo,
      tipo,
      nombre,
      serie: txt(f, "serie"),
      sedeId: Number(f.get("sedeId")) || null,
      observacion: txt(f, "observacion"),
    });
  } catch (e) {
    return { error: duplicado(e) ? "Ya existe un equipo con ese código." : "No se pudo guardar." };
  }
  revalidatePath("/", "layout");
  return { ok: `Equipo ${codigo} registrado.` };
}
