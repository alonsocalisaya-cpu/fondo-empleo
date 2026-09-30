import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentos } from "@/db/schema";
import { borrarArchivo } from "@/lib/archivos";
import { autorizarSesion, permitir } from "@/lib/auth";

/** Quita un archivo recién subido (antes de registrar la actividad). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/archivos/[id]">) {
  const { id } = await ctx.params;
  const doc = await db.query.documentos.findFirst({ where: eq(documentos.id, Number(id) || 0) });
  if (!doc) return Response.json({ ok: false });
  const perm = doc.programacionId ? await autorizarSesion(doc.programacionId) : await permitir("documental");
  if (!perm.u) return Response.json({ error: perm.error }, { status: 403 });
  const [d] = await db.delete(documentos).where(eq(documentos.id, doc.id)).returning();
  await borrarArchivo(d?.archivo);
  return Response.json({ ok: Boolean(d) });
}
