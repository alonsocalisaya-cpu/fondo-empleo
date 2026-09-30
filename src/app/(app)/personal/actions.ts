"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { capacitadores, permisosRol, personal, rolUsuarioEnum, sesionesUsuario, usuarios, type RolUsuario } from "@/db/schema";
import { hashClave, permitir } from "@/lib/auth";
import { MODULOS, ROLES_USUARIO, puede, type Modulo } from "@/lib/permisos";
import { cargarPermisos } from "@/lib/permisos-db";
import { gruposDuplicados, nombreDe, principal, sincronizarRegistros, unirPersonas, usuarioSugerido } from "@/lib/personas";

type Res = { ok?: string; error?: string; clave?: string; usuario?: string } | undefined;
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const refrescar = () => revalidatePath("/", "layout");

/** Contraseña temporal fácil de dictar (se cambia en el primer ingreso). */
function claveTemporal() {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  return `${Array.from({ length: 4 }, () => letras[randomInt(letras.length)]).join("")}${randomInt(1000, 9999)}`;
}

/** DNI, correo o un nombre de usuario simple (letras, números, punto, guion). */
const USUARIO_VALIDO = /^(\d{8,12}|[^\s@]+@[^\s@]+\.[^\s@]+|[a-z0-9][a-z0-9._-]{2,49})$/;
const ERROR_USUARIO = "El usuario debe ser un DNI, un correo o un nombre sin espacios (p. ej. maria.perez).";
const duplicado = (e: unknown) => (e as { cause?: { code?: string } })?.cause?.code === "23505";

/** Datos de la persona y sus roles, tal como vienen del formulario. */
function leer(f: FormData) {
  const nombres = txt(f, "nombres");
  const apellidos = txt(f, "apellidos");
  const roles = rolUsuarioEnum.enumValues.filter((r) => f.getAll("roles").map(String).includes(r));
  const dni = txt(f, "dni");
  const email = txt(f, "email").toLowerCase();
  if (!nombres) return { error: "Escribe los nombres." } as const;
  if (!roles.length) return { error: "Marca al menos un rol." } as const;
  if (dni && !/^\d{8,12}$/.test(dni)) return { error: "El DNI debe tener solo números (8 a 12)." } as const;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "El correo no es válido." } as const;
  return {
    datos: {
      nombres,
      apellidos: apellidos || null,
      nombre: nombreDe({ nombres, apellidos }),
      dni: dni || null,
      email: email || null,
      telefono: txt(f, "telefono") || null,
      especialidad: roles.includes("capacitador") ? txt(f, "especialidad") || null : null,
      roles,
      rol: roles[0],
    },
  } as const;
}

/** Quien no administra accesos no puede dar ni quitar el rol de Administrador. */
function rolesPermitidos(puedeAccesos: boolean, antes: readonly RolUsuario[], despues: readonly RolUsuario[]) {
  if (puedeAccesos) return null;
  return antes.includes("admin") !== despues.includes("admin") ? "Solo quien administra los accesos puede dar o quitar el rol de Administrador." : null;
}

export async function crearPersona(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("rrhh");
  if (!perm.u) return { error: perm.error };
  const r = leer(f);
  if ("error" in r) return { error: r.error };
  const puedeAccesos = puede(perm.u.roles, "usuarios", "editar");
  const conAcceso = puedeAccesos && f.get("acceso") === "si";
  const err = rolesPermitidos(puedeAccesos, [], r.datos.roles);
  if (err) return { error: err };

  let usuario: string | null = null;
  let clave: string | null = null;
  if (conAcceso) {
    usuario = txt(f, "usuario").toLowerCase() || (await usuarioSugerido(r.datos));
    if (!USUARIO_VALIDO.test(usuario)) return { error: ERROR_USUARIO };
    clave = claveTemporal();
  }
  try {
    await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(usuarios)
        .values({ ...r.datos, usuario, acceso: conAcceso, claveHash: clave ? await hashClave(clave) : null, debeCambiarClave: true })
        .returning();
      await sincronizarRegistros(tx, u);
    });
  } catch (e) {
    return { error: duplicado(e) ? "Ya existe alguien con ese usuario o DNI." : "No se pudo guardar." };
  }
  refrescar();
  return clave
    ? { ok: `${r.datos.nombre} registrado. Usuario «${usuario}» · contraseña temporal:`, clave, usuario: usuario! }
    : { ok: `${r.datos.nombre} registrado (sin acceso al sistema).` };
}

export async function editarPersona(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("rrhh");
  if (!perm.u) return { error: perm.error };
  const id = Number(f.get("id"));
  const r = leer(f);
  if ("error" in r) return { error: r.error };
  const [antes] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  if (!antes) return { error: "La persona ya no existe." };
  const puedeAccesos = puede(perm.u.roles, "usuarios", "editar");
  const err = rolesPermitidos(puedeAccesos, antes.roles, r.datos.roles);
  if (err) return { error: err };
  if (id === perm.u.id && antes.roles.includes("admin") && !r.datos.roles.includes("admin")) return { error: "No puedes quitarte a ti mismo el rol de Administrador." };

  // El usuario de acceso solo lo cambia quien administra los accesos
  const cambios: Partial<typeof usuarios.$inferInsert> = { ...r.datos };
  if (puedeAccesos && antes.usuario !== null && f.has("usuario")) {
    const usuario = txt(f, "usuario").toLowerCase();
    if (!USUARIO_VALIDO.test(usuario)) return { error: ERROR_USUARIO };
    cambios.usuario = usuario;
  }
  try {
    await db.transaction(async (tx) => {
      const [u] = await tx.update(usuarios).set(cambios).where(eq(usuarios.id, id)).returning();
      await sincronizarRegistros(tx, u);
    });
  } catch (e) {
    return { error: duplicado(e) ? "Ya existe alguien con ese usuario o DNI." : "No se pudieron guardar los cambios." };
  }
  refrescar();
  return { ok: "Cambios guardados." };
}

/** Activa o da de baja a la persona (dada de baja no aparece para asignar ni puede ingresar). */
export async function alternarPersona(f: FormData) {
  const perm = await permitir("rrhh");
  if (!perm.u) return;
  const id = Number(f.get("id"));
  if (id === perm.u.id) return;
  await db.transaction(async (tx) => {
    const [u] = await tx.update(usuarios).set({ activo: sql`not ${usuarios.activo}` }).where(eq(usuarios.id, id)).returning();
    if (u) await sincronizarRegistros(tx, u);
  });
  await db.delete(sesionesUsuario).where(eq(sesionesUsuario.usuarioId, id));
  refrescar();
}

export async function eliminarPersona(f: FormData): Promise<Res> {
  const perm = await permitir("rrhh");
  if (!perm.u) return { error: perm.error };
  const id = Number(f.get("id"));
  if (id === perm.u.id) return { error: "No puedes eliminarte a ti mismo." };
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  if (!u) return { ok: "Eliminado." };
  if (u.roles.includes("admin")) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(usuarios)
      .where(and(sql`'admin' = any(${usuarios.roles})`, eq(usuarios.activo, true), eq(usuarios.acceso, true), ne(usuarios.id, id)));
    if (!n) return { error: "Debe quedar al menos un administrador con acceso." };
  }
  await db.transaction(async (tx) => {
    await tx.delete(usuarios).where(eq(usuarios.id, id));
    // Sus sesiones programadas quedan sin consultor / asistente asignado
    if (u.capacitadorId) await tx.delete(capacitadores).where(eq(capacitadores.id, u.capacitadorId));
    if (u.personalId) await tx.delete(personal).where(eq(personal.id, u.personalId));
  });
  refrescar();
  return { ok: "Eliminado." };
}

/* ── Acceso al sistema ─────────────────────────────────────── */

export async function darAcceso(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("usuarios");
  if (!perm.u) return { error: perm.error };
  const id = Number(f.get("id"));
  const [p] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  if (!p) return { error: "La persona ya no existe." };
  const usuario = txt(f, "usuario").toLowerCase() || p.usuario || (await usuarioSugerido(p, id));
  if (!USUARIO_VALIDO.test(usuario)) return { error: ERROR_USUARIO };
  const clave = claveTemporal();
  try {
    await db.update(usuarios).set({ usuario, acceso: true, claveHash: await hashClave(clave), debeCambiarClave: true }).where(eq(usuarios.id, id));
  } catch (e) {
    return { error: duplicado(e) ? "Ese usuario ya lo tiene otra persona." : "No se pudo dar el acceso." };
  }
  refrescar();
  return { ok: `Acceso dado · usuario «${usuario}» · contraseña temporal:`, clave, usuario };
}

export async function quitarAcceso(f: FormData) {
  const perm = await permitir("usuarios");
  if (!perm.u) return;
  const id = Number(f.get("id"));
  if (id === perm.u.id) return;
  await db.update(usuarios).set({ acceso: false }).where(eq(usuarios.id, id));
  await db.delete(sesionesUsuario).where(eq(sesionesUsuario.usuarioId, id));
  refrescar();
}

export async function restablecerClave(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("usuarios");
  if (!perm.u) return { error: perm.error };
  const id = Number(f.get("id"));
  const clave = claveTemporal();
  await db.update(usuarios).set({ claveHash: await hashClave(clave), debeCambiarClave: true }).where(eq(usuarios.id, id));
  await db.delete(sesionesUsuario).where(eq(sesionesUsuario.usuarioId, id));
  refrescar();
  return { ok: "Nueva contraseña temporal:", clave };
}

export type CreadoMasivo = { usuario: string; nombre: string; roles: string; clave: string };
type ResMasivo = { ok?: string; error?: string; creados?: CreadoMasivo[] } | undefined;

/** Da acceso de una vez a todas las personas activas que aún no lo tienen. */
export async function darAccesoATodos(_p: ResMasivo, _f: FormData): Promise<ResMasivo> {
  void _p;
  void _f;
  const perm = await permitir("usuarios");
  if (!perm.u) return { error: perm.error };
  const sin = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.activo, true), sql`(${usuarios.acceso} = false or ${usuarios.claveHash} is null or ${usuarios.usuario} is null)`))
    .orderBy(usuarios.nombre);
  if (!sin.length) return { ok: "Todas las personas activas ya tienen acceso." };
  const creados: CreadoMasivo[] = [];
  for (const p of sin) {
    const usuario = p.usuario ?? (await usuarioSugerido(p, p.id));
    const clave = claveTemporal();
    await db.update(usuarios).set({ usuario, acceso: true, claveHash: await hashClave(clave), debeCambiarClave: true }).where(eq(usuarios.id, p.id));
    creados.push({ usuario, nombre: p.nombre, roles: p.roles.map((r) => ROLES_USUARIO[r]).join(" · "), clave });
  }
  refrescar();
  return { ok: `Se dio acceso a ${creados.length} persona(s).`, creados };
}

/* ── Qué puede hacer cada rol ──────────────────────────────── */

export async function guardarPermisos(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("usuarios");
  if (!perm.u) return { error: perm.error };
  const filas: { rol: RolUsuario; modulo: string; nivel: string }[] = [];
  for (const rol of rolUsuarioEnum.enumValues) {
    if (rol === "admin") continue;
    for (const modulo of Object.keys(MODULOS) as Modulo[]) {
      const v = txt(f, `p-${rol}-${modulo}`);
      filas.push({ rol, modulo, nivel: v === "ver" || v === "editar" ? v : "ninguno" });
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(permisosRol);
    await tx.insert(permisosRol).values(filas);
  });
  await cargarPermisos(true);
  refrescar();
  return { ok: "Permisos guardados: ya rigen para todos los usuarios." };
}

export async function restaurarPermisos(_p: Res, _f: FormData): Promise<Res> {
  void _p;
  void _f;
  const perm = await permitir("usuarios");
  if (!perm.u) return { error: perm.error };
  await db.delete(permisosRol);
  await cargarPermisos(true);
  refrescar();
  return { ok: "Se restauraron los permisos por defecto." };
}

/* ── Unir personas repetidas ───────────────────────────────── */

/** Une un grupo de personas repetidas (ids separados por coma) en la que tiene acceso o más datos. */
export async function unirGrupo(f: FormData) {
  const perm = await permitir("rrhh");
  if (!perm.u) return;
  const ids = String(f.get("ids") ?? "").split(",").map(Number).filter(Boolean);
  const gente = await db.select().from(usuarios);
  const grupo = gente.filter((u) => ids.includes(u.id));
  if (grupo.length < 2) return;
  const queda = principal(grupo);
  await db.transaction(async (tx) => {
    for (const x of grupo) if (x.id !== queda.id) await unirPersonas(tx, queda.id, x.id);
  });
  refrescar();
}

/** Une todos los grupos de repetidos que detecta el sistema. */
export async function unirTodosLosRepetidos(f: FormData) {
  void f;
  const perm = await permitir("rrhh");
  if (!perm.u) return;
  const grupos = gruposDuplicados(await db.select().from(usuarios));
  await db.transaction(async (tx) => {
    for (const g of grupos) {
      const queda = principal(g);
      for (const x of g) if (x.id !== queda.id) await unirPersonas(tx, queda.id, x.id);
    }
  });
  refrescar();
}

/** Une manualmente a esta persona con otra que es la misma (se conserva esta). */
export async function unirCon(_p: Res, f: FormData): Promise<Res> {
  const perm = await permitir("rrhh");
  if (!perm.u) return { error: perm.error };
  const queda = Number(f.get("id"));
  const seVa = Number(f.get("otra"));
  if (!seVa) return { error: "Elige a la persona repetida." };
  if (seVa === perm.u.id) return { error: "No puedes unir tu propio usuario dentro de otro." };
  await db.transaction(async (tx) => unirPersonas(tx, queda, seVa));
  refrescar();
  return { ok: "Personas unidas en una sola." };
}
