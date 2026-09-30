import { soloCapacitador } from "@/lib/permisos";
import { exigirUsuario, soloSesionesDe } from "@/lib/auth";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { programaciones } from "@/db/schema";
import { listarProgramaciones, opcionesFiltros } from "@/lib/consultas";
import { contextosDe } from "@/lib/preparacion";
import { etapaActual, resumenFlujo } from "@/lib/flujo-pre";
import { hoyISO, hora, inicioSemana, sumarDias } from "@/lib/fechas";
import { Encabezado, nombreCompleto } from "@/components/ui";

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

export default async function Calendario({ searchParams }: PageProps<"/calendario">) {
  await connection();
  const sp = await searchParams;
  const u = await exigirUsuario();
  const hoy = hoyISO();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoy.slice(0, 7);
  const sede = Number(sp.sede) || 0;
  const capacitador = Number(sp.capacitador) || 0;
  const asistente = Number(sp.asistente) || 0;
  const componente = Number(sp.componente) || 0;
  const estado = (["pre", "post", "cerrada", "reprogramar"] as const).find((x) => x === sp.estado) ?? null;
  const colorPor = sp.color === "sede" ? "sede" : "estado";

  // Cuadrícula: de lunes a domingo, cubriendo el mes completo
  const primero = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const desde = inicioSemana(primero);
  const hasta = sumarDias(inicioSemana(ultimo), 6);
  const mesAnterior = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const mesSiguiente = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  const [lista, { sedes, capacitadores, componentes, asistentes }] = await Promise.all([
    listarProgramaciones(
      and(
        gte(programaciones.fecha, desde),
        lte(programaciones.fecha, hasta),
        ne(programaciones.estado, "cancelada"),
        sede ? eq(programaciones.sedeId, sede) : undefined,
        capacitador ? eq(programaciones.capacitadorId, capacitador) : undefined,
        asistente ? eq(programaciones.asistenteId, asistente) : undefined,
        soloSesionesDe(u),
      ),
    ),
    opcionesFiltros(),
  ]);
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
  const delMes = eventos.filter((x) => x.p.fecha.startsWith(mes));
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);

  const params = { sede, capacitador, asistente, componente, estado: estado ?? "", color: colorPor === "sede" ? "sede" : "" };
  const url = (extra: Record<string, string | number>) =>
    `/calendario?${new URLSearchParams(
      Object.entries({ mes, ...params, ...extra })
        .filter(([, v]) => v)
        .map(([k, v]) => [k, String(v)]),
    )}`;

  return (
    <>
      <Encabezado
        antetitulo={`Calendario · ${delMes.length} sesiones en el mes`}
        titulo={`${MESES[m - 1].charAt(0).toUpperCase()}${MESES[m - 1].slice(1)} ${y}`}
        acciones={
          <div className="flex gap-2">
            <Link href={url({ mes: mesAnterior })} className="btn-secundario" aria-label="Mes anterior">← Anterior</Link>
            <Link href={url({ mes: hoy.slice(0, 7) })} className="btn-secundario">Hoy</Link>
            <Link href={url({ mes: mesSiguiente })} className="btn-secundario" aria-label="Mes siguiente">Siguiente →</Link>
          </div>
        }
      />

      <form aria-label="Filtros" className="card flex flex-wrap items-end gap-3 px-5 py-4">
        <input type="hidden" name="mes" value={mes} />
        {[
          { n: "sede", l: "Sede", v: sede, o: sedes.map((x) => ({ id: x.id, t: x.nombre })) },
          { n: "componente", l: "Componente", v: componente, o: componentes.map((x) => ({ id: x.id, t: x.nombre })) },
          { n: "capacitador", l: "Capacitador", v: capacitador, o: capacitadores.map((x) => ({ id: x.id, t: nombreCompleto(x) })) },
          { n: "asistente", l: "Asistente", v: asistente, o: asistentes.map((x) => ({ id: x.id, t: nombreCompleto(x) })) },
        ].filter((f) => !soloCapacitador(u.roles) || f.n === "sede" || f.n === "componente").map((f) => (
          <div key={f.n} className="w-full sm:w-44">
            <label htmlFor={`c-${f.n}`} className="etiqueta">{f.l}</label>
            <select id={`c-${f.n}`} name={f.n} defaultValue={f.v || ""} className="campo">
              <option value="">Todos</option>
              {f.o.map((o) => <option key={o.id} value={o.id}>{o.t}</option>)}
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
        <Link href={`/calendario?mes=${mes}`} className="btn-secundario">Limpiar</Link>
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

      <section className="card overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-7">
          {DIAS.map((d, i) => (
            <div key={d} className={`border-b border-borde px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide ${i >= 5 ? "text-acento" : "text-texto-2"}`}>{d}</div>
          ))}
          {dias.map((d, i) => {
            const evs = (porDia.get(d) ?? []).sort((a, b) => a.p.horaInicio.localeCompare(b.p.horaInicio));
            const fuera = !d.startsWith(mes);
            const esHoy = d === hoy;
            return (
              <div
                key={d}
                className={`flex min-h-32 flex-col gap-1 border-b border-r border-[#eef1f5] p-1.5 ${i % 7 === 6 ? "border-r-0" : ""} ${fuera ? "bg-[#f8fafc]" : i % 7 >= 5 ? "bg-[#fffbf7]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${esHoy ? "bg-acento text-white" : fuera ? "text-[#cbd5e1]" : "text-texto"}`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {evs.length > 0 && <span className="text-[10px] text-texto-2">{evs.length} ses.</span>}
                </div>
                {evs.slice(0, 4).map(({ p, est, pct }) => {
                  const c = colorPor === "sede" ? colorSede.get(p.sedeId) ?? "#475569" : ESTADO[est].color;
                  return (
                    <Link
                      key={p.id}
                      href={`/operativo/capacitaciones/${p.id}`}
                      title={`${hora(p.horaInicio)}–${hora(p.horaFin)} · ${p.sesion.codigo} ${p.sesion.nombre}\n${p.sede.nombre} · ${nombreCompleto(p.capacitador)}\n${ESTADO[est].txt} · ${pct}% del flujo`}
                      className={`block rounded border-l-[3px] px-1.5 py-1 text-[11px] leading-tight transition-shadow hover:shadow ${fuera ? "opacity-50" : ""}`}
                      style={{ borderLeftColor: c, background: colorPor === "sede" ? `${c}14` : ESTADO[est].fondo }}
                    >
                      <span className="font-semibold" style={{ color: c }}>{hora(p.horaInicio)}</span>{" "}
                      <span className="text-texto">{p.sede.nombre}</span>
                      <span className="block truncate text-texto-2">{p.sesion.codigo.split("-").slice(-2).join("-")} · {p.sesion.nombre}</span>
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
      </section>
    </>
  );
}
