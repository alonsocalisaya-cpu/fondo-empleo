import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { nombresRoles, inicioDe } from "@/lib/permisos";

export const metadata = { title: "Sin permiso" };

export default async function SinPermisoPage() {
  const u = await exigirUsuario();
  return (
    <div className="card mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 p-10 text-center">
      <span className="text-4xl" aria-hidden="true">🔒</span>
      <h1 className="text-xl font-bold text-marino">No tienes acceso a esta sección</h1>
      <p className="text-sm text-texto-2">Tu rol es «{nombresRoles(u.roles)}». Si necesitas entrar aquí, pídelo al administrador del sistema.</p>
      <Link href={inicioDe(u.roles)} className="btn-oscuro">Ir al inicio</Link>
    </div>
  );
}
