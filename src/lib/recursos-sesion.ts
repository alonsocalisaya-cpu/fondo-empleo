export type RecursoSesion = { descripcion: string; cantidad: number; unidad: string; detalle?: string; insumoId?: number; categoria?: "material" | "refrigerio" };

export function leerEquipos(f: FormData): { equipos: RecursoSesion[]; error?: string } {
  if (f.get("sinEquipos") === "si") return { equipos: [] };
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
    .map((r) => ({ ...r }));
}

export function leerRecursos(f: FormData): { recursos: RecursoSesion[]; error?: string } {
  if (f.get("sinRecursos") === "si") return { recursos: [] };
  const nombres = f.getAll("recursoDescripcion");
  const cantidades = f.getAll("recursoCantidad");
  const detalles = f.getAll("recursoDetalle");
  const inventario = f.getAll("recursoInsumoId");
  const categorias = f.getAll("recursoCategoria");
  const unidades = f.getAll("recursoUnidad");
  if (nombres.length > 100 || nombres.length !== cantidades.length || (categorias.length > 0 && categorias.length !== nombres.length) || (inventario.length > 0 && inventario.length !== nombres.length)) return { recursos: [], error: "Revisa la lista de refrigerios y materiales solicitados." };
  const recursos: RecursoSesion[] = [];
  for (let i = 0; i < nombres.length; i++) {
    const descripcion = String(nombres[i]).trim();
    const cantidadTexto = String(cantidades[i]).trim();
    if (!descripcion && !cantidadTexto) continue;
    const cantidad = Number(cantidades[i]);
    const detalle = String(detalles[i] ?? "").trim();
    const categoriaTexto = String(categorias[i] ?? "").trim();
    const categoria = categoriaTexto === "refrigerio" || categoriaTexto === "material"
      ? categoriaTexto
      : ["gaseosas", "galletas"].includes(descripcion.toLowerCase()) ? "refrigerio" : "material";
    if (detalle.length > 1000) return { recursos: [], error: "Los detalles de cada recurso admiten hasta 1000 caracteres." };
    if (!descripcion || descripcion.length > 200 || !Number.isSafeInteger(cantidad) || cantidad < 1) {
      return { recursos: [], error: "Completa cada artículo con su nombre y una cantidad entera mayor que cero." };
    }
    const insumoId = Number(inventario[i]);
    const unidad = String(unidades[i] ?? "unidad").trim().slice(0, 40) || "unidad";
    recursos.push({ descripcion, cantidad, unidad, categoria, ...(detalle ? { detalle } : {}), ...(Number.isSafeInteger(insumoId) && insumoId > 0 ? { insumoId } : {}) });
  }
  return { recursos };
}
