import type { ReactNode } from "react";
import { usuarioActual } from "@/lib/auth";
import { puede, type Modulo, type Nivel } from "@/lib/permisos";

/** Muestra su contenido solo si el usuario puede editar (o `nivel`) el módulo; si no, `sino`. */
export default async function SiPuede({
  modulo,
  nivel = "editar",
  sino = null,
  children,
}: {
  modulo: Modulo;
  nivel?: Nivel;
  sino?: ReactNode;
  children: ReactNode;
}) {
  const u = await usuarioActual();
  return <>{u && puede(u.roles, modulo, nivel) ? children : sino}</>;
}
