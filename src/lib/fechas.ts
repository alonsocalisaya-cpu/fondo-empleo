// Utilidades de fechas. Toda la app trabaja en hora de Lima.
export const ZONA = "America/Lima";

/** Fecha de hoy en Lima como "YYYY-MM-DD". */
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

/** Suma días a una fecha "YYYY-MM-DD". */
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana de la fecha dada. */
export function inicioSemana(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
  return sumarDias(iso, -dow);
}

const fmtCorta = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmtLarga = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Sáb 26 set" */
export function fechaCorta(iso: string): string {
  return capitalizar(fmtCorta.format(new Date(`${iso}T12:00:00Z`)).replace(/\./g, "").replace(",", ""));
}

/** "Sábado, 26 de septiembre de 2026" */
export function fechaLarga(iso: string): string {
  return capitalizar(fmtLarga.format(new Date(`${iso}T12:00:00Z`)));
}

/** "08:00:00" → "08:00" */
export function hora(h: string | null | undefined): string {
  return h ? h.slice(0, 5) : "—";
}

export function turnoDesdeHora(h: string): "manana" | "tarde" | "noche" {
  const hh = Number(h.slice(0, 2));
  if (hh < 13) return "manana";
  if (hh < 18) return "tarde";
  return "noche";
}

export const TURNO_LABEL = { manana: "Mañana", tarde: "Tarde", noche: "Noche" } as const;
