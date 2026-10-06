import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, inscripciones, participantes, programaciones, type Turno } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth";
import { listarProgramaciones } from "@/lib/consultas";
import { TURNO_LABEL, hoyISO } from "@/lib/fechas";
import { examenDe, examenes } from "@/lib/preparacion";
import { Encabezado, Pestanas, TABS_PRE, Vacio } from "@/components/ui";
import CampoFecha from "@/components/CampoFecha";
import BotonImprimir from "./BotonImprimir";

export const metadata = { title: "Registro de asistencia y notas" };

const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const MARCA: Record<string, { t: string; cls: string }> = {
  presente: { t: "P", cls: "bg-[#dcfce7] text-[#166534]" },
  tarde: { t: "T", cls: "bg-[#fef3c7] text-[#92400e]" },
  ausente: { t: "F", cls: "bg-[#fee2e2] text-[#991b1b]" },
  justificado: { t: "J", cls: "bg-[#e2e8f0] text-[#334155]" },
};
const fmt = (n: number | null | undefined) => (n == null ? "" : n.toLocaleString("es-PE", { maximumFractionDigits: 1 }));
const colorNota = (n: number | null | undefined) => (n == null ? "" : n >= 14 ? "text-[#166534]" : n >= 11 ? "text-[#92400e]" : "text-[#991b1b]");
const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default async function RegistroAuxiliar({ searchParams }: PageProps<"/operativo/capacitaciones/participantes/registro">) {
  await connection();
  await exigirUsuario();
  const sp = await searchParams;

  // Sedes con sesiones programadas, y la elegida (por defecto la primera)
  const sedesCon = await db.query.sedes.findMany({ where: (t, { eq }) => eq(t.activa, true), orderBy: (t) => t.nombre });
  const sede = Number(sp.sede) || sedesCon[0]?.id || 0;
  const turno = (typeof sp.turno === "string" && sp.turno in TURNO_LABEL ? sp.turno : "") as Turno | "";
  const act = Number(sp.act) || 0;
  const desde = esFecha(sp.desde) ? sp.desde : "";
  const hasta = esFecha(sp.hasta) ? sp.hasta : "";

  const base = await listarProgramaciones(
    and(
      eq(programaciones.sedeId, sede),
      ne(programaciones.estado, "cancelada"),
      turno ? eq(programaciones.turno, turno) : undefined,
      desde ? gte(programaciones.fecha, desde) : undefined,
      hasta ? lte(programaciones.fecha, hasta) : undefined,
    ),
  );
  // Actividades presentes en la sede (para el filtro)
  const acts = [...new Map(base.map((p) => [p.sesion.modulo.actividad.id, p.sesion.modulo.actividad])).values()].sort((a, b) =>
    a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
  );
  const progs = act ? base.filter((p) => p.sesion.modulo.actividad.id === act) : base;
  const ids = progs.map((p) => p.id);

  const [ins, asis, ex] = await Promise.all([
    ids.length ? db.select().from(inscripciones).where(inArray(inscripciones.programacionId, ids)) : [],
    ids.length ? db.select().from(asistencias).where(inArray(asistencias.programacionId, ids)) : [],
    examenes([...new Set(progs.flatMap((p) => [p.sesionId, ...p.combinadas.map((c) => c.sesionId)]))]),
  ]);
  const pids = [...new Set([...ins.map((i) => i.participanteId), ...asis.map((a) => a.participanteId)])];
  const gente = pids.length
    ? await db.select().from(participantes).where(inArray(participantes.id, pids)).orderBy(participantes.apellidos, participantes.nombres)
    : [];
  const inscrito = new Set(ins.map((i) => `${i.programacionId}:${i.participanteId}`));
  const reg = new Map(asis.map((a) => [`${a.programacionId}:${a.participanteId}`, a]));
  const hoy = hoyISO();

  // Columnas: una por sesión; si tiene examen, además las columnas de nota
  const cols = progs.map((p) => {
    const e = examenDe(p, ex);
    return { p, entrada: e === "entrada" || e === "ambos", salida: e === "salida" || e === "ambos" };
  });

  const filas = gente.map((b) => {
    let P = 0, T = 0, F = 0, J = 0;
    const nE: number[] = [];
    const nS: number[] = [];
    for (const { p, entrada, salida } of cols) {
      const a = reg.get(`${p.id}:${b.id}`);
      if (!a) continue;
      if (a.estado === "presente") P++;
      else if (a.estado === "tarde") T++;
      else if (a.estado === "ausente") F++;
      else J++;
      if (entrada && a.notaEntrada != null) nE.push(a.notaEntrada);
      if (salida && a.notaSalida != null) nS.push(a.notaSalida);
    }
    const marcadas = P + T + F + J;
    return { b, P, T, F, J, pct: marcadas ? Math.round(((P + T) * 100) / marcadas) : null, pE: prom(nE), pS: prom(nS) };
  });

  const sedeNombre = sedesCon.find((s) => s.id === sede)?.nombre ?? "—";
  const th = "border border-borde bg-[#f3f5f4] px-1.5 py-1 text-[11px] font-semibold text-texto-2";
  const td = "border border-borde px-1 py-1 text-center text-[12px]";

  return (
    <>
      <Encabezado
        antetitulo="Operativo · Capacitaciones · Beneficiarios"
        titulo="Registro de asistencia y notas"
        acciones={<BotonImprimir />}
      />
      <Pestanas items={TABS_PRE} actual="/operativo/capacitaciones/participantes/registro" />

      <form key={`${sede}:${turno}:${act}:${desde}:${hasta}`} className="card flex flex-wrap items-end gap-3 px-5 py-4 print:hidden">
        <div>
          <label htmlFor="r-sede" className="etiqueta">Sede</label>
          <select id="r-sede" name="sede" defaultValue={sede} className="campo">
            {sedesCon.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="r-turno" className="etiqueta">Turno</label>
          <select id="r-turno" name="turno" defaultValue={turno} className="campo">
            <option value="">Todos</option>
            {Object.entries(TURNO_LABEL).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div className="min-w-64 flex-1">
          <label htmlFor="r-act" className="etiqueta">Actividad</label>
          <select id="r-act" name="act" defaultValue={act || ""} className="campo">
            <option value="">Todas</option>
            {acts.map((a) => <option key={a.id} value={a.id}>Act. {a.codigo} · {a.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="r-desde" className="etiqueta">Desde</label>
          <CampoFecha id="r-desde" name="desde" value={desde} />
        </div>
        <div>
          <label htmlFor="r-hasta" className="etiqueta">Hasta</label>
          <CampoFecha id="r-hasta" name="hasta" value={hasta} />
        </div>
        <button className="btn-oscuro">Ver registro</button>
      </form>

      <p className="hidden text-sm print:block">
        <strong>{sedeNombre}</strong>{turno ? ` · Turno ${TURNO_LABEL[turno].toLowerCase()}` : ""}
        {act ? ` · Act. ${acts.find((a) => a.id === act)?.codigo}` : ""}
      </p>

      <section className="card overflow-x-auto print:overflow-visible print:shadow-none">
        {cols.length === 0 || gente.length === 0 ? (
          <Vacio>No hay sesiones con beneficiarios para estos filtros.</Vacio>
        ) : (
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className={`${th} sticky left-0 z-10 w-8`}>N°</th>
                <th rowSpan={2} className={`${th} sticky left-8 z-10 min-w-56 text-left`}>Apellidos y nombres</th>
                {cols.map(({ p, entrada, salida }) => (
                  <th
                    key={p.id}
                    colSpan={1 + (entrada ? 1 : 0) + (salida ? 1 : 0)}
                    className={`${th} ${p.fecha > hoy ? "opacity-60" : ""}`}
                    title={`${p.sesion.nombre} · Act. ${p.sesion.modulo.actividad.codigo} · ${TURNO_LABEL[p.turno]}`}
                  >
                    <Link href={`/operativo/capacitacion/${p.id}`} className="block whitespace-nowrap hover:underline">
                      {ddmm(p.fecha)}
                    </Link>
                    <span className="block text-[9px] font-normal">{p.turno === "manana" ? "M" : "T"} · {p.sesion.modulo.actividad.codigo}</span>
                  </th>
                ))}
                <th colSpan={5} className={th}>Asistencia</th>
                <th colSpan={2} className={th}>Promedio</th>
              </tr>
              <tr>
                {cols.flatMap(({ p, entrada, salida }) => [
                  <th key={`${p.id}a`} className={`${th} text-[10px]`}>Asist.</th>,
                  ...(entrada ? [<th key={`${p.id}e`} className={`${th} bg-[#e6f4f1] text-[10px] text-acento-oscuro`}>Nota E</th>] : []),
                  ...(salida ? [<th key={`${p.id}s`} className={`${th} bg-[#e6f4f1] text-[10px] text-acento-oscuro`}>Nota S</th>] : []),
                ])}
                {["P", "T", "F", "J", "%"].map((x) => <th key={x} className={`${th} min-w-8`}>{x}</th>)}
                <th className={`${th} min-w-12`}>Entrada</th>
                <th className={`${th} min-w-12`}>Salida</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ b, P, T, F, J, pct, pE, pS }, i) => (
                <tr key={b.id} className="hover:bg-[#f7faf9]">
                  <td className={`${td} sticky left-0 z-[1] bg-white text-texto-2`}>{i + 1}</td>
                  <td className={`${td} sticky left-8 z-[1] whitespace-nowrap bg-white text-left`}>
                    <Link href={`/operativo/capacitaciones/participantes/${b.id}`} className="hover:underline">
                      {b.apellidos}, {b.nombres}
                    </Link>
                  </td>
                  {cols.flatMap(({ p, entrada, salida }) => {
                    const a = reg.get(`${p.id}:${b.id}`);
                    const m = a ? MARCA[a.estado] : null;
                    const esta = inscrito.has(`${p.id}:${b.id}`) || !!a;
                    return [
                      <td key={`${p.id}a`} className={`${td} font-semibold ${m ? m.cls : ""}`}>
                        {m ? m.t : esta ? "" : <span className="text-[#c4c9cf]">·</span>}
                      </td>,
                      ...(entrada ? [<td key={`${p.id}e`} className={`${td} font-semibold tabular-nums ${colorNota(a?.notaEntrada)}`}>{fmt(a?.notaEntrada)}</td>] : []),
                      ...(salida ? [<td key={`${p.id}s`} className={`${td} font-semibold tabular-nums ${colorNota(a?.notaSalida)}`}>{fmt(a?.notaSalida)}</td>] : []),
                    ];
                  })}
                  <td className={`${td} tabular-nums`}>{P}</td>
                  <td className={`${td} tabular-nums`}>{T}</td>
                  <td className={`${td} tabular-nums ${F ? "font-semibold text-[#991b1b]" : ""}`}>{F}</td>
                  <td className={`${td} tabular-nums`}>{J}</td>
                  <td className={`${td} font-semibold tabular-nums ${pct == null ? "" : pct >= 80 ? "text-[#166534]" : pct >= 60 ? "text-[#92400e]" : "text-[#991b1b]"}`}>
                    {pct == null ? "" : `${pct}%`}
                  </td>
                  <td className={`${td} font-semibold tabular-nums ${colorNota(pE)}`}>{fmt(pE)}</td>
                  <td className={`${td} font-semibold tabular-nums ${colorNota(pS)}`}>{fmt(pS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="border-t border-borde px-5 py-2.5 text-xs text-texto-2">
          P = presente · T = tarde · F = falta · J = justificada · en blanco = aún sin registrar · «·» = no inscrito en esa sesión.
          Notas de 0 a 20 (E = entrada, S = salida). Haz clic en una fecha para abrir su lista de asistencia.
        </p>
      </section>
    </>
  );
}
