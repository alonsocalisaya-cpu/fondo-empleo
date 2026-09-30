"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AREAS, type Area } from "@/lib/navegacion";
import Campana from "./Campana";

// Íconos simples de trazo para cada área
const ICONOS: Record<Area["id"], React.ReactNode> = {
  estrategico: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" strokeLinejoin="round" />,
  operativo: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" strokeLinecap="round" />
    </>
  ),
  soporte: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" strokeLinejoin="round" />,
};

/** ¿Pantalla grande (computadora)? En tablet y celular el menú se abre con el botón ☰. */
function useEscritorio() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(min-width: 1024px)");
      // Safari antiguo solo conoce addListener
      if (m.addEventListener) m.addEventListener("change", cb);
      else m.addListener(cb);
      return () => (m.removeEventListener ? m.removeEventListener("change", cb) : m.removeListener(cb));
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

/** Ruedita mientras se abre la página elegida (en celular la carga puede tardar un poco). */
function Cargando() {
  const { pending } = useLinkStatus();
  return pending ? <span className="ml-auto size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Cargando" /> : null;
}

/** ¿La ruta pertenece a algún módulo que el rol puede abrir? */
const permitida = (href: string, rutas: string[]) => rutas.some((r) => (r === "/" ? href === "/" : href === r || href.startsWith(`${r}/`)));

export default function Sidebar({
  usuario,
  rutasPermitidas,
  cerrarSesion,
}: {
  usuario: { nombre: string; rol: string };
  rutasPermitidas: string[];
  cerrarSesion: () => Promise<void>;
}) {
  const path = usePathname();
  const areas = AREAS.map((a) => ({ ...a, bloques: a.bloques.filter((b) => permitida(b.href, rutasPermitidas)) })).filter((a) => a.bloques.length);
  const areaActiva = areas.find((a) => path.startsWith(`/${a.id}`))?.id;
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(areaActiva ? [areaActiva] : []));

  // Al navegar a otra área (por un enlace), se abre automáticamente
  const [ultimaArea, setUltimaArea] = useState(areaActiva);
  if (areaActiva !== ultimaArea) {
    setUltimaArea(areaActiva);
    if (areaActiva && !abiertas.has(areaActiva)) setAbiertas(new Set([...abiertas, areaActiva]));
  }

  const escritorio = useEscritorio();
  const [abierto, setAbierto] = useState(false); // menú desplegado en tablet / celular
  // Al navegar, el menú del celular se cierra solo
  const [rutaPrevia, setRutaPrevia] = useState(path);
  if (path !== rutaPrevia) {
    setRutaPrevia(path);
    setAbierto(false);
  }
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [abierto]);

  const alternar = (id: string) =>
    setAbiertas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  return (
    <>
    {/* Barra superior en tablet y celular: botón de menú, logo y notificaciones */}
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-[#a9acb0] bg-[#bfc1c4] px-3 shadow-sm lg:hidden print:hidden">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={abierto}
        aria-controls="menu-principal"
        className="flex size-10 items-center justify-center rounded-lg bg-white text-marino shadow-[0_1px_2px_rgb(38_40_43/0.10)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>
      <Link href="/" className="flex h-10 items-center rounded-lg bg-white px-2.5 shadow-[0_1px_2px_rgb(38_40_43/0.10)]" aria-label="Fondoempleo (inicio)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fondoempleo.png" alt="Fondoempleo" width={342} height={92} className="h-6 w-auto" />
      </Link>
      <span className="flex-1" />
      {!escritorio && <Campana />}
    </header>
    {abierto && <div className="fixed inset-0 z-40 bg-[#26282b]/40 lg:hidden" onClick={() => setAbierto(false)} aria-hidden="true" />}
    <nav
      id="menu-principal"
      aria-label="Principal"
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[85vw] shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-[#a9acb0] bg-[#bfc1c4] px-4 py-6 shadow-[1px_0_8px_rgb(38_40_43/0.06)] transition-transform duration-200 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:w-66 lg:max-w-none lg:translate-x-0 print:hidden ${
        abierto ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}
    >
      <div className="mb-6 flex items-center gap-1">
        <Link href="/" className="flex flex-1 flex-col gap-1 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_3px_rgb(38_40_43/0.12)] transition-shadow hover:shadow-md" aria-label="Fondoempleo · Gestión de Capacitaciones (inicio)">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fondoempleo.png" alt="Fondoempleo" width={342} height={92} className="h-9 w-auto self-start" />
          <span className="text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap text-[#6d6e71]">Gestión de capacitaciones</span>
        </Link>
        {escritorio ? (
          <Campana />
        ) : (
          <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar menú" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-marino shadow-[0_1px_2px_rgb(38_40_43/0.10)]">
            ✕
          </button>
        )}
      </div>

      {[
        {
          href: "/calendario",
          label: "Calendario",
          icono: (
            <>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
            </>
          ),
        },
        {
          href: "/personal",
          label: "Personal",
          icono: (
            <>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.5 3 5.2" strokeLinecap="round" />
            </>
          ),
        },
      ]
        .filter((i) => permitida(i.href, rutasPermitidas))
        .map((i) => {
          const activo = path.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={activo ? "page" : undefined}
              onClick={() => setAbierto(false)}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors ${
                activo ? "bg-marino-2 font-semibold text-white shadow-sm" : "bg-white text-[#33363a] shadow-[0_1px_2px_rgb(38_40_43/0.10)] hover:bg-[#f1f4f3] hover:text-marino"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5 shrink-0" aria-hidden="true">
                {i.icono}
              </svg>
              {i.label}
              <Cargando />
            </Link>
          );
        })}

      {areas.map((area) => {
        const abierta = abiertas.has(area.id);
        const activa = area.id === areaActiva;
        return (
          <div key={area.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => alternar(area.id)}
              aria-expanded={abierta}
              aria-controls={`menu-${area.id}`}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-[15px] transition-colors ${
                activa ? "bg-white font-semibold text-marino shadow-[0_1px_2px_rgb(38_40_43/0.10)] hover:bg-[#f1f4f3]" : "bg-white text-[#33363a] shadow-[0_1px_2px_rgb(38_40_43/0.10)] hover:bg-[#f1f4f3] hover:text-marino"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5 shrink-0" aria-hidden="true">
                {ICONOS[area.id]}
              </svg>
              <span className="flex-1">{area.label}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`size-4 transition-transform ${abierta ? "rotate-90" : ""}`}
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <ul id={`menu-${area.id}`} hidden={!abierta} className="my-1.5 ml-[22px] flex flex-col gap-1 border-l-2 border-white/70 pl-3">
              {area.bloques.map((b) => {
                const actual = [b.href, ...(b.tambien ?? [])].some((h) => path === h || path.startsWith(`${h}/`));
                return (
                  <li key={b.href}>
                    <Link
                      href={b.href}
                      aria-current={actual ? "page" : undefined}
                      onClick={() => setAbierto(false)}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                        actual ? "bg-marino-2 font-semibold text-white shadow-sm" : "bg-white text-[#33363a] shadow-[0_1px_2px_rgb(38_40_43/0.10)] hover:bg-[#f1f4f3] hover:text-marino"
                      }`}
                    >
                      {b.label}
                      <Cargando />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div className="flex-1" />
      <div className="flex flex-col gap-2 rounded-xl bg-white px-3 py-3 shadow-[0_1px_2px_rgb(38_40_43/0.10)]">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#d8eee8] text-sm font-semibold text-[#1d7563]">
            {usuario.nombre.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium text-marino">{usuario.nombre}</span>
            <span className="truncate text-xs text-[#3f4246]">{usuario.rol}</span>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href="/cuenta" className="rounded px-2 py-1 text-[#3f4246] hover:bg-[#f1f4f3] hover:text-marino">Mi cuenta</Link>
          <form action={cerrarSesion}>
            <button className="rounded px-2 py-1 text-[#3f4246] hover:bg-[#f1f4f3] hover:text-marino">Salir</button>
          </form>
        </div>
      </div>
    </nav>
    </>
  );
}
