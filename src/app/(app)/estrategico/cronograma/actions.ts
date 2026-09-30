"use server";

import { exigir, permitir } from "@/lib/auth";
import { and, eq, gt, isNotNull, lt, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { validarDisponibilidad } from "@/lib/disponibilidad";
import { moverStock } from "@/lib/stock";
import { borrarArchivo } from "@/lib/archivos";
import { inscribirBeneficiarios } from "@/db/inscribir";
import { documentos, fichaItems, preparaciones, programacionSesiones, programaciones, type EstadoProg } from "@/db/schema";
import { turnoDesdeHora } from "@/lib/fechas";

export type EstadoForm = { error?: string } | undefined;

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Crea o edita una programación (sesión + sede + fecha + horario + capacitador). */
export async function guardarProgramacion(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const perm = await permitir("cronograma");
  if (!perm.u) return { error: perm.error };
  const id = Number(form.get("id")) || null;
  const sesionId = Number(form.get("sesionId"));
  const sedeId = Number(form.get("sedeId"));
  const capacitadorId = Number(form.get("capacitadorId")) || null;
  const asistenteId = Number(form.get("asistenteId")) || null;
  const fecha = txt(form, "fecha");
  const horaInicio = txt(form, "horaInicio");
  const horaFin = txt(form, "horaFin");
  const aula = txt(form, "aula") || null;
  const cupo = Number(form.get("cupo")) || null;
  const estado = (txt(form, "estado") || "programada") as EstadoProg;
  const observacion = txt(form, "observacion").slice(0, 300) || null;

  if (!sesionId || !sedeId || !fecha || !horaInicio || !horaFin) {
    return { error: "Completa sesión, sede, fecha y horario." };
  }
  if (horaFin <= horaInicio) return { error: "La hora de fin debe ser posterior a la de inicio." };

  // Validación: ni el consultor ni el asistente pueden tener otra sesión que se cruce,
  // en ninguno de sus roles (p. ej. capacitador aquí y asistente en otra sede a la misma hora).
  const sinDisp = await validarDisponibilidad({ capacitadorId, asistenteId }, { fecha, horaInicio, horaFin }, id);
  if (sinDisp) return { error: sinDisp };

  const valores = {
    sesionId,
    sedeId,
    capacitadorId,
    asistenteId,
    fecha,
    horaInicio,
    horaFin,
    turno: turnoDesdeHora(horaInicio),
    aula,
    cupo,
    estado,
    observacion,
  };

  // Sesiones combinadas (sin repetir la principal)
  const extras = [...new Set(form.getAll("sesionExtra").map(Number).filter((x) => x && x !== sesionId))];

  const guardado = await db.transaction(async (tx) => {
    let progId = id;
    if (id) await tx.update(programaciones).set(valores).where(eq(programaciones.id, id));
    else progId = (await tx.insert(programaciones).values(valores).returning())[0].id;
    await tx.delete(programacionSesiones).where(eq(programacionSesiones.programacionId, progId!));
    if (extras.length) {
      await tx.insert(programacionSesiones).values(extras.map((sid, i) => ({ programacionId: progId!, sesionId: sid, orden: i + 1 })));
    }
    return progId!;
  });
  // Los beneficiarios de la sede y turno quedan inscritos automáticamente
  await inscribirBeneficiarios([guardado]);

  revalidatePath("/", "layout");
  redirect(`/estrategico/cronograma?desde=${fecha}`);
}

export async function eliminarProgramacion(form: FormData) {
  await exigir("cronograma");
  const id = Number(form.get("id"));
  const prep = await db.query.preparaciones.findFirst({ where: eq(preparaciones.programacionId, id) });
  const items = await db.select().from(fichaItems).where(and(eq(fichaItems.programacionId, id), isNotNull(fichaItems.insumoId)));
  const docs = await db.select().from(documentos).where(eq(documentos.programacionId, id));
  await db.transaction(async (tx) => {
    // Lo que salió del inventario y aún no volvió se devuelve al stock
    if (items.length && !prep?.pasos?.actualizar_inventario) {
      await moverStock(tx, "entrada", items.map((i) => ({ insumoId: i.insumoId!, cantidad: i.cantidad })), id, "Devolución · se eliminó la sesión programada");
    }
    await tx.delete(programaciones).where(eq(programaciones.id, id));
  });
  await Promise.all(docs.map((d) => borrarArchivo(d.archivo)));
  revalidatePath("/", "layout");
  redirect("/estrategico/cronograma");
}
