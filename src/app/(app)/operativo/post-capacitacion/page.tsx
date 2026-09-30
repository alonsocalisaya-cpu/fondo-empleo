import { exigirUsuario, soloSesionesDe } from "@/lib/auth";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, inscripciones, participantes, programaciones } from "@/db/schema";
import { listarProgramaciones, ruta, combinadas } from "@/lib/consultas";
import { fechaCorta, hoyISO, hora, sumarDias, TURNO_LABEL } from "@/lib/fechas";
import { ChipEstado, Encabezado, Kpi, Pestanas, TABS_PRE, Vacio, nombreCompleto, Combinadas } from "@/components/ui";

export const metadata = { title: "Resultados de asistencia" };

const MINIMO = 80; // % de asistencia para considerar que el participante cumplió

const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function PostCapacitacion({ searchParams }: PageProps<"/operativo/post-capacitacion">) {
  await connection();
  const sp = await searchParams;
  const hoy = hoyISO();
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  const desde = esFecha(sp.desde) ? sp.desde : sumarDias(hasta, -29);

  const realizadas = await listarProgramaciones(
    and(
      gte(programaciones.fecha, desde),
      lte(programaciones.fecha, hasta),
      or(eq(programaciones.estado, "finalizada"), eq(programaciones.listaCerrada, true)),
      soloSesionesDe(await exigirUsuario()),
    ),
  );
  const ids = realizadas.map((p) => p.id);

  const [porSesion, porParticipante] = ids.length
    ? await Promise.all([
        db
          .select({
            id: asistencias.programacionId,
            n: sql<number>`count(*)::int`,
            ok: sql<number>`count(*) filter (where ${asistencias.estado} in ('presente','tarde'))::int`,
          })
          .from(asistencias)
          .where(inArray(asistencias.programacionId, ids))
          .groupBy(asistencias.programacionId),
        db
          .select({
            p: participantes,
            inscritas: sql<number>`count(distinct ${inscripciones.programacionId})::int`,
            asistidas: sql<number>`count(distinct ${asistencias.programacionId}) filter (where ${asistencias.estado} in ('presente','tarde'))::int`,
          })
          .from(inscripciones)
          .innerJoin(participantes, eq(participantes.id, inscripciones.participanteId))
          .leftJoin(
            asistencias,
            and(eq(asistencias.programacionId, inscripciones.programacionId), eq(asistencias.participanteId, inscripciones.participanteId)),
          )
          .where(inArray(inscripciones.programacionId, ids))
          .groupBy(participantes.id)
          .orderBy(participantes.apellidos, participantes.nombres),
      ])
    : [[], []];
  const mSes = new Map(porSesion.map((s) => [s.id, s]));

  const part = porParticipante.map((r) => ({ ...r, pct: Math.round((r.asistidas * 100) / r.inscritas) }));
  const porSede = new Map<string, typeof realizadas>();
  for (const p of realizadas) porSede.set(p.sede.nombre, [...(porSede.get(p.sede.nombre) ?? []), p]);
  const cumplen = part.filter((r) => r.pct >= MINIMO).length;

  return (
    <>
      <Encabezado antetitulo={`Operativo · Capacitaciones · del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`} titulo="Capacitaciones" />
      <Pestanas items={TABS_PRE} actual="/operativo/post-capacitacion" />

      <form className="card flex flex-wrap items-end gap-3.5 px-5 py-4">
        <div>
          <label htmlFor="p-desde" className="etiqueta">Desde</label>
          <input id="p-desde" type="date" name="desde" defaultValue={desde} className="campo" />
        </div>
        <div>
          <label htmlFor="p-hasta" className="etiqueta">Hasta</label>
          <input id="p-hasta" type="date" name="hasta" defaultValue={hasta} className="campo" />
        </div>
        <button className="btn-oscuro">Ver resultados</button>
      </form>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi etiqueta="Sesiones realizadas" valor={realizadas.length} />
        <Kpi etiqueta="Participantes atendidos" valor={part.length} />
        <Kpi etiqueta={`Cumplen asistencia (≥ ${MINIMO}%)`} valor={cumplen} tono="ok" />
        <Kpi etiqueta="No cumplen" valor={part.length - cumplen} tono={part.length - cumplen ? "alerta" : "normal"} detalle="Candidatos a recuperación" />
      </section>

      {realizadas.length === 0 && (
        <div className="card"><Vacio>No hay sesiones cerradas en este periodo.</Vacio></div>
      )}

      {[...porSede.entries()].map(([nombreSede, grupo]) => (
        <section key={nombreSede} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-marino">{nombreSede}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {grupo.map((p) => {
              const s = mSes.get(p.id);
              const pct = s ? Math.round((s.ok * 100) / s.n) : null;
              const color = pct === null ? "bg-[#cbd5e1]" : pct >= MINIMO ? "bg-[#16a34a]" : pct >= MINIMO - 10 ? "bg-[#d97706]" : "bg-[#dc2626]";
              return (
                <article key={p.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-lg font-semibold text-marino">{fechaCorta(p.fecha)} · {hora(p.horaInicio)} – {hora(p.horaFin)}</span>
                      <span className="text-xs text-texto-2">Turno {TURNO_LABEL[p.turno].toLowerCase()} · {p.aula ?? "Sin aula"}</span>
                    </div>
                    <ChipEstado estado={p.estado} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{p.sesion.nombre}</span>
                    <span className="text-[13px] text-texto-2">{ruta(p)}</span>
                    {p.observacion && <span className="text-xs italic text-[#92400e]">{p.observacion}</span>}
                    <Combinadas nombres={combinadas(p)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-texto-2">Asistencia</span>
                      <span className="text-2xl font-bold text-marino">{pct === null ? "—" : `${pct}%`}</span>
                    </div>
                    <div className="h-2 rounded bg-[#e6ebf1]" aria-hidden="true">
                      <div className={`h-2 rounded ${color}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#eef1f5] pt-3 text-sm">
                    <span>{nombreCompleto(p.capacitador)}</span>
                    <span className="text-texto-2">{s ? `${s.ok}/${s.n} asistieron` : "Sin registro"}</span>
                  </div>
                  <div className="flex gap-4 text-[13px]">
                    <Link href={`/operativo/capacitacion/${p.id}`} className="enlace">Ver lista</Link>
                    <Link href={`/operativo/capacitacion/${p.id}/imprimir`} className="enlace">Imprimir lista</Link>
                    <Link href={`/operativo/capacitaciones/${p.id}/ficha`} className="enlace">Ficha</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {part.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-marino">Asistencia por participante</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {part.map((r) => (
              <article key={r.p.id} className={`card flex flex-col gap-2 p-4 ${r.pct >= MINIMO ? "" : "border-[#fca5a5]"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{r.p.apellidos}, {r.p.nombres}</span>
                    <span className="text-xs text-texto-2">DNI {r.p.dni}{r.p.area ? ` · ${r.p.area}` : ""}</span>
                  </div>
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${r.pct >= MINIMO ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"}`}>
                    {r.pct >= MINIMO ? "Cumple" : "No cumple"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded bg-[#e6ebf1]" aria-hidden="true">
                    <div className={`h-1.5 rounded ${r.pct >= MINIMO ? "bg-[#16a34a]" : "bg-[#dc2626]"}`} style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-xs text-texto-2">{r.asistidas}/{r.inscritas} · {r.pct}%</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}


    </>
  );
}
