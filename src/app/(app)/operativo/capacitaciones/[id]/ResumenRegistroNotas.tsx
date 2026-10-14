import type { resumenRegistroNotas } from "@/lib/seguimiento-examenes";

export default function ResumenRegistroNotas({ resumen: r }: { resumen: ReturnType<typeof resumenRegistroNotas> }) {
  return <section aria-label="Comparación de asistentes y personas con notas" className="space-y-3">
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[["Asistentes (presentes y tardanzas)", r.asistentes], ["Personas con notas registradas", r.conNotas], ["Diferencia / personas sin notas completas", r.diferencia]].map(([titulo, valor]) => <div key={titulo} className="rounded-xl border border-borde bg-[#f5f8fc] p-4"><dt className="text-xs text-texto-2">{titulo}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums text-marino">{valor}</dd></div>)}
    </dl>
    <p className={`rounded-lg border px-3 py-2 text-sm ${r.diferencia ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]" : "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"}`}>{r.diferencia ? `Hay una diferencia: faltan las notas completas de ${r.diferencia} ${r.diferencia === 1 ? "persona asistente" : "personas asistentes"}.` : r.asistentes ? "Sin diferencias: todos los asistentes tienen sus notas registradas." : "Sin diferencias: no hay beneficiarios registrados como presentes o tardanzas."}</p>
    {r.ambos && <div className="text-xs text-texto-2"><p>Entrada: {r.entrada} de {r.asistentes} · Salida: {r.salida} de {r.asistentes}.</p><p className="mt-1">Una persona cuenta como completa cuando tiene ambas notas. Una nota de 0 también cuenta como registrada.</p></div>}
  </section>;
}
