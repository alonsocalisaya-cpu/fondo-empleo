import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { participantes, sedes } from "@/db/schema";
import { exigir } from "@/lib/auth";
import { Encabezado } from "@/components/ui";
import FormEditar from "./FormEditar";
import HistorialBeneficiario from "@/components/HistorialBeneficiario";

export const metadata = { title: "Editar beneficiario" };

export default async function EditarBeneficiario({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await exigir("beneficiarios");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const b = await db.query.participantes.findFirst({ where: eq(participantes.id, id) });
  if (!b) notFound();
  const listaSedes = await db.query.sedes.findMany({ where: or(eq(sedes.activa, true), b.sedeId ? eq(sedes.id, b.sedeId) : undefined), orderBy: (t, { asc }) => asc(t.nombre) });
  return <>
    <Encabezado antetitulo={<><Link href="/operativo/capacitaciones/participantes" className="hover:underline">Beneficiarios</Link> › Editar</>} titulo={`${b.nombres} ${b.apellidos}`} />
    <FormEditar beneficiario={b} sedes={listaSedes.map((s) => ({ id: s.id, nombre: `${s.nombre}${s.activa ? "" : " (inactiva)"}` }))} />
    <HistorialBeneficiario participanteId={id} />
  </>;
}
