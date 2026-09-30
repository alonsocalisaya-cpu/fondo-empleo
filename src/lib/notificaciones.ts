import "server-only";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { programaciones, usuarios } from "@/db/schema";
import type { Usuario } from "./auth";
import { listarProgramaciones } from "./consultas";
import { contextosDe } from "./preparacion";
import { ETAPAS, PASO, resumenFlujo } from "./flujo-pre";
import { hoyISO, sumarDias } from "./fechas";
import { soloCapacitador } from "./permisos";

export type Notificacion = {
  id: string;
  href: string;
  actividad: string;
  etapa: string;
  sesion: string;
  sede: string;
  fecha: string;
  hora: string;
  /** Desde cuándo está pendiente (cuando se completó lo anterior) */
  desde: string;
  nueva: boolean;
  urgencia: "vencida" | "pronto" | null;
};

/**
 * Actividades del flujo que le tocan a este usuario AHORA (están disponibles y son de su rol).
 * No se guardan: se calculan del estado de cada sesión, así desaparecen solas al registrarse.
 *  - Con varios roles, suma lo de cada uno. Como capacitador: solo sus sesiones. Como asistente vinculado
 *    a una persona: solo las sesiones donde es el asistente.
 *  - El administrador ve todo lo pendiente.
 */
export async function notificacionesDe(u: Usuario): Promise<Notificacion[]> {
  const hoy = hoyISO();
  const lista = await listarProgramaciones(
    and(
      ne(programaciones.estado, "cancelada"),
      gte(programaciones.fecha, sumarDias(hoy, -60)),
      lte(programaciones.fecha, sumarDias(hoy, 45)),
      soloCapacitador(u.roles) ? eq(programaciones.capacitadorId, u.capacitadorId ?? -1) : undefined,
    ),
  );
  if (!lista.length) return [];
  const [ctxs, [yo]] = await Promise.all([
    contextosDe(lista),
    db.select({ vistas: usuarios.notificacionesVistas }).from(usuarios).where(eq(usuarios.id, u.id)),
  ]);
  const vistas = yo?.vistas?.getTime() ?? 0;

  const out: Notificacion[] = [];
  for (const p of lista) {
    const ctx = ctxs.get(p.id)!;
    for (const s of resumenFlujo(ctx, "completo").pendientes) {
      // ¿Alguno de sus roles registra esta actividad en ESTA sesión?
      const mia =
        u.roles.includes("admin") ||
        u.roles.some(
          (r) =>
            (s.roles as string[]).includes(r) &&
            (r === "capacitador" ? p.capacitadorId === u.capacitadorId : r === "asistente" && u.personalId ? p.asistenteId === u.personalId : true),
        );
      if (!mia) continue;
      // La post-capacitación se avisa recién desde el día de la sesión
      if (s.etapa === "post" && p.fecha > hoy) continue;
      const previos = s.requiere.map((r) => ctx.pasos[r]?.en).filter(Boolean) as string[];
      const desde = previos.sort().at(-1) ?? p.creadoEn.toISOString();
      const urgencia = s.etapa === "pre" ? (p.fecha < hoy ? "vencida" : p.fecha <= sumarDias(hoy, 3) ? "pronto" : null) : p.fecha <= sumarDias(hoy, -7) ? "vencida" : null;
      out.push({
        id: `${p.id}:${s.clave}`,
        href: `/operativo/capacitaciones/${p.id}?vista=${s.etapa}#paso-${s.clave}`,
        actividad: PASO[s.clave].titulo,
        etapa: ETAPAS[s.etapa],
        sesion: p.sesion.nombre,
        sede: p.sede.nombre,
        fecha: p.fecha,
        hora: p.horaInicio.slice(0, 5),
        desde,
        nueva: new Date(desde).getTime() > vistas,
        urgencia,
      });
    }
  }
  // Primero lo urgente, luego lo más reciente
  const peso = { vencida: 0, pronto: 1 } as const;
  return out.sort((a, b) => (a.urgencia ? peso[a.urgencia] : 2) - (b.urgencia ? peso[b.urgencia] : 2) || b.desde.localeCompare(a.desde));
}

export async function marcarVistas(usuarioId: number) {
  await db.update(usuarios).set({ notificacionesVistas: new Date() }).where(eq(usuarios.id, usuarioId));
}
