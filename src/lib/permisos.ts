/**
 * Permisos por rol. Este archivo no accede a la base de datos: lo usan el proxy, las páginas,
 * el menú y las acciones para decidir qué puede ver (ver) y modificar (editar) cada rol.
 */
import type { RolUsuario } from "@/db/schema";
import type { RolFlujo } from "./flujo-pre";

export const ROLES_USUARIO: Record<RolUsuario, string> = {
  admin: "Administrador del sistema",
  jefe_proyecto: "Jefe de Proyecto",
  jefe_comercial: "Agente Comercial",
  asistente: "Asistente de Capacitación",
  capacitador: "Capacitador (consultor)",
  gestion_documental: "Encargado de Gestión Documental",
  administradora: "Administradora",
  rrhh: "Recursos Humanos",
};

export type Modulo =
  | "inicio"
  | "calendario"
  | "cronograma"
  | "consultores"
  | "indicadores"
  | "acciones"
  | "capacitaciones"
  | "beneficiarios"
  | "rrhh"
  | "logistica"
  | "mantenimiento"
  | "documental"
  | "usuarios";

export type Nivel = "ver" | "editar";

export const MODULOS: Record<Modulo, { nombre: string; rutas: string[] }> = {
  inicio: { nombre: "Inicio", rutas: ["/"] },
  calendario: { nombre: "Calendario", rutas: ["/calendario"] },
  cronograma: { nombre: "Cronograma y estructura", rutas: ["/estrategico/cronograma"] },
  consultores: { nombre: "Carga laboral del personal", rutas: ["/estrategico/consultores"] },
  indicadores: { nombre: "Indicadores", rutas: ["/estrategico/indicadores", "/estrategico"] },
  acciones: { nombre: "Acciones correctivas", rutas: ["/estrategico/acciones-correctivas"] },
  beneficiarios: { nombre: "Beneficiarios", rutas: ["/operativo/capacitaciones/participantes"] },
  capacitaciones: { nombre: "Capacitaciones (pre y post, asistencia)", rutas: ["/operativo"] },
  rrhh: { nombre: "Personal (datos del equipo)", rutas: ["/personal"] },
  logistica: { nombre: "Logística (inventario y sedes)", rutas: ["/soporte/logistica"] },
  mantenimiento: { nombre: "Mantenimiento (equipos)", rutas: ["/soporte/mantenimiento"] },
  documental: { nombre: "Gestión documental", rutas: ["/soporte/gestion-documental"] },
  usuarios: { nombre: "Accesos, roles y permisos", rutas: ["/personal/permisos"] },
};

const V: Nivel = "ver";
const E: Nivel = "editar";

/** Permisos por defecto: lo que no aparece, no se puede ni ver. Se pueden cambiar en «Usuarios y roles». */
export const PERMISOS_BASE: Record<RolUsuario, Partial<Record<Modulo, Nivel>>> = {
  admin: Object.fromEntries((Object.keys(MODULOS) as Modulo[]).map((m) => [m, E])),
  jefe_proyecto: {
    inicio: V, calendario: V, cronograma: E, consultores: E, indicadores: V, acciones: E,
    capacitaciones: E, beneficiarios: E, rrhh: V, logistica: E, mantenimiento: E, documental: E,
  },
  jefe_comercial: { inicio: V, calendario: V, cronograma: V, indicadores: V, capacitaciones: E, logistica: V },
  asistente: {
    inicio: V, calendario: V, cronograma: V, capacitaciones: E, beneficiarios: E, logistica: E, mantenimiento: E, documental: V,
  },
  capacitador: { calendario: V, capacitaciones: E },
  gestion_documental: {
    inicio: V, calendario: V, cronograma: V, capacitaciones: E, beneficiarios: V, logistica: V, mantenimiento: V, documental: E,
  },
  administradora: { inicio: V, calendario: V, indicadores: V, capacitaciones: E, logistica: E, mantenimiento: V, rrhh: V },
  rrhh: { inicio: V, calendario: V, cronograma: V, consultores: E, capacitaciones: V, beneficiarios: V, rrhh: E },
};

export type Matriz = Record<RolUsuario, Partial<Record<Modulo, Nivel>>>;

/**
 * Permisos vigentes. Los carga de la base el servidor (lib/permisos-db) y se comparten en memoria
 * entre el proxy y las páginas; mientras no se carguen, valen los de por defecto.
 */
const g = globalThis as unknown as { fePermisos?: Matriz };
export const permisosVigentes = (): Matriz => g.fePermisos ?? PERMISOS_BASE;
export function fijarPermisos(m: Matriz) {
  g.fePermisos = m;
}

/** El administrador siempre conserva todo (así nadie queda fuera de «Usuarios y roles»). */
export const FIJOS: { rol: RolUsuario; modulo: Modulo }[] = (Object.keys(MODULOS) as Modulo[]).map((m) => ({ rol: "admin", modulo: m }));

/** Uno o varios roles (un usuario puede tener varios: vale el mayor permiso de todos). */
export type Roles = RolUsuario | readonly RolUsuario[];
const aLista = (r: Roles): readonly RolUsuario[] => (typeof r === "string" ? [r] : r);

export const nombresRoles = (r: Roles) => aLista(r).map((x) => ROLES_USUARIO[x]).join(" · ");

/** Módulos que puede abrir (al menos «ver») alguno de sus roles. */
export function modulosDe(r: Roles): Modulo[] {
  const m = permisosVigentes();
  return (Object.keys(MODULOS) as Modulo[]).filter((mod) => aLista(r).some((x) => m[x]?.[mod]));
}

/** El capacitador (solo con ese rol) trabaja únicamente con sus sesiones. */
export const soloCapacitador = (r: Roles) => aLista(r).length > 0 && aLista(r).every((x) => x === "capacitador");

/** Módulo al que pertenece una ruta (el de la ruta más específica que coincida). */
export function moduloDe(ruta: string): Modulo | null {
  let mejor: { m: Modulo; largo: number } | null = null;
  for (const [m, def] of Object.entries(MODULOS) as [Modulo, (typeof MODULOS)[Modulo]][]) {
    for (const r of def.rutas) {
      const coincide = r === "/" ? ruta === "/" : ruta === r || ruta.startsWith(`${r}/`);
      if (coincide && (!mejor || r.length > mejor.largo)) mejor = { m, largo: r.length };
    }
  }
  return mejor?.m ?? null;
}

export function nivel(r: Roles, modulo: Modulo): Nivel | null {
  const m = permisosVigentes();
  let mejor: Nivel | null = null;
  for (const x of aLista(r)) {
    const n = m[x]?.[modulo];
    if (n === "editar") return "editar";
    if (n === "ver") mejor = "ver";
  }
  return mejor;
}

export function puede(r: Roles, modulo: Modulo, requerido: Nivel = "ver") {
  const n = nivel(r, modulo);
  return n === "editar" || (n === "ver" && requerido === "ver");
}

/** Rutas que cualquier usuario con sesión puede abrir. */
export const RUTAS_LIBRES = ["/cuenta", "/sin-permiso", "/archivos", "/notificaciones", "/api/notificaciones"];

export function puedeAbrir(r: Roles, ruta: string) {
  if (RUTAS_LIBRES.some((x) => ruta === x || ruta.startsWith(`${x}/`))) return true;
  const m = moduloDe(ruta);
  return m === null ? aLista(r).includes("admin") : puede(r, m, "ver");
}

/** Página de inicio según el rol (el capacitador va directo a sus sesiones). */
export function inicioDe(r: Roles) {
  return puede(r, "inicio") ? "/" : puede(r, "capacitaciones") ? "/operativo/capacitaciones" : puede(r, "calendario") ? "/calendario" : "/cuenta";
}

/** ¿Este usuario puede registrar una actividad del flujo que corresponde a estos roles? */
export function puedeRegistrarPaso(r: Roles, rolesPaso: RolFlujo[]) {
  return aLista(r).some((x) => x === "admin" || (rolesPaso as string[]).includes(x));
}

/** Quiénes arman la 1ra sección de la ficha (ítems, refrigerio y equipos). */
export const ROLES_FICHA: RolUsuario[] = ["admin", "jefe_proyecto", "asistente"];
export const puedeEditarFicha = (r: Roles) => aLista(r).some((x) => ROLES_FICHA.includes(x));
