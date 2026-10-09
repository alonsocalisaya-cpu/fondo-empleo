export type RecursoSesion = { descripcion: string; cantidad: number; unidad: string; detalle?: string };

export function leerEquipos(f: FormData): { equipos: RecursoSesion[]; error?: string } {
  const nombres = f.getAll("equipoDescripcion");
  const cantidades = f.getAll("equipoCantidad");
  const detalles = f.getAll("equipoDetalle");
  if (nombres.length > 100 || nombres.length !== cantidades.length) return { equipos: [], error: "Revisa la lista de equipos solicitados." };
  const equipos: RecursoSesion[] = [];
  for (let i = 0; i < nombres.length; i++) {
    const descripcion = String(nombres[i]).trim();
    const cantidad = Number(cantidades[i]);
    const detalle = String(detalles[i] ?? "").trim();
    if (detalle.length > 1000) return { equipos: [], error: "Los detalles de cada equipo admiten hasta 1000 caracteres." };
    if (!descripcion || descripcion.length > 200 || !String(cantidades[i]).trim() || !Number.isSafeInteger(cantidad) || cantidad < 0) return { equipos: [], error: "Indica el nombre de cada equipo y un número entero de unidades desde cero." };
    if (cantidad > 0) equipos.push({ descripcion, cantidad, unidad: "unidad", ...(detalle ? { detalle } : {}) });
  }
  return { equipos };
}

export function recursosDe(valor: unknown): RecursoSesion[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((r): r is RecursoSesion => r != null && typeof r === "object"
    && typeof r.descripcion === "string" && typeof r.cantidad === "number" && typeof r.unidad === "string")
    .map((r) => ({ ...r, unidad: "unidad" }));
}

export function leerRecursos(f: FormData): { recursos: RecursoSesion[]; error?: string } {
  if (f.get("sinRecursos") === "si") return { recursos: [] };
  const nombres = f.getAll("recursoDescripcion");
  const cantidades = f.getAll("recursoCantidad");
  const detalles = f.getAll("recursoDetalle");
  if (!nombres.length || nombres.length > 100 || nombres.length !== cantidades.length) {
    return { recursos: [], error: "Completa la solicitud con gaseosas y galletas, indicando sus unidades." };
  }
  const recursos: RecursoSesion[] = [];
  for (let i = 0; i < nombres.length; i++) {
    const descripcion = String(nombres[i]).trim();
    const cantidad = Number(cantidades[i]);
    const detalle = String(detalles[i] ?? "").trim();
    if (detalle.length > 1000) return { recursos: [], error: "Los detalles de cada recurso admiten hasta 1000 caracteres." };
    if (!descripcion || descripcion.length > 200 || !Number.isSafeInteger(cantidad) || cantidad < 1) {
      return { recursos: [], error: "Completa cada recurso con su nombre y un número entero de unidades mayor que cero." };
    }
    recursos.push({ descripcion, cantidad, unidad: "unidad", ...(detalle ? { detalle } : {}) });
  }
  if (!["gaseosas", "galletas"].every((nombre) => recursos.some((r) => r.descripcion.toLowerCase() === nombre))) {
    return { recursos: [], error: "La solicitud debe incluir gaseosas y galletas." };
  }
  return { recursos };
}
