import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { db as DB } from "@/db";
import { insumos, movimientosInsumo } from "@/db/schema";

type Tx = Parameters<Parameters<typeof DB.transaction>[0]>[0];

/**
 * Saca material del inventario para una sesión (salida) o lo devuelve (entrada).
 * Bloquea las filas para que dos personas no descuenten el mismo stock a la vez.
 * Devuelve un mensaje de error si alguna salida supera el stock disponible.
 */
export async function moverStock(
  tx: Tx,
  tipo: "salida" | "entrada",
  lineas: { insumoId: number; cantidad: number }[],
  programacionId: number,
  motivo: string,
): Promise<string | null> {
  if (!lineas.length) return null;
  const filas = await tx.select().from(insumos).where(inArray(insumos.id, lineas.map((l) => l.insumoId))).for("update");
  const porId = new Map(filas.map((f) => [f.id, f]));
  for (const l of lineas) {
    const i = porId.get(l.insumoId);
    if (!i) return "Un ítem del inventario ya no existe.";
    const nuevo = tipo === "salida" ? i.stock - l.cantidad : i.stock + l.cantidad;
    if (nuevo < 0) return `Stock insuficiente de ${i.nombre}: hay ${i.stock} ${i.unidad} y se piden ${l.cantidad}.`;
    i.stock = nuevo;
    await tx.update(insumos).set({ stock: nuevo }).where(eq(insumos.id, i.id));
    await tx.insert(movimientosInsumo).values({ insumoId: i.id, tipo, cantidad: l.cantidad, stockResultante: nuevo, programacionId, motivo });
  }
  return null;
}
