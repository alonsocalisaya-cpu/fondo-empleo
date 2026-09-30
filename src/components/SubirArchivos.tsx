"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { subirArchivo, tamanoTexto } from "@/lib/subida";

type Item = { clave: string; nombre: string; tamano: number; pct: number; id?: number; error?: string };

/** Lista de archivos con su barra de avance. */
export function ListaSubidas({ items, alQuitar }: { items: Item[]; alQuitar?: (it: Item) => void }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-live="polite">
      {items.map((it) => (
        <li key={it.clave} className="flex flex-col gap-1 rounded-md border border-borde bg-white px-2.5 py-1.5 text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate">
              {it.error ? "✕" : it.id ? "✓" : "⬆"} {it.nombre} <span className="text-xs text-texto-2">· {tamanoTexto(it.tamano)}</span>
            </span>
            <span className={`shrink-0 text-xs font-semibold ${it.error ? "text-[#991b1b]" : it.id ? "text-[#166534]" : "text-marino"}`}>
              {it.error ? "Error" : it.id ? "Subido" : it.pct === 100 ? "Guardando…" : `${it.pct}%`}
            </span>
            {alQuitar && (it.id || it.error) && (
              <button type="button" onClick={() => alQuitar(it)} className="shrink-0 text-xs text-texto-2 hover:text-[#991b1b]">
                Quitar
              </button>
            )}
          </div>
          {!it.id && !it.error && (
            <div className="h-1.5 overflow-hidden rounded bg-[#e6ebf1]" role="progressbar" aria-valuenow={it.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Subiendo ${it.nombre}`}>
              <div className="h-1.5 rounded bg-marino-2 transition-[width] duration-200" style={{ width: `${it.pct}%` }} />
            </div>
          )}
          {it.error && <span className="text-xs text-[#991b1b]">{it.error}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Campo de archivos para las actividades del flujo: cada archivo se sube apenas se elige, con barra de avance.
 * Deja en el formulario un <input name="docId"> por archivo subido y «subiendo» mientras falte alguno.
 */
export default function SubirArchivos({
  programacionId,
  tipo,
  tipoCampo,
  version,
  seccion,
  accept,
  etiqueta,
  ayuda,
}: {
  programacionId: number;
  tipo?: string;
  /** nombre de un <select> del mismo formulario del que se toma el tipo al subir */
  tipoCampo?: string;
  version?: string;
  /** subcarpeta de la fecha donde se guarda (fotos, video, lista_asistencia…) */
  seccion?: string;
  accept?: string;
  etiqueta: string;
  ayuda?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const actualizar = (clave: string, cambio: Partial<Item>) => setItems((l) => l.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)));

  const alElegir = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivos = [...(e.target.files ?? [])];
    const form = e.target.form;
    const tipoElegido = tipoCampo ? (form?.elements.namedItem(tipoCampo) as HTMLSelectElement | null)?.value : tipo;
    const nuevos = archivos.map((a, i) => ({ clave: `${Date.now()}-${i}-${a.name}`, nombre: a.name, tamano: a.size, pct: 0 }));
    setItems((l) => [...l, ...nuevos]);
    if (ref.current) ref.current.value = "";
    // Uno por uno, para que cada barra avance de verdad
    for (const [i, a] of archivos.entries()) {
      const { clave } = nuevos[i];
      try {
        const r = await subirArchivo(a, { programacionId, tipo: tipoElegido, version, seccion, nombre: a.name }, (pct) => actualizar(clave, { pct }));
        actualizar(clave, { id: r.id, pct: 100 });
      } catch (err) {
        actualizar(clave, { error: (err as Error).message });
      }
    }
  };

  const quitar = async (it: Item) => {
    setItems((l) => l.filter((x) => x.clave !== it.clave));
    if (it.id) await fetch(`/api/archivos/${it.id}`, { method: "DELETE" }).catch(() => {});
  };

  const subiendo = items.filter((x) => !x.id && !x.error).length;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="etiqueta" htmlFor={`sa-${programacionId}-${etiqueta}`}>{etiqueta}</label>
      <input id={`sa-${programacionId}-${etiqueta}`} ref={ref} type="file" multiple accept={accept} onChange={alElegir} className="campo py-1.5" />
      {ayuda && <p className="text-[11px] text-texto-2">{ayuda}</p>}
      <ListaSubidas items={items} alQuitar={quitar} />
      {items.filter((x) => x.id).map((x) => <input key={x.clave} type="hidden" name="docId" value={x.id} />)}
      {subiendo > 0 && <input type="hidden" name="subiendo" value={subiendo} />}
    </div>
  );
}
