export type EstadoNota = "registrada" | "pendiente" | "sin_nota" | "no_rindio" | "no_inscrito" | "no_realizada";

export function resumenRegistroNotas(asistencia: { presentes: number; tardanzas: number; conNotaEntrada: number; conNotaSalida: number; conAmbasNotas: number }, examen: "entrada" | "salida" | "ambos" | null) {
  const asistentes = asistencia.presentes + asistencia.tardanzas;
  const conNotas = examen === "ambos" ? asistencia.conAmbasNotas : examen === "entrada" ? asistencia.conNotaEntrada : examen === "salida" ? asistencia.conNotaSalida : 0;
  return {
    asistentes, conNotas, diferencia: examen ? asistentes - conNotas : 0,
    entrada: examen === "entrada" || examen === "ambos" ? asistencia.conNotaEntrada : null,
    salida: examen === "salida" || examen === "ambos" ? asistencia.conNotaSalida : null,
    ambos: examen === "ambos",
  };
}

export function resultadoExamen({ nota, estado, inscrito, pendiente, realizada }: {
  nota?: number | null;
  estado?: "presente" | "tarde" | "ausente" | "justificado" | null;
  inscrito: boolean;
  pendiente: boolean;
  realizada?: boolean;
}): { estado: EstadoNota; nota: number | null } {
  if (nota != null && Number.isFinite(nota) && nota >= 0 && nota <= 20) return { estado: "registrada", nota };
  if (realizada === false) return { estado: "no_realizada", nota: null };
  if (!inscrito && !estado) return { estado: "no_inscrito", nota: null };
  if (estado === "ausente" || estado === "justificado") return { estado: "no_rindio", nota: null };
  if (pendiente && !estado) return { estado: "pendiente", nota: null };
  return { estado: "sin_nota", nota: null };
}

/** Una nota pendiente o no rendida no equivale a cero. */
export function promedioNotas(notas: (number | null | undefined)[]) {
  const validas = notas.filter((n): n is number => n != null && Number.isFinite(n) && n >= 0 && n <= 20);
  return validas.length ? validas.reduce((s, n) => s + n, 0) / validas.length : null;
}
