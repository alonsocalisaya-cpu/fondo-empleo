/**
 * Elimina los DATOS DE EJEMPLO que crea `npm run db:seed` y deja solo la información real
 * (capacitaciones del Excel, cronograma, y todo lo que hayas registrado tú).
 *
 *   npm run db:limpiar-ejemplo
 */
import "dotenv/config";
import { and, eq, inArray, like, or, type AnyColumn } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";

const SEDES = ["Sede Norte", "Sede Centro", "Sede Sur", "Sede Camaná"];
const COMPONENTES = ["HB", "SST", "HD"];
const CONSULTORES = [["Ana", "Torres"], ["Luis", "Paredes"], ["María", "Quispe"], ["Carlos", "Rojas"]];
const PERSONAL = [["Fernando", "Salas"], ["Patricia", "Núñez"], ["Kevin", "Mamani"], ["Lucero", "Apaza"], ["Gabriel", "Zeballos"], ["Silvia", "Chávez"]];
const PARTICIPANTES = [
  ["Rosa", "Mamani Huamán"], ["Jorge", "Castillo Vega"], ["Lucía", "Fernández Ríos"], ["Pedro", "Huaranga Soto"],
  ["Carmen", "Salazar Díaz"], ["Miguel Ángel", "Ccori Quispe"], ["Diana", "Espinoza León"], ["Raúl", "Villanueva Poma"],
  ["Sofía", "Gutiérrez Arce"], ["Andrés", "Chávez Llanos"], ["Patricia", "Ramos Céspedes"], ["Julio", "Mendoza Tello"],
  ["Elena", "Vargas Cruz"], ["Óscar", "Palomino Rey"], ["Gabriela", "Núñez Ortiz"], ["Héctor", "Cárdenas Silva"],
  ["Milagros", "Rivera Luna"], ["Iván", "Aguilar Campos"],
];
const EQUIPOS = ["PRY-01", "PRY-02", "PRY-03", "PRY-04", "LAP-01", "LAP-02", "PAR-01"];
const ACCIONES = ["Baja asistencia en Sede Sur", "Sesión sin consultor asignado"];

const porNombre = (t: { nombres: AnyColumn; apellidos: AnyColumn }, lista: string[][]) =>
  or(...lista.map(([n, a]) => and(eq(t.nombres, n), eq(t.apellidos, a))));

async function main() {
  const r = await db.transaction(async (tx) => {
    // Programaciones de ejemplo: las de las sedes de ejemplo o de las capacitaciones de ejemplo
    const sedesEj = await tx.select({ id: s.sedes.id }).from(s.sedes).where(inArray(s.sedes.nombre, SEDES));
    const sesionesEj = await tx
      .select({ id: s.sesiones.id })
      .from(s.sesiones)
      .innerJoin(s.modulos, eq(s.sesiones.moduloId, s.modulos.id))
      .innerJoin(s.actividades, eq(s.modulos.actividadId, s.actividades.id))
      .innerJoin(s.componentes, eq(s.actividades.componenteId, s.componentes.id))
      .where(inArray(s.componentes.codigo, COMPONENTES));
    const condiciones = [
      ...(sedesEj.length ? [inArray(s.programaciones.sedeId, sedesEj.map((x) => x.id))] : []),
      ...(sesionesEj.length ? [inArray(s.programaciones.sesionId, sesionesEj.map((x) => x.id))] : []),
    ];
    const progs = condiciones.length ? await tx.delete(s.programaciones).where(or(...condiciones)).returning() : [];

    const sedes = await tx.delete(s.sedes).where(inArray(s.sedes.nombre, SEDES)).returning();
    const comps = await tx.delete(s.componentes).where(inArray(s.componentes.codigo, COMPONENTES)).returning();
    // Si una persona "de ejemplo" quedó asignada en el cronograma real (mismo primer nombre), no se borra:
    // se conserva sin el apellido de ejemplo.
    const usadosCap = await tx
      .selectDistinct({ id: s.programaciones.capacitadorId })
      .from(s.programaciones)
      .where(like(s.programaciones.codigoExterno, "CRONO-%"));
    const usadosAsi = await tx
      .selectDistinct({ id: s.programaciones.asistenteId })
      .from(s.programaciones)
      .where(like(s.programaciones.codigoExterno, "CRONO-%"));
    const idsCap = usadosCap.map((x) => x.id).filter((x): x is number => x !== null);
    const idsAsi = usadosAsi.map((x) => x.id).filter((x): x is number => x !== null);
    if (idsCap.length) {
      await tx.update(s.capacitadores).set({ apellidos: "", especialidad: null })
        .where(and(porNombre(s.capacitadores, CONSULTORES), inArray(s.capacitadores.id, idsCap)));
    }
    if (idsAsi.length) {
      await tx.update(s.personal).set({ apellidos: "" })
        .where(and(porNombre(s.personal, PERSONAL), inArray(s.personal.id, idsAsi)));
    }
    const cons = await tx.delete(s.capacitadores).where(porNombre(s.capacitadores, CONSULTORES)).returning();
    const pers = await tx.delete(s.personal).where(porNombre(s.personal, PERSONAL)).returning();
    const parts = await tx.delete(s.participantes).where(porNombre(s.participantes, PARTICIPANTES)).returning();
    const eqs = await tx.delete(s.equipos).where(inArray(s.equipos.codigo, EQUIPOS)).returning();
    const docs = await tx.delete(s.documentos).where(like(s.documentos.url, "%nextcloud.ejemplo.com%")).returning();
    const acc = await tx.delete(s.accionesCorrectivas).where(inArray(s.accionesCorrectivas.titulo, ACCIONES)).returning();
    return { progs, sedes, comps, cons, pers, parts, eqs, docs, acc };
  });

  console.log("✔ Datos de ejemplo eliminados:");
  console.log(`  ${r.progs.length} programaciones · ${r.sedes.length} sedes · ${r.comps.length} componentes de ejemplo`);
  console.log(`  ${r.cons.length} consultores · ${r.pers.length} personas · ${r.parts.length} participantes`);
  console.log(`  ${r.eqs.length} equipos · ${r.docs.length} documentos · ${r.acc.length} acciones correctivas`);
  if (r.pers.length) console.log("  Recuerda registrar en Soporte › Recursos humanos al Agente Comercial, Jefe de Proyecto, Gestión Documental y Administradora reales.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✖ No se pudo limpiar:", e);
    process.exit(1);
  });
