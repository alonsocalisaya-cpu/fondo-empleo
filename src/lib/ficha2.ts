/** 2da sección de la ficha de capacitación (post-capacitación): definición de sus partes. */

export const ENTREGABLES = [
  { k: "diapositivas", t: "Diapositivas y material de exposición" },
  { k: "lista", t: "Lista de asistencia" },
  { k: "evaluaciones", t: "Evaluaciones (si corresponde)", siCorresponde: true },
  { k: "notas", t: "Listado de notas (si corresponde)", siCorresponde: true },
  { k: "fotos", t: "Registro fotográfico" },
  { k: "video", t: "Video (10 min)" },
] as const;

export const PREGUNTAS_PREPARACION = [
  { k: "cambio_fecha", t: "¿Hubo algún cambio en la fecha u horario de la capacitación?" },
  { k: "traslado", t: "¿Hubo algún problema con el traslado?" },
  { k: "proveedores", t: "¿Hubo algún problema con la coordinación de proveedores?" },
  { k: "local", t: "¿Hubo algún problema con el local o mobiliario?" },
] as const;

export const GASTOS = [
  { k: "movilidad", t: "Movilidad / pasajes" },
  { k: "alimentacion", t: "Alimentación" },
  { k: "materiales", t: "Materiales / impresiones" },
  { k: "otros", t: "Otros" },
] as const;

/** Lo que queda guardado en el registro de «llenar_ficha2». */
export type Ficha2 = {
  horaLlegada?: string | null;
  horaInicioReal?: string;
  horaFinReal?: string;
  incidencias?: string | null;
  obsCapacitador?: string | null;
  programados?: number;
  asistentes?: number;
  pctAsistencia?: number | null;
  entregables?: Record<string, "completo" | "incompleto" | "no_corresponde">;
  preparacion?: Record<string, { hubo: boolean; detalle: string | null }>;
  feedback?: string | null;
  devoluciones?: { itemId: number; insumoId: number; nombre: string; salio: number; cantidad: number }[];
  equipos?: { equipoId: number; equipo: string; falla: boolean; correccion: boolean; detalle: string | null }[];
  gastos?: Record<string, number>;
  totalGastos?: number;
  gastosDetalle?: string | null;
};

/** Documentos que revisa el asistente antes de armar el entregable (actividad «Revisar toda la documentación»). */
export const DOCUMENTOS_REVISION = [
  { k: "ficha", t: "Ficha de capacitación (1ra y 2da sección)" },
  ...ENTREGABLES.map((x) => ({ k: x.k, t: x.t.replace(" (si corresponde)", "") })),
  { k: "viaticos", t: "Liquidación de viáticos" },
] as const;
