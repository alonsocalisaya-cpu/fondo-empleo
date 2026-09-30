/**
 * Importa la lista de beneficiarios (datos/beneficiarios.json) y los inscribe en sus sesiones.
 *   npm run db:importar-beneficiarios
 * Con --si-falta (usado al arrancar) solo importa si todavía no se hizo; en ambos casos
 * inscribe a los beneficiarios en las sesiones nuevas que se hayan programado.
 */
import "dotenv/config";
import { importarBeneficiarios, yaImportados } from "./beneficiarios";
import { inscribirBeneficiarios } from "./inscribir";

async function main() {
  if (process.argv.includes("--si-falta") && (await yaImportados())) {
    const n = await inscribirBeneficiarios();
    if (n) console.log(`✔ ${n} inscripciones nuevas de beneficiarios en sesiones programadas.`);
    return;
  }
  const r = await importarBeneficiarios();
  console.log(
    `✔ Beneficiarios: ${r.total} (${r.nuevos} nuevos, ${r.actualizados} actualizados) · ` +
      `${r.inscripciones} inscripciones en sesiones.`,
  );
  if (r.sinSede.length) console.log(`⚠ Sedes creadas porque no existían: ${r.sinSede.join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✖ No se pudo importar los beneficiarios:", e);
    process.exit(1);
  });
