"use client";

import { useEffect } from "react";

/**
 * Si algo falla en una página. El caso más común: el sistema se actualizó (npm run build / npm start)
 * mientras la página seguía abierta en un navegador; basta con recargarla.
 */
export default function ErrorPagina({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const actualizado = /Server Action|older or newer deployment|Failed to fetch|ChunkLoadError|Loading chunk/i.test(error.message ?? "");
  return (
    <div role="alert" className="card mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 px-6 py-8 text-center">
      <span className="text-3xl" aria-hidden="true">{actualizado ? "🔄" : "⚠️"}</span>
      <h1 className="text-lg font-semibold text-marino">{actualizado ? "El sistema se actualizó" : "Algo salió mal"}</h1>
      <p className="text-sm text-texto-2">
        {actualizado
          ? "Esta página se abrió antes de la actualización. Recárgala para seguir trabajando; lo que ya guardaste no se pierde."
          : "No se pudo completar la acción. Intenta de nuevo; si sigue pasando, recarga la página."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => window.location.reload()} className="btn-primario">Recargar la página</button>
        {!actualizado && <button type="button" onClick={() => retry()} className="btn-secundario">Intentar de nuevo</button>}
      </div>
    </div>
  );
}
