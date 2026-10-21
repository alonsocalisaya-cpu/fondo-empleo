import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

// Sin --aplicar solo valida. No sobrescribe beneficiarios ni inventa DNI o turnos.
const ruta = process.argv.find((arg, i) => i > 1 && !arg.startsWith("--"));
if (!ruta) throw new Error("Indica el archivo tabulado con nombre completo, DNI y sede.");
const normalizar = (valor) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const filas = readFileSync(ruta, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/).slice(1).filter((linea) => linea.trim()).map((linea, i) => {
  const [nombre = "", dni = "", sede = ""] = linea.split("\t");
  return { linea: i + 2, nombre: nombre.replace(/\s+/g, " ").trim(), dni: dni.trim(), sede: sede.trim() };
});
const frecuencias = new Map();
for (const fila of filas) if (fila.dni) frecuencias.set(fila.dni, (frecuencias.get(fila.dni) ?? 0) + 1);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const cliente = await pool.connect();
try {
  await cliente.query("BEGIN");
  const { rows: sedes } = await cliente.query("select s.id,s.nombre from sedes s join estructuras e on e.id=s.estructura_id where e.nombre='Puno'");
  const ids = new Map(sedes.map((sede) => [normalizar(sede.nombre), sede.id]));
  const pendientes = [];
  const nuevos = [];
  let existentes = 0;
  for (const fila of filas) {
    if (process.argv.includes("--incluir-sin-dni") && (!fila.dni || frecuencias.get(fila.dni) > 1)) fila.dni = null;
    let motivo = fila.dni === null ? null : !/^\d{8}$/.test(fila.dni) ? "DNI ausente o inválido" : frecuencias.get(fila.dni) > 1 ? "DNI repetido en la lista" : null;
    motivo ??= !fila.nombre || fila.nombre.length > 100 ? "Nombre inválido" : !ids.has(normalizar(fila.sede)) ? "Sede no encontrada" : null;
    if (motivo) { pendientes.push({ linea: fila.linea, motivo }); continue; }
    const sedeId = ids.get(normalizar(fila.sede));
    const { rows: registrados } = fila.dni === null
      ? await cliente.query("select nombres,apellidos,sede_id from participantes where dni is null and sede_id=$1 and upper(trim(concat(nombres,' ',apellidos)))=$2", [sedeId, normalizar(fila.nombre)])
      : await cliente.query("select nombres,apellidos,sede_id from participantes where dni=$1", [fila.dni]);
    if (registrados.length) {
      const registrado = registrados[0];
      if (normalizar(`${registrado.nombres} ${registrado.apellidos}`) !== normalizar(fila.nombre) || registrado.sede_id !== sedeId) pendientes.push({ linea: fila.linea, motivo: "DNI existente con nombre o sede diferente" });
      else existentes++;
      continue;
    }
    nuevos.push({ ...fila, sedeId });
  }
  if (process.argv.includes("--aplicar")) {
    for (const fila of nuevos) {
      // La fuente trae un único nombre completo: se conserva sin inferir apellidos.
      await cliente.query("insert into participantes(nombres,apellidos,dni,sede_id) values($1,'',$2,$3)", [fila.nombre, fila.dni, fila.sedeId]);
    }
    await cliente.query("COMMIT");
  } else await cliente.query("ROLLBACK");
  const porSede = {};
  for (const fila of nuevos) porSede[fila.sede] = (porSede[fila.sede] ?? 0) + 1;
  console.log(JSON.stringify({ aplicado: process.argv.includes("--aplicar"), filas: filas.length, nuevos: nuevos.length, existentes, porSede, pendientes }, null, 2));
} catch (error) {
  await cliente.query("ROLLBACK");
  throw error;
} finally {
  cliente.release();
  await pool.end();
}
