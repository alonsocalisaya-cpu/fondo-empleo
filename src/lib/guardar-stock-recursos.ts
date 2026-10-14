import "server-only";
import { isDeepStrictEqual } from "node:util";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { preparaciones, programaciones, type PasoRegistro } from "@/db/schema";
import { moverStock } from "./stock";
import { diferenciaStock, saldoRecursos } from "./stock-recursos";

/** Movimiento y confirmación se guardan juntos; un doble envío no duplica salidas. */
export async function guardarStockRecursos(id: number, antes: Record<string, PasoRegistro>, pasos: Record<string, PasoRegistro>, clave: string) {
  await db.transaction(async (tx) => {
    await tx.select({ id: programaciones.id }).from(programaciones).where(eq(programaciones.id, id)).for("update");
    const [actual] = await tx.select().from(preparaciones).where(eq(preparaciones.programacionId, id)).for("update");
    if (!isDeepStrictEqual(actual?.pasos ?? {}, antes)) throw new Error("La sesión cambió. Recarga la página antes de continuar.");
    const cambios = diferenciaStock(saldoRecursos(antes), saldoRecursos(pasos));
    for (const l of cambios) {
      const error = await moverStock(tx, l.cantidad > 0 ? "salida" : "entrada", [{ insumoId: l.insumoId, cantidad: Math.abs(l.cantidad) }], id, `${pasos[clave] ? "Confirmación" : "Se deshizo"} · ${clave === "revisar_recursos" ? "recursos aprobados" : "devolución de recursos"} · sesión #${id}`);
      if (error) throw new Error(error);
    }
    await tx.insert(preparaciones).values({ programacionId: id, pasos }).onConflictDoUpdate({ target: preparaciones.programacionId, set: { pasos, actualizadoEn: sql`now()` } });
    if (clave === "revisar_recursos") await tx.update(programaciones).set({ estado: pasos[clave] ? "confirmada" : "programada" }).where(eq(programaciones.id, id));
  });
}
