import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { planesMejoraVersiones } from "@/db/schema";
import { exigir } from "@/lib/auth";
import { rutaSegura } from "@/lib/archivos";
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}) {
 await exigir("capacitaciones","ver");
 const {id}=await ctx.params;
 const indice=Number(new URL(req.url).searchParams.get("indice"));
 const [v]=await db.select().from(planesMejoraVersiones).where(eq(planesMejoraVersiones.id,Number(id)||0));
 const a=Number.isInteger(indice) && indice>=0 ? v?.archivos[indice] : undefined;
 const ruta=a ? rutaSegura(a.ruta) : null;
 if(!a || !ruta) return new Response("Archivo no encontrado",{status:404});
 const info=await stat(ruta).catch(()=>null);
 if(!info) return new Response("Archivo no encontrado",{status:404});
 const ext=a.nombre.split(".").pop()?.toLowerCase() || "";
 const tipos:Record<string,string>={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png"};
 const inline=new URL(req.url).searchParams.get("vista")==="1" && !!tipos[ext];
 return new Response(Readable.toWeb(createReadStream(ruta)) as ReadableStream,{headers:{"Content-Type":inline ? tipos[ext] : "application/octet-stream","Content-Length":String(info.size),"Content-Disposition":`${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store","Content-Security-Policy":"frame-ancestors 'self'"}});
}
