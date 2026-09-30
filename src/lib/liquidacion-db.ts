import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liquidaciones, type PasoRegistro } from "@/db/schema";
import { GASTOS, type Ficha2 } from "./ficha2";
import { hoyISO, TURNO_LABEL } from "./fechas";
import { MAX_LINEAS, redondear, type DatosLiquidacion, type LineaGasto } from "./liquidacion";

const dma = (iso: string) => iso.split("-").reverse().join("/");
const nombreDe = (x: { nombres: string; apellidos: string } | null | undefined) => (x ? `${x.nombres} ${x.apellidos}`.trim() : "");

type Prog = {
  id: number;
  fecha: string;
  turno: keyof typeof TURNO_LABEL;
  sesion: { nombre: string };
  combinadas?: { sesion: { nombre: string } }[];
  sede: { nombre: string };
  asistente?: { nombres: string; apellidos: string } | null;
  capacitador?: { nombres: string; apellidos: string } | null;
};

/**
 * Liquidación guardada de la sesión o, si aún no hay, una propuesta armada con lo que el sistema ya sabe:
 * nombre del asistente, puesto, sesión / sede / fecha, monto entregado y los gastos de la 2da sección de la ficha.
 */
export async function liquidacionDe(p: Prog, pasos: Record<string, PasoRegistro>): Promise<{ datos: DatosLiquidacion; guardada: boolean; actualizadoEn: Date | null }> {
  const g = await db.query.liquidaciones.findFirst({ where: eq(liquidaciones.programacionId, p.id) });
  if (g) return { datos: g.datos, guardada: true, actualizadoEn: g.actualizadoEn };

  const monto = (k: string) => Number((pasos[k] as Record<string, unknown> | undefined)?.monto ?? 0);
  const f2 = (pasos.llenar_ficha2 ?? {}) as Ficha2;
  const lineas: LineaGasto[] = GASTOS.filter((x) => f2.gastos?.[x.k]).map((x) => ({
    descripcion: x.t,
    cantidad: 1,
    unidad: "",
    monto: redondear(f2.gastos![x.k]),
    comprobante: "",
    obs: "",
  }));
  const sesiones = [p.sesion.nombre, ...(p.combinadas ?? []).map((c) => c.sesion.nombre)].join(" + ");
  return {
    guardada: false,
    actualizadoEn: null,
    datos: {
      osft: "",
      fecha: dma(hoyISO()),
      nombre: nombreDe(p.asistente) || nombreDe(p.capacitador),
      puesto: p.asistente ? "Asistente de Capacitación" : "Capacitador",
      descripcion: `Capacitación «${sesiones}» – ${p.sede.nombre}, ${dma(p.fecha)} (turno ${TURNO_LABEL[p.turno].toLowerCase()})`,
      cliente: "FONDOEMPLEO",
      presupuestado: monto("entregar_viaticos") || monto("solicitar_viaticos"),
      lineas: lineas.slice(0, MAX_LINEAS),
    },
  };
}

/** Valida y normaliza lo que llega del formulario (JSON). Devuelve un mensaje si algo está mal. */
export function leerLiquidacion(json: string): DatosLiquidacion | string {
  let d: DatosLiquidacion;
  try {
    d = JSON.parse(json);
  } catch {
    return "No se pudo leer la liquidación.";
  }
  const t = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const lineas = (Array.isArray(d.lineas) ? d.lineas : [])
    .map((l) => ({
      descripcion: t(l.descripcion, 120),
      cantidad: l.cantidad === null || String(l.cantidad).trim() === "" ? null : Number(l.cantidad),
      unidad: t(l.unidad, 12),
      monto: redondear(Number(l.monto) || 0),
      comprobante: t(l.comprobante, 40),
      obs: t(l.obs, 120),
    }))
    .filter((l) => l.descripcion || l.monto || l.comprobante);
  if (lineas.length > MAX_LINEAS) return `El formato tiene espacio para ${MAX_LINEAS} gastos.`;
  const mala = lineas.findIndex((l) => !l.descripcion || !(l.monto > 0) || (l.cantidad != null && !(l.cantidad > 0)));
  if (mala >= 0) return `Gasto N° ${mala + 1}: indica la descripción, un monto mayor a 0 y una cantidad válida.`;
  const presupuestado = redondear(Number(d.presupuestado) || 0);
  if (presupuestado < 0) return "El monto presupuestado no es válido.";
  return {
    osft: t(d.osft, 40),
    fecha: t(d.fecha, 10),
    nombre: t(d.nombre, 120),
    puesto: t(d.puesto, 80),
    descripcion: t(d.descripcion, 250),
    cliente: t(d.cliente, 120),
    presupuestado,
    lineas,
  };
}

export async function guardarLiquidacionDb(programacionId: number, datos: DatosLiquidacion, por: string) {
  await db
    .insert(liquidaciones)
    .values({ programacionId, datos, actualizadoPor: por })
    .onConflictDoUpdate({ target: liquidaciones.programacionId, set: { datos, actualizadoPor: por, actualizadoEn: new Date() } });
}
