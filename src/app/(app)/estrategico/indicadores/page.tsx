import { Fragment } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { accionesCorrectivas } from "@/db/schema";
import { calcularIndicadores, METAS, semaforo, type Resultado, type Semaforo } from "@/lib/indicadores";
import { fechaCorta, hoyISO, sumarDias, inicioSemana } from "@/lib/fechas";
import { Encabezado, Vacio } from "@/components/ui";
import CampoFecha from "@/components/CampoFecha";

export const metadata = { title: "Indicadores" };

const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const COLOR: Record<Semaforo, { punto: string; texto: string; barra: string; etiqueta: string }> = {
  verde: { punto: "bg-[#16a34a]", texto: "text-[#166534]", barra: "bg-[#16a34a]", etiqueta: "En meta" },
  ambar: { punto: "bg-[#d97706]", texto: "text-[#92400e]", barra: "bg-[#d97706]", etiqueta: "Cerca de la meta" },
  rojo: { punto: "bg-[#dc2626]", texto: "text-[#991b1b]", barra: "bg-[#dc2626]", etiqueta: "Fuera de meta" },
  sin: { punto: "bg-[#cbd5e1]", texto: "text-texto-2", barra: "bg-[#cbd5e1]", etiqueta: "Sin datos" },
};

type Clave = keyof typeof METAS;
const DEF: { clave: Clave; nombre: string; formula: string }[] = [
  { clave: "cumplimiento", nombre: "Cumplimiento del cronograma", formula: "Sesiones ejecutadas ÷ sesiones que ya debían realizarse" },
  { clave: "asistencia", nombre: "Asistencia promedio", formula: "(Presentes + tardanzas) ÷ participantes registrados" },
  { clave: "puntualidad", nombre: "Puntualidad", formula: "Presentes a tiempo ÷ asistentes" },
  { clave: "cobertura", nombre: "Cobertura de consultores", formula: "Sesiones con consultor asignado ÷ sesiones programadas" },
  { clave: "programados", nombre: "Asistencia vs. programados", formula: "Asistentes ÷ beneficiarios programados por turno (2da sección de la ficha)" },
  { clave: "cierre", nombre: "Listas cerradas", formula: "Listas cerradas ÷ sesiones ya realizadas" },
];

function nuevaAccionUrl(indicador: string, valor: number, meta: number, ambito: { sede?: number; componente?: number; nombre?: string }) {
  const donde = ambito.nombre ? ` en ${ambito.nombre}` : "";
  const q = new URLSearchParams({
    indicador,
    titulo: `${indicador} fuera de meta${donde}`,
    problema: `${indicador}${donde}: ${valor}% frente a una meta de ${meta}%.`,
    ...(ambito.sede ? { sede: String(ambito.sede) } : {}),
    ...(ambito.componente ? { componente: String(ambito.componente) } : {}),
  });
  return `/estrategico/acciones-correctivas/nueva?${q}`;
}

function Celda({ valor, meta }: { valor: number | null; meta: number }) {
  const s = semaforo(valor, meta);
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${COLOR[s].texto}`}>
      <span className={`size-2.5 rounded-full ${COLOR[s].punto}`} aria-hidden="true" />
      {valor === null ? "—" : `${valor}%`}
      <span className="sr-only">({COLOR[s].etiqueta})</span>
    </span>
  );
}

function TablaDesglose({
  titulo,
  filas,
  tipo,
}: {
  titulo: string;
  filas: ({ id: number; nombre: string } & Resultado)[];
  tipo: "sede" | "componente" | "consultor";
}) {
  return (
    <section className="card overflow-x-auto">
      <h2 className="border-b border-borde px-6 py-4 text-lg font-semibold text-marino">{titulo}</h2>
      {filas.length === 0 ? (
        <Vacio>Sin datos en el periodo.</Vacio>
      ) : (
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr>
              <th className="th">{tipo === "sede" ? "Sede" : tipo === "componente" ? "Componente" : "Consultor"}</th>
              <th className="th">Sesiones</th><th className="th">Cumplimiento</th><th className="th">Asistencia</th>
              <th className="th">Puntualidad</th><th className="th">Vs. programados</th><th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const problema =
                semaforo(f.asistencia, METAS.asistencia) === "rojo"
                  ? { ind: "Asistencia promedio", v: f.asistencia!, m: METAS.asistencia }
                  : semaforo(f.cumplimiento, METAS.cumplimiento) === "rojo"
                    ? { ind: "Cumplimiento del cronograma", v: f.cumplimiento!, m: METAS.cumplimiento }
                    : null;
              return (
                <tr key={f.id}>
                  <td className="td font-medium">{f.nombre}</td>
                  <td className="td">{f.ejecutadas} / {f.sesiones}</td>
                  <td className="td"><Celda valor={f.cumplimiento} meta={METAS.cumplimiento} /></td>
                  <td className="td"><Celda valor={f.asistencia} meta={METAS.asistencia} /></td>
                  <td className="td"><Celda valor={f.puntualidad} meta={METAS.puntualidad} /></td>
                  <td className="td"><Celda valor={f.programados} meta={METAS.programados} /></td>
                  <td className="td text-right">
                    {problema && tipo !== "consultor" && (
                      <Link
                        href={nuevaAccionUrl(problema.ind, problema.v, problema.m, {
                          [tipo]: f.id,
                          nombre: f.nombre,
                        })}
                        className="enlace text-[13px]"
                      >
                        Registrar acción correctiva
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function Indicadores({ searchParams }: PageProps<"/estrategico/indicadores">) {
  await connection();
  const sp = await searchParams;
  const hoy = hoyISO();
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  const desde = esFecha(sp.desde) ? sp.desde : sumarDias(inicioSemana(hasta), -21);

  const [ind, [{ abiertas }]] = await Promise.all([
    calcularIndicadores(desde, hasta, hoy),
    db.select({ abiertas: sql<number>`count(*)::int` }).from(accionesCorrectivas).where(ne(accionesCorrectivas.estado, "cerrada")),
  ]);

  const inicioMes = `${hoy.slice(0, 8)}01`;
  const mesAnteriorFin = sumarDias(inicioMes, -1);
  const rapidos = [
    ["Últimos 30 días", sumarDias(hoy, -29), hoy],
    ["Este mes", inicioMes, hoy],
    ["Mes anterior", `${mesAnteriorFin.slice(0, 8)}01`, mesAnteriorFin],
    ["Próximos 14 días", hoy, sumarDias(hoy, 13)],
  ] as const;

  return (
    <>
      <Encabezado
        antetitulo={`Estratégico · del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`}
        titulo="Indicadores"
        acciones={
          <Link href="/estrategico/acciones-correctivas" className="btn-secundario">
            Acciones correctivas abiertas: {abiertas}
          </Link>
        }
      />

      <form className="card flex flex-wrap items-end gap-3.5 px-5 py-4">
        <div>
          <label htmlFor="i-desde" className="etiqueta">Desde</label>
          <CampoFecha id="i-desde" name="desde" value={desde} />
        </div>
        <div>
          <label htmlFor="i-hasta" className="etiqueta">Hasta</label>
          <CampoFecha id="i-hasta" name="hasta" value={hasta} />
        </div>
        <button className="btn-oscuro">Calcular</button>
        <div className="flex flex-wrap gap-2 pb-0.5">
          {rapidos.map(([t, d, h]) => (
            <Link key={t} href={`/estrategico/indicadores?desde=${d}&hasta=${h}`} className="rounded-full border border-borde-fuerte px-3 py-2 text-[13px] font-semibold text-marino hover:bg-fondo">
              {t}
            </Link>
          ))}
        </div>
      </form>

      <section className="card overflow-hidden">
        <div className="border-b border-borde px-6 py-4">
          <h2 className="text-lg font-semibold text-marino">Asistencia semanal por sede</h2>
          <p className="mt-1 text-sm text-texto-2">Programados, asistentes (presentes y tardanzas) y porcentaje. Semanas de lunes a domingo, hasta hoy, según el periodo seleccionado.</p>
          <p className="mt-1 text-xs text-texto-2">Verde: aumenta respecto a la semana anterior. Rojo: disminuye. Sin cambio o sin comparación: neutro. Si hay varias sesiones, se suman sus cupos y asistencias. «Pendiente» indica un porcentaje provisional porque falta registrar alguna lista.</p>
        </div>
        {ind.asistenciaSemanal.filas.length === 0 ? <Vacio>Sin sesiones en el periodo.</Vacio> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#4472c4] text-white">
                  <th rowSpan={2} className="sticky left-0 z-10 min-w-64 border border-[#365fa5] bg-[#4472c4] px-4 py-3 text-left">Sede</th>
                  {ind.asistenciaSemanal.semanas.map((semana) => <th key={semana} colSpan={3} className="min-w-72 border border-[#365fa5] px-3 py-3">{fechaCorta(semana)} – {fechaCorta(sumarDias(semana, 6))}</th>)}
                </tr>
                <tr className="bg-[#e5ecf8] text-marino">
                  {ind.asistenciaSemanal.semanas.map((semana) => <Fragment key={semana}><th className="border border-borde px-3 py-2">Programados</th><th className="border border-borde px-3 py-2">Asistentes</th><th className="border border-borde px-3 py-2">%</th></Fragment>)}
                </tr>
              </thead>
              <tbody>
                {[...ind.asistenciaSemanal.filas, { id: -1, nombre: "Total", semanas: Object.fromEntries(ind.asistenciaSemanal.semanas.map((semana) => [semana, ind.asistenciaSemanal.filas.reduce((total, fila) => {
                  const c = fila.semanas[semana];
                  if (c) { total.programados += c.programados; total.asistentes += c.asistentes; total.sesiones += c.sesiones; total.registradas += c.registradas; }
                  return total;
                }, { programados: 0, asistentes: 0, sesiones: 0, registradas: 0 })])) }].map((fila) => (
                  <tr key={fila.id} className={fila.id === -1 ? "bg-[#e5ecf8] font-bold" : "bg-white"}>
                    <th scope="row" className="sticky left-0 z-10 border border-borde bg-inherit px-4 py-3 text-left">{fila.nombre}</th>
                    {ind.asistenciaSemanal.semanas.map((semana) => {
                      const c = fila.semanas[semana];
                      const porcentaje = c?.programados && c.registradas ? Math.round(c.asistentes * 1000 / c.programados) / 10 : null;
                      const anterior = fila.semanas[sumarDias(semana, -7)];
                      const porcentajeAnterior = anterior?.programados && anterior.registradas ? Math.round(anterior.asistentes * 1000 / anterior.programados) / 10 : null;
                      const color = porcentaje === null || porcentajeAnterior === null || porcentaje === porcentajeAnterior ? "" : porcentaje > porcentajeAnterior ? "bg-[#e2efda] text-[#166534]" : "bg-[#fce4e4] text-[#991b1b]";
                      return <Fragment key={semana}>
                        <td className="border border-borde bg-[#edf2fb] px-3 py-3 text-center">{c?.sesiones ? c.programados : "—"}</td>
                        <td className="border border-borde px-3 py-3 text-center">{c?.registradas ? c.asistentes : "—"}{c && c.registradas < c.sesiones && <span className="block text-xs font-normal text-texto-2">Pendiente</span>}</td>
                        <td className={`border border-borde px-3 py-3 text-center font-semibold ${color}`}>{porcentaje === null ? "—" : `${porcentaje}%`}</td>
                      </Fragment>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Indicadores del periodo" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEF.map((d) => {
          const valor = ind.total[d.clave];
          const meta = METAS[d.clave];
          const s = semaforo(valor, meta);
          return (
            <article key={d.clave} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-marino">{d.nombre}</h2>
                <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${COLOR[s].texto}`}>
                  <span className={`size-2.5 rounded-full ${COLOR[s].punto}`} aria-hidden="true" />
                  {COLOR[s].etiqueta}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${s === "sin" ? "text-texto-2" : "text-marino"}`}>{valor === null ? "—" : `${valor}%`}</span>
                <span className="text-sm text-texto-2">meta {meta}%</span>
              </div>
              <div className="relative h-2 rounded bg-[#e6ebf1]" aria-hidden="true">
                <div className={`h-2 rounded ${COLOR[s].barra}`} style={{ width: `${Math.min(100, valor ?? 0)}%` }} />
                <div className="absolute -top-1 h-4 w-0.5 bg-marino" style={{ left: `${meta}%` }} title={`Meta ${meta}%`} />
              </div>
              <p className="text-xs text-texto-2">{d.formula}</p>
              {(s === "rojo" || s === "ambar") && valor !== null && (
                <Link href={nuevaAccionUrl(d.nombre, valor, meta, {})} className="enlace text-[13px]">
                  Registrar acción correctiva →
                </Link>
              )}
            </article>
          );
        })}
      </section>

      <p className="text-[13px] text-texto-2">
        Semáforo: <strong className="text-[#166534]">verde</strong> alcanza la meta · <strong className="text-[#92400e]">ámbar</strong> hasta 10
        puntos por debajo · <strong className="text-[#991b1b]">rojo</strong> más de 10 puntos por debajo. Las metas se ajustan en{" "}
        <code className="rounded bg-white px-1">src/lib/indicadores.ts</code>.
      </p>

      <TablaDesglose titulo="Por sede" filas={ind.porSede} tipo="sede" />
      <TablaDesglose titulo="Por componente" filas={ind.porComponente} tipo="componente" />
      <TablaDesglose titulo="Por consultor" filas={ind.porConsultor} tipo="consultor" />
    </>
  );
}
