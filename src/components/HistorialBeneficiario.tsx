import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { historialBeneficiarios } from "@/db/schema";
import { Vacio } from "@/components/ui";

const TURNOS: Record<string, string> = { manana: "Mañana", tarde: "Tarde", ambos: "Único / ambos" };
const turno = (valor: string | null) => valor ? TURNOS[valor] ?? valor : "Sin asignar";

export default async function HistorialBeneficiario({ participanteId }: { participanteId: number }) {
  const cambios = await db.select().from(historialBeneficiarios)
    .where(eq(historialBeneficiarios.participanteId, participanteId))
    .orderBy(desc(historialBeneficiarios.creadoEn), desc(historialBeneficiarios.id));
  return <section className="card overflow-x-auto">
    <h2 className="px-5 pt-4 text-[15px] font-semibold text-marino">Historial de cambios de sede y turno</h2>
    {!cambios.length ? <Vacio>Aún no hay cambios registrados. El historial se guarda a partir de la habilitación de esta función.</Vacio> : <table className="mt-2 w-full min-w-[720px] text-sm">
      <thead><tr><th className="th">Fecha y hora</th><th className="th">Antes</th><th className="th">Después</th><th className="th">Realizado por</th></tr></thead>
      <tbody>{cambios.map((c) => <tr key={c.id}>
        <td className="td">{c.creadoEn.toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" })}</td>
        <td className="td">{c.sedeAnterior ?? "Sin sede"}<span className="block text-xs text-texto-2">Turno {turno(c.turnoAnterior)}</span></td>
        <td className="td">{c.sedeNueva ?? "Sin sede"}<span className="block text-xs text-texto-2">Turno {turno(c.turnoNuevo)}</span></td>
        <td className="td">{c.registradoPor}</td>
      </tr>)}</tbody>
    </table>}
  </section>;
}
