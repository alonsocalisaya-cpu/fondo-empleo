import { exigirEdicion } from "@/lib/auth";
import { connection } from "next/server";
import { Encabezado } from "@/components/ui";
import { hoyISO, sumarDias } from "@/lib/fechas";
import FormAccion from "../FormAccion";
import { opcionesAccion } from "../datos";

export const metadata = { title: "Registrar acción correctiva" };

export default async function NuevaAccion({ searchParams }: PageProps<"/estrategico/acciones-correctivas/nueva">) {
  await exigirEdicion("acciones");
  await connection();
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const opciones = await opcionesAccion();
  const hoy = hoyISO();

  return (
    <>
      <Encabezado antetitulo="Estratégico · Acciones correctivas" titulo="Registrar acción correctiva" />
      <FormAccion
        valores={{
          titulo: s("titulo"),
          problema: s("problema"),
          indicador: s("indicador"),
          origen: s("indicador") ? "indicador" : undefined,
          sedeId: Number(s("sede")) || null,
          componenteId: Number(s("componente")) || null,
          fechaDeteccion: hoy,
          fechaLimite: sumarDias(hoy, 15),
        }}
        {...opciones}
      />
    </>
  );
}
