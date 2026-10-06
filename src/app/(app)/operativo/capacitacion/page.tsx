import { exigirUsuario, soloSesionesDe } from "@/lib/auth";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { asistencias, inscripciones, programaciones } from "@/db/schema";
import { listarProgramaciones, opcionesFiltros, ruta, combinadas } from "@/lib/consultas";
import { fechaLarga, hoyISO, hora, sumarDias, TURNO_LABEL } from "@/lib/fechas";
import { ChipEstado, Encabezado, Pestanas, TABS_PRE, Vacio, nombreCompleto, TituloSesion } from "@/components/ui";

export const metadata = { title: "Capacitación" };

export default async function Asistencia({ searchParams }: PageProps<"/operativo/capacitacion">) {
  await connection();
  const sp = await searchParams;
  const fecha = typeof sp.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoyISO();
  const sede = Number(sp.sede) || 0;

  const [lista, { sedes }] = await Promise.all([
    listarProgramaciones(and(eq(programaciones.fecha, fecha), sede ? eq(programaciones.sedeId, sede) : undefined, soloSesionesDe(await exigirUsuario()))),
    opcionesFiltros(),
  ]);

  const ids = lista.map((p) => p.id);
  const [ins, asis] = ids.length
    ? await Promise.all([
        db
          .select({ id: inscripciones.programacionId, n: sql<number>`count(*)::int` })
          .from(inscripciones)
          .where(inArray(inscripciones.programacionId, ids))
          .groupBy(inscripciones.programacionId),
        db
          .select({
            id: asistencias.programacionId,
            n: sql<number>`count(*)::int`,
            ok: sql<number>`count(*) filter (where ${asistencias.estado} in ('presente','tarde'))::int`,
          })
          .from(asistencias)
          .where(inArray(asistencias.programacionId, ids))
          .groupBy(asistencias.programacionId),
      ])
    : [[], []];
  const nIns = new Map(ins.map((r) => [r.id, r.n]));
  const nAsis = new Map(asis.map((r) => [r.id, r]));

  // Agrupar por sede
  const porSede = new Map<string, typeof lista>();
  for (const p of lista) porSede.set(p.sede.nombre, [...(porSede.get(p.sede.nombre) ?? []), p]);

  const url = (f: string) => `/operativo/capacitacion?fecha=${f}${sede ? `&sede=${sede}` : ""}`;

  return (
    <>
      <Encabezado
        antetitulo={`Operativo · Capacitaciones · ${fechaLarga(fecha)}`}
        titulo="Capacitaciones"
        acciones={
          <>
            <Link href={url(sumarDias(fecha, -1))} className="btn-secundario">← Día anterior</Link>
            <Link href={url(hoyISO())} className="btn-secundario">Hoy</Link>
            <Link href={url(sumarDias(fecha, 1))} className="btn-secundario">Día siguiente →</Link>
            <a href={`/operativo/capacitacion/excel?fecha=${fecha}`} className="btn-primario">⬇ Listas del día (Excel)</a>
          </>
        }
      />
      <Pestanas items={TABS_PRE} actual="/operativo/capacitacion" />

      <form className="card flex flex-wrap items-end gap-3.5 px-5 py-4">
        <div>
          <label htmlFor="a-fecha" className="etiqueta">Fecha</label>
          <input id="a-fecha" type="date" name="fecha" defaultValue={fecha} className="campo" />
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="a-sede" className="etiqueta">Sede</label>
          <select id="a-sede" name="sede" defaultValue={sede || ""} className="campo">
            <option value="">Todas las sedes</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <button className="btn-oscuro">Ver listas</button>
      </form>

      {lista.length === 0 && (
        <div className="card"><Vacio>No hay sesiones programadas este día.</Vacio></div>
      )}

      {[...porSede.entries()].map(([nombreSede, progs]) => (
        <section key={nombreSede} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-marino">{nombreSede}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {progs.map((p) => {
              const inscritos = nIns.get(p.id) ?? 0;
              const a = nAsis.get(p.id);
              return (
                <Link key={p.id} href={`/operativo/capacitacion/${p.id}`} className="card flex flex-col gap-3 p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-lg font-semibold text-marino">{hora(p.horaInicio)} – {hora(p.horaFin)}</span>
                      <span className="text-xs text-texto-2">Turno {TURNO_LABEL[p.turno].toLowerCase()} · {p.aula ?? "Sin aula"}</span>
                    </div>
                    <ChipEstado estado={p.estado} sinCapacitador={!p.capacitador} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium"><TituloSesion nombre={p.sesion.nombre} combinadas={combinadas(p)} /></span>
                    <span className="text-[13px] text-texto-2">{ruta(p)}</span>
                    {p.observacion && <span className="text-xs italic text-[#92400e]">{p.observacion}</span>}
                  </div>
                  <div className="flex items-center justify-between border-t border-[#eef1f5] pt-3 text-sm">
                    <span>{nombreCompleto(p.capacitador)}</span>
                    <span className={p.listaCerrada ? "font-semibold text-[#166534]" : a ? "font-semibold text-[#92400e]" : "text-texto-2"}>
                      {p.listaCerrada
                        ? `Cerrada · ${a?.ok ?? 0}/${inscritos} asistieron`
                        : a
                          ? `En registro · ${a.n}/${inscritos}`
                          : `${inscritos} inscritos · sin registrar`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
