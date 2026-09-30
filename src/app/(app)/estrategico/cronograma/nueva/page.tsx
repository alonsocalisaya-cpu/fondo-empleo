import { exigirEdicion } from "@/lib/auth";
import { connection } from "next/server";
import { Encabezado, ESTADOS_PROG } from "@/components/ui";
import { hoyISO } from "@/lib/fechas";
import FormProgramacion from "../FormProgramacion";
import { opcionesFormulario } from "../opciones";

export const metadata = { title: "Programar sesión" };

export default async function NuevaProgramacion({ searchParams }: PageProps<"/estrategico/cronograma/nueva">) {
  await exigirEdicion("cronograma");
  await connection();
  const sp = await searchParams;
  const opciones = await opcionesFormulario();

  return (
    <>
      <Encabezado antetitulo="Estratégico · Cronograma" titulo="Programar sesión" />
      <FormProgramacion
        valores={{ sesionId: Number(sp.sesion) || undefined, fecha: hoyISO(), horaInicio: "08:00", horaFin: "10:00" }}
        estados={ESTADOS_PROG}
        {...opciones}
      />
    </>
  );
}
