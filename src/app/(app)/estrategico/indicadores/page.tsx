import {porcentajeRegistrado,compararSemanas,totalSemana} from "@/lib/asistencia-semanal";
import FiltrosUbicacion from "./FiltrosUbicacion";
import { Fragment } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ne, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import { accionesCorrectivas, estructuras, sedes } from "@/db/schema";
import { calcularIndicadores } from "@/lib/indicadores";
import { fechaCorta, hoyISO, sumarDias, inicioSemana } from "@/lib/fechas";
import { Encabezado, Vacio } from "@/components/ui";
import CampoFecha from "@/components/CampoFecha";

export const metadata = { title: "Indicadores" };

const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function Indicadores({ searchParams }: PageProps<"/estrategico/indicadores">) {
  await connection();
  const sp = await searchParams;
  const hoy = hoyISO();
  const hasta = esFecha(sp.hasta) ? sp.hasta : hoy;
  const desde = esFecha(sp.desde) ? sp.desde : sumarDias(inicioSemana(hasta), -21);

  const [regiones,lugares]=await Promise.all([db.select({id:estructuras.id,nombre:estructuras.nombre}).from(estructuras).orderBy(asc(estructuras.nombre)),db.select({id:sedes.id,nombre:sedes.nombre,estructuraId:sedes.estructuraId}).from(sedes).orderBy(asc(sedes.nombre))]);
  const region=regiones.some(r=>r.id===Number(sp.region))?Number(sp.region):0;
  const sede=lugares.some(s=>s.id===Number(sp.sede)&&(!region||s.estructuraId===region))?Number(sp.sede):0;
  const ubicacionQuery=new URLSearchParams();if(region)ubicacionQuery.set("region",String(region));if(sede)ubicacionQuery.set("sede",String(sede));
  const [ind, [{ abiertas }]] = await Promise.all([
    calcularIndicadores(desde, hasta, hoy, {region,sede}),
    db.select({ abiertas: sql<number>`count(*)::int` }).from(accionesCorrectivas).where(ne(accionesCorrectivas.estado, "cerrada")),
  ]);

  const sedesVisibles=new Set(lugares.filter(s=>(!region||s.estructuraId===region)&&(!sede||s.id===sede)).map(s=>s.id));
  const filasSemanales=ind.asistenciaSemanal.filas.filter(f=>sedesVisibles.has(f.id));
  const alcance=sede?lugares.find(s=>s.id===sede)?.nombre:region?regiones.find(r=>r.id===region)?.nombre:"Todas las regiones y sedes";
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
            Acciones correctivas abiertas (total): {abiertas}
          </Link>
        }
      />

      <form className="card flex flex-wrap items-end gap-3.5 px-5 py-4">
        <FiltrosUbicacion key={`${region}:${sede}`} regiones={regiones} sedes={lugares} regionInicial={region} sedeInicial={sede}/>
        <div>
          <label htmlFor="i-desde" className="etiqueta">Desde</label>
          <CampoFecha id="i-desde" name="desde" value={desde} />
        </div>
        <div>
          <label htmlFor="i-hasta" className="etiqueta">Hasta</label>
          <CampoFecha id="i-hasta" name="hasta" value={hasta} />
        </div>
        <button className="btn-oscuro">Calcular</button><Link href="/estrategico/indicadores" className="btn-secundario">Limpiar</Link>
        <div className="flex flex-wrap gap-2 pb-0.5">
          {rapidos.map(([t, d, h]) => (
            <Link key={t} href={`/estrategico/indicadores?desde=${d}&hasta=${h}&${ubicacionQuery.toString()}`} className="rounded-full border border-borde-fuerte px-3 py-2 text-[13px] font-semibold text-marino hover:bg-fondo">
              {t}
            </Link>
          ))}
        </div>
      </form>

      <section className="card overflow-hidden">
        <div className="border-b border-borde px-6 py-4">
          <h2 className="text-lg font-semibold text-marino">Asistencia semanal por sede</h2><p className="mt-1 text-xs font-semibold text-acento">Filtro aplicado: {alcance}</p>
          <p className="mt-1 text-sm text-texto-2">Programados, asistentes (presentes y tardanzas) y porcentaje. Semanas de lunes a domingo, hasta hoy, según el periodo seleccionado.</p>
          <p className="mt-1 text-xs text-texto-2">Verde: aumenta respecto a la semana anterior. Rojo: disminuye. Sin cambio o sin comparación: neutro. Programados incluye todas las sesiones. El porcentaje usa solo los programados de listas con asistencia registrada; las pendientes se excluyen de esa base. Las semanas incompletas no se comparan ni colorean.</p>
        </div>
        {filasSemanales.length === 0 ? <Vacio>Sin sesiones en el periodo.</Vacio> : (
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
                {[...filasSemanales, { id: -1, nombre: "Total", semanas: Object.fromEntries(ind.asistenciaSemanal.semanas.map(semana=>[semana,totalSemana(filasSemanales,semana)])) }].map((fila) => (
                  <tr key={fila.id} className={fila.id === -1 ? "bg-[#e5ecf8] font-bold" : "bg-white"}>
                    <th scope="row" className="sticky left-0 z-10 border border-borde bg-inherit px-4 py-3 text-left">{fila.nombre}</th>
                    {ind.asistenciaSemanal.semanas.map((semana) => {
                      const c = fila.semanas[semana];
                      const porcentaje = porcentajeRegistrado(c);
                      const anterior = fila.semanas[sumarDias(semana, -7)];
                      const variacion=compararSemanas(c,anterior);
                      const color = variacion===null?"":variacion==="sube"?"bg-[#e2efda] text-[#166534]":"bg-[#fce4e4] text-[#991b1b]";
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

    </>
  );
}
