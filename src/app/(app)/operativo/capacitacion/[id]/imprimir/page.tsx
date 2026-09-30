import { exigirUsuario, puedeVerSesion } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { programaciones } from "@/db/schema";
import { LISTA_PROYECTO, LISTA_TITULO, datosLista } from "@/lib/lista-asistencia";
import BotonImprimir from "@/components/BotonImprimir";

export const metadata = { title: "Lista de asistencia" };

/** Lista de asistencia en el formato oficial (el mismo del Excel); fecha y sesión se completan a mano. */
export default async function Imprimir({ params }: PageProps<"/operativo/capacitacion/[id]/imprimir">) {
  await connection();
  const id = Number((await params).id);
  const p = await db.query.programaciones.findFirst({ where: eq(programaciones.id, id) });
  if (!p || !puedeVerSesion(await exigirUsuario(), p)) notFound();
  const [{ hoja }] = await datosLista([id]);
  const filas = [...hoja.personas, ...Array.from({ length: hoja.enBlanco ?? 0 }, () => null)];
  const celda = "border border-black px-2";

  return (
    <div className="hoja-asistencia mx-auto flex w-full max-w-[820px] flex-col gap-4 bg-white p-6 print:max-w-none print:p-0">
      <style>{`@page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { margin: 0 !important; }
          .hoja-asistencia {
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            padding: 19.05mm 17.78mm !important;
          }
        }`}</style>
      <div className="flex flex-wrap justify-between gap-2 print:hidden">
        <Link href={`/operativo/capacitacion/${id}`} className="btn-secundario">← Volver</Link>
        <div className="flex gap-2">
          <a href={`/operativo/capacitacion/${id}/excel`} className="btn-secundario">⬇ Formato oficial Excel</a>
          <BotonImprimir />
        </div>
      </div>

      <table className="w-full table-fixed border-collapse text-black" style={{ fontFamily: "Calibri, Arial, sans-serif", fontSize: "11pt" }}>
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "43.7%" }} />
          <col style={{ width: "17.4%" }} />
          <col style={{ width: "32.9%" }} />
        </colgroup>
        <thead>
          <tr style={{ height: "45pt" }}>
            <th colSpan={4} className="border border-black px-3 py-2">
              <div className="flex items-center justify-between">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/acide.png" alt="ACIDE Consultoría en Gestión" className="h-12 w-auto" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/fondoempleo-lista.png" alt="Fondoempleo" className="h-10 w-auto" />
              </div>
            </th>
          </tr>
          <tr style={{ height: "27.75pt" }}>
            <th colSpan={4} className="border border-black bg-[#223962] px-3 py-2 text-center font-bold text-white print:bg-[#223962]" style={{ fontSize: "14pt", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
              {LISTA_TITULO}
            </th>
          </tr>
          <tr style={{ height: "46.5pt" }}>
            <th colSpan={4} className="border border-black bg-[#d0dcf1] px-4 py-2.5 text-center font-bold print:bg-[#d0dcf1]" style={{ fontSize: "14pt", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
              {hoja.proyecto || LISTA_PROYECTO} - {hoja.sede}
            </th>
          </tr>
          <tr style={{ height: "28.5pt" }}>
            <th colSpan={2} className="border border-black px-3 py-2 text-left font-bold" style={{ fontSize: "14pt" }}>Fecha:</th>
            <th colSpan={2} className="border border-black px-3 py-2 text-left font-bold" style={{ fontSize: "14pt" }}>Sesión:</th>
          </tr>
          <tr className="bg-[#223962] text-white print:bg-[#223962]" style={{ height: "17.25pt", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
            <th className={`${celda} py-1`}></th>
            <th className={`${celda} py-1 text-center`} style={{ fontSize: "13pt" }}>NOMBRES Y APELLIDOS</th>
            <th className={`${celda} py-1 text-center`} style={{ fontSize: "13pt" }}>DNI</th>
            <th className={`${celda} py-1 text-center`} style={{ fontSize: "13pt" }}>FIRMA</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="break-inside-avoid" style={{ height: "52.5pt" }}>
              <td className={`${celda} bg-[#223962] text-center text-white print:bg-[#223962]`} style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>{i + 1}</td>
              <td className={`${celda} text-center`} style={{ fontSize: "15pt" }}>{f?.nombre ?? ""}</td>
              <td className={`${celda} text-center`} style={{ fontSize: "15pt" }}>{f?.dni ?? ""}</td>
              <td className={celda}></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
