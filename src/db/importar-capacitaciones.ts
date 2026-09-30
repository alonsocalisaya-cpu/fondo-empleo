/**
 * Importa las capacitaciones de datos/capacitaciones.json (tomadas del Excel "programacion de sesiones").
 *
 *   npm run db:importar               → agrega/actualiza sin borrar nada
 *   npm run db:importar -- --reemplazar → además ELIMINA la estructura que no esté en el Excel
 *                                          (incluye las programaciones de esas sesiones)
 */
import "dotenv/config";
import { inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { sesiones } from "./schema";
import { ESTRUCTURA, importarEstructura } from "./estructura";

const reemplazar = process.argv.includes("--reemplazar");
const siFalta = process.argv.includes("--si-falta"); // usado al arrancar: solo importa si aún no están cargadas

async function main() {
  if (siFalta) {
    const codigos = ESTRUCTURA.flatMap((c) => c.actividades.flatMap((a) => a.modulos.flatMap((m) => m.sesiones.map((x) => x.codigo))));
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(sesiones).where(inArray(sesiones.codigo, codigos));
    if (n > 0) return null;
  }
  return importarEstructura({ reemplazar });
}

main()
  .then((r) => {
    if (!r) process.exit(0);
    console.log(
      `✔ Importado: ${r.componentes} componentes, ${r.actividades} actividades, ${r.modulos} módulos, ${r.sesiones} sesiones.` +
        (reemplazar ? ` Se eliminaron ${r.eliminadas} sesiones que no estaban en el Excel.` : ""),
    );
    process.exit(0);
  })
  .catch((e) => {
    console.error("✖ No se pudo importar:", e);
    process.exit(1);
  });
