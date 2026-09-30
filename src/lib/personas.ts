/**
 * Personal unificado: cada persona del equipo es una fila de «usuarios» (con o sin acceso al sistema).
 * Los registros de consultor (capacitadores) y de personal interno (personal) que usa el resto del sistema
 * —asignaciones, listas de asistentes, fichas— se mantienen sincronizados solos desde aquí.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { capacitadores, personal, programaciones, usuarios, type RolUsuario } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Persona = typeof usuarios.$inferSelect;

export const normalizar = (t: string | null | undefined) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Roles del personal interno (los que tienen registro en «personal»). */
const ROLES_INTERNOS = ["asistente", "jefe_proyecto", "jefe_comercial", "gestion_documental", "administradora", "rrhh"] as const;
type RolInterno = (typeof ROLES_INTERNOS)[number];
/** Si tiene varios roles internos, «asistente» manda (es el que se asigna a las sesiones). */
const rolInterno = (roles: readonly RolUsuario[]) => ROLES_INTERNOS.find((r) => roles.includes(r)) as RolInterno | undefined;

export const nombreDe = (p: { nombres?: string | null; apellidos?: string | null; nombre?: string | null }) =>
  `${p.nombres ?? ""} ${p.apellidos ?? ""}`.replace(/\s+/g, " ").trim() || (p.nombre ?? "");

/** ¿Es la misma persona? Mismo nombre y mismos apellidos (o a uno le faltan). */
function misma(a: { nombres: string | null; apellidos: string | null }, b: { nombres: string | null; apellidos: string | null }) {
  if (normalizar(a.nombres) !== normalizar(b.nombres) || !normalizar(a.nombres)) return false;
  return !normalizar(a.apellidos) || !normalizar(b.apellidos) || normalizar(a.apellidos) === normalizar(b.apellidos);
}

/** Separa «Nombre Apellido» cuando solo se tiene el nombre completo. */
function partir(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  return p.length <= 1 ? { nombres: p[0] ?? "", apellidos: "" } : { nombres: p[0], apellidos: p.slice(1).join(" ") };
}

/**
 * Deja una persona por cada consultor y cada miembro del personal interno que aún no la tenga
 * (uniendo a quien figura en ambos con el mismo nombre). No da acceso: eso se hace desde «Personal».
 * Es seguro llamarla muchas veces.
 */
export async function sincronizarPersonas() {
  const [gente, caps, pers] = await Promise.all([db.select().from(usuarios), db.select().from(capacitadores), db.select().from(personal)]);

  // Completar nombres/apellidos y datos de quienes no los tienen (usuarios creados antes de unificar)
  for (const u of gente.filter((x) => x.nombres === null)) {
    const c = caps.find((x) => x.id === u.capacitadorId);
    const p = pers.find((x) => x.id === u.personalId);
    const base = c ?? p ?? partir(u.nombre);
    const datos = {
      nombres: base.nombres,
      apellidos: base.apellidos || null,
      dni: u.dni ?? c?.dni ?? p?.dni ?? null,
      email: u.email ?? c?.email ?? p?.email ?? null,
      telefono: u.telefono ?? c?.telefono ?? p?.telefono ?? null,
      especialidad: u.especialidad ?? c?.especialidad ?? null,
    };
    await db.update(usuarios).set(datos).where(eq(usuarios.id, u.id));
    Object.assign(u, datos);
  }

  const conP = new Set(gente.map((u) => u.personalId).filter(Boolean));
  const conC = new Set(gente.map((u) => u.capacitadorId).filter(Boolean));
  let nuevos = 0;

  for (const p of pers.filter((x) => !conP.has(x.id))) {
    const igual = gente.filter((u) => !u.personalId && (misma(u, p) || parecenIguales(u, { ...p, nombre: nombreDe(p) })));
    if (igual.length === 1) {
      const u = igual[0];
      const roles = [...new Set([...u.roles, p.rol as RolUsuario])];
      await db.update(usuarios).set({ personalId: p.id, roles, dni: u.dni ?? p.dni, email: u.email ?? p.email, telefono: u.telefono ?? p.telefono }).where(eq(usuarios.id, u.id));
      Object.assign(u, { personalId: p.id, roles });
    } else {
      const [u] = await db
        .insert(usuarios)
        .values({
          nombre: nombreDe(p), nombres: p.nombres, apellidos: p.apellidos || null, dni: p.dni, email: p.email, telefono: p.telefono,
          rol: p.rol as RolUsuario, roles: [p.rol as RolUsuario], personalId: p.id, activo: p.activo, acceso: false, debeCambiarClave: true,
        })
        .returning();
      gente.push(u);
      nuevos++;
    }
  }
  for (const c of caps.filter((x) => !conC.has(x.id))) {
    const igual = gente.filter((u) => !u.capacitadorId && (misma(u, c) || parecenIguales(u, { ...c, nombre: nombreDe(c) })));
    if (igual.length === 1) {
      const u = igual[0];
      const roles = [...new Set([...u.roles, "capacitador" as RolUsuario])];
      await db
        .update(usuarios)
        .set({
          capacitadorId: c.id, roles, apellidos: u.apellidos || c.apellidos || null, dni: u.dni ?? c.dni, email: u.email ?? c.email,
          telefono: u.telefono ?? c.telefono, especialidad: u.especialidad ?? c.especialidad,
        })
        .where(eq(usuarios.id, u.id));
      Object.assign(u, { capacitadorId: c.id, roles });
    } else {
      const [u] = await db
        .insert(usuarios)
        .values({
          nombre: nombreDe(c), nombres: c.nombres, apellidos: c.apellidos || null, dni: c.dni, email: c.email, telefono: c.telefono,
          especialidad: c.especialidad, rol: "capacitador", roles: ["capacitador"], capacitadorId: c.id, activo: c.activo, acceso: false,
          debeCambiarClave: true,
        })
        .returning();
      gente.push(u);
      nuevos++;
    }
  }
  return nuevos;
}

/**
 * Después de guardar una persona: crea o actualiza su registro de consultor (si tiene el rol Capacitador)
 * y de personal interno (si tiene algún rol interno). Si ya no tiene el rol, el registro queda inactivo
 * (no se borra: las sesiones pasadas lo siguen mostrando). Devuelve los ids vinculados.
 */
export async function sincronizarRegistros(tx: Tx, u: Persona) {
  const datos = {
    nombres: u.nombres || partir(u.nombre).nombres,
    apellidos: u.apellidos ?? "",
    dni: u.dni || null,
    email: u.email || null,
    telefono: u.telefono || null,
  };
  let { capacitadorId, personalId } = u;

  if (u.roles.includes("capacitador")) {
    const fila = { ...datos, especialidad: u.especialidad || null, activo: u.activo };
    if (capacitadorId) await tx.update(capacitadores).set(fila).where(eq(capacitadores.id, capacitadorId));
    else capacitadorId = (await tx.insert(capacitadores).values(fila).returning({ id: capacitadores.id }))[0].id;
  } else if (capacitadorId) {
    await tx.update(capacitadores).set({ ...datos, activo: false }).where(eq(capacitadores.id, capacitadorId));
  }

  const rol = rolInterno(u.roles);
  if (rol) {
    const fila = { ...datos, rol, activo: u.activo };
    if (personalId) await tx.update(personal).set(fila).where(eq(personal.id, personalId));
    else personalId = (await tx.insert(personal).values(fila).returning({ id: personal.id }))[0].id;
  } else if (personalId) {
    await tx.update(personal).set({ ...datos, activo: false }).where(eq(personal.id, personalId));
  }

  if (capacitadorId !== u.capacitadorId || personalId !== u.personalId) {
    await tx.update(usuarios).set({ capacitadorId, personalId }).where(eq(usuarios.id, u.id));
  }
  return { capacitadorId, personalId };
}

/** Usuario sugerido: DNI, si no el correo, si no nombre.apellido (sin repetir uno existente). */
export async function usuarioSugerido(p: { dni?: string | null; email?: string | null; nombres?: string | null; apellidos?: string | null }, excepto?: number) {
  const tomados = new Set(
    (await db.select({ id: usuarios.id, u: usuarios.usuario }).from(usuarios)).filter((x) => x.id !== excepto && x.u).map((x) => x.u!),
  );
  const base =
    (p.dni && /^\d{8,12}$/.test(p.dni) && p.dni) ||
    (p.email && p.email.toLowerCase()) ||
    [normalizar(p.nombres).split(" ")[0], normalizar(p.apellidos).split(" ")[0]].filter(Boolean).join(".").replace(/[^a-z0-9.]/g, "") ||
    "usuario";
  const inicial = base.length >= 3 ? base : `${base}.fe`;
  let u = inicial;
  for (let i = 2; tomados.has(u); i++) u = `${inicial}${i}`;
  return u;
}


/* ── Personas duplicadas ─────────────────────────────────── */

const completo = (p: { nombres: string | null; apellidos: string | null; nombre: string }) => normalizar(nombreDe(p));

/** ¿Parecen la misma persona? Mismo nombre completo, o mismo primer nombre y a uno le faltan los apellidos. */
export function parecenIguales(
  a: { nombres: string | null; apellidos: string | null; nombre: string; dni: string | null },
  b: { nombres: string | null; apellidos: string | null; nombre: string; dni: string | null },
) {
  if (a.dni && b.dni) return a.dni === b.dni;
  const ca = completo(a);
  const cb = completo(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const [pa] = ca.split(" ");
  const [pb] = cb.split(" ");
  const sinApellidoA = !normalizar(a.apellidos) && ca.split(" ").length === 1;
  const sinApellidoB = !normalizar(b.apellidos) && cb.split(" ").length === 1;
  return pa === pb && (sinApellidoA || sinApellidoB);
}

/** Grupos de personas que parecen repetidas (para ofrecer unirlas). */
export function gruposDuplicados<T extends { id: number; nombres: string | null; apellidos: string | null; nombre: string; dni: string | null }>(gente: T[]) {
  const usados = new Set<number>();
  const grupos: T[][] = [];
  for (const a of gente) {
    if (usados.has(a.id)) continue;
    const g = gente.filter((b) => b.id === a.id || (!usados.has(b.id) && parecenIguales(a, b)));
    if (g.length > 1) {
      g.forEach((x) => usados.add(x.id));
      grupos.push(g);
    }
  }
  return grupos;
}

/** Cuál conservar al unir: la que tiene acceso, luego la de más datos. */
export function principal<T extends Persona>(g: T[]) {
  const puntos = (p: T) =>
    (p.acceso && p.usuario && p.claveHash ? 100 : 0) + (p.roles.includes("admin") ? 50 : 0) +
    [p.apellidos, p.dni, p.email, p.telefono, p.especialidad].filter(Boolean).length + (p.ultimoIngreso ? 10 : 0);
  return [...g].sort((a, b) => puntos(b) - puntos(a) || a.id - b.id)[0];
}

/**
 * Une a «seVa» dentro de «queda»: suma roles y datos que falten, y pasa sus sesiones
 * (como consultor y como asistente) al registro que se conserva. Luego borra el duplicado.
 */
export async function unirPersonas(tx: Tx, quedaId: number, seVaId: number) {
  const [queda] = await tx.select().from(usuarios).where(eq(usuarios.id, quedaId));
  const [seVa] = await tx.select().from(usuarios).where(eq(usuarios.id, seVaId));
  if (!queda || !seVa || queda.id === seVa.id) return;

  // Registros de consultor / personal: si ambos tienen, las sesiones pasan al que queda
  let capacitadorId = queda.capacitadorId ?? seVa.capacitadorId;
  if (queda.capacitadorId && seVa.capacitadorId && queda.capacitadorId !== seVa.capacitadorId) {
    await tx.update(programaciones).set({ capacitadorId: queda.capacitadorId }).where(eq(programaciones.capacitadorId, seVa.capacitadorId));
    await tx.update(usuarios).set({ capacitadorId: null }).where(eq(usuarios.id, seVa.id));
    await tx.delete(capacitadores).where(eq(capacitadores.id, seVa.capacitadorId));
    capacitadorId = queda.capacitadorId;
  }
  let personalId = queda.personalId ?? seVa.personalId;
  if (queda.personalId && seVa.personalId && queda.personalId !== seVa.personalId) {
    await tx.update(programaciones).set({ asistenteId: queda.personalId }).where(eq(programaciones.asistenteId, seVa.personalId));
    await tx.update(usuarios).set({ personalId: null }).where(eq(usuarios.id, seVa.id));
    await tx.delete(personal).where(eq(personal.id, seVa.personalId));
    personalId = queda.personalId;
  }
  const roles = [...new Set([...queda.roles, ...seVa.roles])];
  const acceso = queda.acceso && !!queda.claveHash;
  await tx.delete(usuarios).where(eq(usuarios.id, seVa.id));
  const [u] = await tx
    .update(usuarios)
    .set({
      roles,
      rol: roles[0],
      capacitadorId,
      personalId,
      apellidos: queda.apellidos || seVa.apellidos,
      dni: queda.dni || seVa.dni,
      email: queda.email || seVa.email,
      telefono: queda.telefono || seVa.telefono,
      especialidad: queda.especialidad || seVa.especialidad,
      // Si solo el duplicado tenía acceso, se conserva su acceso
      ...(!acceso && seVa.acceso && seVa.claveHash && seVa.usuario
        ? { usuario: seVa.usuario, claveHash: seVa.claveHash, acceso: true, debeCambiarClave: seVa.debeCambiarClave }
        : {}),
    })
    .where(eq(usuarios.id, queda.id))
    .returning();
  u.nombre = nombreDe(u);
  await tx.update(usuarios).set({ nombre: u.nombre }).where(eq(usuarios.id, u.id));
  await sincronizarRegistros(tx, u);
}
