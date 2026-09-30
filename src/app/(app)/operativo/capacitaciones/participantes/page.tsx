import SiPuede from "@/components/SiPuede";
import { connection } from "next/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { asistencias, inscripciones, participantes, sedes } from "@/db/schema";
import { Encabezado, Pestanas, TABS_PRE, Vacio } from "@/components/ui";
import FormAlta from "@/components/FormAlta";
import { crearParticipante, eliminarParticipante } from "@/lib/acciones-maestros";
import BotonEliminar from "@/components/BotonEliminar";
import SedeTurno from "./SedeTurno";

export const metadata = { title: "Beneficiarios" };

const TURNO: Record<string, string> = { manana: "Mañana", tarde: "Tarde", ambos: "Único / ambos" };

export default async function Participantes({ searchParams }: PageProps<"/operativo/capacitaciones/participantes">) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const patron = `%${q}%`;

  const sede = Number(sp.sede) || 0;

  const [filas, listaSedes, porSede] = await Promise.all([
    db
      .select({
        p: participantes,
        sede: sedes.nombre,
        inscritas: sql<number>`(select count(*)::int from ${inscripciones} where ${inscripciones.participanteId} = ${participantes.id})`,
        sesiones: sql<number>`count(${asistencias.id})::int`,
        asistio: sql<number>`count(${asistencias.id}) filter (where ${asistencias.estado} in ('presente','tarde'))::int`,
        notaE: sql<number | null>`round(avg(${asistencias.notaEntrada})::numeric, 1)::float`,
        notaS: sql<number | null>`round(avg(${asistencias.notaSalida})::numeric, 1)::float`,
      })
      .from(participantes)
      .leftJoin(sedes, eq(sedes.id, participantes.sedeId))
      .leftJoin(asistencias, eq(asistencias.participanteId, participantes.id))
      .where(
        and(
          q ? or(ilike(participantes.nombres, patron), ilike(participantes.apellidos, patron), ilike(participantes.dni, patron)) : undefined,
          sede ? eq(participantes.sedeId, sede) : undefined,
        ),
      )
      .groupBy(participantes.id, sedes.nombre)
      .orderBy(sedes.nombre, participantes.apellidos, participantes.nombres)
      .limit(300),
    db.query.sedes.findMany({ where: (t, { eq }) => eq(t.activa, true), orderBy: (t) => t.nombre }),
    db
      .select({ id: participantes.sedeId, n: sql<number>`count(*)::int` })
      .from(participantes)
      .groupBy(participantes.sedeId),
  ]);
  const opcSedes = listaSedes.map((x) => ({ id: x.id, nombre: x.nombre }));
  const nSede = new Map(porSede.map((x) => [x.id, x.n]));
  const total = porSede.reduce((a, x) => a + x.n, 0);
  const url = (id: number) => `/operativo/capacitaciones/participantes?${new URLSearchParams({ ...(id ? { sede: String(id) } : {}), ...(q ? { q } : {}) })}`;

  return (
    <>
      <Encabezado antetitulo="Operativo · Capacitaciones" titulo="Beneficiarios" />
      <Pestanas items={TABS_PRE} actual="/operativo/capacitaciones/participantes" />
      <SiPuede modulo="beneficiarios">
      <FormAlta
        titulo="Nuevo beneficiario"
        accion={crearParticipante}
        boton="Agregar beneficiario"
        campos={[
          { name: "dni", label: "DNI", required: true, inputMode: "numeric" },
          { name: "nombres", label: "Nombres", required: true },
          { name: "apellidos", label: "Apellidos", required: true },
          { name: "sedeId", label: "Sede", opciones: [{ valor: "", texto: "Sin sede" }, ...listaSedes.map((x) => ({ valor: String(x.id), texto: x.nombre }))] },
          { name: "turno", label: "Turno", opciones: Object.entries(TURNO).map(([valor, texto]) => ({ valor, texto })) },
          { name: "email", label: "Correo", type: "email" },
          { name: "telefono", label: "Teléfono", inputMode: "tel" },
        ]}
      />
      </SiPuede>
      <nav aria-label="Beneficiarios por sede" className="flex flex-wrap items-center gap-2">
        {[{ id: 0, nombre: "Todas", n: total }, ...listaSedes.filter((x) => nSede.get(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, n: nSede.get(x.id)! }))].map((x) => (
          <Link
            key={x.id}
            href={url(x.id)}
            aria-current={sede === x.id ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${sede === x.id ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-white text-marino"}`}
          >
            {x.nombre} <span className={`ml-1 rounded-full px-1.5 ${sede === x.id ? "bg-white/20" : "bg-[#eef1f5] text-texto-2"}`}>{x.n}</span>
          </Link>
        ))}
      </nav>
      <form className="flex items-end gap-3">
        {sede > 0 && <input type="hidden" name="sede" value={sede} />}
        <div className="w-80">
          <label htmlFor="q" className="etiqueta">Buscar por nombre o DNI</label>
          <input id="q" name="q" defaultValue={q} className="campo" />
        </div>
        <button className="btn-secundario">Buscar</button>
      </form>
      <section className="card overflow-x-auto">
        {filas.length === 0 ? <Vacio>No se encontraron participantes.</Vacio> : (
          <table className="w-full text-sm">
            <thead><tr><th className="th">Beneficiario</th><th className="th">DNI</th><th className="th">Sede y turno</th><th className="th">Sesiones inscritas</th><th className="th">Asistencias registradas</th><th className="th">% asistencia</th><th className="th whitespace-nowrap">Notas (prom.)</th><th className="th"><span className="sr-only">Detalle</span></th><th className="th"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {filas.map(({ p, sede: nombreSede, inscritas, sesiones, asistio, notaE, notaS }) => (
                <tr key={p.id}>
                  <td className="td font-medium"><Link href={`/operativo/capacitaciones/participantes/${p.id}`} className="hover:underline">{p.apellidos}, {p.nombres}</Link></td>
                  <td className="td">{p.dni}</td>
                  <td className="td">
                    <SiPuede modulo="beneficiarios" sino={<>{nombreSede ?? "Sin sede"} · {p.turno ? TURNO[p.turno] ?? p.turno : "—"}</>}>
                      <SedeTurno id={p.id} sedeId={p.sedeId} turno={p.turno} sedes={p.sedeId && !opcSedes.some((x) => x.id === p.sedeId) ? [...opcSedes, { id: p.sedeId, nombre: `${nombreSede} (inactiva)` }] : opcSedes} />
                    </SiPuede>
                  </td>
                  <td className="td">{inscritas}</td>
                  <td className="td">{sesiones}</td>
                  <td className="td">{sesiones ? `${Math.round((asistio * 100) / sesiones)}%` : "—"}</td>
                  <td className="td whitespace-nowrap text-[13px]">
                    {notaE == null && notaS == null ? <span className="text-texto-2">—</span> : (
                      <>
                        {notaE != null && <span title="Promedio de exámenes de entrada">E: <strong>{notaE}</strong></span>}
                        {notaE != null && notaS != null && " · "}
                        {notaS != null && <span title="Promedio de exámenes de salida">S: <strong>{notaS}</strong></span>}
                      </>
                    )}
                  </td>
                  <td className="td"><Link href={`/operativo/capacitaciones/participantes/${p.id}`} className="enlace whitespace-nowrap text-[13px]">Ver detalle →</Link></td>
                  <td className="td text-right">
                    <SiPuede modulo="beneficiarios">
                    <BotonEliminar
                      accion={eliminarParticipante}
                      campos={{ id: p.id }}
                      pregunta={`¿Eliminar a ${p.nombres} ${p.apellidos}?`}
                      detalle={`Se quita de ${inscritas} sesión(es)${sesiones ? ` y se borran sus ${sesiones} registros de asistencia` : ""}.`}
                    />
                    </SiPuede>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="border-t border-borde px-5 py-3 text-[13px] text-texto-2">
          {filas.length === 300 ? "Mostrando los primeros 300 resultados. Usa el buscador para afinar." : `${filas.length} beneficiarios`}
        </p>
      </section>
    </>
  );
}
