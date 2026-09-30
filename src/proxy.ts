/**
 * Control de acceso antes de mostrar cualquier página:
 *  - sin sesión válida → al ingreso (/login)
 *  - debe cambiar su contraseña → /cuenta
 *  - su rol no puede abrir esa sección → /sin-permiso
 * Las acciones del servidor vuelven a verificar el permiso por su cuenta (ver src/lib/auth.ts).
 */
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sesionesUsuario, usuarios } from "@/db/schema";
import { inicioDe, puedeAbrir } from "@/lib/permisos";
import { migrarSiHayCambios } from "@/db/auto-migrar";
import { cargarPermisos } from "@/lib/permisos-db";

const COOKIE = "fe_sesion";

export async function proxy(req: NextRequest) {
  const ruta = req.nextUrl.pathname;
  // Si llegó una actualización con cambios en la base de datos, se aplican antes de continuar
  await migrarSiHayCambios();
  if (ruta === "/login") return NextResponse.next();

  const alIngreso = () => {
    const url = new URL("/login", req.url);
    if (ruta !== "/") url.searchParams.set("siguiente", ruta + req.nextUrl.search);
    const r = NextResponse.redirect(url);
    r.cookies.delete(COOKIE);
    return r;
  };

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return alIngreso();
  const [u] = await db
    .select({ rol: usuarios.rol, roles: usuarios.roles, debeCambiar: usuarios.debeCambiarClave })
    .from(sesionesUsuario)
    .innerJoin(usuarios, eq(sesionesUsuario.usuarioId, usuarios.id))
    .where(
      and(
        eq(sesionesUsuario.id, createHash("sha256").update(token).digest("hex")),
        gt(sesionesUsuario.expira, new Date()),
        eq(usuarios.activo, true),
        eq(usuarios.acceso, true),
      ),
    );
  if (!u) return alIngreso();
  const roles = u.roles?.length ? u.roles : [u.rol];
  await cargarPermisos();

  // Solo se redirige al navegar (las acciones del servidor se validan por dentro)
  if (req.method !== "GET") return NextResponse.next();
  if (u.debeCambiar && ruta !== "/cuenta") return NextResponse.redirect(new URL("/cuenta", req.url));
  if (ruta === "/" && inicioDe(roles) !== "/") return NextResponse.redirect(new URL(inicioDe(roles), req.url));
  if (!puedeAbrir(roles, ruta)) return NextResponse.redirect(new URL("/sin-permiso", req.url));
  return NextResponse.next();
}

export const config = {
  // Todo menos archivos internos de Next, imágenes y la subida de archivos (que valida la sesión por sí misma)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/archivos|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
