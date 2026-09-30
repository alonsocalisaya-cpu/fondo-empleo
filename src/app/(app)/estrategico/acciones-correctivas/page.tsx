import SiPuede from "@/components/SiPuede";
import Link from "next/link";
import { connection } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { accionesCorrectivas, type EstadoAccion } from "@/db/schema";
import { fechaCorta, hoyISO } from "@/lib/fechas";
import { Encabezado, Kpi, Vacio } from "@/components/ui";
import { ORIGENES } from "./constantes";

export const metadata = { title: "Acciones correctivas" };

const ESTADO: Record<EstadoAccion, { txt: string; cls: string }> = {
  abierta: { txt: "Abierta", cls: "bg-[#dbeafe] text-[#1e40af]" },
  en_proceso: { txt: "En proceso", cls: "bg-[#fef3c7] text-[#92400e]" },
  cerrada: { txt: "Cerrada", cls: "bg-[#dcfce7] text-[#166534]" },
};
const PRIORIDAD = { alta: "text-[#991b1b] font-semibold", media: "text-[#92400e]", baja: "text-texto-2" } as const;
const ORIGEN = Object.fromEntries(ORIGENES) as Record<string, string>;

export default async function AccionesCorrectivas({ searchParams }: PageProps<"/estrategico/acciones-correctivas">) {
  await connection();
  const sp = await searchParams;
  const filtro = typeof sp.estado === "string" && sp.estado in ESTADO ? (sp.estado as EstadoAccion) : null;
  const hoy = hoyISO();

  const todas = await db.query.accionesCorrectivas.findMany({
    with: { sede: true, componente: true },
    orderBy: [desc(accionesCorrectivas.fechaDeteccion), desc(accionesCorrectivas.id)],
  });
  const lista = filtro ? todas.filter((a) => a.estado === filtro) : todas;
  const vencida = (a: (typeof todas)[number]) => a.estado !== "cerrada" && a.fechaLimite < hoy;

  const n = (e: EstadoAccion) => todas.filter((a) => a.estado === e).length;
  const nVencidas = todas.filter(vencida).length;

  return (
    <>
      <Encabezado
        antetitulo="Estratégico · Mejora continua"
        titulo="Acciones correctivas"
        acciones={<SiPuede modulo="acciones"><Link href="/estrategico/acciones-correctivas/nueva" className="btn-primario">+ Registrar acción</Link></SiPuede>}
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi etiqueta="Abiertas" valor={n("abierta")} />
        <Kpi etiqueta="En proceso" valor={n("en_proceso")} />
        <Kpi etiqueta="Vencidas" valor={nVencidas} detalle="Pasaron su fecha límite sin cerrarse" tono={nVencidas ? "alerta" : "normal"} />
        <Kpi etiqueta="Cerradas" valor={n("cerrada")} tono="ok" detalle="Con resultado verificado" />
      </section>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {[["", "Todas"], ["abierta", "Abiertas"], ["en_proceso", "En proceso"], ["cerrada", "Cerradas"]].map(([k, t]) => {
          const activo = (filtro ?? "") === k;
          return (
            <Link
              key={k}
              href={k ? `/estrategico/acciones-correctivas?estado=${k}` : "/estrategico/acciones-correctivas"}
              aria-current={activo ? "page" : undefined}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${activo ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-white text-marino hover:bg-fondo"}`}
            >
              {t}
            </Link>
          );
        })}
      </nav>

      <section className="card overflow-x-auto">
        {lista.length === 0 ? (
          <Vacio>No hay acciones correctivas {filtro ? "con este estado" : "registradas"}.</Vacio>
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr>
                <th className="th">Acción</th><th className="th">Origen</th><th className="th">Ámbito</th>
                <th className="th">Responsable</th><th className="th">Prioridad</th><th className="th">Fecha límite</th>
                <th className="th">Estado</th><th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td className="td">
                    <div className="flex max-w-md flex-col">
                      <span className="font-medium">{a.titulo}</span>
                      <span className="line-clamp-1 text-xs text-texto-2">{a.accion}</span>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex flex-col">
                      <span>{ORIGEN[a.origen]}</span>
                      {a.indicador && <span className="text-xs text-texto-2">{a.indicador}</span>}
                    </div>
                  </td>
                  <td className="td text-[13px]">{[a.sede?.nombre, a.componente?.nombre].filter(Boolean).join(" · ") || "General"}</td>
                  <td className="td">{a.responsable}</td>
                  <td className={`td capitalize ${PRIORIDAD[a.prioridad]}`}>{a.prioridad}</td>
                  <td className={`td whitespace-nowrap ${vencida(a) ? "font-semibold text-[#991b1b]" : ""}`}>
                    {fechaCorta(a.fechaLimite)}
                    {vencida(a) && <span className="block text-xs">Vencida</span>}
                    {a.estado === "cerrada" && a.fechaCierre && <span className="block text-xs text-texto-2">Cerrada {fechaCorta(a.fechaCierre)}</span>}
                  </td>
                  <td className="td">
                    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO[a.estado].cls}`}>
                      {ESTADO[a.estado].txt}
                    </span>
                  </td>
                  <td className="td"><Link href={`/estrategico/acciones-correctivas/${a.id}`} className="enlace text-[13px]">Ver / editar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
