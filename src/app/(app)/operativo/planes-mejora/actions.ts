"use server";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { participantes, planesMejoraVersiones } from "@/db/schema";
import { exigir } from "@/lib/auth";
import { archivosDe, validarArchivo, CARPETA_ARCHIVOS, borrarArchivo } from "@/lib/archivos";
import { guardarContinuo } from "@/lib/archivo-continuo";
export async function guardarVersion(form: FormData) {
  const u = await exigir("capacitaciones");
  const id = Number(form.get("participanteId"));
  const volver = `/operativo/planes-mejora/${id}`;
  const cambios = String(form.get("cambios") ?? "").trim();
  const escaneados = archivosDe(form, "escaneado");
  const editables = archivosDe(form, "editable");
  const evidencias = archivosDe(form, "evidencias");
  let error = "";
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Beneficiario inválido");
  if (!cambios || cambios.length > 5000) error = "Describe los cambios de la versión.";
  if (!escaneados.length && !editables.length) error = "Adjunta el plan escaneado o editable.";
  for (const f of [...escaneados, ...editables, ...evidencias]) error ||= validarArchivo(f) ?? "";
  if (error) redirect(`${volver}?error=${encodeURIComponent(error)}`);
  const archivos: {nombre: string; ruta: string; tipo: "escaneado" | "editable" | "evidencia"}[] = [];
  try {
    await db.transaction(async (tx) => {
      const [persona] = await tx.select({id: participantes.id, problemas: participantes.problemasMejora}).from(participantes).where(eq(participantes.id, id)).for("update");
      if (!persona) throw new Error("Beneficiario no encontrado");
      const [anterior] = await tx.select({problemas: planesMejoraVersiones.problemas}).from(planesMejoraVersiones).where(eq(planesMejoraVersiones.participanteId, id)).orderBy(sql`${planesMejoraVersiones.numero} desc`).limit(1);
      const problemas = persona.problemas ?? anterior?.problemas ?? [];
      const [ultima] = await tx.select({ numero: sql<number>`coalesce(max(${planesMejoraVersiones.numero}), 0)::int` }).from(planesMejoraVersiones).where(eq(planesMejoraVersiones.participanteId, id));
      for (const [tipo, lista] of [["escaneado", escaneados], ["editable", editables], ["evidencia", evidencias]] as const) {
        for (const f of lista) {
          const guardado = await guardarContinuo({ cuerpo: f.stream(), nombre: f.name, tamano: f.size, carpeta: `planes-mejora/${id}`, base: CARPETA_ARCHIVOS });
          archivos.push({nombre: f.name, ruta: guardado.archivo, tipo});
        }
      }
      await tx.insert(planesMejoraVersiones).values({ participanteId: id, numero: ultima.numero + 1, cambios, problemas, archivos, autorId: u.id });
    });
  } catch (e) {
    await Promise.all(archivos.map((a) => borrarArchivo(a.ruta)));
    console.error("No se pudo guardar el plan", e);
    redirect(`${volver}?error=No%20se%20pudo%20guardar.%20Intenta%20nuevamente.`);
  }
  revalidatePath("/operativo/planes-mejora");
  revalidatePath(volver);
  redirect(`${volver}?guardado=1`);
}

export async function guardarProblemas(form: FormData) {
  await exigir("capacitaciones");
  const id=Number(form.get("participanteId"));
  if(!Number.isSafeInteger(id) || id<1) throw new Error("Beneficiario inválido");
  const problemas=[1,2,3].map((n)=>({texto:String(form.get(`problema${n}`) ?? "").trim()}));
  if(problemas.some((p)=>!p.texto || p.texto.length>500)) redirect(`/operativo/planes-mejora/${id}?error=Completa%20los%20tres%20problemas`);
  await db.update(participantes).set({problemasMejora:problemas}).where(eq(participantes.id,id));
  revalidatePath("/operativo/planes-mejora");
  revalidatePath(`/operativo/planes-mejora/${id}`);
  redirect(`/operativo/planes-mejora/${id}?problemasGuardados=1`);
}
