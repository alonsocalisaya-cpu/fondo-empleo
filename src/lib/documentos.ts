/** Enlace para abrir/descargar un documento: archivo subido al sistema o enlace externo. */
export const enlaceDoc = (d: { id: number; archivo: string | null; url: string | null }) => (d.archivo ? `/archivos/${d.id}` : d.url ?? "#");

export const tamanoLegible = (b: number | null) =>
  b == null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

export const TIPO_DOC = {
  diapositiva: "Diapositivas",
  taller: "Taller",
  examen_entrada: "Examen de entrada",
  examen_salida: "Examen de salida",
  ficha: "Ficha / formato",
  otro: "Otro",
  evidencia: "Evidencia (formatos, fotos, video)",
} as const;

/** Etiqueta para documentos propios de una fecha programada (no el material oficial de la sesión). */
export const origenDoc = (d: { programacionId: number | null; tipo: string; version: string | null }) =>
  !d.programacionId ? null : d.tipo === "evidencia" ? "Evidencia" : d.version === "corregido" ? "Corregido" : "Personalizado";

/** Subcarpetas de cada fecha programada (como en la carpeta compartida del proyecto). */
export const SECCIONES = {
  diapositivas: "Diapositivas y material modificado",
  examen: "Examen",
  fotos: "Fotos",
  lista_asistencia: "Lista de Asistencia",
  talleres: "Talleres y practicas",
  video: "Video",
  viaticos: "Viáticos",
} as const;
export type Seccion = keyof typeof SECCIONES;
export const esSeccion = (v: unknown): v is Seccion => typeof v === "string" && v in SECCIONES;

const EXT_VIDEO = /\.(mp4|mov|avi|3gp)$/i;
const EXT_FOTO = /\.(jpe?g|png|heic)$/i;

/** Subcarpeta de un documento de una fecha: la elegida al subir o, si no, según su tipo y extensión. */
export function seccionDe(d: { tipo: string; seccion?: string | null; archivo?: string | null; nombre?: string | null }): Seccion {
  if (esSeccion(d.seccion)) return d.seccion;
  if (d.tipo === "taller") return "talleres";
  if (d.tipo === "examen_entrada" || d.tipo === "examen_salida") return "examen";
  if (d.tipo === "evidencia") {
    const n = d.archivo ?? d.nombre ?? "";
    return EXT_VIDEO.test(n) ? "video" : EXT_FOTO.test(n) ? "fotos" : "lista_asistencia";
  }
  return "diapositivas";
}
