import SiPuede from "@/components/SiPuede";
import Link from "next/link";
import { connection } from "next/server";
import { and, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { programaciones } from "@/db/schema";
import { listarProgramaciones } from "@/lib/consultas";
import { contextosDe } from "@/lib/preparacion";
import { estadoPaso } from "@/lib/flujo-pre";
import { fechaCorta, hoyISO, sumarDias } from "@/lib/fechas";
import { Encabezado, Vacio } from "@/components/ui";
import FormSubirDocumento from "./FormSubirDocumento";
import { eliminarDocumento } from "@/lib/acciones-maestros";
import BotonEliminar from "@/components/BotonEliminar";
import { SECCIONES, TIPO_DOC, enlaceDoc, origenDoc, seccionDe, tamanoLegible } from "@/lib/documentos";

export const metadata = { title: "Gestión documental" };

const TIPO = TIPO_DOC;

export default async function GestionDocumental({ searchParams }: PageProps<"/soporte/gestion-documental">) {
  await connection();
  const sp = await searchParams;
  const sesionSel = Number(sp.sesion) || 0;

  const [arbol, docs, proximas] = await Promise.all([
    db.query.componentes.findMany({
      orderBy: (t, { asc }) => [asc(t.orden)],
      with: {
        actividades: {
          orderBy: (t, { asc }) => [asc(t.orden)],
          with: { modulos: { orderBy: (t, { asc }) => [asc(t.orden)], with: { sesiones: { orderBy: (t, { asc }) => [asc(t.orden)] } } } },
        },
      },
    }),
    db.query.documentos.findMany({ with: { sesion: true, programacion: { with: { sede: true } } }, orderBy: (t) => [t.sesionId, t.tipo, t.nombre] }),
    listarProgramaciones(and(gte(programaciones.fecha, sumarDias(hoyISO(), -7)), ne(programaciones.estado, "cancelada"))),
  ]);

  // Bandeja: fichas esperando revisión de Gestión Documental
  const ctxs = await contextosDe(proximas);
  const porRevisar = proximas.filter((p) => estadoPaso("revisar_ficha", ctxs.get(p.id)!) === "disponible");

  const sesiones = arbol.flatMap((c) =>
    c.actividades.flatMap((a) => a.modulos.flatMap((m) => m.sesiones.map((s) => ({ ...s, grupo: `${c.nombre} › ${a.nombre} › ${m.nombre}` })))),
  );
  const visibles = sesionSel ? docs.filter((d) => d.sesionId === sesionSel) : docs;
  const sinMaterial = sesiones.filter((s) => !docs.some((d) => d.sesionId === s.id && !d.programacionId && (d.tipo === "diapositiva" || d.tipo === "taller")));

  return (
    <>
      <Encabezado antetitulo="Soporte" titulo="Gestión documental" />

      <section className="card">
        <h2 className="border-b border-borde px-6 py-4 text-lg font-semibold text-marino">
          Fichas por revisar <span className="ml-1 rounded-full bg-[#fce7f3] px-2 py-0.5 text-sm text-[#9d174d]">{porRevisar.length}</span>
        </h2>
        {porRevisar.length === 0 ? (
          <Vacio>No hay fichas de capacitación esperando revisión.</Vacio>
        ) : (
          <ul>
            {porRevisar.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-6 py-3 last:border-0">
                <span className="text-sm"><strong>{fechaCorta(p.fecha)}</strong> · {p.sesion.nombre} · {p.sede.nombre}</span>
                <Link href={`/operativo/capacitaciones/${p.id}#ficha`} className="btn-secundario py-2 text-[13px]">Revisar ficha</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mt-2 text-xl font-bold text-marino">Repositorio de materiales</h2>
      <p className="-mt-4 text-sm text-texto-2">
        Diapositivas, talleres y exámenes por sesión. Los archivos se guardan en el sistema: el capacitador los descarga desde su primer paso en el expediente de pre-capacitación de cada fecha programada de esa sesión.
      </p>

      <SiPuede modulo="documental">
      <FormSubirDocumento
        key={sesionSel}
        sesionInicial={sesionSel ? String(sesionSel) : undefined}
        tipos={Object.entries(TIPO).map(([valor, texto]) => ({ valor, texto }))}
        sesiones={[...sesiones]
                .sort((a, b) => (a.id === sesionSel ? -1 : b.id === sesionSel ? 1 : 0))
                .map((s) => ({ valor: String(s.id), texto: s.nombre }))}
      />
      </SiPuede>

      {sinMaterial.length > 0 && (
        <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
          {sinMaterial.length} sesión(es) sin diapositivas ni talleres: {sinMaterial.slice(0, 6).map((s) => s.codigo).join(", ")}
          {sinMaterial.length > 6 ? "…" : ""}
        </p>
      )}

      <form className="flex items-end gap-3">
        <div className="w-96">
          <label htmlFor="gd-ses" className="etiqueta">Filtrar por sesión</label>
          <select id="gd-ses" name="sesion" defaultValue={sesionSel || ""} className="campo">
            <option value="">Todas</option>
            {sesiones.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}
          </select>
        </div>
        <button className="btn-secundario">Filtrar</button>
      </form>

      <section className="card overflow-x-auto">
        {visibles.length === 0 ? (
          <Vacio>No hay documentos registrados.</Vacio>
        ) : (
          <table className="w-full min-w-[800px] text-sm">
            <thead><tr><th className="th">Sesión</th><th className="th">Tipo</th><th className="th">Documento</th><th className="th">Versión</th><th className="th"></th></tr></thead>
            <tbody>
              {visibles.map((d) => (
                <tr key={d.id}>
                  <td className="td">
                    <div className="flex flex-col">
                      <span>{d.sesion ? `${d.sesion.codigo} · ${d.sesion.nombre}` : "General"}</span>
                      {d.programacion && (
                        <span className="text-xs text-[#9a3412]">
                          {origenDoc(d)} · sesión del {fechaCorta(d.programacion.fecha)} · {d.programacion.sede.nombre} · 📁 {SECCIONES[seccionDe(d)]}{d.subidoPor ? ` · ${d.subidoPor}` : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="td">{TIPO[d.tipo]}</td>
                  <td className="td">
                    <a href={enlaceDoc(d)} target={d.archivo ? undefined : "_blank"} rel="noreferrer" className="enlace">{d.archivo ? "⬇" : "↗"} {d.nombre}</a>
                    {!d.archivo && <span className="ml-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#92400e]">Enlace antiguo · súbelo como archivo</span>}
                    {d.tamano != null && <span className="ml-1 text-xs text-texto-2">({tamanoLegible(d.tamano)})</span>}
                  </td>
                  <td className="td">{d.version ?? "—"}</td>
                  <td className="td text-right">
                    <SiPuede modulo="documental">
                    <BotonEliminar accion={eliminarDocumento} campos={{ id: d.id }} etiqueta="Quitar" pregunta={`¿Quitar «${d.nombre}»?`} detalle={d.archivo ? "Se borra el archivo guardado." : undefined} />
                    </SiPuede>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
