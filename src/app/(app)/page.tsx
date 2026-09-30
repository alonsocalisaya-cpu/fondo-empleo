import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { programaciones, participantes, sedes } from "@/db/schema";
import { asistenciaPorSede, listarProgramaciones, ruta, combinadas } from "@/lib/consultas";
import { fechaLarga, hoyISO, hora, inicioSemana, sumarDias, TURNO_LABEL } from "@/lib/fechas";
import { ChipEstado, Encabezado, Kpi, Vacio, iniciales, nombreCompleto, Combinadas } from "@/components/ui";

export default async function Inicio() {
  await connection();
  const hoy = hoyISO();
  const lunes = inicioSemana(hoy);
  const domingo = sumarDias(lunes, 6);

  const [semana, [{ nPart }], [{ nSedes }], pendientes, deHoy, asis] = await Promise.all([
    db
      .select({ fecha: programaciones.fecha })
      .from(programaciones)
      .where(and(gte(programaciones.fecha, lunes), lte(programaciones.fecha, domingo), ne(programaciones.estado, "cancelada"))),
    db.select({ nPart: sql<number>`count(*)::int` }).from(participantes),
    db.select({ nSedes: sql<number>`count(*)::int` }).from(sedes).where(eq(sedes.activa, true)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(programaciones)
      .where(and(lte(programaciones.fecha, hoy), eq(programaciones.listaCerrada, false), ne(programaciones.estado, "cancelada"))),
    listarProgramaciones(eq(programaciones.fecha, hoy)),
    asistenciaPorSede(sumarDias(hoy, -30), hoy),
  ]);

  const nHoy = semana.filter((s) => s.fecha === hoy).length;
  const capsHoy = new Map<number, { nombre: string; ini: string; sedes: Set<string>; n: number }>();
  for (const p of deHoy) {
    if (!p.capacitador) continue;
    const c = capsHoy.get(p.capacitador.id) ?? {
      nombre: nombreCompleto(p.capacitador),
      ini: iniciales(p.capacitador),
      sedes: new Set<string>(),
      n: 0,
    };
    c.n++;
    c.sedes.add(p.sede.nombre.replace("Sede ", ""));
    capsHoy.set(p.capacitador.id, c);
  }

  return (
    <>
      <Encabezado
        antetitulo={fechaLarga(hoy)}
        titulo="Panel de capacitaciones"
        acciones={
          <>
            <Link href="/estrategico/cronograma/estructura" className="btn-secundario">Nueva capacitación</Link>
            <Link href="/estrategico/cronograma/nueva" className="btn-primario">+ Programar sesión</Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi etiqueta="Sesiones esta semana" valor={semana.length} detalle={`${nHoy} hoy`} />
        <Kpi etiqueta="Participantes registrados" valor={nPart} detalle={`En ${nSedes} sedes activas`} />
        <Kpi
          etiqueta="Asistencia promedio"
          valor={asis.promedio === null ? "—" : `${asis.promedio}%`}
          detalle="Últimos 30 días"
          tono="ok"
        />
        <Kpi
          etiqueta="Listas sin cerrar"
          valor={pendientes[0].n}
          detalle="Sesiones de hoy o anteriores"
          tono={pendientes[0].n ? "alerta" : "normal"}
        />
      </section>

      <div className="flex flex-col gap-5 xl:flex-row">
        <section className="card flex-1">
          <div className="flex items-center justify-between border-b border-borde px-6 py-4">
            <h2 className="text-lg font-semibold text-marino">Sesiones de hoy</h2>
            <Link href="/estrategico/cronograma" className="enlace text-sm">Ver programación</Link>
          </div>
          {deHoy.length === 0 && <Vacio>No hay sesiones programadas para hoy.</Vacio>}
          <ul>
            {deHoy.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 border-b border-[#eef1f5] px-6 py-3.5 last:border-0 2xl:flex-nowrap">
                <div className="flex w-28 flex-col">
                  <span className="font-semibold text-marino">{hora(p.horaInicio)} – {hora(p.horaFin)}</span>
                  <span className="text-xs text-texto-2">{TURNO_LABEL[p.turno]}</span>
                </div>
                <div className="flex min-w-40 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{p.sesion.nombre}</span>
                  <span className="text-[13px] text-texto-2">{ruta(p)}</span>
                    {p.observacion && <span className="text-xs italic text-[#92400e]">{p.observacion}</span>}
                    <Combinadas nombres={combinadas(p)} />
                </div>
                <div className="flex w-36 flex-col">
                  <span className="text-sm">{p.sede.nombre}</span>
                  <span className="text-xs text-texto-2">{nombreCompleto(p.capacitador)}</span>
                </div>
                <ChipEstado estado={p.estado} sinCapacitador={!p.capacitador} />
                <Link href={`/operativo/capacitacion/${p.id}`} className="btn-secundario px-3 py-2 text-[13px]">
                  Asistencia
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex w-full flex-col gap-5 xl:w-90">
          <section className="card flex flex-col gap-4 px-6 py-5">
            <h2 className="text-lg font-semibold text-marino">Asistencia por sede</h2>
            {asis.sedes.length === 0 && <p className="text-sm text-texto-2">Aún no hay asistencias registradas.</p>}
            {asis.sedes.map((s) => (
              <div key={s.sede} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span>{s.sede}</span>
                  <span className="font-semibold">{s.pct}%</span>
                </div>
                <div className="h-2 rounded bg-[#e6ebf1]">
                  <div className="h-2 rounded bg-marino-2" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </section>

          <section className="card flex flex-col gap-3.5 px-6 py-5">
            <h2 className="text-lg font-semibold text-marino">Consultores hoy</h2>
            {capsHoy.size === 0 && <p className="text-sm text-texto-2">Sin consultores asignados hoy.</p>}
            {[...capsHoy.values()].map((c) => (
              <div key={c.nombre} className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-[#dce6f2] text-[13px] font-semibold text-marino">
                  {c.ini}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{c.nombre}</span>
                  <span className="text-xs text-texto-2">
                    {c.n} {c.n === 1 ? "sesión" : "sesiones"} · {[...c.sedes].join(", ")}
                  </span>
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
