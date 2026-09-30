import { exigirUsuario, puedeVerSesion } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, inscripciones, programaciones } from "@/db/schema";
import { conRuta, ruta, combinadas } from "@/lib/consultas";
import { fechaCorta, hora, TURNO_LABEL } from "@/lib/fechas";
import { ChipEstado, Encabezado, nombreCompleto } from "@/components/ui";
import ListaAsistencia, { type FilaAsistencia } from "./ListaAsistencia";
import { reabrirLista } from "../actions";
import { examenDe, examenes } from "@/lib/preparacion";

export const metadata = { title: "Lista de asistencia" };

export default async function PaginaAsistencia({ params }: PageProps<"/operativo/capacitacion/[id]">) {
  await connection();
  const id = Number((await params).id);
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, id), with: conRuta });
  if (!p || !puedeVerSesion(await exigirUsuario(), p)) notFound();

  const [ins, asis, ex] = await Promise.all([
    db.query.inscripciones.findMany({ where: eq(inscripciones.programacionId, id), with: { participante: true } }),
    db.select().from(asistencias).where(eq(asistencias.programacionId, id)),
    examenes([p.sesionId, ...p.combinadas.map((c) => c.sesionId)]),
  ]);
  // ¿Esta sesión tiene examen? (1ra sesión → entrada, última → salida)
  const examen = examenDe(p, ex);
  const porParticipante = new Map(asis.map((a) => [a.participanteId, a]));

  const filas: FilaAsistencia[] = ins
    .map((i) => {
      const a = porParticipante.get(i.participanteId);
      return {
        participanteId: i.participanteId,
        nombre: `${i.participante.apellidos}, ${i.participante.nombres}`,
        dni: i.participante.dni,
        area: i.participante.area,
        estado: a?.estado ?? null,
        horaIngreso: a?.horaIngreso ?? null,
        observacion: a?.observacion ?? null,
        notaEntrada: a?.notaEntrada ?? null,
        notaSalida: a?.notaSalida ?? null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <>
      <Encabezado
        antetitulo={
          <>
            <Link href="/operativo/capacitaciones" className="hover:underline">Capacitaciones</Link> › <Link href={`/operativo/capacitaciones/${p.id}`} className="hover:underline">Expediente</Link> › <Link href="/operativo/capacitacion" className="hover:underline">Listas de asistencia</Link> › {p.sede.nombre} › {fechaCorta(p.fecha)} ·{" "}
            {hora(p.horaInicio)} – {hora(p.horaFin)}
          </>
        }
        titulo="Lista de asistencia"
        acciones={
          <>
            <Link href={`/operativo/capacitacion/${p.id}/imprimir`} className="btn-secundario">🖨 Imprimir (formato oficial)</Link>
            <a href={`/operativo/capacitacion/${p.id}/excel`} className="btn-secundario">⬇ Excel</a>
            {p.listaCerrada && (
              <form action={reabrirLista}>
                <input type="hidden" name="programacionId" value={p.id} />
                <button className="btn-secundario">Reabrir lista</button>
              </form>
            )}
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 rounded-xl bg-marino px-6 py-5 text-white md:grid-cols-4">
        {[
          ["Sesión", [p.sesion.nombre, ...combinadas(p)].join(" + "), ruta(p)],
          ["Sede y aula", p.sede.nombre, p.aula ?? "—"],
          ["Horario", `${hora(p.horaInicio)} – ${hora(p.horaFin)}`, `Turno ${TURNO_LABEL[p.turno].toLowerCase()}`],
          ["Consultor", nombreCompleto(p.capacitador), p.listaCerrada ? "Lista cerrada" : "Lista abierta"],
        ].map(([t, v, d]) => (
          <div key={t} className="flex flex-col gap-1">
            <span className="text-xs text-niebla">{t}</span>
            <span className="font-semibold">{v}</span>
            <span className="text-xs text-niebla">{d}</span>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-3 text-sm">
        <ChipEstado estado={p.estado} sinCapacitador={!p.capacitador} />
        {p.listaCerrada && <span className="text-texto-2">Esta lista está cerrada. Para modificarla, usa «Reabrir lista».</span>}
      </div>

      <ListaAsistencia key={p.id} programacionId={p.id} filas={filas} cerrada={p.listaCerrada} examen={examen} />
    </>
  );
}
