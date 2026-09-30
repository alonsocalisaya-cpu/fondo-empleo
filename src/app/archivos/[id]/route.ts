import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentos } from "@/db/schema";
import { rutaSegura } from "@/lib/archivos";

/** Descarga de un archivo subido al repositorio (Gestión documental / material personalizado). */
export async function GET(_req: Request, ctx: RouteContext<"/archivos/[id]">) {
  const { id } = await ctx.params;
  const d = await db.query.documentos.findFirst({ where: eq(documentos.id, Number(id) || 0) });
  const abs = d?.archivo ? rutaSegura(d.archivo) : null;
  if (!d || !abs) return new Response("Archivo no encontrado", { status: 404 });
  const info = await stat(abs).catch(() => null);
  if (!info) return new Response("El archivo ya no está en el servidor", { status: 404 });
  const nombre = d.archivo!.split("/").at(-1)!.replace(/^[0-9a-f]{8}-/, "");
  return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(info.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    },
  });
}
