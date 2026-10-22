import Link from "next/link";
import type { ProgramacionConRuta } from "@/lib/consultas";
import { combinadas } from "@/lib/consultas";
import { fechaCorta, hora, hoyISO, inicioSemana, sumarDias } from "@/lib/fechas";
import { nombreCompleto } from "@/components/ui";

const COLORES = { programada: "#1d4ed8", confirmada: "#15803d", reprogramada: "#a16207", cancelada: "#b91c1c", finalizada: "#475569" };

/** Vista de planificación propia del cronograma: las sesiones abren su edición. */
export default function CalendarioCronograma({ filas, desde, hasta, volver }: { filas: ProgramacionConRuta[]; desde: string; hasta: string; volver: string }) {
  const dias = [];
  const final = sumarDias(inicioSemana(hasta), 6);
  for (let dia = inicioSemana(desde); dia <= final; dia = sumarDias(dia, 1)) dias.push(dia);
  const porDia = new Map<string, ProgramacionConRuta[]>();
  for (const f of filas) porDia.set(f.fecha, [...(porDia.get(f.fecha) ?? []), f]);
  const hoy = hoyISO();
  return <section aria-label="Calendario del cronograma de capacitaciones" className="card overflow-x-auto">
    <div className="grid min-w-[980px] grid-cols-7">
      {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dia) => <div key={dia} className="border-b border-borde px-2 py-2 text-center text-xs font-semibold uppercase text-texto-2">{dia}</div>)}
      {dias.map((dia, indice) => {
        const sesiones = (porDia.get(dia) ?? []).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        const fuera = dia < desde || dia > hasta;
        return <div key={dia} className={`flex min-h-36 flex-col gap-1 border-b border-r border-borde p-2 ${fuera ? "bg-[#f5f6f7]" : indice % 7 >= 5 ? "bg-[#fffbf7]" : "bg-white"}`}>
          <div className="mb-1 flex items-center justify-between gap-1"><span className={`rounded px-1.5 py-1 text-xs font-semibold ${dia === hoy ? "bg-acento text-white" : fuera ? "text-texto-2" : "text-marino"}`}>{fechaCorta(dia)}</span>{sesiones.length > 0 && <span className="text-[10px] text-texto-2">{sesiones.length} ses.</span>}</div>
          {sesiones.map((f) => <Link key={f.id} href={`/estrategico/cronograma/${f.id}?volver=${encodeURIComponent(volver)}`} className="block rounded border-l-[3px] px-2 py-1.5 text-xs hover:shadow" style={{ borderLeftColor: COLORES[f.estado], background: `${COLORES[f.estado]}10` }} title={`Editar programación · ${[f.sesion.nombre, ...combinadas(f)].join(" + ")} · ${f.sede.nombre}`}>
            <span className="block font-semibold" style={{ color: COLORES[f.estado] }}>{hora(f.horaInicio)}–{hora(f.horaFin)} · {f.sede.nombre}</span>
            <span className="mt-0.5 block text-texto">{[f.sesion.nombre, ...combinadas(f)].join(" + ")}</span>
            <span className="mt-1 block text-[11px] text-texto-2">{f.capacitador ? nombreCompleto(f.capacitador) : "Sin consultor"}{f.asistente ? ` · ${nombreCompleto(f.asistente)}` : ""}</span>
          </Link>)}
        </div>;
      })}
    </div>
    {!filas.length && <p className="p-5 text-center text-sm text-texto-2">No hay sesiones con estos filtros.</p>}
  </section>;
}
