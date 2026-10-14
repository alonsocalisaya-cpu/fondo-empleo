import type { PasoRegistro } from "@/db/schema";

export type LineaStock = { insumoId: number; cantidad: number };

/** Saldo que permanece fuera del almacén, solo para registros vinculados nuevos. */
export function saldoRecursos(pasos: Record<string, PasoRegistro>): LineaStock[] {
  const saldo = new Map<number, number>();
  for (const [clave, signo] of [["revisar_recursos", 1], ["recursos_post", -1]] as const) {
    const lineas = pasos[clave]?.stockLineas as LineaStock[] | undefined;
    for (const l of lineas ?? []) saldo.set(l.insumoId, (saldo.get(l.insumoId) ?? 0) + signo * l.cantidad);
  }
  return [...saldo].filter(([, cantidad]) => cantidad !== 0).map(([insumoId, cantidad]) => ({ insumoId, cantidad }));
}

export function diferenciaStock(antes: LineaStock[], despues: LineaStock[]): LineaStock[] {
  const ids = [...new Set([...antes, ...despues].map((l) => l.insumoId))].sort((a, b) => a - b);
  return ids.map((insumoId) => ({ insumoId, cantidad: (despues.find((l) => l.insumoId === insumoId)?.cantidad ?? 0) - (antes.find((l) => l.insumoId === insumoId)?.cantidad ?? 0) })).filter((l) => l.cantidad !== 0);
}
