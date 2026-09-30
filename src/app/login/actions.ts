"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { abrirSesion, cerrarSesionActual, hashClave, rolesDe, usuarioActual, verificarClave } from "@/lib/auth";
import { inicioDe } from "@/lib/permisos";

type Res = { error?: string; ok?: string } | undefined;

export async function iniciarSesion(_p: Res, f: FormData): Promise<Res> {
  const usuario = String(f.get("usuario") ?? "").trim().toLowerCase();
  const clave = String(f.get("clave") ?? "");
  const siguiente = String(f.get("siguiente") ?? "");
  if (!usuario || !clave) return { error: "Escribe tu usuario y contraseña." };
  const u = await db.query.usuarios.findFirst({ where: eq(usuarios.usuario, usuario) });
  if (!u || !u.claveHash || !(await verificarClave(clave, u.claveHash))) return { error: "Usuario o contraseña incorrectos." };
  if (!u.activo || !u.acceso) return { error: "Tu usuario no tiene acceso al sistema. Consulta con el administrador." };
  await abrirSesion(u.id);
  if (u.debeCambiarClave) redirect("/cuenta");
  redirect(siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : inicioDe(rolesDe(u)));
}

export async function cerrarSesion() {
  await cerrarSesionActual();
  redirect("/login");
}

export async function cambiarClave(_p: Res, f: FormData): Promise<Res> {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  const actual = String(f.get("actual") ?? "");
  const nueva = String(f.get("nueva") ?? "");
  const repetir = String(f.get("repetir") ?? "");
  const fila = await db.query.usuarios.findFirst({ where: eq(usuarios.id, u.id) });
  if (!fila || !fila.claveHash || !(await verificarClave(actual, fila.claveHash))) return { error: "La contraseña actual no es correcta." };
  if (nueva.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (!/\d/.test(nueva) || !/[a-zA-Z]/.test(nueva)) return { error: "Usa letras y números en la nueva contraseña." };
  if (nueva !== repetir) return { error: "Las contraseñas nuevas no coinciden." };
  if (nueva === actual) return { error: "La nueva contraseña debe ser distinta de la actual." };
  await db.update(usuarios).set({ claveHash: await hashClave(nueva), debeCambiarClave: false }).where(eq(usuarios.id, u.id));
  if (u.debeCambiarClave) redirect(inicioDe(u.roles));
  return { ok: "Contraseña actualizada." };
}
