import "server-only";
import { cache } from "react";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { programaciones, sesionesUsuario, usuarios, type RolUsuario } from "@/db/schema";
import { puede, puedeEditarFicha, soloCapacitador, type Modulo, type Nivel } from "./permisos";
import { cargarPermisos } from "./permisos-db";

const scrypt = promisify(scryptCb) as (clave: string, sal: string, largo: number) => Promise<Buffer>;

export const COOKIE = "fe_sesion";
const DIAS_SESION = 7;

export async function hashClave(clave: string) {
  const sal = randomBytes(16).toString("hex");
  const h = await scrypt(clave, sal, 64);
  return `${sal}:${h.toString("hex")}`;
}

export async function verificarClave(clave: string, guardado: string) {
  const [sal, hex] = guardado.split(":");
  if (!sal || !hex) return false;
  const h = await scrypt(clave, sal, 64);
  const esperado = Buffer.from(hex, "hex");
  return esperado.length === h.length && timingSafeEqual(esperado, h);
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea la sesión de ingreso y deja la cookie en el navegador. */
export async function abrirSesion(usuarioId: number) {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DIAS_SESION * 24 * 3600 * 1000);
  await db.insert(sesionesUsuario).values({ id: hashToken(token), usuarioId, expira });
  await db.update(usuarios).set({ ultimoIngreso: new Date() }).where(eq(usuarios.id, usuarioId));
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires: expira });
}

export async function cerrarSesionActual() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) await db.delete(sesionesUsuario).where(eq(sesionesUsuario.id, hashToken(token)));
  c.delete(COOKIE);
}

export type Usuario = {
  id: number;
  usuario: string;
  nombre: string;
  /** Rol principal (para mostrar) */
  rol: RolUsuario;
  /** Todos sus roles: los permisos son la suma de todos */
  roles: RolUsuario[];
  personalId: number | null;
  capacitadorId: number | null;
  debeCambiarClave: boolean;
};

/** Roles de una fila de usuarios (los antiguos solo tenían «rol»). */
export const rolesDe = (u: { rol: RolUsuario; roles: RolUsuario[] | null }) => (u.roles?.length ? u.roles : [u.rol]);

/** Usuario con sesión válida en esta petición (o null). */
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  await cargarPermisos();
  const [r] = await db
    .select({ u: usuarios })
    .from(sesionesUsuario)
    .innerJoin(usuarios, eq(sesionesUsuario.usuarioId, usuarios.id))
    .where(and(eq(sesionesUsuario.id, hashToken(token)), gt(sesionesUsuario.expira, new Date()), eq(usuarios.activo, true), eq(usuarios.acceso, true)));
  if (!r) return null;
  const { id, nombre, rol, personalId, capacitadorId, debeCambiarClave } = r.u;
  const usuario = r.u.usuario ?? "";
  return { id, usuario, nombre, rol, roles: rolesDe(r.u), personalId, capacitadorId, debeCambiarClave };
});

/** Para páginas: exige sesión (si no, al ingreso). */
export async function exigirUsuario() {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  return u;
}

/** Para páginas de edición: sin permiso de editar el módulo, a «Sin permiso». */
export async function exigirEdicion(modulo: Modulo) {
  const u = await exigirUsuario();
  if (!puede(u.roles, modulo, "editar")) redirect("/sin-permiso");
  return u;
}

export class SinPermiso extends Error {}

/**
 * Para acciones del servidor: exige sesión y permiso sobre el módulo.
 * Lanza un error si no lo tiene (las acciones no confían en lo que muestra la pantalla).
 */
export async function exigir(modulo: Modulo, requerido: Nivel = "editar") {
  const u = await usuarioActual();
  if (!u) throw new SinPermiso("Tu sesión terminó: vuelve a ingresar.");
  if (!puede(u.roles, modulo, requerido)) throw new SinPermiso("No tienes permiso para esta acción.");
  return u;
}

/** El capacitador solo trabaja con las sesiones que tiene asignadas. */
export function puedeVerSesion(u: Usuario, p: { capacitadorId: number | null }) {
  return !soloCapacitador(u.roles) || (u.capacitadorId !== null && p.capacitadorId === u.capacitadorId);
}

/** Condición para listar solo las sesiones que el usuario puede ver (el capacitador, las suyas). */
export function soloSesionesDe(u: Usuario) {
  return soloCapacitador(u.roles) ? eq(programaciones.capacitadorId, u.capacitadorId ?? -1) : undefined;
}

/** Como `exigir`, pero devuelve { error } en vez de lanzar (para formularios que muestran el mensaje). */
export async function permitir(modulo: Modulo, requerido: Nivel = "editar"): Promise<{ u: Usuario; error: null } | { u: null; error: string }> {
  try {
    return { u: await exigir(modulo, requerido), error: null };
  } catch (e) {
    if (e instanceof SinPermiso) return { u: null, error: e.message };
    throw e;
  }
}

/** Permiso para trabajar sobre una sesión programada concreta (el capacitador, solo en las suyas). */
export async function autorizarSesion(programacionId: number): Promise<{ u: Usuario; error: null } | { u: null; error: string }> {
  const perm = await permitir("capacitaciones");
  if (!perm.u) return perm;
  const [p] = await db
    .select({ capacitadorId: programaciones.capacitadorId })
    .from(programaciones)
    .where(eq(programaciones.id, programacionId));
  if (!p) return { u: null, error: "La sesión ya no existe." };
  if (!puedeVerSesion(perm.u, p)) return { u: null, error: "Esta sesión no está asignada a ti." };
  return perm;
}

/** Para la 1ra sección de la ficha: solo el asistente, el jefe de proyecto o el administrador. */
export async function autorizarFicha(programacionId: number): Promise<{ u: Usuario; error: null } | { u: null; error: string }> {
  const perm = await autorizarSesion(programacionId);
  if (!perm.u) return perm;
  if (!puedeEditarFicha(perm.u.roles)) return { u: null, error: "La ficha la arma el asistente de capacitación." };
  return perm;
}
