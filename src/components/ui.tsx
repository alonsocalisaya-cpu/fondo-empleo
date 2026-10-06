import Link from "next/link";
import type { ReactNode } from "react";
import { usuarioActual } from "@/lib/auth";
import { puedeAbrir } from "@/lib/permisos";
import type { EstadoProg } from "@/db/schema";

export function Encabezado({
  antetitulo,
  titulo,
  acciones,
}: {
  antetitulo?: ReactNode;
  titulo: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {antetitulo && <span className="text-sm text-texto-2">{antetitulo}</span>}
        <h1 className="text-2xl font-bold text-marino sm:text-3xl">{titulo}</h1>
      </div>
      {acciones && <div className="flex flex-wrap gap-3">{acciones}</div>}
    </header>
  );
}

export function Kpi({
  etiqueta,
  valor,
  detalle,
  tono = "normal",
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: string;
  tono?: "normal" | "alerta" | "ok";
}) {
  const color = tono === "alerta" ? "text-acento" : "text-marino";
  return (
    <div className="card flex flex-col gap-1.5 p-5">
      <span className="text-sm text-texto-2">{etiqueta}</span>
      <span className={`text-3xl font-bold ${color}`}>{valor}</span>
      {detalle && (
        <span className={`text-[13px] ${tono === "ok" ? "text-[#166534]" : "text-texto-2"}`}>{detalle}</span>
      )}
    </div>
  );
}

const CHIP: Record<EstadoProg, { txt: string; cls: string }> = {
  programada: { txt: "Programada", cls: "bg-[#dbeafe] text-[#1e40af]" },
  confirmada: { txt: "Confirmada", cls: "bg-[#dcfce7] text-[#166534]" },
  reprogramada: { txt: "Reprogramada", cls: "bg-[#fef3c7] text-[#92400e]" },
  cancelada: { txt: "Cancelada", cls: "bg-[#fee2e2] text-[#991b1b]" },
  finalizada: { txt: "Finalizada", cls: "bg-[#e5e7eb] text-[#374151]" },
};

export function ChipEstado({ estado, sinCapacitador }: { estado: EstadoProg; sinCapacitador?: boolean }) {
  const c = sinCapacitador && estado !== "finalizada" && estado !== "cancelada"
    ? { txt: "Sin consultor", cls: "bg-[#fee2e2] text-[#991b1b]" }
    : CHIP[estado];
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${c.cls}`}>
      {c.txt}
    </span>
  );
}

export const ESTADOS_PROG = Object.entries(CHIP).map(([valor, { txt }]) => ({ valor, txt }));

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-texto-2">{children}</p>;
}

export function nombreCompleto(p: { nombres: string; apellidos: string } | null | undefined) {
  return p ? `${p.nombres} ${p.apellidos}`.trim() : "—";
}

export function iniciales(p: { nombres: string; apellidos: string }) {
  return (p.nombres[0] + (p.apellidos[0] ?? p.nombres[1] ?? "")).toUpperCase();
}

/** Pestañas para navegar entre sub-secciones de un bloque. */
export async function Pestanas({ items, actual }: { items: { href: string; label: string }[]; actual: string }) {
  // Solo las pestañas que el rol del usuario puede abrir
  const u = await usuarioActual();
  const visibles = items.filter((i) => u && puedeAbrir(u.roles, i.href));
  return (
    <nav aria-label="Secciones" className="-mx-4 flex gap-1 overflow-x-auto border-b border-borde px-4 sm:mx-0 sm:px-0">
      {visibles.map((i) => {
        const activa = i.href === actual;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={activa ? "page" : undefined}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activa ? "border-acento text-marino" : "border-transparent text-texto-2 hover:text-marino"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const TABS_CRONOGRAMA = [
  { href: "/estrategico/cronograma", label: "Calendario de sesiones" },
  { href: "/estrategico/cronograma/estructura", label: "Estructura del programa" },
];

export const TABS_PRE = [
  { href: "/operativo/capacitaciones", label: "Sesiones" },
  { href: "/operativo/capacitaciones/participantes", label: "Beneficiarios" },
  { href: "/operativo/capacitaciones/participantes/registro", label: "Registro de asistencia y notas" },
  { href: "/operativo/capacitacion", label: "Listas de asistencia" },
  { href: "/operativo/post-capacitacion", label: "Resultados de asistencia" },
];

/** Título legible de una programación que reúne varias sesiones en un mismo horario. */
export function TituloSesion({ nombre, combinadas }: { nombre: string; combinadas: string[] }) {
  return <>{nombre}{combinadas.length ? ` + ${combinadas.join(" + ")}` : ""}</>;
}
