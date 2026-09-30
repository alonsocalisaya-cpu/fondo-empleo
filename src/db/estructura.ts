/**
 * Carga la estructura de capacitaciones (Componente › Actividad › Módulo › Sesión)
 * desde datos/capacitaciones.json. Actualiza por código: si ya existe, lo actualiza; si no, lo crea.
 */
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db as dbPorDefecto } from "./index";
import * as s from "./schema";
import estructura from "../../datos/capacitaciones.json";

type SesionJson = { codigo: string; nombre: string; explicacion: string | null; contenido: string | null; recurso: string | null; perfil: string | null };
type ModuloJson = { codigo: string; nombre: string; sesiones: SesionJson[] };
type ActividadJson = { codigo: string; nombre: string; modulos: ModuloJson[] };
type ComponenteJson = { codigo: string; nombre: string; actividades: ActividadJson[] };

export const ESTRUCTURA = estructura as ComponenteJson[];

export async function importarEstructura(opciones: { reemplazar?: boolean } = {}, db = dbPorDefecto) {
  const res = { componentes: 0, actividades: 0, modulos: 0, sesiones: 0, eliminadas: 0 };
  const codigosSesion: string[] = [];
  const codigosComp: string[] = [];
  // Esta carga es la de la estructura «Arequipa» (datos/capacitaciones.json)
  const [areq] = await db
    .insert(s.estructuras)
    .values({ nombre: "Arequipa", orden: 1 })
    .onConflictDoUpdate({ target: s.estructuras.nombre, set: { nombre: "Arequipa" } })
    .returning();

  for (const [ci, c] of ESTRUCTURA.entries()) {
    codigosComp.push(c.codigo);
    const [comp] = await db
      .insert(s.componentes)
      .values({ estructuraId: areq.id, codigo: c.codigo, nombre: c.nombre, orden: ci + 1 })
      .onConflictDoUpdate({ target: s.componentes.codigo, set: { orden: ci + 1 } }) // el nombre editado en el sistema se respeta
      .returning();
    res.componentes++;

    for (const [ai, a] of c.actividades.entries()) {
      const [act] = await db
        .insert(s.actividades)
        .values({ componenteId: comp.id, codigo: a.codigo, nombre: a.nombre, orden: ai + 1 })
        .onConflictDoUpdate({ target: s.actividades.codigo, set: { componenteId: comp.id, nombre: a.nombre, orden: ai + 1 } })
        .returning();
      res.actividades++;

      for (const [mi, m] of a.modulos.entries()) {
        const [mod] = await db
          .insert(s.modulos)
          .values({ actividadId: act.id, codigo: m.codigo, nombre: m.nombre, orden: mi + 1 })
          .onConflictDoUpdate({ target: s.modulos.codigo, set: { actividadId: act.id, nombre: m.nombre, orden: mi + 1 } })
          .returning();
        res.modulos++;

        for (const [si, x] of m.sesiones.entries()) {
          const datos = {
            moduloId: mod.id,
            nombre: x.nombre,
            objetivo: x.explicacion,
            contenido: x.contenido,
            recursoMetodologico: x.recurso,
            perfilSalida: x.perfil,
            orden: si + 1,
          };
          await db
            .insert(s.sesiones)
            .values({ codigo: x.codigo, ...datos })
            .onConflictDoUpdate({ target: s.sesiones.codigo, set: datos });
          codigosSesion.push(x.codigo);
          res.sesiones++;
        }
      }
    }
  }

  if (opciones.reemplazar) {
    // Elimina la estructura que no está en el Excel (y las programaciones de esas sesiones)
    // Solo dentro de la estructura de Arequipa: las demás estructuras no se tocan
    const viejas = await db
      .select({ id: s.sesiones.id })
      .from(s.sesiones)
      .innerJoin(s.modulos, eq(s.sesiones.moduloId, s.modulos.id))
      .innerJoin(s.actividades, eq(s.modulos.actividadId, s.actividades.id))
      .innerJoin(s.componentes, eq(s.actividades.componenteId, s.componentes.id))
      .where(and(eq(s.componentes.estructuraId, areq.id), notInArray(s.sesiones.codigo, codigosSesion)));
    if (viejas.length) {
      const ids = viejas.map((v) => v.id);
      await db.delete(s.programaciones).where(inArray(s.programaciones.sesionId, ids));
      await db.delete(s.sesiones).where(inArray(s.sesiones.id, ids));
      res.eliminadas = ids.length;
    }
    await db.delete(s.componentes).where(and(eq(s.componentes.estructuraId, areq.id), notInArray(s.componentes.codigo, codigosComp))); // borra en cascada actividades y módulos
  }
  return res;
}
