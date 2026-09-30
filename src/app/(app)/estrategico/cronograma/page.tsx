import SiPuede from "@/components/SiPuede";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { actividades, inscripciones, modulos, programaciones, sesiones, type Turno } from "@/db/schema";
import { listarProgramaciones, opcionesFiltros, ruta, combinadas, type ProgramacionConRuta } from "@/lib/consultas";
import { fechaCorta, hoyISO, hora, inicioSemana, sumarDias, TURNO_LABEL } from "@/lib/fechas";
import { ChipEstado, Encabezado, Pestanas, TABS_CRONOGRAMA, Vacio, nombreCompleto, Combinadas } from "@/components/ui";

export const metadata = { title: "Cronograma de capacitaciones" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

type RolPersonal = "consultor" | "asistente";
type CruceHorario = { rol: RolPersonal; otroRol: RolPersonal; persona: string; otra: ProgramacionConRuta };

const clavePersona = (nombre: string) => nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();

/** Detecta cruces de una misma persona aunque figure con distinto rol en cada sesión. */
function crucesDePersonal(programaciones: ProgramacionConRuta[]) {
  const grupos = new Map<string, Map<number, { programacion: ProgramacionConRuta; nombre: string; roles: Set<RolPersonal> }>>();
  for (const p of programaciones) {
    if (p.estado === "cancelada") continue;
    for (const [rol, persona] of [["consultor", p.capacitador], ["asistente", p.asistente]] as const) {
      if (!persona) continue;
      const nombre = nombreCompleto(persona);
      const key = `${p.fecha}:${clavePersona(nombre)}`;
      const grupo = grupos.get(key) ?? new Map();
      const asignacion = grupo.get(p.id) ?? { programacion: p, nombre, roles: new Set<RolPersonal>() };
      asignacion.roles.add(rol);
      grupo.set(p.id, asignacion);
      grupos.set(key, grupo);
    }
  }

  const resultado = new Map<number, CruceHorario[]>();
  const agregar = (id: number, cruce: CruceHorario) => resultado.set(id, [...(resultado.get(id) ?? []), cruce]);
  for (const asignaciones of grupos.values()) {
    const grupo = [...asignaciones.values()].sort((a, b) => a.programacion.horaInicio.localeCompare(b.programacion.horaInicio));
    for (let i = 0; i < grupo.length; i++) {
      const a = grupo[i];
      for (let j = i + 1; j < grupo.length && grupo[j].programacion.horaInicio < a.programacion.horaFin; j++) {
        const b = grupo[j].programacion;
        if (b.horaFin <= a.programacion.horaInicio) continue;
        const otra = grupo[j];
        for (const rol of a.roles) for (const otroRol of otra.roles) {
          agregar(a.programacion.id, { rol, otroRol, persona: a.nombre, otra: b });
          agregar(b.id, { rol: otroRol, otroRol: rol, persona: otra.nombre, otra: a.programacion });
        }
      }
    }
  }
  return resultado;
}

export default async function Programacion({ searchParams }: PageProps<"/estrategico/cronograma">) {
  await connection();
  const sp = await searchParams;
  const desde = esFecha(str(sp.desde)) ? str(sp.desde) : inicioSemana(hoyISO());
  const hasta = esFecha(str(sp.hasta)) ? str(sp.hasta) : sumarDias(desde, 6);
  const semanaActual = inicioSemana(hoyISO());
  const enSemanaActual = desde === semanaActual && hasta === sumarDias(semanaActual, 6);
  const sede = Number(str(sp.sede)) || 0;
  const cap = Number(str(sp.capacitador)) || 0;
  const asi = Number(str(sp.asistente)) || 0;
  const comp = Number(str(sp.componente)) || 0;
  const turno = str(sp.turno) as Turno | "";

  const filtro = and(
    gte(programaciones.fecha, desde),
    lte(programaciones.fecha, hasta),
    sede ? eq(programaciones.sedeId, sede) : undefined,
    cap ? eq(programaciones.capacitadorId, cap) : undefined,
    asi ? eq(programaciones.asistenteId, asi) : undefined,
    turno && turno in TURNO_LABEL ? eq(programaciones.turno, turno) : undefined,
    comp
      ? inArray(
          programaciones.sesionId,
          db
            .select({ id: sesiones.id })
            .from(sesiones)
            .innerJoin(modulos, eq(sesiones.moduloId, modulos.id))
            .innerJoin(actividades, eq(modulos.actividadId, actividades.id))
            .where(eq(actividades.componenteId, comp)),
        )
      : undefined,
  );

  const [filas, todasLasSesiones, opciones] = await Promise.all([
    listarProgramaciones(filtro),
    listarProgramaciones(ne(programaciones.estado, "cancelada")),
    opcionesFiltros(),
  ]);
  const cruces = crucesDePersonal(todasLasSesiones);
  const sesionesConCruce = todasLasSesiones.filter((f) => cruces.has(f.id));

  // Número de inscritos por programación
  const conteo = filas.length
    ? await db
        .select({ id: inscripciones.programacionId, n: sql<number>`count(*)::int` })
        .from(inscripciones)
        .where(inArray(inscripciones.programacionId, filas.map((f) => f.id)))
        .groupBy(inscripciones.programacionId)
    : [];
  const inscritos = new Map(conteo.map((c) => [c.id, c.n]));

  const q = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ desde, hasta, ...(sede && { sede: String(sede) }), ...(cap && { capacitador: String(cap) }), ...(asi && { asistente: String(asi) }), ...(comp && { componente: String(comp) }), ...(turno && { turno }), ...cambios });
    return `/estrategico/cronograma?${p}`;
  };

  return (
    <>
      <Encabezado
        antetitulo={`Estratégico · del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`}
        titulo="Cronograma de capacitaciones"
        acciones={
          <>
            <Link href={q({ desde: sumarDias(desde, -7), hasta: sumarDias(hasta, -7) })} className="btn-secundario">← Anterior</Link>
            {!enSemanaActual && <Link href={q({ desde: semanaActual, hasta: sumarDias(semanaActual, 6) })} className="btn-secundario">Esta semana</Link>}
            <Link href={q({ desde: sumarDias(desde, 7), hasta: sumarDias(hasta, 7) })} className="btn-secundario">Siguiente →</Link>
            <SiPuede modulo="cronograma">
            <Link href="/estrategico/cronograma/nueva" className="btn-primario">+ Programar sesión</Link>
            </SiPuede>
          </>
        }
      />

      <Pestanas items={TABS_CRONOGRAMA} actual="/estrategico/cronograma" />

      {sesionesConCruce.length > 0 && (
        <p role="alert" className="rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#991b1b]">
          ⚠ Hay cruces de horario en {sesionesConCruce.length} {sesionesConCruce.length === 1 ? "sesión" : "sesiones"} de todo el cronograma. Este aviso se mantiene aunque cambies el periodo.
          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-normal">
            {sesionesConCruce.slice(0, 8).map((f) => (
              <Link key={f.id} href={`/estrategico/cronograma?desde=${f.fecha}&hasta=${f.fecha}`} className="underline underline-offset-2">
                {fechaCorta(f.fecha)} · {f.sesion.nombre} · {f.sede.nombre}
              </Link>
            ))}
            {sesionesConCruce.length > 8 && <span>y {sesionesConCruce.length - 8} más.</span>}
          </span>
        </p>
      )}

      <form key={`${desde}:${hasta}`} className="card grid grid-cols-2 items-end gap-3.5 px-5 py-4 md:grid-cols-4 xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]">
        <div>
          <label htmlFor="f-desde" className="etiqueta">Desde</label>
          <input id="f-desde" type="date" name="desde" defaultValue={desde} className="campo" />
        </div>
        <div>
          <label htmlFor="f-hasta" className="etiqueta">Hasta</label>
          <input id="f-hasta" type="date" name="hasta" defaultValue={hasta} className="campo" />
        </div>
        <div>
          <label htmlFor="f-sede" className="etiqueta">Sede</label>
          <select id="f-sede" name="sede" defaultValue={sede || ""} className="campo">
            <option value="">Todas</option>
            {opciones.sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-turno" className="etiqueta">Horario</label>
          <select id="f-turno" name="turno" defaultValue={turno} className="campo">
            <option value="">Todos los turnos</option>
            {Object.entries(TURNO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-cap" className="etiqueta">Consultor</label>
          <select id="f-cap" name="capacitador" defaultValue={cap || ""} className="campo">
            <option value="">Todos</option>
            {opciones.capacitadores.map((c) => <option key={c.id} value={c.id}>{nombreCompleto(c)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-asi" className="etiqueta">Asistente</label>
          <select id="f-asi" name="asistente" defaultValue={asi || ""} className="campo">
            <option value="">Todos</option>
            {opciones.asistentes.map((a) => <option key={a.id} value={a.id}>{nombreCompleto(a)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-comp" className="etiqueta">Componente</label>
          <select id="f-comp" name="componente" defaultValue={comp || ""} className="campo">
            <option value="">Todos</option>
            {opciones.componentes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-oscuro flex-1">Filtrar</button>
          <Link href="/estrategico/cronograma" className="btn-secundario">Limpiar</Link>
        </div>
      </form>

      <section className="card overflow-x-auto">
        {filas.length === 0 ? (
          <Vacio>No hay sesiones programadas con estos filtros.</Vacio>
        ) : (
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr>
                <th className="th">Fecha</th><th className="th">Horario</th><th className="th">Sesión</th>
                <th className="th">Sede / Aula</th><th className="th">Consultor · Asistente</th><th className="th">Inscritos</th>
                <th className="th">Estado</th><th className="th">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td className="td font-medium whitespace-nowrap">{fechaCorta(f.fecha)}</td>
                  <td className="td">
                    <div className="flex flex-col">
                      <span className="whitespace-nowrap">{hora(f.horaInicio)} – {hora(f.horaFin)}</span>
                      <span className="text-xs text-texto-2">{TURNO_LABEL[f.turno]}</span>
                      {(cruces.get(f.id) ?? []).map(({ rol, otroRol, persona, otra }, i) => (
                        <span key={`${otra.id}-${rol}-${i}`} className="mt-1 text-xs font-semibold text-[#b91c1c]">
                          ⚠ Cruce de horario: {persona} figura como {rol} aquí y como {otroRol} en {otra.sesion.nombre} · {otra.sede.nombre}, {hora(otra.horaInicio)}–{hora(otra.horaFin)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex flex-col">
                      <span className="font-medium">{f.sesion.nombre}</span>
                      <span className="text-xs text-texto-2">{ruta(f)}</span>
                      {f.observacion && <span className="text-xs italic text-[#92400e]">{f.observacion}</span>}
                      <Combinadas nombres={combinadas(f)} />
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex flex-col">
                      <span>{f.sede.nombre}</span>
                      <span className="text-xs text-texto-2">{f.aula ?? "—"}</span>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex flex-col">
                      <span>{nombreCompleto(f.capacitador)}</span>
                      <span className={`text-xs ${f.asistente ? "text-texto-2" : "font-semibold text-[#92400e]"}`}>
                        {f.asistente ? `Asist.: ${nombreCompleto(f.asistente)}` : "Sin asistente"}
                      </span>
                    </div>
                  </td>
                  <td className="td">{inscritos.get(f.id) ?? 0}{f.cupo ? ` / ${f.cupo}` : ""}</td>
                  <td className="td"><ChipEstado estado={f.estado} sinCapacitador={!f.capacitador} /></td>
                  <td className="td">
                    <div className="flex gap-3 text-[13px]">
                      <Link href={`/operativo/capacitacion/${f.id}`} className="enlace">Asistencia</Link>
                      <Link href={`/estrategico/cronograma/${f.id}`} className="font-semibold text-[#334155] hover:text-marino">Editar</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="border-t border-borde px-5 py-3 text-[13px] text-texto-2">
          {filas.length} {filas.length === 1 ? "sesión" : "sesiones"} en el periodo
        </p>
      </section>
    </>
  );
}
