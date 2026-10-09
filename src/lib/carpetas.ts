/**
 * Carpeta de cada archivo según la estructura del programa:
 *   archivos/<Proyecto>/<Componente>/<Actividad>/<Módulo>/<Sesión>/ → material oficial, solo códigos
 *   archivos/<Componente>/<Actividad>/<Módulo>/<Sede -Turno- dd-mm-aaaa Sesión>/<Subcarpeta>/
 *        → lo de una fecha programada, separado en Diapositivas y material modificado · Examen · Fotos ·
 *          Lista de Asistencia · Talleres y practicas · Video (el turno solo en sedes con mañana y tarde)
 * Los nombres se recortan para no pasar el límite de rutas de Windows.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db as dbPorDefecto } from "../db";
import { actividades, componentes, modulos, participantes, programaciones, sedes, sesiones } from "../db/schema";
import { SECCIONES, type Seccion } from "./documentos";

const TURNO = { manana: "Mañana", tarde: "Tarde", noche: "Noche" } as const;
const ddmmaaaa = (iso: string) => iso.split("-").reverse().join("-");

/** Nombre válido para una carpeta de Windows (sin \ / : * ? " < > | ni punto/espacio al final). */
export function nombreCarpeta(texto: string, max = 32) {
  const limpio = texto.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio.replace(/[.\s]+$/, "") || "sin nombre";
  // Se corta en un espacio (sin partir palabras) y se marca con «…»
  const corte = limpio.slice(0, max);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[.,;\s-]+$/, "")}…`;
}

/** «1.1.2 Programa de formación…» sin repetir el código si el nombre ya lo incluye. */
const conCodigo = (codigo: string, nombre: string) => (nombre.includes(codigo) ? nombre : `${codigo} ${nombre}`);
/** Del código 1.1.2-M1-S3 se usa la última parte (S3) para no repetir la ruta completa. */
const sufijo = (codigo: string) => codigo.split("-").at(-1) ?? codigo;

export async function carpetaDe(sesionId: number, programacionId?: number | null, seccion?: Seccion | null, db = dbPorDefecto) {
  const [r] = await db
    .select({ c: componentes, a: actividades, m: modulos, s: sesiones })
    .from(sesiones)
    .innerJoin(modulos, eq(sesiones.moduloId, modulos.id))
    .innerJoin(actividades, eq(modulos.actividadId, actividades.id))
    .innerJoin(componentes, eq(actividades.componenteId, componentes.id))
    .where(eq(sesiones.id, sesionId));
  if (!r) return "sin sesion";
  if (!programacionId) {
    const prefijo = r.c.codigo.match(/^([A-Za-z][A-Za-z0-9]*)-/)?.[1];
    const proyecto = prefijo ?? `PRY-${r.c.estructuraId}`;
    const sinProyecto = (codigo: string) => prefijo && codigo.startsWith(`${prefijo}-`)
      ? codigo.slice(prefijo.length + 1)
      : codigo;
    return [proyecto, sinProyecto(r.c.codigo), sinProyecto(r.a.codigo), sufijo(r.m.codigo), sufijo(r.s.codigo)]
      .map((codigo) => nombreCarpeta(codigo, 64))
      .join("/");
  }
  const partes = [
    nombreCarpeta(conCodigo(r.c.codigo, r.c.nombre), 34),
    nombreCarpeta(conCodigo(r.a.codigo, r.a.nombre), 30),
    nombreCarpeta(`${sufijo(r.m.codigo)} ${r.m.nombre}`, 30),
  ];
  if (programacionId) {
    const [p] = await db
      .select({ fecha: programaciones.fecha, turno: programaciones.turno, sede: sedes.nombre, sedeId: sedes.id })
      .from(programaciones)
      .innerJoin(sedes, eq(programaciones.sedeId, sedes.id))
      .where(eq(programaciones.id, programacionId));
    if (p) {
      // ¿La sede tiene grupos de mañana y de tarde? (lista de turno oficial)
      const [t] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(participantes)
        .where(and(eq(participantes.sedeId, p.sedeId), inArray(participantes.turno, ["manana", "tarde"])));
      const conTurno = (t?.n ?? 0) > 0;
      const titulo = `${p.sede} ${conTurno ? `-${TURNO[p.turno]}- ` : "- "}${ddmmaaaa(p.fecha)} ${r.s.nombre}`;
      partes.push(nombreCarpeta(titulo, 85));
      partes.push(SECCIONES[seccion ?? "diapositivas"]);
      return partes.join("/");
    }
  }
  partes.push(nombreCarpeta(`${sufijo(r.s.codigo)} ${r.s.nombre}`));
  return partes.join("/");
}
