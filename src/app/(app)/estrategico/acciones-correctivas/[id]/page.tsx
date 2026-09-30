import { exigirEdicion } from "@/lib/auth";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Encabezado } from "@/components/ui";
import FormAccion from "../FormAccion";
import { buscarAccion, opcionesAccion } from "../datos";
import { eliminarAccion } from "../actions";
import BotonEliminar from "@/components/BotonEliminar";

export const metadata = { title: "Acción correctiva" };

export default async function EditarAccion({ params }: PageProps<"/estrategico/acciones-correctivas/[id]">) {
  await exigirEdicion("acciones");
  await connection();
  const a = await buscarAccion(Number((await params).id));
  if (!a) notFound();
  const opciones = await opcionesAccion();

  return (
    <>
      <Encabezado
        antetitulo="Estratégico · Acciones correctivas"
        titulo={a.titulo}
        acciones={
          <BotonEliminar accion={eliminarAccion} campos={{ id: a.id }} pregunta="¿Eliminar esta acción correctiva?" grande />
        }
      />
      <FormAccion valores={a} {...opciones} />
    </>
  );
}
