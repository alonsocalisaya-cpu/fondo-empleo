import Link from "next/link";
import { connection } from "next/server";
import type { RolUsuario } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth";
import { MODULOS, PERMISOS_BASE, ROLES_USUARIO, permisosVigentes, type Modulo } from "@/lib/permisos";
import { Encabezado } from "@/components/ui";
import { MatrizPermisos } from "../Formularios";

export const metadata = { title: "Qué puede hacer cada rol" };

export default async function Permisos() {
  await connection();
  await exigirUsuario();
  const modulos = Object.keys(MODULOS) as Modulo[];
  const editables = (Object.keys(ROLES_USUARIO) as RolUsuario[]).filter((r) => r !== "admin").map((r) => ({ valor: r, texto: ROLES_USUARIO[r] }));
  const tabla = (m: ReturnType<typeof permisosVigentes>) =>
    Object.fromEntries(editables.map((r) => [r.valor, Object.fromEntries(modulos.map((x) => [x, m[r.valor as RolUsuario][x] ?? "ninguno"]))]));
  return (
    <>
      <Encabezado
        antetitulo={<><Link href="/personal" className="hover:underline">Personal</Link> › Permisos</>}
        titulo="Qué puede hacer cada rol"
      />
      <MatrizPermisos
        roles={editables}
        modulos={modulos.map((m) => ({ valor: m, texto: MODULOS[m].nombre }))}
        valores={tabla(permisosVigentes())}
        base={tabla(PERMISOS_BASE)}
      />
    </>
  );
}
