import { soloCapacitador } from "@/lib/permisos";
import { exigirUsuario, soloSesionesDe } from "@/lib/auth";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, lte, ne, or, inArray } from "drizzle-orm";
import { programaciones, sedes as tablaSedes } from "@/db/schema";
import { db } from "@/db";
import { listarProgramaciones, opcionesFiltros, combinadas } from "@/lib/consultas";
import { contextosDe } from "@/lib/preparacion";
import { etapaActual, resumenFlujo } from "@/lib/flujo-pre";
import { hoyISO, hora, inicioSemana, sumarDias, fechaCorta, fechaLarga } from "@/lib/fechas";
import { Encabezado, nombreCompleto } from "@/components/ui";
import { equivalencias } from "@/lib/disponibilidad";
import ExportarCalendario from "./ExportarCalendario";
import FiltrosFecha from "@/components/FiltrosFecha";

export const metadata = { title: "Calendario" };

type Estado = "pre" | "post" | "cerrada" | "reprogramar";
const ESTADO: Record<Estado, { txt: string; color: string; fondo: string }> = {
  pre: { txt: "Pre-capacitación", color: "#1d4ed8", fondo: "#eff6ff" },
  post: { txt: "Post-capacitación", color: "#7c3aed", fondo: "#f5f3ff" },
  cerrada: { txt: "Cerrada", color: "#15803d", fondo: "#f0fdf4" },
  reprogramar: { txt: "Por reprogramar", color: "#dc2626", fondo: "#fef2f2" },
};
/** Colores para distinguir sedes (se asignan en orden alfabético). */
const PALETA = ["#0e7490", "#c2410c", "#7c3aed", "#15803d", "#b91c1c", "#1d4ed8", "#a16207", "#be185d", "#475569"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const COLUMNAS = [
  { clave: "consultor", titulo: "Consultor" },
  { clave: "region", titulo: "Región" },
  { clave: "sede", titulo: "Sede" },
  { clave: "semana", titulo: "Semana" },
  { clave: "fecha", titulo: "Fecha" },
  { clave: "sesion", titulo: "Sesión" },
  { clave: "fechaLarga", titulo: "Fecha larga" },
  { clave: "estado", titulo: "Estado" },
  { clave: "soporte", titulo: "Soporte" },
] as const;

export default async function Calendario({ searchParams }: PageProps<"/calendario">) {
  await connection();
  const sp = await searchParams;
  const u = await exigirUsuario();
  const hoy = hoyISO();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoy.slice(0, 7);
  const region = Number(sp.region) || 0;
  const sedePedida = Number(sp.sede) || 0;
  const personaPedida = typeof sp.persona === "string" ? sp.persona : Number(sp.capacitador) > 0 ? `cap:${Number(sp.capacitador)}` : Number(sp.asistente) > 0 ? `asis:${Number(sp.asistente)}` : "";
  const componentePedido = Number(sp.componente) || 0;
  const estado = (["pre", "post", "cerrada", "reprogramar"] as const).find((x) => x === sp.estado) ?? null;
  const colorPor = sp.color === "sede" ? "sede" : "estado";
  const vista = sp.vista === "tabla" ? "tabla" : "mes";
  const enlaceSesion = (id: number) => `/operativo/capacitaciones/${id}`;
  const orden = COLUMNAS.find((c) => c.clave === sp.orden)?.clave ?? "fecha";
  const direccion = sp.direccion === "desc" ? "desc" : "asc";

  // Cuadrícula: de lunes a domingo, cubriendo el mes completo
  const primero = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const esFecha = (valor: unknown): valor is string => typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor;
  const rangoPersonalizado = esFecha(sp.desde) || esFecha(sp.hasta);
  const inicioPedido = esFecha(sp.desde) ? sp.desde : primero;
  const finPedido = esFecha(sp.hasta) ? sp.hasta : ultimo;
  const inicio = inicioPedido <= finPedido ? inicioPedido : finPedido;
  const fin = inicioPedido <= finPedido ? finPedido : inicioPedido;
  const desde = inicioSemana(inicio);
  const hasta = sumarDias(inicioSemana(fin), 6);
  const mesAnterior = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const mesSiguiente = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  const [{ sedes, capacitadores, componentes, asistentes, estructuras }, equivalentes] = await Promise.all([opcionesFiltros(), equivalencias()]);
  const sede = region && !sedes.some((s) => s.id === sedePedida && s.estructuraId === region) ? 0 : sedePedida;
  const componente = region && !componentes.some((c) => c.id === componentePedido && c.estructuraId === region) ? 0 : componentePedido;
  const personas = capacitadores.map((c) => ({ id: `cap:${c.id}`, t: nombreCompleto(c), capIds: [c.id], asisIds: [] as number[] }));
  for (const asistente of asistentes) {
    const caps = equivalentes.capacitadoresDe(asistente.id);
    const grupos = personas.filter((p) => p.capIds.some((id) => caps.includes(id)));
    if (!grupos.length) personas.push({ id: `asis:${asistente.id}`, t: nombreCompleto(asistente), capIds: caps, asisIds: [asistente.id] });
    else {
      const grupo = grupos[0];
      grupo.asisIds.push(asistente.id);
      grupo.capIds = [...new Set([...grupo.capIds, ...caps, ...grupos.flatMap((p) => p.capIds)])];
      grupo.asisIds = [...new Set([...grupo.asisIds, ...grupos.slice(1).flatMap((p) => p.asisIds)])];
      for (const otro of grupos.slice(1)) personas.splice(personas.indexOf(otro), 1);
    }
  }
  for (const persona of personas) persona.asisIds = [...new Set([...persona.asisIds, ...persona.capIds.flatMap((id) => equivalentes.personalDe(id))])];
  personas.sort((a, b) => a.t.localeCompare(b.t, "es"));
  const seleccionada = personas.find((p) => p.id === personaPedida || p.capIds.some((id) => personaPedida === `cap:${id}`) || p.asisIds.some((id) => personaPedida === `asis:${id}`));
  const persona = seleccionada?.id ?? "";
  const lista = await listarProgramaciones(
      and(
        gte(programaciones.fecha, rangoPersonalizado ? inicio : desde),
        lte(programaciones.fecha, rangoPersonalizado ? fin : hasta),
        ne(programaciones.estado, "cancelada"),
        region ? inArray(programaciones.sedeId, db.select({ id: tablaSedes.id }).from(tablaSedes).where(eq(tablaSedes.estructuraId, region))) : undefined,
        sede ? eq(programaciones.sedeId, sede) : undefined,
        seleccionada ? or(
          seleccionada.capIds.length ? inArray(programaciones.capacitadorId, seleccionada.capIds) : undefined,
          seleccionada.asisIds.length ? inArray(programaciones.asistenteId, seleccionada.asisIds) : undefined,
        ) : undefined,
        soloSesionesDe(u),
      ),
    );
  const ctxs = await contextosDe(lista);

  const colorSede = new Map(sedes.map((s, i) => [s.id, PALETA[i % PALETA.length]]));
  const eventos = lista
    .map((p) => {
      const ctx = ctxs.get(p.id)!;
      const etapa = etapaActual(ctx);
      const r = resumenFlujo(ctx, etapa);
      const est: Estado = r.reprogramada || r.noRealizada ? "reprogramar" : r.cerrada ? "cerrada" : etapa;
      return { p, est, pct: r.porcentaje };
    })
    .filter((x) => (!estado || x.est === estado) && (!componente || x.p.sesion.modulo.actividad.componenteId === componente));

  const porDia = new Map<string, typeof eventos>();
  for (const ev of eventos) porDia.set(ev.p.fecha, [...(porDia.get(ev.p.fecha) ?? []), ev]);
  const delMes = eventos.filter((x) => x.p.fecha >= inicio && x.p.fecha <= fin);
  const valorOrden = ({ p, est }: (typeof eventos)[number]) => {
    switch (orden) {
      case "consultor": return p.capacitador ? nombreCompleto(p.capacitador) : "";
      case "region": return estructuras.find((e) => e.id === p.sede.estructuraId)?.nombre ?? "";
      case "sede": return p.sede.nombre;
      case "sesion": return [p.sesion.nombre, ...combinadas(p)].join(" + ");
      case "estado": return ESTADO[est].txt;
      case "soporte": return p.asistente ? nombreCompleto(p.asistente) : "";
      case "semana": return inicioSemana(p.fecha);
      default: return `${p.fecha} ${p.horaInicio}`;
    }
  };
  const filasTabla = [...delMes].sort((a, b) => {
    const primero = valorOrden(a);
    const segundo = valorOrden(b);
    if (!primero || !segundo) return primero ? -1 : segundo ? 1 : a.p.id - b.p.id;
    const comparacion = primero.localeCompare(segundo, "es", { sensitivity: "base", numeric: true });
    return comparacion * (direccion === "desc" ? -1 : 1) || a.p.fecha.localeCompare(b.p.fecha) || a.p.horaInicio.localeCompare(b.p.horaInicio) || a.p.id - b.p.id;
  });
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);

  const params = { region, sede, persona, componente, estado: estado ?? "", color: colorPor === "sede" ? "sede" : "", vista, desde: rangoPersonalizado ? inicio : "", hasta: rangoPersonalizado ? fin : "", orden, direccion };
  const duracion = Math.round((Date.parse(fin) - Date.parse(inicio)) / 86400000) + 1;
  const url = (extra: Record<string, string | number>) =>
    `/calendario?${new URLSearchParams(
      Object.entries({ mes, ...params, ...extra })
        .filter(([, v]) => v)
        .map(([k, v]) => [k, String(v)]),
    )}`;

  return (
    <>
      <Encabezado
        antetitulo={`Calendario · ${delMes.length} sesiones en el período`}
        titulo="Calendario de capacitaciones"
      />

      <nav aria-label="Vista del calendario" className="flex flex-wrap items-center gap-2">
        <Link href={url({ vista: "mes" })} aria-current={vista === "mes" ? "page" : undefined} className={vista === "mes" ? "btn-oscuro" : "btn-secundario"}>Vista mensual</Link>
        <Link href={url({ vista: "tabla" })} aria-current={vista === "tabla" ? "page" : undefined} className={vista === "tabla" ? "btn-oscuro" : "btn-secundario"}>Vista de tabla</Link>
        <ExportarCalendario columnas={["Consultor", "Región", "Sede", "Semana", "Fecha", "Horario", "Sesión", "Fecha larga", "Estado", "Soporte"]} inicio={inicio} fin={fin} filas={filasTabla.map(({ p, est }) => {
          const mesEvento = Number(p.fecha.slice(5, 7));
          const semana = Math.floor((Date.parse(p.fecha) - Date.parse(inicioSemana(`${p.fecha.slice(0, 7)}-01`))) / (7 * 86400000)) + 1;
          return [p.capacitador ? nombreCompleto(p.capacitador) : "Sin asignar", estructuras.find((e) => e.id === p.sede.estructuraId)?.nombre ?? "—", p.sede.nombre, `Semana ${semana} de ${MESES[mesEvento - 1]}`, fechaCorta(p.fecha), `${hora(p.horaInicio)}–${hora(p.horaFin)}`, [p.sesion.nombre, ...combinadas(p)].join(" + "), fechaLarga(p.fecha), ESTADO[est].txt, p.asistente ? nombreCompleto(p.asistente) : "—"];
        })} />
      </nav>

      <form key={`${inicio}:${fin}:${region}`} aria-label="Filtros" className="card flex flex-wrap items-end gap-3 px-5 py-4">
        <input type="hidden" name="mes" value={mes} />
        <input type="hidden" name="vista" value={vista} />
        <input type="hidden" name="orden" value={orden} />
        <input type="hidden" name="direccion" value={direccion} />
        <FiltrosFecha inicio={inicio} fin={fin} prefijo="c" className="w-full sm:w-44" />
        <div className="w-full sm:w-44">
          <label htmlFor="c-region" className="etiqueta">Región</label>
          <select id="c-region" name="region" defaultValue={region || ""} className="campo">
            <option value="">Todas las regiones</option>
            {estructuras.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        {[
          { n: "sede", l: "Sede", v: sede, o: sedes.filter((s) => !region || s.estructuraId === region).map((x) => ({ id: x.id, t: x.nombre })) },
          { n: "componente", l: "Componente", v: componente, o: componentes.filter((c) => !region || c.estructuraId === region).map((x) => ({ id: x.id, t: x.nombre })) },
          { n: "persona", l: "Persona", v: persona, o: personas },
        ].filter((f) => !soloCapacitador(u.roles) || f.n === "sede" || f.n === "componente").map((f) => (
          <div key={f.n} className="w-full sm:w-44">
            <label htmlFor={`c-${f.n}`} className="etiqueta">{f.l}</label>
            <select id={`c-${f.n}`} name={f.n} defaultValue={f.v || ""} className="campo">
              <option value="">Todos</option>
              {f.n === "sede" ? estructuras.filter((r) => !region || r.id === region).map((r) => {
                const opciones = sedes.filter((s) => s.estructuraId === r.id);
                return opciones.length ? <optgroup key={r.id} label={r.nombre}>{opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</optgroup> : null;
              }) : f.o.map((o) => <option key={o.id} value={o.id}>{o.t}</option>)}
            </select>
          </div>
        ))}
        <div className="w-full sm:w-44">
          <label htmlFor="c-estado" className="etiqueta">Estado del proceso</label>
          <select id="c-estado" name="estado" defaultValue={estado ?? ""} className="campo">
            <option value="">Todos</option>
            {(Object.keys(ESTADO) as Estado[]).map((k) => <option key={k} value={k}>{ESTADO[k].txt}</option>)}
          </select>
        </div>
        <div className="w-full sm:w-40">
          <label htmlFor="c-color" className="etiqueta">Colorear por</label>
          <select id="c-color" name="color" defaultValue={colorPor} className="campo">
            <option value="estado">Estado</option>
            <option value="sede">Sede</option>
          </select>
        </div>
        <button className="btn-oscuro">Filtrar</button>
        <Link href={`/calendario?mes=${mes}&vista=${vista}`} className="btn-secundario">Limpiar</Link>
      </form>

      <section aria-label="Leyenda y resumen" className="flex flex-wrap items-center gap-2">
        {colorPor === "estado"
          ? (Object.keys(ESTADO) as Estado[]).map((k) => (
              <Link
                key={k}
                href={url({ estado: estado === k ? "" : k })}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${estado === k ? "border-marino bg-marino text-white" : "border-borde bg-white"}`}
              >
                <span className="size-2.5 rounded-full" style={{ background: ESTADO[k].color }} />
                {ESTADO[k].txt}
                <span className="font-semibold">{delMes.filter((x) => x.est === k).length}</span>
              </Link>
            ))
          : sedes
              .filter((s) => delMes.some((x) => x.p.sedeId === s.id))
              .map((s) => (
                <Link
                  key={s.id}
                  href={url({ sede: sede === s.id ? "" : s.id })}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${sede === s.id ? "border-marino bg-marino text-white" : "border-borde bg-white"}`}
                >
                  <span className="size-2.5 rounded-full" style={{ background: colorSede.get(s.id) }} />
                  {s.nombre}
                  <span className="font-semibold">{delMes.filter((x) => x.p.sedeId === s.id).length}</span>
                </Link>
              ))}
      </section>

      <nav aria-label="Navegar por fechas" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-texto-2">Del {fechaCorta(inicio)} al {fechaCorta(fin)}</p>
        <div className="flex gap-2">
          <Link href={url(rangoPersonalizado ? { desde: sumarDias(inicio, -duracion), hasta: sumarDias(inicio, -1) } : { mes: mesAnterior })} className="btn-secundario" aria-label="Período anterior">← Anterior</Link>
          <Link href={url({ mes: hoy.slice(0, 7), desde: "", hasta: "" })} className="btn-secundario">Hoy</Link>
          <Link href={url(rangoPersonalizado ? { desde: sumarDias(fin, 1), hasta: sumarDias(fin, duracion) } : { mes: mesSiguiente })} className="btn-secundario" aria-label="Período siguiente">Siguiente →</Link>
        </div>
      </nav>

      {vista === "tabla" ? <section aria-label="Capacitaciones en tabla" className="card overflow-x-auto">
        <table className="w-full min-w-[1300px] text-sm">
          <caption className="sr-only">Capacitaciones del {fechaCorta(inicio)} al {fechaCorta(fin)}. Ordenadas por {COLUMNAS.find((c) => c.clave === orden)?.titulo}, {direccion === "asc" ? "ascendente" : "descendente"}.</caption>
          <thead className="bg-marino text-white"><tr>{COLUMNAS.map(({ clave, titulo }) => <th key={clave} scope="col" aria-sort={orden === clave ? direccion === "asc" ? "ascending" : "descending" : "none"} className="whitespace-nowrap px-3 py-3 text-left font-semibold"><Link href={url({ orden: clave, direccion: orden === clave && direccion === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-2 hover:underline" title={`Ordenar por ${titulo}`}><span>{titulo}</span><span aria-hidden="true">{orden === clave ? direccion === "asc" ? "↑" : "↓" : "↕"}</span></Link></th>)}</tr></thead>
          <tbody>{filasTabla.map(({ p, est }) => {
            const mesEvento = Number(p.fecha.slice(5, 7));
            const semana = Math.floor((Date.parse(`${p.fecha}T00:00:00Z`) - Date.parse(`${inicioSemana(`${p.fecha.slice(0, 7)}-01`)}T00:00:00Z`)) / (7 * 86400000)) + 1;
            return <tr key={p.id} className="border-b border-borde odd:bg-white even:bg-[#eef4f8] hover:bg-[#e3efea]">
              <td className="px-3 py-2">{p.capacitador ? nombreCompleto(p.capacitador) : "Sin asignar"}</td>
              <td className="px-3 py-2">{estructuras.find((e) => e.id === p.sede.estructuraId)?.nombre ?? "—"}</td>
              <td className="px-3 py-2">{p.sede.nombre}</td>
              <td className="whitespace-nowrap px-3 py-2">Semana {semana} de {MESES[mesEvento - 1]}</td>
              <td className="whitespace-nowrap px-3 py-2">{fechaCorta(p.fecha)}<span className="block text-xs text-texto-2">{hora(p.horaInicio)}–{hora(p.horaFin)}</span></td>
              <td className="min-w-72 px-3 py-2"><Link href={enlaceSesion(p.id)} className="enlace">{[p.sesion.nombre, ...combinadas(p)].join(" + ")}</Link></td>
              <td className="whitespace-nowrap px-3 py-2">{fechaLarga(p.fecha)}</td>
              <td className="px-3 py-2"><span className="inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold" style={{ color: ESTADO[est].color, background: ESTADO[est].fondo }}>{ESTADO[est].txt}</span></td>
              <td className="px-3 py-2">{p.asistente ? nombreCompleto(p.asistente) : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
        {!delMes.length && <p className="px-5 py-8 text-center text-texto-2">No hay capacitaciones en este rango de fechas con los filtros seleccionados.</p>}
        <p className="border-t border-borde px-4 py-3 text-xs text-texto-2">{delMes.length} capacitaciones · Semanas de lunes a domingo dentro del calendario del mes.</p>
      </section> : <section className="card overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-7">
          {DIAS.map((d, i) => (
            <div key={d} className={`border-b border-borde px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide ${i >= 5 ? "text-acento" : "text-texto-2"}`}>{d}</div>
          ))}
          {dias.map((d, i) => {
            const evs = (porDia.get(d) ?? []).sort((a, b) => a.p.horaInicio.localeCompare(b.p.horaInicio));
            const fuera = d < inicio || d > fin;
            const esHoy = d === hoy;
            return (
              <div
                key={d}
                className={`flex min-h-36 flex-col gap-1 border-b border-r border-borde p-2 ${i % 7 === 6 ? "border-r-0" : ""} ${fuera ? "bg-[#f5f6f7]" : i % 7 >= 5 ? "bg-[#fffbf7]" : "bg-white"}`}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span
                    className={`rounded px-1.5 py-1 text-xs font-semibold ${esHoy ? "bg-acento text-white" : fuera ? "text-texto-2" : "text-marino"}`}
                  >
                    {fechaCorta(d)}
                  </span>
                  {evs.length > 0 && <span className="text-[10px] text-texto-2">{evs.length} ses.</span>}
                </div>
                {evs.slice(0, 4).map(({ p, est, pct }) => {
                  const c = colorPor === "sede" ? colorSede.get(p.sedeId) ?? "#475569" : ESTADO[est].color;
                  return (
                    <Link
                      key={p.id}
                      href={enlaceSesion(p.id)}
                      title={`${hora(p.horaInicio)}–${hora(p.horaFin)} · ${p.sesion.codigo} ${p.sesion.nombre}\n${p.sede.nombre} · ${nombreCompleto(p.capacitador)}\n${ESTADO[est].txt} · ${pct}% del flujo`}
                      className={`block rounded border-l-[3px] px-2 py-1.5 text-xs transition-shadow hover:shadow ${fuera ? "opacity-50" : ""}`}
                      style={{ borderLeftColor: c, background: colorPor === "sede" ? `${c}14` : ESTADO[est].fondo }}
                    >
                      <span className="block font-semibold" style={{ color: c }}>{hora(p.horaInicio)}–{hora(p.horaFin)} · {p.sede.nombre}</span>
                      <span className="mt-0.5 block text-texto">{[p.sesion.nombre, ...combinadas(p)].join(" + ")}</span>
                      <span className="mt-1 block text-[11px] text-texto-2">{p.capacitador ? nombreCompleto(p.capacitador) : "Sin consultor"}{p.asistente ? ` · ${nombreCompleto(p.asistente)}` : ""}</span>
                    </Link>
                  );
                })}
                {evs.length > 4 && (
                  <Link href={`/operativo/capacitaciones?desde=${d}&hasta=${d}`} className="px-1 text-[11px] font-semibold text-marino hover:underline">
                    +{evs.length - 4} más
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>}
    </>
  );
}
