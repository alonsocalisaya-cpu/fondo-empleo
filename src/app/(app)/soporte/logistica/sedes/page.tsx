import SiPuede from "@/components/SiPuede";
import { connection } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { programaciones, sedes } from "@/db/schema";
import { Encabezado, Pestanas, Vacio } from "@/components/ui";
import { TABS_LOGISTICA } from "../tabs";
import FormAlta from "@/components/FormAlta";
import { alternarSede, crearSede, eliminarSede } from "@/lib/acciones-maestros";
import BotonEliminar from "@/components/BotonEliminar";

export const metadata = { title: "Logística · Sedes" };

export default async function Sedes() {
  await connection();
  const filas = await db
    .select({
      id: sedes.id,
      nombre: sedes.nombre,
      direccion: sedes.direccion,
      distrito: sedes.distrito,
      contacto: sedes.contacto,
      telefono: sedes.telefono,
      activa: sedes.activa,
      sesiones: sql<number>`count(${programaciones.id})::int`,
    })
    .from(sedes)
    .leftJoin(programaciones, eq(programaciones.sedeId, sedes.id))
    .groupBy(sedes.id)
    .orderBy(sedes.nombre);

  return (
    <>
      <Encabezado antetitulo="Soporte · Logística" titulo="Sedes" />
      <Pestanas items={TABS_LOGISTICA} actual="/soporte/logistica/sedes" />
      <SiPuede modulo="logistica">
      <FormAlta
        titulo="Nueva sede"
        accion={crearSede}
        boton="Agregar sede"
        campos={[
          { name: "nombre", label: "Nombre", required: true },
          { name: "direccion", label: "Dirección" },
          { name: "distrito", label: "Distrito" },
          { name: "contacto", label: "Contacto en la sede" },
          { name: "telefono", label: "Teléfono", inputMode: "tel" },
        ]}
      />
      </SiPuede>
      <section className="card overflow-x-auto">
        {filas.length === 0 ? <Vacio>No hay sedes registradas.</Vacio> : (
          <table className="w-full text-sm">
            <thead><tr><th className="th">Sede</th><th className="th">Dirección</th><th className="th">Distrito</th><th className="th">Contacto</th><th className="th">Sesiones programadas</th><th className="th">Estado</th><th className="th"></th></tr></thead>
            <tbody>
              {filas.map((s) => (
                <tr key={s.id} className={s.activa ? "" : "text-texto-2"}>
                  <td className="td font-medium">{s.nombre}</td>
                  <td className="td">{s.direccion ?? "—"}</td>
                  <td className="td">{s.distrito ?? "—"}</td>
                  <td className="td">
                    <div className="flex flex-col"><span>{s.contacto ?? "—"}</span><span className="text-xs text-texto-2">{s.telefono ?? ""}</span></div>
                  </td>
                  <td className="td">{s.sesiones}</td>
                  <td className="td">{s.activa ? "Activa" : "Inactiva"}</td>
                  <td className="td text-right">
                    <SiPuede modulo="logistica">
                    <div className="flex items-start justify-end gap-4">
                      <form action={alternarSede}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="enlace text-[13px]">{s.activa ? "Desactivar" : "Activar"}</button>
                      </form>
                      <BotonEliminar
                        accion={eliminarSede}
                        campos={{ id: s.id }}
                        pregunta={`¿Eliminar la sede ${s.nombre}?`}
                        detalle={s.sesiones ? `Tiene ${s.sesiones} sesión(es): no se podrá eliminar mientras existan.` : "Sus beneficiarios y equipos quedarán sin sede."}
                      />
                    </div>
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
