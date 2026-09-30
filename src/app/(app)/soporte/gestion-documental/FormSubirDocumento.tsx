"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ListaSubidas } from "@/components/SubirArchivos";
import { subirArchivo } from "@/lib/subida";

type Opcion = { valor: string; texto: string };
type Item = { clave: string; nombre: string; tamano: number; pct: number; id?: number; error?: string };

/** Subir documentos al repositorio de una sesión, con barra de avance por archivo. */
export default function FormSubirDocumento({ sesiones, tipos, sesionInicial }: { sesiones: Opcion[]; tipos: Opcion[]; sesionInicial?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const actualizar = (clave: string, cambio: Partial<Item>) => setItems((l) => l.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)));

  const alEnviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const archivos = f.getAll("archivo").filter((x): x is File => x instanceof File && x.size > 0);
    setError(null);
    if (!f.get("sesionId")) return setError("Elige la sesión.");
    if (!archivos.length) return setError("Selecciona el archivo a subir.");
    const nuevos = archivos.map((a, i) => ({ clave: `${Date.now()}-${i}`, nombre: a.name, tamano: a.size, pct: 0 }));
    setItems(nuevos);
    setSubiendo(true);
    let ok = 0;
    for (const [i, a] of archivos.entries()) {
      try {
        await subirArchivo(
          a,
          {
            sesionId: String(f.get("sesionId")),
            tipo: String(f.get("tipo")),
            version: String(f.get("version") ?? ""),
            nombre: archivos.length === 1 ? String(f.get("nombre") ?? "") : "",
          },
          (pct) => actualizar(nuevos[i].clave, { pct }),
        );
        actualizar(nuevos[i].clave, { id: 1, pct: 100 });
        ok++;
      } catch (err) {
        actualizar(nuevos[i].clave, { error: (err as Error).message });
      }
    }
    setSubiendo(false);
    if (ok) {
      (e.target as HTMLFormElement).querySelector<HTMLInputElement>('input[type="file"]')!.value = "";
      router.refresh();
    }
  };

  return (
    <form ref={ref} onSubmit={alEnviar} className="card flex flex-col gap-3 border-dashed px-5 py-4">
      <h2 className="font-semibold text-marino">Subir documento</h2>
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <label htmlFor="sd-sesion" className="etiqueta">Sesión *</label>
          <select id="sd-sesion" name="sesionId" defaultValue={sesionInicial ?? ""} className="campo">
            {!sesionInicial && <option value="">Elige la sesión…</option>}
            {sesiones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sd-tipo" className="etiqueta">Tipo *</label>
          <select id="sd-tipo" name="tipo" className="campo">
            {tipos.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sd-version" className="etiqueta">Versión</label>
          <input id="sd-version" name="version" className="campo" />
        </div>
        <div className="xl:col-span-2">
          <label htmlFor="sd-archivo" className="etiqueta">Archivo(s) *</label>
          <input
            id="sd-archivo"
            name="archivo"
            type="file"
            multiple
            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.odp,.odt,.jpg,.jpeg,.png,.heic,.zip,.rar,.mp4,.mov"
            className="campo py-1.5"
          />
          <p className="mt-0.5 text-[11px] text-texto-2">PowerPoint, PDF, Word, Excel… hasta 50 MB c/u (videos hasta 300 MB)</p>
        </div>
        <div>
          <label htmlFor="sd-nombre" className="etiqueta">Nombre (opcional)</label>
          <input id="sd-nombre" name="nombre" placeholder="Si lo dejas vacío, el del archivo" className="campo" />
        </div>
        <button disabled={subiendo} className="btn-oscuro">{subiendo ? "Subiendo…" : "Subir archivo"}</button>
      </div>
      <ListaSubidas items={items} />
      {error && <p role="alert" className="text-sm text-[#991b1b]">{error}</p>}
      {!subiendo && items.length > 0 && items.every((x) => x.id) && (
        <p role="status" className="text-sm text-[#166534]">{items.length === 1 ? "Archivo guardado en el repositorio." : `${items.length} archivos guardados en el repositorio.`}</p>
      )}
    </form>
  );
}
