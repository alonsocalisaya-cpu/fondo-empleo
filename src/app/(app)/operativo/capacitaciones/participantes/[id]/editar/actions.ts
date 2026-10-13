"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { inscribirBeneficiarios } from "@/db/inscribir";
import { participantes, sedes } from "@/db/schema";
import { permitir } from "@/lib/auth";
import { hoyISO } from "@/lib/fechas";

export async function editarBeneficiario(_prev: { error?: string } | undefined, f: FormData): Promise<{ error?: string } | undefined> {
  const permiso = await permitir("beneficiarios");
  if (!permiso.u) return { error: permiso.error };
  const id = Number(f.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return { error: "Beneficiario no válido." };
  const texto = (campo: string) => String(f.get(campo) ?? "").trim();
  const dni = texto("dni");
  const nombres = texto("nombres");
  const apellidos = texto("apellidos");
  const email = texto("email");
  const telefono = texto("telefono");
  const area = texto("area");
  const sedeId = texto("sedeId") ? Number(f.get("sedeId")) : null;
  if (!/^\d{8,12}$/.test(dni)) return { error: "El DNI debe tener entre 8 y 12 dígitos." };
  if (!nombres || !apellidos || nombres.length > 100 || apellidos.length > 100) return { error: "Completa nombres y apellidos, con un máximo de 100 caracteres cada uno." };
  if (email.length > 150 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Ingresa un correo válido de hasta 150 caracteres." };
  if (telefono.length > 30 || area.length > 120) return { error: "El teléfono admite hasta 30 caracteres y el área hasta 120." };
  if (sedeId !== null && (!Number.isSafeInteger(sedeId) || sedeId <= 0)) return { error: "Elige una sede válida." };
  if (sedeId && !await db.query.sedes.findFirst({ where: eq(sedes.id, sedeId) })) return { error: "La sede seleccionada ya no existe." };
  try {
    await db.transaction(async (tx) => {
      const b = await tx.query.participantes.findFirst({ where: eq(participantes.id, id) });
      if (!b) throw new Error("El beneficiario ya no existe.");
      await tx.update(participantes).set({ dni, nombres, apellidos, sedeId, email: email || null, telefono: telefono || null, area: area || null }).where(eq(participantes.id, id));
      if (b.sedeId !== sedeId) {
        const hoy = hoyISO();
        await tx.execute(sql`delete from inscripciones i using programaciones p
          where i.programacion_id = p.id and i.participante_id = ${id} and p.fecha >= ${hoy}
          and p.lista_cerrada = false
          and not exists (select 1 from asistencias a where a.programacion_id = p.id and a.participante_id = ${id})`);
        if (sedeId) await inscribirBeneficiarios(undefined, tx, { participanteId: id, desde: hoy });
      }
    });
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === "23505") return { error: "Ya existe otro beneficiario con ese DNI." };
    return { error: e instanceof Error && e.message === "El beneficiario ya no existe." ? e.message : "No se pudieron guardar los cambios. Inténtalo nuevamente." };
  }
  revalidatePath("/", "layout");
  redirect("/operativo/capacitaciones/participantes");
}
