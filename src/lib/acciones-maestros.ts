"use server";

import { exigir, permitir } from "@/lib/auth";
import { eq, not, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { inscribirBeneficiarios } from "@/db/inscribir";
import { borrarArchivo } from "./archivos";
import { hoyISO } from "./fechas";
import { documentos, equipos, insumos, participantes, programaciones, sedes } from "@/db/schema";

export type Res = { ok?: string; error?: string } | undefined;
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const duplicado = (e: unknown) => (e as { cause?: { code?: string } })?.cause?.code === "23505";

export async function crearSede(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("logistica");
  if (!perm.u) return { error: perm.error };
  const nombre = txt(f, "nombre");
  if (!nombre) return { error: "El nombre es obligatorio." };
  try {
    await db.insert(sedes).values({
      nombre,
      direccion: txt(f, "direccion"),
      distrito: txt(f, "distrito"),
      fueraDeArequipa: txt(f, "ubicacion") === "fuera",
      contacto: txt(f, "contacto"),
      telefono: txt(f, "telefono"),
    });
  } catch (e) {
    return { error: duplicado(e) ? "Ya existe una sede con ese nombre." : "No se pudo guardar." };
  }
  revalidatePath("/", "layout");
  return { ok: `Sede «${nombre}» creada.` };
}

export async function alternarSede(f: FormData) {
  await exigir("logistica");
  await db.update(sedes).set({ activa: not(sedes.activa) }).where(eq(sedes.id, Number(f.get("id"))));
  revalidatePath("/", "layout");
}



export async function crearParticipante(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("beneficiarios");
  if (!perm.u) return { error: perm.error };
  const nombres = txt(f, "nombres");
  const apellidos = txt(f, "apellidos");
  const dni = txt(f, "dni");
  const sedeId = Number(f.get("sedeId")) || null;
  const turno = ["manana", "tarde", "ambos"].includes(txt(f, "turno") ?? "") ? txt(f, "turno") : "ambos";
  if (!nombres || !apellidos || !dni) return { error: "Nombres, apellidos y DNI son obligatorios." };
  if (!/^\d{8,12}$/.test(dni)) return { error: "El DNI debe tener solo números (8 a 12 dígitos)." };
  try {
    await db.insert(participantes).values({ nombres, apellidos, dni, email: txt(f, "email"), telefono: txt(f, "telefono"), sedeId, turno });
  } catch (e) {
    return { error: duplicado(e) ? "Ya existe un beneficiario con ese DNI." : "No se pudo guardar." };
  }
  // Queda inscrito en las sesiones programadas de su sede y turno
  const n = sedeId ? await inscribirBeneficiarios() : 0;
  revalidatePath("/", "layout");
  return { ok: `${nombres} ${apellidos} registrado${n ? ` e inscrito en ${n} sesión(es)` : ""}.` };
}

/**
 * Cambia la sede y/o el turno de un beneficiario.
 * Sus sesiones pasadas y asistencias no se tocan. En las sesiones de hoy en adelante (con lista abierta
 * y sin asistencia registrada) se quita de las que ya no le corresponden y se inscribe en las de su nueva sede y turno.
 */
export async function cambiarSedeTurno(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("beneficiarios");
  if (!perm.u) return { error: perm.error };
  const id = idDe(f);
  const sedeId = Number(f.get("sedeId")) || null;
  const turno = txt(f, "turno");
  if (!id) return { error: "Beneficiario no válido." };
  if (!turno || !["manana", "tarde", "ambos"].includes(turno)) return { error: "Elige un turno válido." };
  const antes = await db.query.participantes.findFirst({ where: eq(participantes.id, id) });
  if (!antes) return { error: "El beneficiario ya no existe." };
  if (antes.sedeId === sedeId && antes.turno === turno) return { ok: "Sin cambios." };

  const hoy = hoyISO();
  const n = await db.transaction(async (tx) => {
    await tx.update(participantes).set({ sedeId, turno }).where(eq(participantes.id, id));
    await tx.execute(sql`
      delete from inscripciones i
      using programaciones p
      where i.programacion_id = p.id
        and i.participante_id = ${id}
        and p.fecha >= ${hoy}
        and p.lista_cerrada = false
        and not exists (select 1 from asistencias a where a.programacion_id = p.id and a.participante_id = ${id})
    `);
    return sedeId ? inscribirBeneficiarios(undefined, tx, { participanteId: id, desde: hoy }) : 0;
  });
  revalidatePath("/", "layout");
  return { ok: `Actualizado${n ? ` · inscrito en ${n} sesión(es) de su nueva sede/turno` : ""}.` };
}

/* ── Personal interno ─────────────────────────────────────── */



/* ── Gestión documental ───────────────────────────────────── */

export async function eliminarDocumento(f: FormData) {
  await exigir("documental");
  const [d] = await db.delete(documentos).where(eq(documentos.id, Number(f.get("id")))).returning();
  await borrarArchivo(d?.archivo);
  revalidatePath("/", "layout");
}

/* ── Mantenimiento: equipos ───────────────────────────────── */
export async function cambiarEstadoEquipo(f: FormData) {
  await exigir("mantenimiento");
  const estado = txt(f, "estado") as "operativo" | "en_reparacion" | "de_baja";
  if (!["operativo", "en_reparacion", "de_baja"].includes(estado)) return;
  await db
    .update(equipos)
    .set({ estado, observacion: txt(f, "observacion") })
    .where(eq(equipos.id, Number(f.get("id"))));
  revalidatePath("/", "layout");
}

/* ── Eliminar registros maestros ──────────────────────────
 * Cada acción revisa las dependencias: lo que tiene historial se protege o se
 * desvincula (p. ej. las sesiones de un consultor eliminado quedan «sin consultor»). */

const idDe = (f: FormData) => Number(f.get("id")) || 0;



export async function eliminarSede(f: FormData): Promise<Res> {
  const perm = await permitir("logistica");
  if (!perm.u) return { error: perm.error };
  const id = idDe(f);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(programaciones).where(eq(programaciones.sedeId, id));
  if (n) return { error: `No se puede eliminar: tiene ${n} sesión(es) programadas. Desactívala o elimina primero esas sesiones.` };
  await db.delete(sedes).where(eq(sedes.id, id));
  revalidatePath("/", "layout");
  return { ok: "Eliminado." };
}

export async function eliminarParticipante(f: FormData): Promise<Res> {
  const perm = await permitir("beneficiarios");
  if (!perm.u) return { error: perm.error };
  await db.delete(participantes).where(eq(participantes.id, idDe(f)));
  revalidatePath("/", "layout");
  return { ok: "Eliminado." };
}

export async function eliminarEquipo(f: FormData): Promise<Res> {
  const perm = await permitir("mantenimiento");
  if (!perm.u) return { error: perm.error };
  await db.delete(equipos).where(eq(equipos.id, idDe(f)));
  revalidatePath("/", "layout");
  return { ok: "Eliminado." };
}

export async function eliminarInsumo(f: FormData): Promise<Res> {
  const perm = await permitir("logistica");
  if (!perm.u) return { error: perm.error };
  await db.delete(insumos).where(eq(insumos.id, idDe(f)));
  revalidatePath("/", "layout");
  return { ok: "Eliminado." };
}
