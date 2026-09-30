import { exigirEdicion } from "@/lib/auth";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { programaciones } from "@/db/schema";
import { Encabezado, ESTADOS_PROG } from "@/components/ui";
import FormProgramacion from "../FormProgramacion";
import { opcionesFormulario } from "../opciones";
import { eliminarProgramacion } from "../actions";
import BotonEliminar from "@/components/BotonEliminar";

export const metadata = { title: "Editar programación" };

export default async function EditarProgramacion({ params }: PageProps<"/estrategico/cronograma/[id]">) {
  await exigirEdicion("cronograma");
  await connection();
  const { id } = await params;
  const p = await db.query.programaciones.findFirst({
    where: eq(programaciones.id, Number(id)),
    with: { combinadas: { orderBy: (t, { asc }) => [asc(t.orden)] } },
  });
  if (!p) notFound();
  const opciones = await opcionesFormulario();

  return (
    <>
      <Encabezado
        antetitulo="Estratégico · Cronograma"
        titulo="Editar programación"
        acciones={
          <BotonEliminar
            accion={eliminarProgramacion}
            campos={{ id: p.id }}
            etiqueta="Eliminar programación"
            pregunta="¿Eliminar esta sesión programada?"
            detalle="Se borran también su lista de asistencia, la ficha y todo lo registrado en el pre y post."
            grande
          />
        }
      />
      <FormProgramacion
        valores={{ ...p, horaInicio: p.horaInicio.slice(0, 5), horaFin: p.horaFin.slice(0, 5), combinadas: p.combinadas.map((c) => c.sesionId) }}
        estados={ESTADOS_PROG}
        {...opciones}
      />
    </>
  );
}
