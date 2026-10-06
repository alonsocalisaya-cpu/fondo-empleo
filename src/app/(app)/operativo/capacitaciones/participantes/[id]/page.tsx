import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, inscripciones, participantes, programaciones, sedes } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth";
import { conRuta, combinadas, ruta } from "@/lib/consultas";
import { fechaCorta, hora, hoyISO, TURNO_LABEL } from "@/lib/fechas";
import { examenDe, examenes } from "@/lib/preparacion";
import { Encabezado, Vacio, TituloSesion } from "@/components/ui";

export const metadata = { title: "Detalle del beneficiario" };

const TURNO: Record<string, string> = { manana: "Mañana", tarde: "Tarde", ambos: "Único / ambos" };
const ESTADO: Record<string, { t: string; cls: string }> = {
  presente: { t: "Presente", cls: "bg-[#dcfce7] text-[#166534]" },
  tarde: { t: "Tarde", cls: "bg-[#fef3c7] text-[#92400e]" },
  ausente: { t: "Ausente", cls: "bg-[#fee2e2] text-[#991b1b]" },
  justificado: { t: "Justificado", cls: "bg-[#e2e8f0] text-[#334155]" },
};
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const fmtNota = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-PE", { maximumFractionDigits: 1 }));
const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
/** Color de la nota (escala 0–20, aprobado desde 11). */
const colorNota = (n: number | null | undefined) => (n == null ? "text-texto-2" : n >= 14 ? "text-[#166534]" : n >= 11 ? "text-[#92400e]" : "text-[#991b1b]");

export default async function DetalleBeneficiario({ params }: PageProps<"/operativo/capacitaciones/participantes/[id]">) {
  await connection();
  await exigirUsuario();
  const id = Number((await params).id);
  const b = await db.query.participantes.findFirst({ where: eq(participantes.id, id) });
  if (!b) notFound();
  const sedeB = b.sedeId ? await db.query.sedes.findFirst({ where: eq(sedes.id, b.sedeId) }) : null;

  const ins = await db.select({ pid: inscripciones.programacionId }).from(inscripciones).where(eq(inscripciones.participanteId, id));
  const [asis, progs] = await Promise.all([
    db.select().from(asistencias).where(eq(asistencias.participanteId, id)),
    // Sesiones donde está inscrito o tiene asistencia registrada
    db.query.programaciones.findMany({
      where: inArray(
        programaciones.id,
        db.select({ id: inscripciones.programacionId }).from(inscripciones).where(eq(inscripciones.participanteId, id))
          .union(db.select({ id: asistencias.programacionId }).from(asistencias).where(eq(asistencias.participanteId, id))),
      ),
      with: conRuta,
      orderBy: (t, { asc }) => [asc(t.fecha), asc(t.horaInicio)],
    }),
  ]);
  const ex = await examenes([...new Set(progs.flatMap((p) => [p.sesionId, ...p.combinadas.map((c) => c.sesionId)]))]);
  const aDe = new Map(asis.map((a) => [a.programacionId, a]));
  const inscrito = new Set(ins.map((i) => i.pid));
  const hoy = hoyISO();

  const filas = progs.map((p) => ({ p, a: aDe.get(p.id), examen: examenDe(p, ex), inscrito: inscrito.has(p.id) }));
  const pasadas = filas.filter((f) => f.p.fecha <= hoy && f.p.estado !== "cancelada");
  const conRegistro = filas.filter((f) => f.a);
  const asistio = conRegistro.filter((f) => f.a!.estado === "presente" || f.a!.estado === "tarde");
  const tardanzas = conRegistro.filter((f) => f.a!.estado === "tarde").length;
  const ausencias = conRegistro.filter((f) => f.a!.estado === "ausente").length;
  const justificadas = conRegistro.filter((f) => f.a!.estado === "justificado").length;
  const horas = asistio.reduce((s, f) => s + minutos(f.p.horaFin) - minutos(f.p.horaInicio), 0) / 60;
  const pct = conRegistro.length ? Math.round((asistio.length * 100) / conRegistro.length) : null;
  const proximas = filas.filter((f) => f.p.fecha > hoy && f.p.estado !== "cancelada").length;

  // ── Exámenes: agrupados por actividad (entrada en la 1ra sesión, salida en la última) ──
  type Ex = { actividad: string; codigo: string; entrada?: { n: number | null; fecha: string; ausente: boolean }; salida?: { n: number | null; fecha: string; ausente: boolean } };
  const porAct = new Map<number, Ex>();
  for (const f of filas) {
    if (!f.examen || f.p.estado === "cancelada") continue;
    const act = f.p.sesion.modulo.actividad;
    const e = porAct.get(act.id) ?? { actividad: act.nombre, codigo: act.codigo };
    const falto = !!f.a && f.a.estado !== "presente" && f.a.estado !== "tarde";
    if (f.examen === "entrada" || f.examen === "ambos") e.entrada = { n: f.a?.notaEntrada ?? null, fecha: f.p.fecha, ausente: falto };
    if (f.examen === "salida" || f.examen === "ambos") e.salida = { n: f.a?.notaSalida ?? null, fecha: f.p.fecha, ausente: falto };
    porAct.set(act.id, e);
  }
  const exs = [...porAct.values()];
  const notasE = exs.map((e) => e.entrada?.n).filter((n): n is number => n != null);
  const notasS = exs.map((e) => e.salida?.n).filter((n): n is number => n != null);
  const pE = promedio(notasE);
  const pS = promedio(notasS);

  return (
    <>
      <Encabezado
        antetitulo={
          <>
            <Link href="/operativo/capacitaciones/participantes" className="hover:underline">Beneficiarios</Link> › DNI {b.dni}
          </>
        }
        titulo={`${b.nombres} ${b.apellidos}`}
        acciones={<Link href="/operativo/capacitaciones/participantes" className="btn-secundario">← Volver</Link>}
      />

      <section className="grid grid-cols-2 gap-4 rounded-xl bg-marino px-6 py-5 text-white md:grid-cols-4">
        {[
          ["Sede", sedeB?.nombre ?? "Sin sede", `Turno ${b.turno ? (TURNO[b.turno] ?? b.turno).toLowerCase() : "—"}`],
          ["DNI", b.dni, b.area ?? "—"],
          ["Contacto", b.telefono ?? "—", b.email ?? "—"],
          ["Sesiones", `${filas.length} en su historial`, `${pasadas.length} ya realizadas · ${proximas} próximas`],
        ].map(([t, v, d]) => (
          <div key={t} className="flex flex-col gap-1">
            <span className="text-xs text-niebla">{t}</span>
            <span className="font-semibold">{v}</span>
            <span className="text-xs text-niebla">{d}</span>
          </div>
        ))}
      </section>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Asistencia", pct == null ? "—" : `${pct}%`, `${asistio.length} de ${conRegistro.length} registradas`, pct == null ? "text-texto-2" : pct >= 80 ? "text-[#166534]" : pct >= 60 ? "text-[#92400e]" : "text-[#991b1b]"],
          ["Horas asistidas", `${horas.toLocaleString("es-PE", { maximumFractionDigits: 1 })} h`, `${tardanzas} tardanza(s)`, "text-marino"],
          ["Faltas", String(ausencias), `${justificadas} justificada(s)`, ausencias ? "text-[#991b1b]" : "text-[#166534]"],
          ["Promedio entrada", fmtNota(pE), `${notasE.length} examen(es)`, colorNota(pE)],
          ["Promedio salida", fmtNota(pS), `${notasS.length} examen(es)`, colorNota(pS)],
          ["Mejora", pE != null && pS != null ? `${pS - pE >= 0 ? "+" : "−"}${fmtNota(Math.abs(pS - pE))}` : "—", "salida − entrada", pE != null && pS != null ? (pS >= pE ? "text-[#166534]" : "text-[#991b1b]") : "text-texto-2"],
        ].map(([t, v, d, c]) => (
          <div key={t} className="card flex flex-col gap-0.5 px-4 py-3.5">
            <span className="text-xs text-texto-2">{t}</span>
            <span className={`text-[26px] font-bold ${c}`}>{v}</span>
            <span className="text-[11px] text-texto-2">{d}</span>
          </div>
        ))}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="px-5 pt-4 text-[15px] font-semibold text-marino">Exámenes</h2>
        {exs.length === 0 ? (
          <Vacio>Aún no tiene sesiones con examen.</Vacio>
        ) : (
          <table className="mt-2 w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                <th className="th">Actividad</th>
                <th className="th">Examen de entrada</th>
                <th className="th">Examen de salida</th>
                <th className="th text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {exs.map((e) => {
                const celda = (x: Ex["entrada"]) =>
                  !x ? <span className="text-[#c4c9cf]">No corresponde</span>
                  : (
                    <span className="flex flex-col leading-tight">
                      <span className={`text-[15px] font-semibold tabular-nums ${colorNota(x.n)}`}>
                        {x.n != null ? fmtNota(x.n) : x.ausente ? "No rindió (faltó)" : x.fecha > hoy ? "Pendiente" : "Sin nota"}
                      </span>
                      <span className="text-[11px] text-texto-2">{fechaCorta(x.fecha)}</span>
                    </span>
                  );
                const dif = e.entrada?.n != null && e.salida?.n != null ? e.salida.n - e.entrada.n : null;
                return (
                  <tr key={e.codigo}>
                    <td className="td">
                      <span className="font-medium">Act. {e.codigo}</span>
                      <span className="block text-xs text-texto-2">{e.actividad}</span>
                    </td>
                    <td className="td">{celda(e.entrada)}</td>
                    <td className="td">{celda(e.salida)}</td>
                    <td className={`td text-right font-semibold tabular-nums ${dif == null ? "text-texto-2" : dif >= 0 ? "text-[#166534]" : "text-[#991b1b]"}`}>
                      {dif == null ? "—" : `${dif >= 0 ? "+" : "−"}${fmtNota(Math.abs(dif))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="border-t border-borde px-5 py-2.5 text-xs text-texto-2">Escala de 0 a 20 · verde desde 14, ámbar de 11 a 13, rojo menos de 11.</p>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="px-5 pt-4 text-[15px] font-semibold text-marino">Detalle de asistencia por fecha</h2>
        {filas.length === 0 ? (
          <Vacio>No está inscrito en ninguna sesión.</Vacio>
        ) : (
          <table className="mt-2 w-full min-w-[980px] text-sm">
            <thead>
              <tr>
                <th className="th">Fecha y horario</th>
                <th className="th">Sesión</th>
                <th className="th">Sede</th>
                <th className="th">Asistencia</th>
                <th className="th text-center">Nota entrada</th>
                <th className="th text-center">Nota salida</th>
                <th className="th">Observación</th>
              </tr>
            </thead>
            <tbody>
              {[...filas].reverse().map(({ p, a, examen, inscrito: ok }) => {
                const est = a ? ESTADO[a.estado] : null;
                const futura = p.fecha > hoy;
                const nota = (tiene: boolean, n: number | null | undefined) =>
                  !tiene ? <span className="text-[#c4c9cf]">·</span> : <span className={`font-semibold tabular-nums ${colorNota(n)}`}>{fmtNota(n)}</span>;
                return (
                  <tr key={p.id} className={p.estado === "cancelada" ? "opacity-50" : undefined}>
                    <td className="td whitespace-nowrap">
                      <span className="block font-medium">{fechaCorta(p.fecha)}</span>
                      <span className="text-xs text-texto-2">{hora(p.horaInicio)} – {hora(p.horaFin)} · {TURNO_LABEL[p.turno]}</span>
                    </td>
                    <td className="td">
                      <Link href={`/operativo/capacitacion/${p.id}`} className="font-medium hover:underline"><TituloSesion nombre={p.sesion.nombre} combinadas={combinadas(p)} /></Link>
                      <span className="block text-xs text-texto-2">
                        {ruta(p)}
                        {examen && <span className="ml-1.5 rounded bg-[#eef8f5] px-1.5 py-0.5 text-[10px] font-semibold text-acento-oscuro">📝 examen {examen === "ambos" ? "entrada y salida" : examen}</span>}
                      </span>
                    </td>
                    <td className="td">{p.sede.nombre}</td>
                    <td className="td whitespace-nowrap">
                      {p.estado === "cancelada" ? (
                        <span className="text-xs text-texto-2">Sesión cancelada</span>
                      ) : est ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${est.cls}`}>{est.t}</span>
                      ) : (
                        <span className="text-xs text-texto-2">{futura ? "Próxima" : "Sin registrar"}{!ok ? " · ya no inscrito" : ""}</span>
                      )}
                    </td>
                    <td className="td text-center">{nota(examen === "entrada" || examen === "ambos", a?.notaEntrada)}</td>
                    <td className="td text-center">{nota(examen === "salida" || examen === "ambos", a?.notaSalida)}</td>
                    <td className="td text-[13px] text-texto-2">{a?.observacion ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
