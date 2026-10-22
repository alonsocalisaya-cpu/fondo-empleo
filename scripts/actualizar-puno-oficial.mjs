import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

const ruta = process.argv[2];
if (!ruta) throw new Error("Indica el archivo oficial tabulado.");
const norm = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, " ").trim().toUpperCase();
const claveNombre = (x) => norm(x).split(" ").sort().join(" ");
const filas = readFileSync(ruta, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/).slice(1).map((l) => {
  const [nombre, dni, sede] = l.split("\t");
  if (!nombre?.includes(",") || !sede || (dni && !/^\d{8}$/.test(dni))) throw new Error(`Fila inválida: ${l}`);
  const [apellidos, nombres] = nombre.split(",").map((x) => x.trim());
  return { apellidos, nombres, dni: dni?.trim() || null, sede: sede.trim() };
});
const unicas = [...new Map(filas.map((f) => [JSON.stringify(f), f])).values()];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows: sedes } = await pool.query("select s.id,s.nombre from sedes s join estructuras e on e.id=s.estructura_id where e.nombre='Puno'");
  const { rows: personas } = await pool.query("select p.*,s.nombre sede,e.nombre region,(select count(*)::int from asistencias a where a.participante_id=p.id) asistencias from participantes p left join sedes s on s.id=p.sede_id left join estructuras e on e.id=s.estructura_id");
  const usados = new Set();
  const cambios = [], nuevos = [], conflictos = [];
  for (const f of unicas) {
    const sede = sedes.find((s) => norm(s.nombre) === norm(f.sede));
    if (!sede) { conflictos.push({ f, error: "Sede no encontrada" }); continue; }
    const porDni = f.dni ? personas.filter((p) => p.dni === f.dni) : [];
    const porNombre = personas.filter((p) => claveNombre(`${p.apellidos} ${p.nombres}`) === claveNombre(`${f.apellidos} ${f.nombres}`));
    const mismoNombreSede = porNombre.filter((p) => p.sede_id === sede.id);
    const candidatos = porDni.length ? porDni : mismoNombreSede.length === 1 ? mismoNombreSede : porNombre;
    if (candidatos.length > 1) { conflictos.push({ f, candidatos }); continue; }
    const p = candidatos[0];
    if (p && (p.region !== "Puno" || usados.has(p.id))) { conflictos.push({ f, p }); continue; }
    const valor = { ...f, sedeId: sede.id };
    if (!p) nuevos.push(valor);
    else {
      usados.add(p.id);
      if (p.nombres !== f.nombres || p.apellidos !== f.apellidos || p.dni !== f.dni || p.sede_id !== sede.id) cambios.push({ id: p.id, antes: { nombres: p.nombres, apellidos: p.apellidos, dni: p.dni, sede: p.sede }, despues: valor });
    }
  }
  const fuera = personas.filter((p) => p.region === "Puno" && !usados.has(p.id));
  const resumen = { filas: filas.length, duplicadasExactas: filas.length - unicas.length, oficiales: unicas.length, porSede: Object.fromEntries(sedes.map((s) => [s.nombre, unicas.filter((f) => norm(f.sede) === norm(s.nombre)).length])), actualizaciones: cambios.length, nuevos, conflictos, fuera };
  if (process.argv.includes("--aplicar")) {
    if (conflictos.length) throw new Error("Hay conflictos pendientes; no se aplicó nada.");
    // Solo se permite retirar el duplicado conocido sin vínculos ni historial.
    if (fuera.some((p) => p.id !== 316 || p.dni !== null || claveNombre(`${p.nombres} ${p.apellidos}`) !== claveNombre("BERTHA MAQUERO MERMA"))) throw new Error("Hay registros fuera de la lista que requieren revisión.");
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query("LOCK TABLE participantes IN SHARE ROW EXCLUSIVE MODE");
      const { rows: antes } = await cliente.query("select * from asistencias order by id");
      for (const c of cambios) {
        await cliente.query("update participantes set nombres=$1,apellidos=$2,dni=$3,sede_id=$4 where id=$5", [c.despues.nombres, c.despues.apellidos, c.despues.dni, c.despues.sedeId, c.id]);
      }
      for (const f of nuevos) await cliente.query("insert into participantes(nombres,apellidos,dni,sede_id) values($1,$2,$3,$4)", [f.nombres,f.apellidos,f.dni,f.sedeId]);
      for (const p of fuera) {
        const r = await cliente.query(`delete from participantes p where p.id=$1
          and not exists(select 1 from inscripciones i where i.participante_id=p.id)
          and not exists(select 1 from asistencias a where a.participante_id=p.id)
          and not exists(select 1 from incorporaciones_excepcionales x where x.participante_id=p.id)
          and not exists(select 1 from historial_beneficiarios h where h.participante_id=p.id) returning id`, [p.id]);
        if (r.rowCount !== 1) throw new Error("El duplicado tiene vínculos; no se aplicó nada.");
      }
      const { rows: despues } = await cliente.query("select * from asistencias order by id");
      if (JSON.stringify(antes) !== JSON.stringify(despues)) throw new Error("La verificación de conservación de asistencias falló.");
      const { rows: finales } = await cliente.query("select p.*,s.nombre sede from participantes p join sedes s on s.id=p.sede_id join estructuras e on e.id=s.estructura_id where e.nombre='Puno'");
      if (finales.length !== unicas.length || unicas.some((f) => !finales.some((p) => p.nombres === f.nombres && p.apellidos === f.apellidos && p.dni === f.dni && norm(p.sede) === norm(f.sede)))) throw new Error("La lista final no coincide con la oficial.");
      await cliente.query("COMMIT");
      resumen.aplicado = true;
      resumen.asistenciasConservadas = antes.length;
      resumen.totalFinalPuno = finales.length;
    } catch (e) { await cliente.query("ROLLBACK"); throw e; }
    finally { cliente.release(); }
  }
  console.log(JSON.stringify(resumen, null, 2));
} finally { await pool.end(); }
