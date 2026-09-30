/**
 * Importa el cronograma de datos/cronograma.json (Excel "Cronograma Consultor V3", hoja General).
 *   npm run db:importar-cronograma   → crea/actualiza sedes, consultores, asistentes y las 130 programaciones
 * Con --si-falta (usado al arrancar) solo importa si todavía no se hizo.
 */
import "dotenv/config";
import { actualizarCombinadas, importarCronograma, yaImportado } from "./cronograma";

async function main() {
  if (process.argv.includes("--si-falta") && (await yaImportado())) {
    const n = await actualizarCombinadas();
    if (n) console.log(`✔ ${n} sesiones combinadas del cronograma actualizadas.`);
    return;
  }
  const r = await importarCronograma();
  console.log(
    `✔ Cronograma importado: ${r.programaciones} sesiones programadas, ${r.sedes} sedes, ` +
      `${r.consultoresNuevos} consultores nuevos, ${r.asistentesNuevos} asistentes nuevos.`,
  );
  if (r.sinSesion.length) console.log(`⚠ ${r.sinSesion.length} filas sin sesión reconocida:\n  ${r.sinSesion.join("\n  ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✖ No se pudo importar el cronograma:", e);
    process.exit(1);
  });
