/** Escritura continua a disco. No depende de Next.js ni de la base de datos. */
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export class ErrorTransferencia extends Error {}

export async function guardarContinuo({ cuerpo, nombre, tamano, carpeta, base, signal }: {
  cuerpo: ReadableStream<Uint8Array>;
  nombre: string;
  tamano: number;
  carpeta: string;
  base: string;
  signal?: AbortSignal;
}) {
  const raiz = path.resolve(base);
  const destino = path.resolve(raiz, carpeta);
  if (!destino.startsWith(raiz + path.sep)) throw new ErrorTransferencia("Carpeta de destino no válida.");
  if (!Number.isSafeInteger(tamano) || tamano <= 0) throw new ErrorTransferencia("Tamaño de archivo no válido.");
  const limpio = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\-]+/g, "_").slice(-70);
  const relativa = path.posix.join(carpeta, `${randomUUID().slice(0, 8)}-${limpio}`);
  const final = path.join(raiz, relativa);
  const temporales = path.join(raiz, ".temporales");
  const temporal = path.join(temporales, `${randomUUID()}.part`);
  let recibidos = 0;
  let publicado = false;
  const medir = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      recibidos += chunk.length;
      if (recibidos > tamano) return callback(new ErrorTransferencia("El archivo recibido supera el tamaño anunciado."));
      callback(null, chunk);
    },
  });
  try {
    await mkdir(temporales, { recursive: true });
    // pipeline aplica contrapresión: espera al disco y no acumula el archivo en RAM.
    await pipeline(Readable.fromWeb(cuerpo as import("node:stream/web").ReadableStream), medir,
      createWriteStream(temporal, { flags: "wx" }), { signal });
    if (recibidos !== tamano) throw new ErrorTransferencia("La transferencia quedó incompleta. Vuelve a subir el archivo.");
    signal?.throwIfAborted();
    await mkdir(destino, { recursive: true });
    await rename(temporal, final);
    publicado = true;
    return { archivo: relativa, tamano: recibidos };
  } finally {
    if (!publicado) await unlink(temporal).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") console.error("No se pudo limpiar el archivo temporal:", error);
    });
  }
}
