import SiPuede from "@/components/SiPuede";
import { connection } from "next/server";
import { and, eq, ilike, or, sql, asc, desc, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { asistencias, estructuras, inscripciones, participantes, sedes } from "@/db/schema";
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

  const sede = Number(sp.sede) || 0;
  const sinSede = sp.sede === "sin";
  const ordenes = {
    beneficiario: sql`${participantes.apellidos}`,
    dni: sql`${participantes.dni}`,
    sede: sql`${sedes.nombre}`,
    inscritas: sql`(select count(*) from ${inscripciones} where ${inscripciones.participanteId} = ${participantes.id})`,
    asistencias: sql`count(${asistencias.id})`,
    porcentaje: sql`100.0 * count(${asistencias.id}) filter (where ${asistencias.estado} in ('presente','tarde')) / nullif(count(${asistencias.id}), 0)`,
    notaE: sql`avg(${asistencias.notaEntrada})`,
    notaS: sql`avg(${asistencias.notaSalida})`,
  };
  type Orden = keyof typeof ordenes;
  const orden: Orden = typeof sp.orden === "string" && Object.hasOwn(ordenes, sp.orden) ? sp.orden as Orden : "beneficiario";
  const direccion = sp.direccion === "desc" ? "desc" : "asc";

  const [listaSedes, programas, porSede] = await Promise.all([
    db.query.sedes.findMany({ where: (t, { eq }) => eq(t.activa, true), orderBy: (t) => t.nombre }),
    db.select({ id: estructuras.id, nombre: estructuras.nombre }).from(estructuras).orderBy(estructuras.orden, estructuras.nombre),
    db
      .select({ id: participantes.sedeId, n: sql<number>`count(*)::int` })
      .from(participantes)
      .groupBy(participantes.sedeId),
  ]);
  const filas = await db
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
          ...q.split(/\s+/).filter(Boolean).map((termino) => or(
            ilike(sql`concat_ws(' ', ${participantes.nombres}, ${participantes.apellidos})`, `%${termino}%`),
            ilike(participantes.dni, `%${termino}%`), ilike(participantes.email, `%${termino}%`), ilike(participantes.telefono, `%${termino}%`),
          )),
          sede ? eq(participantes.sedeId, sede) : undefined,
          sinSede ? isNull(participantes.sedeId) : undefined,
        ),
      )
      .groupBy(participantes.id, sedes.nombre)
      .orderBy(sql`${direccion === "desc" ? desc(ordenes[orden]) : asc(ordenes[orden])} nulls last`, asc(participantes.apellidos), orden === "beneficiario" && direccion === "desc" ? desc(participantes.nombres) : asc(participantes.nombres), asc(participantes.id))
      .limit(300);
  const opcSedes = listaSedes.map((x) => ({ id: x.id, nombre: x.nombre }));
  const nSede = new Map(porSede.map((x) => [x.id, x.n]));
  const total = porSede.reduce((a, x) => a + x.n, 0);
  const parametros = { q, sede: sinSede ? "sin" : sede ? String(sede) : "", orden, direccion };
  const url = (cambios: Partial<typeof parametros>) => `/operativo/capacitaciones/participantes?${new URLSearchParams(Object.entries({ ...parametros, ...cambios }).filter(([, valor]) => valor))}`;
  const encabezado = (clave: Orden, titulo: string) => <th className="th whitespace-nowrap" aria-sort={orden === clave ? direccion === "asc" ? "ascending" : "descending" : "none"}><Link href={url({ orden: clave, direccion: orden === clave && direccion === "asc" ? "desc" : "asc" })} className="inline-flex items-center gap-2 hover:text-marino hover:underline" title={`Ordenar por ${titulo}`}><span>{titulo}</span><span aria-hidden="true" className={orden === clave ? "text-marino" : "text-texto-2"}>{orden === clave ? direccion === "asc" ? "↑" : "↓" : "↕"}</span></Link></th>;
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
          { name: "sedeId", label: "Sede", opciones: [{ valor: "", texto: "Sin sede" }, ...listaSedes.map((x) => ({ valor: String(x.id), texto: x.nombre, grupo: programas.find((p) => p.id === x.estructuraId)?.nombre ?? "Sin programa" }))] },
          { name: "turno", label: "Turno", opciones: Object.entries(TURNO).map(([valor, texto]) => ({ valor, texto })) },
          { name: "email", label: "Correo", type: "email" },
          { name: "telefono", label: "Teléfono", inputMode: "tel" },
        ]}
      />
      </SiPuede>
      <form key={JSON.stringify(parametros)} className="card flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="orden" value={orden} /><input type="hidden" name="direccion" value={direccion} />
        <div className="w-full sm:w-72">
          <label htmlFor="sede" className="etiqueta">Buscar por sede</label>
          <select id="sede" name="sede" defaultValue={sinSede ? "sin" : sede || ""} className="campo">
            <option value="">Todas las sedes ({total})</option>
            <option value="sin">Sin sede ({nSede.get(null) ?? 0})</option>
            {listaSedes.filter((x) => nSede.get(x.id)).map((x) => <option key={x.id} value={x.id}>{x.nombre} ({nSede.get(x.id)})</option>)}
          </select>
        </div>
        <div className="w-full sm:w-80">
          <label htmlFor="q" className="etiqueta">Nombre, DNI, correo o teléfono</label>
          <input id="q" name="q" defaultValue={q} placeholder="Buscar beneficiario…" className="campo" />
        </div>
        <button className="btn-oscuro">Filtrar</button>
        <Link href="/operativo/capacitaciones/participantes" className="btn-secundario">Limpiar filtros</Link>
      </form>
      <section className="card overflow-x-auto">
        {filas.length === 0 ? <Vacio>No se encontraron participantes.</Vacio> : (
          <table className="w-full text-sm">
            <thead><tr>{encabezado("beneficiario", "Beneficiario")}{encabezado("dni", "DNI")}{encabezado("sede", "Sede")}{encabezado("inscritas", "Sesiones inscritas")}{encabezado("asistencias", "Asistencias registradas")}{encabezado("porcentaje", "% asistencia")}{encabezado("notaE", "Nota entrada (prom.)")}{encabezado("notaS", "Nota salida (prom.)")}<th className="th"><span className="sr-only">Editar</span></th><th className="th"><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {filas.map(({ p, sede: nombreSede, inscritas, sesiones, asistio, notaE, notaS }) => (
                <tr key={p.id}>
                  <td className="td font-medium">{p.apellidos}, {p.nombres}</td>
                  <td className="td">{p.dni}</td>
                  <td className="td">
                    <SiPuede modulo="beneficiarios" sino={<>{nombreSede ?? "Sin sede"}</>}>
                      <SedeTurno id={p.id} sedeId={p.sedeId} turno={p.turno} sedes={p.sedeId && !opcSedes.some((x) => x.id === p.sedeId) ? [...opcSedes, { id: p.sedeId, nombre: `${nombreSede} (inactiva)` }] : opcSedes} />
                    </SiPuede>
                  </td>
                  <td className="td">{inscritas}</td>
                  <td className="td">{sesiones}</td>
                  <td className="td">{sesiones ? `${Math.round((asistio * 100) / sesiones)}%` : "—"}</td>
                  <td className="td">{notaE ?? "—"}</td>
                  <td className="td">{notaS ?? "—"}</td>
                  <td className="td"><SiPuede modulo="beneficiarios"><Link href={`/operativo/capacitaciones/participantes/${p.id}/editar`} className="btn-secundario whitespace-nowrap px-3 py-2 text-[13px]">Editar</Link></SiPuede></td>
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
