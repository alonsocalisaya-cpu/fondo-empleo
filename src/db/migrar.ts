/**
 * Aplica las migraciones pendientes de la carpeta drizzle/ y muestra el resultado con claridad.
 * Se ejecuta solo al arrancar (npm run dev). También: npm run db:migrate
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

async function main() {
  await migrate(db, { migrationsFolder: "drizzle" });
  const r = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
  console.log(`✔ Base de datos al día (${(r.rows[0] as { n: number }).n} migraciones aplicadas).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✖ No se pudo actualizar la base de datos:");
    console.error("  ", e?.cause?.message ?? e?.message ?? e);
    process.exit(1);
  });
