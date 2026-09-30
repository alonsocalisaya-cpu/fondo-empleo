import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accionesCorrectivas } from "@/db/schema";

export async function opcionesAccion() {
  const [sedes, componentes] = await Promise.all([
    db.query.sedes.findMany({ orderBy: (t) => t.nombre }),
    db.query.componentes.findMany({ orderBy: (t) => t.orden }),
  ]);
  return {
    sedes: sedes.map((s) => ({ id: s.id, nombre: s.nombre })),
    componentes: componentes.map((c) => ({ id: c.id, nombre: c.nombre })),
  };
}

export async function buscarAccion(id: number) {
  return db.query.accionesCorrectivas.findFirst({ where: eq(accionesCorrectivas.id, id) });
}
