import SiPuede from "@/components/SiPuede";
import { equivalencias } from "@/lib/disponibilidad";
import Link from "next/link";
import { connection } from "next/server";
import { and, gte, lte, ne } from "drizzle-orm";
import { programaciones } from "@/db/schema";
import { listarProgramaciones, opcionesFiltros, ruta, combinadas } from "@/lib/consultas";
import { fechaCorta, hoyISO, hora, inicioSemana, sumarDias } from "@/lib/fechas";
import { Encabezado, Vacio, iniciales, nombreCompleto, TituloSesion } from "@/components/ui";
import CampoFecha from "@/components/CampoFecha";
import SelectorConsultor from "./SelectorConsultor";

export const metadata = { title: "Carga laboral del personal" };

const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const h1 = (min: number) => Math.round((min / 60) * 10) / 10;
const fmtH = (min: number) => `${h1(min).toLocaleString("es-PE")} h`;
const veces = (n: number) => `${n} ${n === 1 ? "vez" : "veces"}`;

/** Primer y último día del mes de una fecha "YYYY-MM-DD". */
function mes(iso: string, desplazar = 0) {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + desplazar);
  const ini = d.toISOString().slice(0, 10);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { desde: ini, hasta: d.toISOString().slice(0, 10) };
}

/** Margen para considerar la carga «equilibrada»: ±20 % del promedio. */
const MARGEN = 0.2;

type Rol = "capacitador" | "asistente";
type Vista = "todos" | Rol;
const VISTAS: { v: Vista; t: string }[] = [
  { v: "todos", t: "Ambos roles" },
  { v: "capacitador", t: "Como capacitador" },
  { v: "asistente", t: "Como asistente" },
];
const COLOR: Record<Rol, string> = { capacitador: "#28927c", asistente: "#d08a2c" };

/** Lo acumulado en un rol (o en una sede dentro de un rol). */
type Acum = { min: number; n: number };
const nuevo = (): Acum => ({ min: 0, n: 0 });
const sumar = (a: Acum, m: number) => {
  a.min += m;
  a.n++;
};

type Persona = {
  clave: string; // "c12" (consultor) o "p7" (solo personal/asistente)
  nombres: string;
  apellidos: string;
  capId: number | null;
  persId: number | null;
  rol: Record<Rol, Acum>;
  sede: Map<number, Record<Rol, Acum>>;
  fuera: number;
};

export default async function CargaPersonal({ searchParams }: PageProps<"/estrategico/consultores">) {
  await connection();
  const sp = await searchParams;
  const hoy = hoyISO();
  const esteMes = mes(hoy);
  const desde = esFecha(sp.desde) ? sp.desde : esteMes.desde;
  const hasta = esFecha(sp.hasta) ? sp.hasta : esFecha(sp.desde) ? sp.desde : esteMes.hasta;
  const ver = typeof sp.ver === "string" ? sp.ver : "";
  const vista: Vista = sp.rol === "capacitador" || sp.rol === "asistente" ? sp.rol : "todos";

  const [sesiones, { capacitadores, asistentes }, eqv] = await Promise.all([
    listarProgramaciones(and(gte(programaciones.fecha, desde), lte(programaciones.fecha, hasta), ne(programaciones.estado, "cancelada"))),
    opcionesFiltros(),
    equivalencias(),
  ]);

  // ── Personas: un consultor y un asistente que son la misma persona se cuentan juntos ──
  const personas = new Map<string, Persona>();
  const deCap = new Map<number, Persona>();
  const dePers = new Map<number, Persona>();
  const crear = (clave: string, x: { nombres: string; apellidos: string }, capId: number | null, persId: number | null) => {
    const p: Persona = { clave, nombres: x.nombres, apellidos: x.apellidos, capId, persId, rol: { capacitador: nuevo(), asistente: nuevo() }, sede: new Map(), fuera: 0 };
    personas.set(clave, p);
    return p;
  };
  for (const c of capacitadores) deCap.set(c.id, crear(`c${c.id}`, c, c.id, null));
  for (const a of asistentes) {
    const mismo = eqv.capacitadoresDe(a.id).map((id) => deCap.get(id)).find(Boolean);
    if (mismo) {
      mismo.persId ??= a.id;
      dePers.set(a.id, mismo);
    } else dePers.set(a.id, crear(`p${a.id}`, a, null, a.id));
  }

  // ── Acumular horas y veces por rol y por sede ──
  const sedesUsadas = new Map<number, { nombre: string; fuera: boolean }>();
  const anotar = (per: Persona | undefined, rol: Rol, p: (typeof sesiones)[number]) => {
    if (!per) return;
    const m = minutos(p.horaFin) - minutos(p.horaInicio);
    sumar(per.rol[rol], m);
    const s = per.sede.get(p.sede.id) ?? { capacitador: nuevo(), asistente: nuevo() };
    sumar(s[rol], m);
    per.sede.set(p.sede.id, s);
    if (p.sede.fueraDeArequipa && (vista === "todos" || vista === rol)) per.fuera++;
  };
  for (const p of sesiones) {
    sedesUsadas.set(p.sede.id, { nombre: p.sede.nombre, fuera: p.sede.fueraDeArequipa });
    if (p.capacitadorId) anotar(deCap.get(p.capacitadorId), "capacitador", p);
    if (p.asistenteId) anotar(dePers.get(p.asistenteId), "asistente", p);
  }

  // Lo que cuenta según la vista elegida
  const roles: Rol[] = vista === "todos" ? ["capacitador", "asistente"] : [vista];
  const total = (per: Persona) => roles.reduce((s, r) => s + per.rol[r].min, 0);
  const totalN = (per: Persona) => roles.reduce((s, r) => s + per.rol[r].n, 0);
  const enSede = (per: Persona, id: number): Acum => {
    const s = per.sede.get(id);
    return s ? { min: roles.reduce((a, r) => a + s[r].min, 0), n: roles.reduce((a, r) => a + s[r].n, 0) } : nuevo();
  };
  const nSedes = (per: Persona) => [...per.sede.keys()].filter((id) => enSede(per, id).n > 0).length;

  // En la vista de un rol solo entran quienes pueden cumplirlo
  const filas = [...personas.values()]
    .filter((per) => (vista === "capacitador" ? per.capId : vista === "asistente" ? per.persId : true))
    .sort((a, b) => total(b) - total(a) || nombreCompleto(a).localeCompare(nombreCompleto(b), "es"));

  const sedesCol = [...sedesUsadas.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, "es"));
  const totalMin = filas.reduce((s, f) => s + total(f), 0);
  const prom = filas.length ? totalMin / filas.length : 0;
  const maxMin = Math.max(1, ...filas.map(total));
  const brecha = filas.length ? total(filas[0]) - total(filas[filas.length - 1]) : 0;
  const maxCelda = Math.max(1, ...filas.flatMap((f) => sedesCol.map(([id]) => enSede(f, id).min)));
  const promSedes = filas.length ? filas.reduce((s, f) => s + nSedes(f), 0) / filas.length : 0;
  const sinCap = sesiones.filter((p) => !p.capacitadorId);
  const sinAsi = sesiones.filter((p) => !p.asistenteId);

  const estado = (min: number) => {
    if (!prom) return { t: "—", cls: "bg-[#eef1f5] text-texto-2" };
    if (min > prom * (1 + MARGEN)) return { t: "Sobrecargado", cls: "bg-[#fee2e2] text-[#991b1b]" };
    if (min < prom * (1 - MARGEN)) return { t: "Con poca carga", cls: "bg-[#e0ecff] text-[#1e40af]" };
    return { t: "Equilibrado", cls: "bg-[#dcfce7] text-[#166534]" };
  };
  const nSobre = filas.filter((f) => prom && total(f) > prom * (1 + MARGEN)).length;
  const nBajo = filas.filter((f) => prom && total(f) < prom * (1 - MARGEN)).length;

  // ── Totales por sede (cuántas veces y horas se va a cada lugar) ──
  const porSede = sedesCol.map(([id, s]) => {
    const ses = sesiones.filter((p) => p.sede.id === id);
    const m = ses.reduce((a, p) => a + minutos(p.horaFin) - minutos(p.horaInicio), 0);
    const gente = filas.filter((f) => enSede(f, id).n > 0).length;
    return { id, ...s, sesiones: ses.length, min: m, gente };
  });

  // ── Reajuste: sesiones de la persona elegida (por defecto, la más cargada) ──
  const elegido = ver.startsWith("sin") ? null : filas.find((f) => f.clave === ver) ?? (ver ? null : filas[0]);
  type Fila = { p: (typeof sesiones)[number]; rol: Rol };
  const aReajustar: Fila[] =
    ver === "sin-c"
      ? sinCap.map((p) => ({ p, rol: "capacitador" as const }))
      : ver === "sin-a"
        ? sinAsi.map((p) => ({ p, rol: "asistente" as const }))
        : elegido
          ? sesiones.flatMap((p): Fila[] => [
              ...(elegido.capId && p.capacitadorId === elegido.capId && roles.includes("capacitador") ? [{ p, rol: "capacitador" as const }] : []),
              ...(elegido.persId && p.asistenteId === elegido.persId && roles.includes("asistente") ? [{ p, rol: "asistente" as const }] : []),
            ])
          : [];

  // Quiénes están ocupados en el horario de una sesión (en cualquiera de sus roles)
  const ocupadas = (p: (typeof sesiones)[number]) => {
    const set = new Set<Persona>();
    for (const o of sesiones) {
      if (o.id === p.id || o.fecha !== p.fecha || !(o.horaInicio < p.horaFin && o.horaFin > p.horaInicio)) continue;
      const c = o.capacitadorId ? deCap.get(o.capacitadorId) : undefined;
      const a = o.asistenteId ? dePers.get(o.asistenteId) : undefined;
      if (c) set.add(c);
      if (a) set.add(a);
    }
    return set;
  };
  // Opciones de menor a mayor carga TOTAL (ambos roles): las primeras son las mejores para equilibrar
  const cargaTotal = (per: Persona) => per.rol.capacitador.min + per.rol.asistente.min;
  const idEnRol = (per: Persona, rol: Rol) => (rol === "capacitador" ? per.capId : per.persId);
  const opciones = (f: Fila) => {
    const busy = ocupadas(f.p);
    // Tampoco puede ser capacitador y asistente de la misma sesión
    const otro =
      f.rol === "capacitador"
        ? f.p.asistenteId ? dePers.get(f.p.asistenteId) : undefined
        : f.p.capacitadorId ? deCap.get(f.p.capacitadorId) : undefined;
    const actual = f.rol === "capacitador" ? f.p.capacitadorId : f.p.asistenteId;
    return [...personas.values()]
      .filter((per) => idEnRol(per, f.rol) && (idEnRol(per, f.rol) === actual || (!busy.has(per) && per !== otro)))
      .sort((a, b) => cargaTotal(a) - cargaTotal(b))
      .map((per) => ({ id: idEnRol(per, f.rol)!, nombre: `${nombreCompleto(per)} · ${fmtH(cargaTotal(per))}`, ocupado: false }));
  };

  const params = (extra: Record<string, string>, d = desde, h = hasta, v: Vista = vista) =>
    new URLSearchParams({ desde: d, hasta: h, ...(v !== "todos" ? { rol: v } : {}), ...extra }).toString();
  const qs = (extra: Record<string, string>) => `/estrategico/consultores?${params(extra)}`;
  const lunes = inicioSemana(hoy);
  const presets = [
    { t: "Esta semana", d: lunes, h: sumarDias(lunes, 6) },
    { t: "Este mes", d: esteMes.desde, h: esteMes.hasta },
    { t: "Próximo mes", d: mes(hoy, 1).desde, h: mes(hoy, 1).hasta },
  ];
  const rolTexto = vista === "todos" ? "" : vista === "capacitador" ? " como capacitador" : " como asistente";

  return (
    <>
      <Encabezado
        antetitulo={`Estratégico · del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`}
        titulo="Carga laboral del personal"
        acciones={
          <div className="flex flex-wrap gap-2">
            {presets.map((x) => (
              <Link
                key={x.t}
                href={`/estrategico/consultores?${params({}, x.d, x.h)}`}
                aria-current={desde === x.d && hasta === x.h ? "page" : undefined}
                className={`btn-secundario py-2 text-[13px] ${desde === x.d && hasta === x.h ? "border-acento bg-[#e6f4f1] text-acento-oscuro" : ""}`}
              >
                {x.t}
              </Link>
            ))}
          </div>
        }
      />

      <form key={`${desde}:${hasta}:${vista}`} className="card flex flex-wrap items-end gap-3.5 px-5 py-4">
        <div>
          <label htmlFor="c-desde" className="etiqueta">Desde</label>
          <CampoFecha id="c-desde" name="desde" value={desde} />
        </div>
        <div>
          <label htmlFor="c-hasta" className="etiqueta">Hasta</label>
          <CampoFecha id="c-hasta" name="hasta" value={hasta} />
        </div>
        {vista !== "todos" && <input type="hidden" name="rol" value={vista} />}
        <button className="btn-oscuro">Ver periodo</button>
        <nav aria-label="Rol" className="flex rounded-lg bg-[#eef1f3] p-1 text-[13px] font-semibold md:ml-auto">
          {VISTAS.map((x) => (
            <Link
              key={x.v}
              href={`/estrategico/consultores?${params({}, desde, hasta, x.v)}`}
              aria-current={vista === x.v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${vista === x.v ? "bg-white text-marino shadow-sm" : "text-texto-2 hover:text-marino"}`}
            >
              {x.t}
            </Link>
          ))}
        </nav>
        <p className="basis-full text-xs text-texto-2">
          Se busca que todos tengan una carga parecida de horas y de sedes. «Equilibrado» = dentro de ±{MARGEN * 100} % del promedio.
          Si una persona es consultor y asistente, se suma lo que hace en los dos roles.
        </p>
      </form>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="card flex flex-col gap-1 p-5">
          <span className="text-sm text-texto-2">Horas asignadas{rolTexto}</span>
          <span className="text-3xl font-bold text-marino">{fmtH(totalMin)}</span>
          <span className="text-xs text-texto-2">{filas.reduce((s, f) => s + totalN(f), 0)} asignaciones en {sesiones.length} sesiones</span>
        </div>
        <div className="card flex flex-col gap-1 p-5">
          <span className="text-sm text-texto-2">Promedio por persona</span>
          <span className="text-3xl font-bold text-marino">{fmtH(prom)}</span>
          <span className="text-xs text-texto-2">{filas.length} personas · {promSedes.toFixed(1)} sedes en promedio</span>
        </div>
        <div className={`card flex flex-col gap-1 p-5 ${nSobre || nBajo ? "border-[#fcd34d]" : ""}`}>
          <span className="text-sm text-texto-2">Brecha (más − menos cargado)</span>
          <span className={`text-3xl font-bold ${nSobre || nBajo ? "text-[#b45309]" : "text-[#166534]"}`}>{fmtH(brecha)}</span>
          <span className="text-xs text-texto-2">{nSobre} sobrecargado(s) · {nBajo} con poca carga</span>
        </div>
        <div className={`card flex flex-col gap-1 p-5 ${sinCap.length || sinAsi.length ? "border-[#fca5a5]" : ""}`}>
          <span className="text-sm text-texto-2">Sesiones incompletas</span>
          <span className={`text-3xl font-bold ${sinCap.length || sinAsi.length ? "text-[#991b1b]" : "text-[#166534]"}`}>{sinCap.length + sinAsi.length}</span>
          <span className="flex flex-wrap gap-x-3 text-[13px]">
            {sinCap.length > 0 && <Link href={qs({ ver: "sin-c" }) + "#reajuste"} className="enlace">{sinCap.length} sin capacitador →</Link>}
            {sinAsi.length > 0 && <Link href={qs({ ver: "sin-a" }) + "#reajuste"} className="enlace">{sinAsi.length} sin asistente →</Link>}
            {!sinCap.length && !sinAsi.length && <span className="text-xs text-texto-2">Todas tienen capacitador y asistente</span>}
          </span>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
          <h2 className="text-[15px] font-semibold text-marino">Distribución por persona y sede</h2>
          <span className="flex flex-wrap items-center gap-3 text-xs text-texto-2">
            {roles.map((r) => (
              <span key={r} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: COLOR[r] }} />
                {r === "capacitador" ? "Capacitador" : "Asistente"}
              </span>
            ))}
            <span>· línea negra = promedio · en cada sede: horas y veces · clic en una persona para reajustar</span>
          </span>
        </div>
        {filas.length === 0 ? (
          <Vacio>No hay personal activo para este rol. Regístralo en Personal.</Vacio>
        ) : (
          <table className="mt-2 w-full min-w-[1000px] text-sm">
            <thead>
              <tr>
                <th className="th">Persona</th>
                <th className="th w-[22%]">Horas{rolTexto}</th>
                {roles.map((r) => (
                  <th key={r} className="th whitespace-nowrap text-right">{r === "capacitador" ? "Capacitador" : "Asistente"}</th>
                ))}
                <th className="th text-right">Sedes</th>
                {sedesCol.map(([id, s]) => (
                  <th key={id} className="th whitespace-nowrap text-center text-[11px]" title={s.fuera ? "Fuera de Arequipa" : undefined}>
                    {s.nombre.replace("Sede ", "")}{s.fuera ? " ✈" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((per) => {
                const t = total(per);
                const e = estado(t);
                const dif = t - prom;
                const activo = elegido?.clave === per.clave;
                const doble = per.capId && per.persId;
                return (
                  <tr key={per.clave} className={activo ? "bg-[#f0f7f5]" : undefined}>
                    <td className="td py-2">
                      <Link href={qs({ ver: per.clave }) + "#reajuste"} className="flex items-center gap-2.5 hover:underline">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#dce6f2] text-[12px] font-semibold text-marino">{iniciales(per)}</span>
                        <span className="flex flex-col">
                          <span className="whitespace-nowrap font-medium">{nombreCompleto(per)}</span>
                          <span className="flex items-center gap-1.5">
                            <span className={`w-fit whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.cls}`}>{e.t}</span>
                            <span className="whitespace-nowrap text-[11px] text-texto-2">{doble ? "Cap. y asist." : per.capId ? "Capacitador" : "Asistente"}</span>
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-2.5 min-w-[120px] flex-1 rounded bg-[#e6ebf1]">
                          {roles.map((r) => (
                            <div key={r} className="h-2.5 first:rounded-l last:rounded-r" style={{ width: `${(per.rol[r].min * 100) / maxMin}%`, backgroundColor: COLOR[r] }} />
                          ))}
                          {prom > 0 && <div className="absolute -top-1 h-4.5 w-0.5 bg-[#26282b]" style={{ left: `${(prom * 100) / maxMin}%` }} aria-hidden />}
                        </div>
                        <span className="w-24 shrink-0 text-right text-[13px] tabular-nums">
                          <strong>{fmtH(t)}</strong>
                          {prom > 0 && (
                            <span className={`ml-1 text-[11px] ${Math.abs(dif) < 60 ? "text-texto-2" : dif > 0 ? "text-[#991b1b]" : "text-[#1e40af]"}`}>
                              {dif >= 0 ? "+" : "−"}{h1(Math.abs(dif))}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    {roles.map((r) => (
                      <td key={r} className="td whitespace-nowrap text-right text-[13px] tabular-nums">
                        {idEnRol(per, r) ? (
                          per.rol[r].n ? (
                            <span className="flex flex-col leading-tight">
                              <span className="font-medium">{fmtH(per.rol[r].min)}</span>
                              <span className="text-[11px] text-texto-2">{veces(per.rol[r].n)}</span>
                            </span>
                          ) : (
                            <span className="text-texto-2">0</span>
                          )
                        ) : (
                          <span className="text-[#c4c9cf]" title="No tiene este rol">—</span>
                        )}
                      </td>
                    ))}
                    <td className="td whitespace-nowrap text-right tabular-nums">
                      {nSedes(per)}
                      {per.fuera > 0 && <span className="ml-1 text-[11px] text-texto-2" title="Veces fuera de Arequipa">({per.fuera} ✈)</span>}
                    </td>
                    {sedesCol.map(([id, s]) => {
                      const a = enSede(per, id);
                      const det = per.sede.get(id);
                      const titulo = det
                        ? `${s.nombre} — ${roles.filter((r) => det[r].n).map((r) => `${r === "capacitador" ? "capacitador" : "asistente"}: ${veces(det[r].n)}, ${fmtH(det[r].min)}`).join(" · ")}`
                        : undefined;
                      return (
                        <td key={id} className="td p-1 text-center tabular-nums">
                          {a.n > 0 ? (
                            <span
                              title={titulo}
                              className="flex flex-col rounded px-1.5 py-0.5 leading-tight"
                              style={{ backgroundColor: `rgba(40,146,124,${0.1 + (0.6 * a.min) / maxCelda})`, color: a.min / maxCelda > 0.6 ? "#fff" : "#1d4f45" }}
                            >
                              <span className="text-[12px] font-semibold">{h1(a.min)} h</span>
                              <span className="whitespace-nowrap text-[10px] opacity-90">
                                {vista === "todos" && det && det.capacitador.n && det.asistente.n ? `${det.capacitador.n} C + ${det.asistente.n} A` : veces(a.n)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[#c4c9cf]">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-borde bg-[#f7f9f8]">
                <td className="td text-[13px] font-semibold text-texto-2" colSpan={3 + roles.length}>
                  Total por sede <span className="font-normal">(horas de sesión · sesiones · personas distintas que van)</span>
                </td>
                {porSede.map((s) => (
                  <td key={s.id} className="td p-1 text-center text-[11px] leading-tight text-texto-2">
                    <span className="block text-[12px] font-semibold text-marino">{fmtH(s.min)}</span>
                    <span className="whitespace-nowrap">{s.sesiones} ses. · {s.gente} pers.</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section id="reajuste" className="card scroll-mt-4 overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
          <h2 className="text-[15px] font-semibold text-marino">Reajustar</h2>
          <form className="flex items-center gap-2">
            <input type="hidden" name="desde" value={desde} />
            <input type="hidden" name="hasta" value={hasta} />
            {vista !== "todos" && <input type="hidden" name="rol" value={vista} />}
            <label htmlFor="r-ver" className="sr-only">Sesiones de</label>
            <select id="r-ver" name="ver" defaultValue={ver.startsWith("sin") ? ver : elegido?.clave ?? ""} className="campo w-auto py-1.5 text-[13px]">
              {sinCap.length > 0 && <option value="sin-c">Sesiones sin capacitador ({sinCap.length})</option>}
              {sinAsi.length > 0 && <option value="sin-a">Sesiones sin asistente ({sinAsi.length})</option>}
              {filas.map((per) => (
                <option key={per.clave} value={per.clave}>{nombreCompleto(per)} · {fmtH(total(per))}</option>
              ))}
            </select>
            <button className="btn-secundario py-1.5 text-[13px]">Ver</button>
          </form>
          <span className="text-xs text-texto-2">
            En cada sesión, las personas aparecen de <strong>menor a mayor carga total</strong> (solo quienes no tienen cruce de horario).
          </span>
        </div>
        {aReajustar.length === 0 ? (
          <Vacio>{ver.startsWith("sin") ? "No hay sesiones pendientes de asignar en el periodo." : "Esta persona no tiene sesiones en el periodo."}</Vacio>
        ) : (
          <table className="mt-2 w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th className="th">Fecha y horario</th><th className="th">Sesión</th><th className="th">Sede</th><th className="th">Rol</th><th className="th">Asignado</th>
              </tr>
            </thead>
            <tbody>
              {aReajustar.map((f) => {
                const { p, rol } = f;
                const m = minutos(p.horaFin) - minutos(p.horaInicio);
                const actual = rol === "capacitador" ? p.capacitadorId : p.asistenteId;
                const quien = rol === "capacitador" ? p.capacitador : p.asistente;
                return (
                  <tr key={`${p.id}:${rol}`}>
                    <td className="td whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium">{fechaCorta(p.fecha)}</span>
                        <span className="text-xs text-texto-2">{hora(p.horaInicio)} – {hora(p.horaFin)} · {fmtH(m)}</span>
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex flex-col">
                        <Link href={`/operativo/capacitaciones/${p.id}`} className="font-medium hover:underline"><TituloSesion nombre={p.sesion.nombre} combinadas={combinadas(p)} /></Link>
                        <span className="text-xs text-texto-2">{ruta(p)}</span>
                      </div>
                    </td>
                    <td className="td">{p.sede.nombre}{p.sede.fueraDeArequipa ? " ✈" : ""}</td>
                    <td className="td">
                      <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: COLOR[rol] }}>
                        {rol === "capacitador" ? "Capacitador" : "Asistente"}
                      </span>
                    </td>
                    <td className="td py-2">
                      <SiPuede modulo="consultores" sino={quien ? nombreCompleto(quien) : "Sin asignar"}>
                        <SelectorConsultor
                          key={`${p.id}:${rol}:${actual}`}
                          rol={rol}
                          programacionId={p.id}
                          actual={actual}
                          etiqueta={`${rol === "capacitador" ? "Capacitador" : "Asistente"} para ${p.sesion.nombre}, ${fechaCorta(p.fecha)} ${hora(p.horaInicio)}`}
                          opciones={opciones(f)}
                        />
                      </SiPuede>
                    </td>
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
