/**
 * Inscribe automáticamente a los beneficiarios en las sesiones programadas de su sede y turno
 * (lista de turno oficial). Un beneficiario de turno "ambos" va a las sesiones de ambos registros del mismo local.
 * La sede "Paucarpata virtual" recibe a TODOS los beneficiarios de "Paucarpata" (son los mismos), sin importar el turno.
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
    join sedes sp on sp.id = p.sede_id
    join participantes b on b.sede_id is not null
    join sedes sb on sb.id = b.sede_id
    where p.estado <> 'cancelada'
      and sp.estructura_id = sb.estructura_id
      and sp.grupo = sb.grupo
      and (b.turno = 'ambos' or b.turno = p.turno::text or sp.nombre = 'Paucarpata virtual')
      ${filtro}
      ${deQuien}
      ${desde}
    on conflict (programacion_id, participante_id) do nothing
  `);
  return (r as unknown as { rowCount?: number }).rowCount ?? 0;
}
