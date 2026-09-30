import { soloCapacitador } from "@/lib/permisos";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { programaciones } from "@/db/schema";
import { listarProgramaciones, opcionesFiltros, ruta, combinadas } from "@/lib/consultas";
import { contextosDe } from "@/lib/preparacion";
import { DIAS_ANTICIPACION_COMUNICACION, ETAPAS, ROLES, etapaActual, resumenFlujo, type RolFlujo } from "@/lib/flujo-pre";
import { fechaCorta, hoyISO, hora, inicioSemana, sumarDias, TURNO_LABEL } from "@/lib/fechas";
import { Encabezado, Kpi, Pestanas, TABS_PRE, Vacio, nombreCompleto, Combinadas } from "@/components/ui";
import { BarraAvance, ChipRol } from "@/components/flujo";
import LineaProceso from "@/components/LineaProceso";
import { exigirUsuario } from "@/lib/auth";

export const metadata = { title: "Capacitaciones" };

export default async function Capacitaciones({ searchParams }: PageProps<"/operativo/capacitaciones">) {
  await connection();
  const sp = await searchParams;
  const u = await exigirUsuario();
  // El capacitador solo ve las sesiones que tiene asignadas
  const soloMias = soloCapacitador(u.roles);
  const rol = typeof sp.rol === "string" && sp.rol in ROLES ? (sp.rol as RolFlujo) : null;
  const hoy = hoyISO();
  const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const todo = sp.todo === "1" && !esFecha(sp.desde) && !esFecha(sp.hasta);
  // Por defecto: la semana actual (lunes a domingo). «Todo el cronograma» quita el rango de fechas.
  const lunes = inicioSemana(hoy);
  const desde = todo ? null : esFecha(sp.desde) ? sp.desde : lunes;
  const hasta = todo ? null : esFecha(sp.hasta) ? sp.hasta : esFecha(sp.desde) ? sumarDias(sp.desde, 6) : sumarDias(lunes, 6);
  const sede = Number(sp.sede) || 0;
  const capacitador = soloMias ? (u.capacitadorId ?? -1) : Number(sp.capacitador) || 0;
  const estado = ["pre", "post", "cerrada", "reprogramar"].includes(String(sp.estado)) ? String(sp.estado) : "";
  const texto = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const [lista, { sedes: listaSedes, capacitadores: listaCap }] = await Promise.all([
    listarProgramaciones(
      and(
        desde ? gte(programaciones.fecha, desde) : undefined,
        hasta ? lte(programaciones.fecha, hasta) : undefined,
        ne(programaciones.estado, "cancelada"),
        sede ? eq(programaciones.sedeId, sede) : undefined,
        capacitador ? eq(programaciones.capacitadorId, capacitador) : undefined,
      ),
    ),
    opcionesFiltros(),
  ]);
  const ctxs = await contextosDe(lista);

  const filas = lista.map((p) => {
    const ctx = ctxs.get(p.id)!;
    const etapa = etapaActual(ctx);
    const r = resumenFlujo(ctx, etapa);
    const todo = resumenFlujo(ctx, "completo");
    const comunicarPendiente = todo.estados.find((e) => e.clave === "comunicar")!.estado !== "hecho";
    const vencida = comunicarPendiente && !r.reprogramada && hoy > sumarDias(p.fecha, -DIAS_ANTICIPACION_COMUNICACION);
    return { p, r, etapa, todo, vencida };
  });
  const coincide = (f: (typeof filas)[number]) =>
    (!estado ||
      (estado === "pre" && f.etapa === "pre") ||
      (estado === "post" && f.etapa === "post" && !f.r.cerrada) ||
      (estado === "cerrada" && f.r.cerrada) ||
      (estado === "reprogramar" && (f.r.reprogramada || f.r.noRealizada))) &&
    (!texto || `${f.p.sesion.codigo} ${f.p.sesion.nombre} ${ruta(f.p)} ${combinadas(f.p).join(" ")}`.toLowerCase().includes(texto));
  const filtradas = filas.filter(coincide);
  // Para las tarjetas del resumen: todos los filtros menos el de estado (así cada tarjeta cuenta lo suyo)
  const base = filas.filter((f) => !texto || `${f.p.sesion.codigo} ${f.p.sesion.nombre} ${ruta(f.p)} ${combinadas(f.p).join(" ")}`.toLowerCase().includes(texto));
  const visibles = rol ? filtradas.filter((f) => f.todo.pendientes.some((x) => x.roles.includes(rol))) : filtradas;

  // Agrupar por sede (como en Capacitación)
  const porSede = new Map<string, typeof visibles>();
  for (const f of visibles) porSede.set(f.p.sede.nombre, [...(porSede.get(f.p.sede.nombre) ?? []), f]);

  const params: Record<string, string> = Object.fromEntries(
    Object.entries({ desde: todo ? "" : desde, hasta: todo ? "" : hasta, todo: todo ? "1" : "", sede: sede || "", capacitador: soloMias ? "" : capacitador || "", estado, q: texto, rol: rol ?? "" })
      .filter(([, v]) => v)
      .map(([k, v]) => [k, String(v)]),
  );
  const q = (extra: Record<string, string>) => {
    const todos = { ...params, ...extra };
    return `/operativo/capacitaciones?${new URLSearchParams(Object.entries(todos).filter(([, v]) => v))}`;
  };
  const presets = [
    { t: "Esta semana", u: `/operativo/capacitaciones?desde=${lunes}&hasta=${sumarDias(lunes, 6)}` },
    { t: "Próximas 2 semanas", u: `/operativo/capacitaciones?desde=${hoy}&hasta=${sumarDias(hoy, 13)}` },
    { t: "Últimos 30 días", u: `/operativo/capacitaciones?desde=${sumarDias(hoy, -30)}&hasta=${sumarDias(hoy, -1)}` },
    { t: "Cerradas", u: `/operativo/capacitaciones?todo=1&estado=cerrada` },
    { t: "Todo el cronograma", u: "/operativo/capacitaciones?todo=1" },
  ];

  return (
    <>
      <Encabezado
        antetitulo={`Operativo · ${todo ? "todo el cronograma" : `del ${fechaCorta(desde!)} al ${fechaCorta(hasta!)}`} · ${visibles.length} sesiones`}
        titulo="Capacitaciones"
        acciones={
          <div className="flex flex-wrap gap-2">
            {presets.map((x) => (
              <Link key={x.t} href={x.u} className="btn-secundario py-2 text-[13px]">{x.t}</Link>
            ))}
          </div>
        }
      />
      <Pestanas items={TABS_PRE} actual="/operativo/capacitaciones" />

      <form key={`${desde}:${hasta}`} aria-label="Filtros" className="card flex flex-wrap items-end gap-3 px-5 py-4">
        {todo && <input type="hidden" name="todo" value="1" />}
        {rol && <input type="hidden" name="rol" value={rol} />}
        <div>
          <label htmlFor="f-desde" className="etiqueta">Desde</label>
          <input id="f-desde" type="date" name="desde" defaultValue={desde ?? ""} className="campo" />
        </div>
        <div>
          <label htmlFor="f-hasta" className="etiqueta">Hasta</label>
          <input id="f-hasta" type="date" name="hasta" defaultValue={hasta ?? ""} className="campo" />
        </div>
        <div className="w-full sm:w-44">
          <label htmlFor="f-sede" className="etiqueta">Sede</label>
          <select id="f-sede" name="sede" defaultValue={sede || ""} className="campo">
            <option value="">Todas</option>
            {listaSedes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </div>
        {!soloMias && <div className="w-full sm:w-44">
          <label htmlFor="f-cap" className="etiqueta">Capacitador</label>
          <select id="f-cap" name="capacitador" defaultValue={capacitador || ""} className="campo">
            <option value="">Todos</option>
            {listaCap.map((x) => <option key={x.id} value={x.id}>{nombreCompleto(x)}</option>)}
          </select>
        </div>}
        <div className="w-full sm:w-44">
          <label htmlFor="f-estado" className="etiqueta">Estado del proceso</label>
          <select id="f-estado" name="estado" defaultValue={estado} className="campo">
            <option value="">Todos</option>
            <option value="pre">En pre-capacitación</option>
            <option value="post">En post-capacitación</option>
            <option value="cerrada">Cerradas</option>
            <option value="reprogramar">Por reprogramar</option>
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="f-q" className="etiqueta">Buscar sesión</label>
          <input id="f-q" name="q" defaultValue={texto} placeholder="Nombre o código de la sesión" className="campo" />
        </div>
        <button className="btn-oscuro">Filtrar</button>
        <Link href="/operativo/capacitaciones" className="btn-secundario">Limpiar</Link>
      </form>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { k: "", etiqueta: "Capacitaciones totales", valor: base.length, detalle: "Sesiones programadas en el filtro" },
          { k: "pre", etiqueta: "En pre-capacitación", valor: base.filter((f) => f.etapa === "pre").length, detalle: "Preparándose para salir a sede" },
          { k: "post", etiqueta: "En post-capacitación", valor: base.filter((f) => f.etapa === "post" && !f.r.cerrada).length, detalle: "Ya se dictaron, falta cerrar" },
          { k: "cerrada", etiqueta: "Cerradas", valor: base.filter((f) => f.r.cerrada).length, detalle: "Pre y post completos" },
        ].map((c) => (
          <Link
            key={c.k || "todas"}
            href={q({ estado: c.k })}
            aria-current={estado === c.k ? "page" : undefined}
            className={`rounded-xl transition-shadow hover:shadow-md ${estado === c.k ? "ring-2 ring-acento" : ""}`}
          >
            <Kpi etiqueta={c.etiqueta} valor={c.valor} detalle={c.detalle} tono={c.k === "cerrada" ? "ok" : "normal"} />
          </Link>
        ))}
      </section>

      <nav aria-label="Pendientes por rol" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-texto-2">Ver pendientes de:</span>
        <Link href={q({ rol: "" })} aria-current={!rol ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${!rol ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-white text-marino"}`}>
          Todos
        </Link>
        {(Object.keys(ROLES) as RolFlujo[]).map((k) => {
          const n = filtradas.filter((f) => f.todo.pendientes.some((x) => x.roles.includes(k))).length;
          return (
            <Link key={k} href={q({ rol: k })} aria-current={rol === k ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${rol === k ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-white text-marino"}`}>
              {ROLES[k]} {n > 0 && <span className={`ml-1 rounded-full px-1.5 ${rol === k ? "bg-white/20" : "bg-[#d8eee8] text-acento-oscuro"}`}>{n}</span>}
            </Link>
          );
        })}
      </nav>

      {visibles.length === 0 && (
        <div className="card"><Vacio>{rol ? `No hay actividades pendientes para ${ROLES[rol]}.` : "No hay sesiones con estos filtros."}</Vacio></div>
      )}

      {[...porSede.entries()].map(([nombreSede, grupo]) => (
        <section key={nombreSede} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-marino">
            {nombreSede}
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {grupo.map(({ p, r, etapa, todo, vencida }) => {
              const siguientes = rol ? todo.pendientes.filter((x) => x.roles.includes(rol)) : r.pendientes;
              return (
                <Link
                  key={p.id}
                  href={`/operativo/capacitaciones/${p.id}`}
                  className={`card flex flex-col gap-3 p-5 transition-shadow hover:shadow-md ${r.reprogramada || vencida ? "border-[#fca5a5]" : r.cerrada ? "border-[#86efac]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-lg font-semibold text-marino">{fechaCorta(p.fecha)} · {hora(p.horaInicio)} – {hora(p.horaFin)}</span>
                      <span className="text-xs text-texto-2">Turno {TURNO_LABEL[p.turno].toLowerCase()} · {p.aula ?? "Sin aula"}</span>
                    </div>
                    {r.reprogramada ? (
                      <span className="whitespace-nowrap rounded-full bg-[#fee2e2] px-2.5 py-1 text-xs font-semibold text-[#991b1b]">Reprogramar</span>
                    ) : r.noRealizada ? (
                      <span className="whitespace-nowrap rounded-full bg-[#fee2e2] px-2.5 py-1 text-xs font-semibold text-[#991b1b]">No realizada</span>
                    ) : r.cerrada ? (
                      <span className="whitespace-nowrap rounded-full bg-[#dcfce7] px-2.5 py-1 text-xs font-semibold text-[#166534]">✓ Cerrada</span>
                    ) : etapa === "post" ? (
                      <span className="whitespace-nowrap rounded-full bg-[#ede9fe] px-2.5 py-1 text-xs font-semibold text-[#5b21b6]">Post-capacitación</span>
                    ) : (
                      <span className="whitespace-nowrap rounded-full bg-[#dbeafe] px-2.5 py-1 text-xs font-semibold text-[#1e40af]">Pre-capacitación</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{p.sesion.nombre}</span>
                    <span className="text-[13px] text-texto-2">{ruta(p)}</span>
                    {p.observacion && <span className="text-xs italic text-[#92400e]">{p.observacion}</span>}
                    <Combinadas nombres={combinadas(p)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-texto-2">{ETAPAS[etapa]}</span>
                    <LineaProceso pasos={r.estados} detenido={etapa === "pre" ? r.reprogramada : r.noRealizada} compacto />
                    <BarraAvance porcentaje={r.porcentaje} etiqueta={`Avance de ${p.sesion.nombre}`} />
                  </div>
                  <div className="flex min-h-12 flex-col gap-1">
                    {r.reprogramada ? (
                      <span className="text-[13px] font-semibold text-[#991b1b]">Local no confirmado: reprogramar la sesión</span>
                    ) : r.cerrada ? (
                      <span className="text-[13px] font-semibold text-[#166534]">Proceso completo: sesión cerrada</span>
                    ) : (
                      <>
                        <span className="text-xs text-texto-2">Siguiente:</span>
                        {siguientes.slice(0, 2).map((x) => (
                          <span key={x.clave} className="flex flex-wrap items-center gap-2">
                            {x.roles.map((r) => <ChipRol key={r} rol={r} />)}
                            <span className="text-[13px]">{x.titulo}</span>
                          </span>
                        ))}
                        {siguientes.length > 2 && <span className="text-xs text-texto-2">+{siguientes.length - 2} más</span>}
                      </>
                    )}
                    {vencida && <span className="text-xs font-semibold text-[#991b1b]">⚠ Comunicación al personal fuera de plazo</span>}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#eef1f5] pt-3 text-sm">
                    <span>{nombreCompleto(p.capacitador)}</span>
                    <span className="text-texto-2">{r.hechos}/{r.total} actividades</span>
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
