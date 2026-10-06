import { redirect } from "next/navigation";

export default async function SedesAnterior({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams;
  const query=new URLSearchParams();
  for (const [key,value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const item of value) query.append(key,item);
    else if (value!==undefined) query.set(key,value);
  }
  redirect(`/soporte/sedes${query.size ? `?${query}` : ""}`);
}
