export type ActividadViaje = { actividad: string; descripcion: string; fecha: string; hora: string };
export const MAX_ACTIVIDADES_VIAJE = 13;

export function leerActividadesViaje(valor: unknown): { actividades: ActividadViaje[]; error?: string } {
  if (!Array.isArray(valor) || !valor.length || valor.length > MAX_ACTIVIDADES_VIAJE) return { actividades: [], error: "Completa entre 1 y 13 actividades del programa de viaje." };
  const actividades: ActividadViaje[] = [];
  for (const fila of valor) {
    if (!fila || typeof fila !== "object") return { actividades: [], error: "Actividad de viaje no válida." };
    const actividad = String(fila.actividad ?? "").trim();
    const descripcion = String(fila.descripcion ?? "").trim();
    const fecha = String(fila.fecha ?? "");
    const hora = String(fila.hora ?? "");
    const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha;
    if (!actividad || actividad.length > 120 || !descripcion || descripcion.length > 500 || !fechaValida || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return { actividades: [], error: "Completa cada fila con Actividad, Descripción, Fecha y Hora válidas (actividad: hasta 120 caracteres; descripción: hasta 500)." };
    actividades.push({ actividad, descripcion, fecha, hora });
  }
  return { actividades };
}
