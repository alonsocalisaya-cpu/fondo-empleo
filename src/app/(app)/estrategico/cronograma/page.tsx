import SiPuede from "@/components/SiPuede";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { actividades, inscripciones, modulos, componentes, programaciones, sesiones, type Turno } from "@/db/schema";
import { listarProgramaciones, opcionesFiltros, combinadas, type ProgramacionConRuta } from "@/lib/consultas";
import { fechaCorta, fechaLarga, hoyISO, hora, inicioSemana, sumarDias, TURNO_LABEL } from "@/lib/fechas";
import { ChipEstado, Encabezado, Pestanas, TABS_CRONOGRAMA, Vacio, nombreCompleto } from "@/components/ui";
import FiltrosFecha from "@/components/FiltrosFecha";
import ExportarCalendario from "../../calendario/ExportarCalendario";
import { equivalencias } from "@/lib/disponibilidad";
import CalendarioCronograma from "./CalendarioCronograma";
import FiltroEstadosProgramacion from "@/components/FiltroEstadosProgramacion";
import FiltroPersonas from "@/components/FiltroPersonas";

export const metadata = { title: "Cronograma de capacitaciones" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const COLUMNAS = [
  { clave: "consultor", titulo: "Consultor" }, { clave: "region", titulo: "Región" },
  { clave: "sede", titulo: "Sede" }, { clave: "semana", titulo: "Semana" },
  { clave: "fecha", titulo: "Fecha" }, { clave: "sesion", titulo: "Sesión" },
  { clave: "fechaLarga", titulo: "Fecha larga" }, { clave: "estado", titulo: "Estado" },
  { clave: "soporte", titulo: "Soporte" }, { clave: "inscritos", titulo: "Inscritos" },
] as const;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const semanaDe = (fecha: string) => `Semana ${Math.floor((Date.parse(fecha) - Date.parse(inicioSemana(`${fecha.slice(0, 7)}-01`))) / (7 * 86400000)) + 1} de ${MESES[Number(fecha.slice(5, 7)) - 1]}`;
const ESTADOS: Record<ProgramacionConRuta["estado"], string> = { programada: "Programada", confirmada: "Confirmada", finalizada: "Finalizada", cancelada: "Cancelada", reprogramada: "Reprogramada" };

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
  const vista = sp.vista === "calendario" ? "calendario" : "tabla";
  const pedidos = (Array.isArray(sp.estados) ? sp.estados : [str(sp.estados)]).flatMap((x) => x.split(","));
  const estados = (Object.keys(ESTADOS) as ProgramacionConRuta["estado"][]).filter((e) => pedidos.includes(e));
  const desde = esFecha(str(sp.desde)) ? str(sp.desde) : inicioSemana(hoyISO());
  const hasta = esFecha(str(sp.hasta)) ? str(sp.hasta) : sumarDias(desde, 6);
  const semanaActual = inicioSemana(hoyISO());
  const enSemanaActual = desde === semanaActual && hasta === sumarDias(semanaActual, 6);
  const [opciones, equivalentes] = await Promise.all([opcionesFiltros(), equivalencias()]);
  const programa = Number(str(sp.programa)) || 0;
  const sedePedida = Number(str(sp.sede)) || 0;
  const sede = programa && !opciones.sedes.some(s=>s.id===sedePedida && s.estructuraId===programa) ? 0 : sedePedida;
  const personasPedidas = (Array.isArray(sp.persona) ? sp.persona : [str(sp.persona) || (Number(sp.capacitador) > 0 ? `cap:${Number(sp.capacitador)}` : Number(sp.asistente) > 0 ? `asis:${Number(sp.asistente)}` : "")]).flatMap((p) => p.split(",")).filter(Boolean);
  const sinAsignar = personasPedidas.includes("sin-asignar");
  const personas = opciones.capacitadores.map((c) => ({ id: `cap:${c.id}`, nombre: nombreCompleto(c), capIds: [c.id], asisIds: [] as number[] }));
  for (const asistente of opciones.asistentes) {
    const caps = equivalentes.capacitadoresDe(asistente.id);
    const grupos = personas.filter((p) => p.capIds.some((id) => caps.includes(id)));
    if (!grupos.length) personas.push({ id: `asis:${asistente.id}`, nombre: nombreCompleto(asistente), capIds: caps, asisIds: [asistente.id] });
    else {
      const grupo = grupos[0];
      grupo.capIds = [...new Set([...caps, ...grupos.flatMap((p) => p.capIds)])];
      grupo.asisIds = [...new Set([asistente.id, ...grupos.flatMap((p) => p.asisIds)])];
      for (const otro of grupos.slice(1)) personas.splice(personas.indexOf(otro), 1);
    }
  }
  for (const p of personas) p.asisIds = [...new Set([...p.asisIds, ...p.capIds.flatMap((id) => equivalentes.personalDe(id))])];
  personas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const seleccionadas = personas.filter((p) => personasPedidas.includes(p.id) || p.capIds.some((id) => personasPedidas.includes(`cap:${id}`)) || p.asisIds.some((id) => personasPedidas.includes(`asis:${id}`)));
  const persona = [...seleccionadas.map((p) => p.id), ...(sinAsignar ? ["sin-asignar"] : [])].join(",");
  const capIds = [...new Set(seleccionadas.flatMap((p) => p.capIds))];
  const asisIds = [...new Set(seleccionadas.flatMap((p) => p.asisIds))];
  const compPedido = Number(str(sp.componente)) || 0;
  const comp = programa && !opciones.componentes.some(c=>c.id===compPedido && c.estructuraId===programa) ? 0 : compPedido;
  const turno = str(sp.turno) as Turno | "";
  const orden = COLUMNAS.find((c) => c.clave === sp.orden)?.clave ?? "fecha";
  const direccion = sp.direccion === "desc" ? "desc" : "asc";

  const filtro = and(
    estados.length ? inArray(programaciones.estado, estados) : ne(programaciones.estado, "cancelada"),
    gte(programaciones.fecha, desde),
    lte(programaciones.fecha, hasta),
    sede ? eq(programaciones.sedeId, sede) : undefined,
    seleccionadas.length || sinAsignar ? or(
      capIds.length ? inArray(programaciones.capacitadorId, capIds) : undefined,
      asisIds.length ? inArray(programaciones.asistenteId, asisIds) : undefined,
      sinAsignar ? or(isNull(programaciones.capacitadorId), isNull(programaciones.asistenteId)) : undefined,
    ) : undefined,
    turno && turno in TURNO_LABEL ? eq(programaciones.turno, turno) : undefined,
    programa ? inArray(programaciones.sesionId, db.select({id:sesiones.id}).from(sesiones)
      .innerJoin(modulos,eq(sesiones.moduloId,modulos.id))
      .innerJoin(actividades,eq(modulos.actividadId,actividades.id))
      .innerJoin(componentes,eq(actividades.componenteId,componentes.id))
      .where(eq(componentes.estructuraId,programa))) : undefined,
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

  const [filas, todasLasSesiones] = await Promise.all([
    listarProgramaciones(filtro),
    listarProgramaciones(ne(programaciones.estado, "cancelada")),
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
  const regionDe = (f: ProgramacionConRuta) => opciones.estructuras.find((e) => e.id === f.sede.estructuraId)?.nombre ?? "—";
  const valorOrden = (f: ProgramacionConRuta): string | number => {
    switch (orden) {
      case "consultor": return f.capacitador ? nombreCompleto(f.capacitador) : "";
      case "region": return regionDe(f);
      case "sede": return f.sede.nombre;
      case "semana": return inicioSemana(f.fecha);
      case "sesion": return [f.sesion.nombre, ...combinadas(f)].join(" + ");
      case "estado": return ESTADOS[f.estado];
      case "soporte": return f.asistente ? nombreCompleto(f.asistente) : "";
      case "inscritos": return inscritos.get(f.id) ?? 0;
      default: return `${f.fecha} ${f.horaInicio}`;
    }
  };
  const filasOrdenadas = [...filas].sort((a, b) => {
    const x = valorOrden(a), z = valorOrden(b);
    if (x === "" || z === "") return x === "" ? z === "" ? a.id - b.id : 1 : -1;
    const comparacion = typeof x === "number" && typeof z === "number" ? x - z : String(x).localeCompare(String(z), "es", { sensitivity: "base", numeric: true });
    return comparacion * (direccion === "desc" ? -1 : 1) || a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio) || a.id - b.id;
  });

  const q = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ desde, hasta, orden, direccion, vista, ...(programa && { programa: String(programa) }), ...(sede && { sede: String(sede) }), ...(persona && { persona }), ...(comp && { componente: String(comp) }), ...(turno && { turno }), ...cambios });
    if (estados.length) p.set("estados", estados.join(","));
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
      <nav aria-label="Vista del cronograma" className="flex flex-wrap gap-2">
        <Link href={q({ vista: "tabla" })} aria-current={vista === "tabla" ? "page" : undefined} className={vista === "tabla" ? "btn-oscuro" : "btn-secundario"}>Vista de tabla</Link>
        <Link href={q({ vista: "calendario" })} aria-current={vista === "calendario" ? "page" : undefined} className={vista === "calendario" ? "btn-oscuro" : "btn-secundario"}>Vista de calendario</Link>
      </nav>

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

      <form key={`${desde}:${hasta}:${estados.join(",")}:${persona}`} className="card grid grid-cols-2 items-end gap-3.5 px-5 py-4 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <input type="hidden" name="vista" value={vista} />
        <input type="hidden" name="orden" value={orden} /><input type="hidden" name="direccion" value={direccion} />
        <FiltrosFecha inicio={desde} fin={hasta} prefijo="f" />
        <div>
          <label htmlFor="f-region" className="etiqueta">Región</label>
          <select id="f-region" name="programa" defaultValue={programa || ""} className="campo"><option value="">Todas las regiones</option>{opciones.estructuras.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        </div>
        <div>
          <label htmlFor="f-sede" className="etiqueta">Sede</label>
          <select id="f-sede" name="sede" defaultValue={sede || ""} className="campo">
            <option value="">Todas</option>
            {opciones.sedes.filter(s=>!programa || s.estructuraId===programa).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-turno" className="etiqueta">Horario</label>
          <select id="f-turno" name="turno" defaultValue={turno} className="campo">
            <option value="">Todos los turnos</option>
            {Object.entries(TURNO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <FiltroPersonas personas={[{ id: "sin-asignar", nombre: "Sin asignar (consultor o soporte)" }, ...personas.map((p) => ({ id: p.id, nombre: p.nombre }))]} seleccionadas={[...seleccionadas.map((p) => p.id), ...(sinAsignar ? ["sin-asignar"] : [])]} />
        <div>
          <label htmlFor="f-comp" className="etiqueta">Componente</label>
          <select id="f-comp" name="componente" defaultValue={comp || ""} className="campo">
            <option value="">Todos</option>
            {opciones.componentes.filter(c=>!programa || c.estructuraId===programa).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <FiltroEstadosProgramacion seleccionados={estados} />
        <div className="flex gap-2">
          <button className="btn-oscuro flex-1">Filtrar</button>
          <Link href={`/estrategico/cronograma?vista=${vista}`} className="btn-secundario">Limpiar</Link>
        </div>
      </form>

      <ExportarCalendario titulo="Cronograma de capacitaciones" inicio={desde} fin={hasta} columnas={["Consultor", "Región", "Sede", "Semana", "Fecha", "Horario", "Sesión", "Fecha larga", "Estado", "Soporte", "Inscritos"]} filas={filasOrdenadas.map((f) => [f.capacitador ? nombreCompleto(f.capacitador) : "Sin asignar", regionDe(f), f.sede.nombre, semanaDe(f.fecha), fechaCorta(f.fecha), `${hora(f.horaInicio)}–${hora(f.horaFin)}`, [f.sesion.nombre, ...combinadas(f)].join(" + "), fechaLarga(f.fecha), ESTADOS[f.estado], f.asistente ? nombreCompleto(f.asistente) : "—", String(inscritos.get(f.id) ?? 0)])} />
      {vista === "calendario" ? <CalendarioCronograma filas={filas} desde={desde} hasta={hasta} volver={q({})} /> : <section className="card overflow-x-auto">
        {filas.length === 0 ? (
          <Vacio>No hay sesiones programadas con estos filtros.</Vacio>
        ) : (
          <table className="w-full min-w-[1500px] text-sm [&_td]:px-3 [&_td]:py-2 [&_td]:align-middle">
            <thead className="bg-marino text-white">
              <tr>
                {COLUMNAS.map(({ clave, titulo }) => <th key={clave} scope="col" aria-sort={orden === clave ? direccion === "asc" ? "ascending" : "descending" : "none"} className="whitespace-nowrap px-3 py-3 text-left font-semibold"><Link href={q({ orden: clave, direccion: orden === clave && direccion === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-2 hover:underline" title={`Ordenar por ${titulo}`}>{titulo}<span aria-hidden="true">{orden === clave ? direccion === "asc" ? "↑" : "↓" : "↕"}</span></Link></th>)}
                <th scope="col" className="px-3 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filasOrdenadas.map((f) => (
                <tr key={f.id} className="border-b border-borde odd:bg-white even:bg-[#eef4f8] hover:bg-[#e3efea]">
                  <td className="td">{f.capacitador ? nombreCompleto(f.capacitador) : "Sin asignar"}</td>
                  <td className="td">{regionDe(f)}</td>
                  <td className="td max-w-48" title={f.aula ?? undefined}>{f.sede.nombre}</td>
                  <td className="td whitespace-nowrap">{semanaDe(f.fecha)}</td>
                  <td className="td">
                    <span className="font-medium whitespace-nowrap">{fechaCorta(f.fecha)}</span>
                    <div className="flex flex-col">
                      <span className="whitespace-nowrap text-xs text-texto-2">{hora(f.horaInicio)}–{hora(f.horaFin)}</span>
                      {(cruces.get(f.id) ?? []).map(({ rol, otroRol, persona, otra }, i) => (
                        <span key={`${otra.id}-${rol}-${i}`} className="mt-1 text-xs font-semibold text-[#b91c1c]">
                          ⚠ Cruce de horario: {persona} figura como {rol} aquí y como {otroRol} en {otra.sesion.nombre} · {otra.sede.nombre}, {hora(otra.horaInicio)}–{hora(otra.horaFin)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="td min-w-72" title={f.observacion ?? undefined}>
                    <Link href={`/operativo/capacitaciones/${f.id}`} className="enlace font-semibold">{[f.sesion.nombre, ...combinadas(f)].join(" + ")}</Link>
                  </td>
                  <td className="td whitespace-nowrap">{fechaLarga(f.fecha)}</td>
                  <td className="td"><ChipEstado estado={f.estado} sinCapacitador={!f.capacitador} /></td>
                  <td className="td">{f.asistente ? nombreCompleto(f.asistente) : "—"}</td>
                  <td className="td">{inscritos.get(f.id) ?? 0}{f.cupo ? ` / ${f.cupo}` : ""}</td>
                  <td className="td">
                    <div className="flex gap-3 text-[13px]">
                      <Link href={`/operativo/capacitacion/${f.id}`} className="enlace">Asistencia</Link>
                      <Link href={`/estrategico/cronograma/${f.id}?volver=${encodeURIComponent(q({}))}`} className="font-semibold text-[#334155] hover:text-marino">Editar</Link>
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
      </section>}
    </>
  );
}
