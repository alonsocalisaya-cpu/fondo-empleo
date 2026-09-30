import { db } from "@/db";
import { permisosRol, type RolUsuario } from "@/db/schema";
import { FIJOS, MODULOS, PERMISOS_BASE, fijarPermisos, type Matriz, type Modulo, type Nivel } from "./permisos";

const g = globalThis as unknown as { fePermisosEn?: number };
const VIGENCIA_MS = 5000;

/** Lee de la base los permisos editados (cada pocos segundos como máximo) y los deja vigentes. */
export async function cargarPermisos(forzar = false) {
  if (!forzar && g.fePermisosEn && Date.now() - g.fePermisosEn < VIGENCIA_MS) return;
  const filas = await db.select().from(permisosRol);
  const m = Object.fromEntries(Object.entries(PERMISOS_BASE).map(([r, p]) => [r, { ...p }])) as Matriz;
  for (const f of filas) {
    if (!(f.modulo in MODULOS) || FIJOS.some((x) => x.rol === f.rol && x.modulo === f.modulo)) continue;
    const fila = m[f.rol as RolUsuario];
    if (f.nivel === "ver" || f.nivel === "editar") fila[f.modulo as Modulo] = f.nivel as Nivel;
    else delete fila[f.modulo as Modulo];
  }
  fijarPermisos(m);
  g.fePermisosEn = Date.now();
}
