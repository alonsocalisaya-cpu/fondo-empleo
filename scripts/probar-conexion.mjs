// Verifica la conexión a PostgreSQL y explica el problema si falla. Uso: npm run db:probar
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ No existe DATABASE_URL. Crea el archivo .env copiando .env.example");
  process.exit(1);
}
const oculto = url.replace(/:\/\/([^:]+):[^@]*@/, "://$1:****@");
console.log(`Probando conexión a ${oculto} …`);

const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
try {
  await cliente.connect();
  const { rows } = await cliente.query("select current_user, current_database(), version()");
  console.log(`✔ Conectado como "${rows[0].current_user}" a la base "${rows[0].current_database}".`);
  await cliente.end();
} catch (e) {
  const u = new URL(url);
  const usuario = decodeURIComponent(u.username);
  const base = u.pathname.slice(1);
  console.error("\n✖ No se pudo conectar a PostgreSQL.\n");
  switch (e.code) {
    case "28P01":
    case "28000":
      console.error(`  La contraseña del usuario "${usuario}" es incorrecta, o el usuario no existe.`);
      console.error("  → Abre pgAdmin 4 › Query Tool (conectado como postgres) y ejecuta:\n");
      console.error(`     CREATE USER ${usuario} WITH PASSWORD '${decodeURIComponent(u.password)}' CREATEDB;`);
      console.error(`     CREATE DATABASE ${base} OWNER ${usuario};\n`);
      console.error(`  Si el usuario ya existía, basta con:  ALTER USER ${usuario} WITH PASSWORD '${decodeURIComponent(u.password)}';\n`);
      break;
    case "3D000":
      console.error(`  La base de datos "${base}" no existe.`);
      console.error("  → En pgAdmin 4 › Query Tool (conectado como postgres) ejecuta:\n");
      console.error(`     CREATE DATABASE ${base} OWNER ${usuario};\n`);
      break;
    case "ECONNREFUSED":
      console.error(`  PostgreSQL no está encendido en ${u.hostname}:${u.port || 5432}.`);
      console.error("  → Pulsa Win + R, escribe services.msc, busca \"postgresql-x64-…\" y dale a Iniciar.");
      console.error("    También revisa que el puerto en .env sea el mismo que elegiste al instalar.\n");
      break;
    default:
      console.error(`  Detalle: ${e.code ?? ""} ${e.message}\n`);
  }
  process.exit(1);
}
