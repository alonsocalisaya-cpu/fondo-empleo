"use client";

import { useRouter } from "next/navigation";

export default function VolverFormatoAsistencia({ destino }: { destino: string }) {
  const router = useRouter();
  return <button type="button" className="btn-secundario" onClick={() => {
    const retorno = new URLSearchParams(window.location.search).get("volver");
    if (retorno?.startsWith("/") && !retorno.startsWith("//") && !retorno.includes("\\")) {
      router.push(retorno);
      return;
    }
    const origen = document.referrer ? new URL(document.referrer) : null;
    if (origen?.origin === window.location.origin && origen.pathname !== window.location.pathname) {
      router.push(`${origen.pathname}${origen.search}${origen.hash}`);
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push(destino);
    }
  }}>← Volver</button>;
}
