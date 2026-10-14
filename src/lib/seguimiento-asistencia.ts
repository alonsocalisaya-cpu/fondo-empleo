export type MarcaSeguimiento = "presente" | "tarde" | "justificado" | "ausente" | "programada" | "no_inscrito" | "no_realizada";

export function totalizarAsistencia(filas: { programados: number; asistentes: number }[]) {
  const total = filas.reduce((t, f) => ({ programados: t.programados + f.programados, asistentes: t.asistentes + f.asistentes }), { programados: 0, asistentes: 0 });
  return { ...total, porcentaje: total.programados ? Math.round(100 * total.asistentes / total.programados) : null };
}

export function marcaSeguimiento({ estado, inscrito, pendiente, cerrada, realizada }: {
  estado?: "presente" | "tarde" | "justificado" | "ausente" | null;
  inscrito: boolean;
  pendiente: boolean;
  cerrada: boolean;
  realizada?: boolean;
}): MarcaSeguimiento {
  if (estado) return estado;
  if (realizada === false) return "no_realizada";
  if (!inscrito) return "no_inscrito";
  if (pendiente && !cerrada) return "programada";
  return "ausente";
}

export const MARCAS_SEGUIMIENTO: Record<MarcaSeguimiento, { texto: string; sigla: string; clase: string }> = {
  presente: { texto: "Presente", sigla: "P", clase: "bg-[#dcfce7] text-[#166534]" },
  tarde: { texto: "Tardanza", sigla: "T", clase: "bg-[#fef3c7] text-[#92400e]" },
  justificado: { texto: "Justificado", sigla: "J", clase: "bg-[#e2e8f0] text-[#334155]" },
  ausente: { texto: "Ausente", sigla: "A", clase: "bg-[#fee2e2] text-[#991b1b]" },
  programada: { texto: "Por realizar", sigla: "·", clase: "bg-[#eff6ff] text-[#64748b]" },
  no_inscrito: { texto: "No inscrito en esta sesión", sigla: "—", clase: "bg-[#f8fafc] text-[#94a3b8]" },
  no_realizada: { texto: "Capacitación no ejecutada", sigla: "N/E", clase: "bg-[#f3f4f6] text-[#6b7280]" },
};
