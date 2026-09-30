/** Sube un archivo a /api/archivos informando el avance (0–100). Solo en el navegador. */
export type Subido = { id: number; nombre: string; tamano: number | null };

export function subirArchivo(archivo: File, datos: Record<string, string | number | null | undefined>, alAvanzar: (pct: number) => void) {
  return new Promise<Subido>((resolve, reject) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    for (const [k, v] of Object.entries(datos)) if (v !== null && v !== undefined && v !== "") fd.append(k, String(v));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/archivos");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar(Math.round((e.loaded * 100) / e.total));
    };
    xhr.onload = () => {
      let r: { error?: string } & Partial<Subido> = {};
      try {
        r = JSON.parse(xhr.responseText);
      } catch {
        /* respuesta no JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && r.id) resolve(r as Subido);
      else reject(new Error(r.error ?? `No se pudo subir «${archivo.name}» (error ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error(`Se perdió la conexión al subir «${archivo.name}».`));
    xhr.send(fd);
  });
}

export const tamanoTexto = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
