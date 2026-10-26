/**
 * Inscribe automáticamente en la sede seleccionada, que ya identifica el grupo/horario.
 * El campo antiguo de turno del beneficiario no interviene en la inscripción.
 * Solo agrega: nunca quita inscripciones (para no perder asistencias ya registradas).
 */
import { sql } from "drizzle-orm";
import { db as dbPorDefecto } from "./index";

type Db = Pick<typeof dbPorDefecto, "execute">;

export async function inscribirBeneficiarios(
  programacionIds?: number[],
  db: Db = dbPorDefecto,
  /** Opcional: solo este beneficiario y/o solo sesiones desde esta fecha (p. ej. al cambiarlo de sede). */
  solo?: { participanteId?: number; desde?: string },
): Promise<number> {
  const filtro = programacionIds?.length ? sql`and p.id in (${sql.join(programacionIds.map((i) => sql`${i}`), sql`, `)})` : sql``;
  const deQuien = solo?.participanteId ? sql`and b.id = ${solo.participanteId}` : sql``;
  const desde = solo?.desde ? sql`and p.fecha >= ${solo.desde}` : sql``;
  const r = await db.execute(sql`
    insert into inscripciones (programacion_id, participante_id)
    select p.id, b.id
    from programaciones p
    join participantes b on b.sede_id = p.sede_id
    where p.estado <> 'cancelada'
      ${filtro}
      ${deQuien}
      ${desde}
    on conflict (programacion_id, participante_id) do nothing
  `);
  return (r as unknown as { rowCount?: number }).rowCount ?? 0;
}
