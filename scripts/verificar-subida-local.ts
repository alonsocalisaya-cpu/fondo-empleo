/** Prueba local de integración. Crea y elimina una sesión y documentos exclusivos de prueba. */
import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const marca = `prueba-transferencia-${randomBytes(8).toString("hex")}`;
  const base = path.resolve("archivos");
  try {
    const { rows: usuarios } = await pool.query("select id from usuarios where activo and acceso and not debe_cambiar_clave and (rol='admin' or 'admin'=any(roles)) limit 1");
    assert.ok(usuarios[0], "Se requiere un administrador local para la prueba.");
    const { rows: sesiones } = await pool.query("select id from sesiones where codigo like 'ARQ-%' order by id limit 1");
    assert.ok(sesiones[0]);
    await pool.query("insert into sesiones_usuario(id,usuario_id,expira) values($1,$2,now()+interval '10 minutes')", [hash, usuarios[0].id]);
    for (const bytes of [128, 2 * 1024 ** 3 + 65536]) {
      const parametros = new URLSearchParams({ archivo: `${marca}.mp4`, nombre: `${marca}-${bytes}`, tamano: String(bytes), tipo: "otro", sesionId: String(sesiones[0].id) });
      const url = `http://localhost:4000/api/archivos?${parametros}`;
      if (bytes === 128) {
        const prohibida = await fetch(url, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: Buffer.alloc(bytes) });
        assert.equal(prohibida.status, 403);
      }
      const bloque = Buffer.alloc(64 * 1024, 37);
      const stream = Readable.from((function* () {
        for (let pendiente = bytes; pendiente > 0; pendiente -= bloque.length) yield bloque.subarray(0, Math.min(pendiente, bloque.length));
      })());
      const respuesta = await fetch(url, { method: "POST", headers: { "Content-Type": "application/octet-stream", "Content-Length": String(bytes), Cookie: `fe_sesion=${token}` },
        body: stream as unknown as BodyInit, duplex: "half" } as RequestInit & { duplex: string });
      const resultado = await respuesta.json();
      assert.equal(respuesta.status, 200, JSON.stringify(resultado));
      assert.equal(resultado.tamano, bytes);
      const { rows } = await pool.query("select archivo,tamano from documentos where id=$1", [resultado.id]);
      assert.equal(Number(rows[0].tamano), bytes);
      assert.match(rows[0].archivo, /^ARQ\/[0-9.]+\/[0-9.]+\/M\d+\/S\d+\/[0-9a-f]{8}-/);
      const descarga = await fetch(`http://localhost:4000/archivos/${resultado.id}`, { headers: { Cookie: `fe_sesion=${token}` } });
      assert.equal(descarga.status, 200);
      assert.equal(Number(descarga.headers.get("content-length")), bytes);
      let recibidos = 0;
      const lector = descarga.body!.getReader();
      while (true) {
        const { value, done } = await lector.read();
        if (done) break;
        recibidos += value.length;
        assert.equal(value[0], 37);
      }
      assert.equal(recibidos, bytes);
      console.log(`✔ Subida, registro y descarga completos: ${bytes} bytes.`);
    }
  } finally {
    const { rows } = await pool.query("delete from documentos where nombre like $1 returning archivo", [`${marca}%`]);
    for (const d of rows) {
      const destino = path.resolve(base, d.archivo);
      assert.ok(destino.startsWith(base + path.sep));
      await unlink(destino);
    }
    await pool.query("delete from sesiones_usuario where id=$1", [hash]);
    await pool.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
