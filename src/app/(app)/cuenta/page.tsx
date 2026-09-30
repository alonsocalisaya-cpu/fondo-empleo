import { exigirUsuario } from "@/lib/auth";
import { nombresRoles } from "@/lib/permisos";
import { Encabezado } from "@/components/ui";
import FormClave from "./FormClave";

export const metadata = { title: "Mi cuenta" };

export default async function Cuenta() {
  const u = await exigirUsuario();
  return (
    <>
      <Encabezado antetitulo={`${u.usuario} · ${nombresRoles(u.roles)}`} titulo={`Hola, ${u.nombre}`} />
      {u.debeCambiarClave && (
        <p role="alert" className="max-w-md rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
          Es tu primer ingreso (o te restablecieron la contraseña): crea una contraseña propia para continuar.
        </p>
      )}
      <FormClave />
    </>
  );
}
