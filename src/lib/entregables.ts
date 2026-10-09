import { seccionDe, type Seccion } from "./documentos";

export const MINIMO_FOTOS = 10;
export const ES_FOTO = /\.(jpe?g|png|heic)$/i;
export const ES_VIDEO = /\.(mp4|mov|avi|3gp)$/i;

/** Categorías del expediente de una programación; reutilizan los tipos del repositorio. */
export const ENTREGABLES: { seccion: Seccion; titulo: string; tipo: string; accept?: string }[] = [
  { seccion: "diapositivas", titulo: "Diapositivas", tipo: "diapositiva" },
  { seccion: "talleres", titulo: "Talleres o prácticas", tipo: "taller" },
  { seccion: "lista_asistencia", titulo: "Lista de asistencia", tipo: "evidencia" },
  { seccion: "examen", titulo: "Exámenes", tipo: "examen_entrada" },
  { seccion: "fotos", titulo: "Fotos", tipo: "evidencia", accept: ".jpg,.jpeg,.png,.heic" },
  { seccion: "video", titulo: "Videos", tipo: "evidencia", accept: ".mp4,.mov,.avi,.3gp" },
  { seccion: "viaticos", titulo: "Viáticos", tipo: "ficha" },
];

type DocumentoEntregable = { tipo: string; seccion?: string | null; archivo?: string | null; nombre?: string | null };
export function fotosEntregadas(documentos: DocumentoEntregable[]) {
  return documentos.filter((d) => seccionDe(d) === "fotos" && d.archivo && ES_FOTO.test(d.archivo)).length;
}

export function validarEntregable(seccion: Seccion | null, nombre: string) {
  if (seccion === "fotos" && !ES_FOTO.test(nombre)) return "Selecciona fotos en formato JPG, PNG o HEIC.";
  if (seccion === "video" && !ES_VIDEO.test(nombre)) return "Selecciona videos en formato MP4, MOV, AVI o 3GP.";
  return null;
}
