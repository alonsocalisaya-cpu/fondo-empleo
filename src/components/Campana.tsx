"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Notif = {
  id: string;
  href: string;
  actividad: string;
  etapa: string;
  sesion: string;
  sede: string;
  fecha: string;
  hora: string;
  desde: string;
  nueva: boolean;
  urgencia: "vencida" | "pronto" | null;
};
type Mensaje = { id: number; titulo: string; mensaje: string | null; href: string | null; de: string | null; creadoEn: string; leido: boolean; confirmado: boolean };
type Datos = { total: number; nuevas: number; items: Notif[]; mensajes: Mensaje[] };

const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const hace = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 60 / 24)} d`;
};

/** Campana de notificaciones: actividades del flujo que le tocan al usuario. Se actualiza cada minuto. */
export default function Campana() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [abierta, setAbierta] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const path = usePathname();

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/notificaciones", { cache: "no-store" });
      if (r.ok) setDatos(await r.json());
    } catch {
      /* sin conexión: se reintenta en el próximo ciclo */
    }
  }, []);

  // Al cargar, al navegar (p. ej. después de registrar una actividad) y cada minuto
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar, path]);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  /** Al cerrar, lo que se vio deja de contarse como nuevo. */
  const cerrar = useCallback(() => {
    setAbierta(false);
    setDatos((d) => (d && d.nuevas ? { ...d, nuevas: 0, items: d.items.map((n) => ({ ...n, nueva: false })), mensajes: d.mensajes.map((m) => ({ ...m, leido: true })) } : d));
  }, []);

  // Cerrar con Escape o clic fuera
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      cerrar();
      boton.current?.focus();
    };
    const clic = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", clic);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", clic);
    };
  }, [abierta, cerrar]);

  const alternar = () => {
    if (abierta) return cerrar();
    setAbierta(true);
    // Se marcan como vistas; el panel sigue resaltando las nuevas hasta que se cierre
    if (datos?.nuevas) fetch("/api/notificaciones", { method: "POST" }).catch(() => {});
  };

  const confirmar = async (id: number) => {
    setDatos((d) => d && { ...d, mensajes: d.mensajes.map((m) => (m.id === id ? { ...m, confirmado: true } : m)) });
    await fetch("/api/notificaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmar: id }) }).catch(() => {});
  };

  const nuevas = datos?.nuevas ?? 0;
  const pendientesMsj = datos?.mensajes.filter((m) => !m.confirmado).length ?? 0;
  const total = (datos?.total ?? 0) + pendientesMsj;
  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        aria-label={`Notificaciones: ${total} pendiente(s)${nuevas ? `, ${nuevas} nueva(s)` : ""}`}
        className={`relative flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${abierta ? "bg-marino-2 text-white" : "bg-white text-[#33363a] shadow-[0_1px_2px_rgb(38_40_43/0.10)] hover:bg-[#f1f4f3] hover:text-marino"}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" strokeLinejoin="round" />
          <path d="M10 20.5a2 2 0 0 0 4 0" strokeLinecap="round" />
        </svg>
        {total > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
              "bg-[#dc2626] text-white ring-2 ring-[#bfc1c4]"
            }`}
          >
            {nuevas || total > 99 ? (nuevas || "99+") : total}
          </span>
        )}
      </button>

      {/* El panel va al body para que el overflow y el z-index de la barra no lo recorten. */}
      {abierta && typeof document !== "undefined" && createPortal((
        <div
          ref={panel}
          role="dialog"
          aria-label="Notificaciones"
          className="fixed inset-x-2 top-16 z-50 flex max-h-[calc(100dvh-5rem)] flex-col lg:inset-x-auto lg:left-[17.25rem] lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-[400px] lg:max-w-[calc(100vw-18rem)] overflow-hidden rounded-xl border border-borde bg-white text-texto shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-borde px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-marino">Notificaciones</h2>
              <p className="text-xs text-texto-2">
                {datos?.total ? `${datos.total} actividad(es) pendiente(s) de tu rol` : "No tienes actividades pendientes"}
                {pendientesMsj ? ` · ${pendientesMsj} mensaje(s)` : ""}
                {nuevas ? ` · ${nuevas} nueva(s)` : ""}
              </p>
            </div>
            <Link href="/notificaciones" onClick={cerrar} className="enlace text-[13px]">Ver todas</Link>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {datos?.mensajes.map((m) => (
              <li key={`m${m.id}`} className={`border-b border-[#eef1f5] px-4 py-2.5 ${m.leido ? "" : "bg-[#fff7ed]"}`}>
                <div className="flex gap-3">
                  <span aria-hidden="true" className="mt-0.5 text-sm">✉️</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold leading-snug text-marino">{m.titulo}</span>
                    {m.mensaje && <span className="whitespace-pre-line text-xs text-texto">{m.mensaje}</span>}
                    <span className="text-[11px] text-texto-2">{m.de ? `De ${m.de} · ` : ""}{hace(m.creadoEn)}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-3">
                      {m.confirmado ? (
                        <span className="text-xs font-semibold text-[#166534]">✓ Enterado</span>
                      ) : (
                        <button type="button" onClick={() => confirmar(m.id)} className="rounded-md bg-marino px-2.5 py-1 text-xs font-semibold text-white hover:bg-marino-2">
                          Enterado
                        </button>
                      )}
                      {m.href && <Link href={m.href} onClick={cerrar} className="enlace text-xs">Ver la sesión →</Link>}
                    </span>
                  </div>
                </div>
              </li>
            ))}
            {datos?.items.map((n) => (
              <li key={n.id} className="border-b border-[#eef1f5] last:border-0">
                <Link
                  href={n.href}
                  onClick={cerrar}
                  className={`flex gap-3 px-4 py-2.5 hover:bg-[#f5f7fa] ${n.nueva ? "bg-[#fff7ed]" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${n.urgencia === "vencida" ? "bg-[#dc2626]" : n.urgencia === "pronto" ? "bg-[#f59e0b]" : n.nueva ? "bg-acento" : "bg-[#cbd5e1]"}`}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] font-semibold leading-snug text-marino">{n.actividad}</span>
                    <span className="truncate text-xs text-texto">{n.sesion}</span>
                    <span className="text-[11px] text-texto-2">
                      {n.sede} · {fecha(n.fecha)} {n.hora} · {n.etapa} · {hace(n.desde)}
                      {n.urgencia === "vencida" && <strong className="text-[#b91c1c]"> · atrasada</strong>}
                      {n.urgencia === "pronto" && <strong className="text-[#b45309]"> · la sesión es pronto</strong>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {(datos?.total ?? 0) > (datos?.items.length ?? 0) && (
            <Link href="/notificaciones" onClick={cerrar} className="border-t border-borde px-4 py-2.5 text-center text-[13px] font-semibold text-marino hover:bg-[#f5f7fa]">
              Ver las {datos?.total} actividades pendientes →
            </Link>
          )}
        </div>
      ), document.body)}
    </>
  );
}
