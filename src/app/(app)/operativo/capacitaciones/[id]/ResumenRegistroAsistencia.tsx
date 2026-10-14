type Resumen = { programados: number; presentes: number; tardanzas: number; ausentes: number; justificados: number; pendientes: number };

export default function ResumenRegistroAsistencia({ resumen: r }: { resumen: Resumen }) {
  const asistentes = r.presentes + r.tardanzas;
  const diferencia = r.programados - asistentes;
  return <section aria-label="Resumen de asistencia de beneficiarios" className="space-y-3">
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[["Beneficiarios programados", r.programados], ["Asistentes (presentes y tardanzas)", asistentes], ["Diferencia / beneficiarios no asistentes", diferencia]].map(([titulo, valor]) => <div key={titulo} className="rounded-xl border border-borde bg-[#f5f8fc] p-4"><dt className="text-xs text-texto-2">{titulo}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums text-marino">{valor}</dd></div>)}</dl>
    <p className={`rounded-lg border px-3 py-2 text-sm ${diferencia ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]" : "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"}`}>{diferencia ? `Hay una diferencia de ${diferencia} ${diferencia === 1 ? "beneficiario" : "beneficiarios"}: ${asistentes} de ${r.programados} programados figuran como presentes o tardanzas.` : r.programados ? "Sin diferencias: todos los beneficiarios programados asistieron." : "No hay beneficiarios programados en esta sesión."}</p>
    <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">{[["Presentes", r.presentes], ["Tardanzas", r.tardanzas], ["Ausentes", r.ausentes], ["Justificados", r.justificados]].map(([titulo, valor]) => <div key={titulo} className="rounded-lg border border-borde bg-white px-3 py-2"><dt className="text-texto-2">{titulo}</dt><dd className="mt-1 text-base font-semibold tabular-nums text-marino">{valor}</dd></div>)}</dl>
    {r.pendientes > 0 && <p className="text-xs text-texto-2">De los ausentes, {r.pendientes} {r.pendientes === 1 ? "beneficiario aún no tiene" : "beneficiarios aún no tienen"} un registro de asistencia guardado.</p>}
  </section>;
}
