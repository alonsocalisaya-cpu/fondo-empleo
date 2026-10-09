import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { ErrorTransferencia, guardarContinuo } from "./archivo-continuo";

async function entorno(prueba: (base: string) => Promise<void>) {
  const base = await mkdtemp(path.join(process.cwd(), "archivos-prueba-"));
  try { await prueba(base); }
  finally { await rm(base, { recursive: true, force: true }); }
}

function cuerpo(bytes: number, alLeer?: () => void) {
  const bloque = new Uint8Array(64 * 1024).fill(37);
  return new ReadableStream<Uint8Array>({
    pull(controlador) {
      alLeer?.();
      if (!bytes) return controlador.close();
      const n = Math.min(bloque.length, bytes);
      bytes -= n;
      controlador.enqueue(bloque.subarray(0, n));
    },
  });
}

test("publica los bytes completos, conserva carpeta y usa prefijo aleatorio", () => entorno(async (base) => {
  const guardado = await guardarContinuo({ base, carpeta: "ARQ/1.1/1.1.2/M1/S1", nombre: "diapós.pdf", tamano: 128, cuerpo: cuerpo(128) });
  assert.match(guardado.archivo, /^ARQ\/1\.1\/1\.1\.2\/M1\/S1\/[0-9a-f]{8}-diapos\.pdf$/);
  assert.deepEqual(await readFile(path.join(base, guardado.archivo)), Buffer.alloc(128, 37));
  assert.deepEqual(await readdir(path.join(base, ".temporales")), []);
}));

test("limpia temporales cuando faltan o sobran bytes", () => entorno(async (base) => {
  for (const bytes of [127, 129]) {
    await assert.rejects(guardarContinuo({ base, carpeta: "PUN/M1/S1", nombre: "examen.pdf", tamano: 128, cuerpo: cuerpo(bytes) }), ErrorTransferencia);
    assert.deepEqual(await readdir(path.join(base, ".temporales")), []);
  }
  assert.deepEqual(await readdir(base), [".temporales"]);
}));

test("cancela y limpia una transferencia interrumpida", () => entorno(async (base) => {
  const controlador = new AbortController();
  let bloques = 0;
  await assert.rejects(guardarContinuo({ base, carpeta: "ARQ/M1/S1", nombre: "video.mp4", tamano: 1024 * 1024,
    cuerpo: cuerpo(1024 * 1024, () => { if (++bloques === 4) controlador.abort(); }), signal: controlador.signal }));
  assert.deepEqual(await readdir(path.join(base, ".temporales")), []);
}));

test("rechaza rutas fuera del almacenamiento", () => entorno(async (base) => {
  await assert.rejects(guardarContinuo({ base, carpeta: "../fuera", nombre: "datos.pdf", tamano: 128, cuerpo: cuerpo(128) }), ErrorTransferencia);
  assert.deepEqual(await readdir(base), []);
}));

test("escribe más de 1 GiB manteniendo acotada la memoria", () => entorno(async (base) => {
  const bytes = 1024 ** 3 + 64 * 1024;
  const inicial = process.memoryUsage().arrayBuffers;
  let pico = inicial;
  const guardado = await guardarContinuo({ base, carpeta: "ARQ/M1/S1", nombre: "grande.mp4", tamano: bytes,
    cuerpo: cuerpo(bytes, () => { pico = Math.max(pico, process.memoryUsage().arrayBuffers); }) });
  assert.equal((await stat(path.join(base, guardado.archivo))).size, bytes);
  assert.equal(guardado.tamano, bytes);
  assert.ok(pico - inicial < 64 * 1024 * 1024, `Memoria de buffers: ${pico - inicial} bytes`);
  assert.deepEqual(await readdir(path.join(base, ".temporales")), []);
}));
