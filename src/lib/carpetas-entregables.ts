export type CarpetaEntregable = { id: string; nombre: string; descripcion: string };

export function carpetasEntregables(registro: unknown): CarpetaEntregable[] {
  const lista = (registro as { carpetas?: unknown } | undefined)?.carpetas;
  if (!Array.isArray(lista)) return [];
  return lista.filter((c): c is CarpetaEntregable => !!c && typeof c.id === "string" && /^[a-f0-9]{12}$/.test(c.id) && typeof c.nombre === "string" && typeof c.descripcion === "string");
}

export const versionCarpeta = (id: string) => `carpeta_${id}`;
