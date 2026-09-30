/**
 * Importa los beneficiarios desde datos/beneficiarios.json (Excel "LISTAS DE TURNO OFICIAL"):
 * crea/actualiza cada participante (por DNI) con su sede y turno, y lo inscribe en las sesiones
 * programadas que le corresponden. Es seguro ejecutarlo varias veces.
 */
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import datos from "../../datos/beneficiarios.json";
import { inscribirBeneficiarios } from "./inscribir";

type Fila = { sede: string; turno: string; apellidos: string; nombres: string; dni: string; nota: string | null };

/** ¿Ya están en la base todos los DNI de la lista? (si se agregan personas a la lista, se vuelve a importar) */
export async function yaImportados() {
  const dnis = (datos.beneficiarios as Fila[]).map((b) => b.dni);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.participantes).where(inArray(s.participantes.dni, dnis));
  return n >= dnis.length;
}

export async function importarBeneficiarios() {
  const sedes = await db.select().from(s.sedes);
  const idSede = new Map(sedes.map((x) => [x.nombre.toLowerCase(), x.id]));
  const sinSede = new Set<string>();
  let nuevos = 0;
  let actualizados = 0;
  for (const b of datos.beneficiarios as Fila[]) {
    let sedeId = idSede.get(b.sede.toLowerCase());
    if (!sedeId) {
      sinSede.add(b.sede);
      const [n] = await db.insert(s.sedes).values({ nombre: b.sede }).onConflictDoNothing().returning();
      sedeId = n?.id ?? (await db.select().from(s.sedes).where(eq(s.sedes.nombre, b.sede)))[0].id;
      idSede.set(b.sede.toLowerCase(), sedeId);
    }
    const [r] = await db
      .insert(s.participantes)
      .values({ nombres: b.nombres, apellidos: b.apellidos, dni: b.dni, sedeId, turno: b.turno, area: b.nota })
      .onConflictDoUpdate({
        target: s.participantes.dni,
        set: { nombres: b.nombres, apellidos: b.apellidos, sedeId, turno: b.turno },
      })
      .returning({ nuevo: sql<boolean>`(xmax = 0)` });
    if (r.nuevo) nuevos++;
    else actualizados++;
  }
  const inscripciones = await inscribirBeneficiarios();
  return { total: datos.beneficiarios.length, nuevos, actualizados, omitidos: (datos.omitidos as unknown[]).length, inscripciones, sinSede: [...sinSede] };
}
