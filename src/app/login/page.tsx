import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/auth";
import { inicioDe } from "@/lib/permisos";
import FormIngreso from "./FormIngreso";

export const metadata = { title: "Ingresar" };

export default async function Login({ searchParams }: PageProps<"/login">) {
  const u = await usuarioActual();
  if (u) redirect(inicioDe(u.roles));
  const sp = await searchParams;
  const siguiente = typeof sp.siguiente === "string" ? sp.siguiente : "";
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-marino px-4">
      <div className="card flex w-full max-w-sm flex-col gap-6 p-8">
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fondoempleo.png" alt="Fondoempleo" width={342} height={92} className="h-14 w-auto" />
          <span className="text-sm font-semibold uppercase tracking-wide text-texto-2">Gestión de Capacitaciones</span>
        </div>
        <FormIngreso siguiente={siguiente} />
        <p className="text-center text-xs text-texto-2">¿Olvidaste tu contraseña? Pide al administrador que la restablezca.</p>
      </div>
    </div>
  );
}
