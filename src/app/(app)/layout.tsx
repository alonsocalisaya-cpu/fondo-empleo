import Sidebar from "@/components/Sidebar";
import ArcosFondo from "@/components/ArcosFondo";
import { exigirUsuario } from "@/lib/auth";
import { MODULOS, modulosDe, nombresRoles } from "@/lib/permisos";
import { cerrarSesion } from "@/app/login/actions";

/** Todo el sistema (con menú) requiere haber ingresado. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const u = await exigirUsuario();
  const modulos = modulosDe(u.roles);
  return (
    <>
      <Sidebar
        usuario={{ nombre: u.nombre, rol: nombresRoles(u.roles) }}
        rutasPermitidas={modulos.flatMap((m) => MODULOS[m].rutas)}
        cerrarSesion={cerrarSesion}
      />
      <main className="espacio-trabajo flex min-h-screen min-w-0 flex-1 flex-col gap-5 px-4 pb-8 pt-20 sm:gap-6 sm:px-6 lg:px-10 lg:py-8 print:bg-none print:p-0">
        <ArcosFondo />
        {children}
      </main>
    </>
  );
}
