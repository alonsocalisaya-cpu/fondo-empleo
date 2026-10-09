"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ListaSubidas } from "@/components/SubirArchivos";
import { subirArchivo } from "@/lib/subida";
import type { Seccion } from "@/lib/documentos";
import { validarEntregable } from "@/lib/entregables";

type Opcion = { valor: string; texto: string };
type Item = { clave: string; nombre: string; tamano: number; pct: number; id?: number; error?: string };

/** Subir documentos al repositorio de una sesión, con barra de avance por archivo. */
export default function FormSubirDocumento({ sesiones, tipos, sesionInicial, programacionId, seccion, accept }: {
  sesiones: Opcion[]; tipos: Opcion[]; sesionInicial?: string; programacionId?: number; seccion?: Seccion; accept?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [seleccionados, setSeleccionados] = useState<File[]>([]);
  const actualizar = (clave: string, cambio: Partial<Item>) => setItems((l) => l.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)));
  const actualizarSeleccion = (archivos: File[]) => {
    setSeleccionados(archivos);
    const campo = ref.current?.querySelector<HTMLInputElement>('input[type="file"]');
    if (campo) {
      const lista = new DataTransfer();
      archivos.forEach((archivo) => lista.items.add(archivo));
      campo.files = lista.files;
    }
  };
  const quitarSeleccionado = (indice: number) => actualizarSeleccion(seleccionados.filter((_, i) => i !== indice));

  const alEnviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const archivos = seleccionados.filter((archivo) => archivo.size > 0);
    const prefijoNombre = String(f.get("nombre") ?? "").trim();
    setError(null);
    if (!f.get("sesionId")) return setError("Elige la sesión.");
    if (!archivos.length) return setError("Selecciona el archivo a subir.");
    for (const archivo of archivos) {
      const errorArchivo = validarEntregable(seccion ?? null, archivo.name);
      if (errorArchivo) return setError(errorArchivo);
    }
    const nuevos = archivos.map((a, i) => ({ clave: `${Date.now()}-${i}`, nombre: a.name, tamano: a.size, pct: 0 }));
    setItems(nuevos);
    setSubiendo(true);
    let ok = 0;
    const pendientes: File[] = [];
    for (const [i, a] of archivos.entries()) {
      try {
        await subirArchivo(
          a,
          {
            sesionId: String(f.get("sesionId")),
            programacionId,
            seccion,
            tipo: String(f.get("tipo")),
            nombre: prefijoNombre ? `${prefijoNombre} - ${a.name.replace(/\.[^.]+$/, "")}` : "",
          },
          (pct) => actualizar(nuevos[i].clave, { pct }),
        );
        actualizar(nuevos[i].clave, { id: 1, pct: 100 });
        ok++;
      } catch (err) {
        pendientes.push(a);
        actualizar(nuevos[i].clave, { error: (err as Error).message });
      }
    }
    setSubiendo(false);
    if (ok) {
      actualizarSeleccion(pendientes);
      router.refresh();
    }
  };

  return (
    <div className="space-y-3">
      <button type="button" className="btn-secundario" aria-expanded={abierto} aria-controls={`${id}-formulario`} disabled={subiendo} onClick={() => setAbierto(!abierto)}>
        {abierto ? "Cerrar formulario" : "+ Subir documento"}
      </button>
      <div id={`${id}-formulario`} hidden={!abierto}>
    <form ref={ref} onSubmit={alEnviar} className="card flex flex-col gap-3 border-dashed px-5 py-4">
      <h2 className="font-semibold text-marino">Subir documento</h2>
      <div className="grid grid-cols-1 items-start gap-5">
        {sesionInicial ? (
          <input type="hidden" name="sesionId" value={sesionInicial} />
        ) : (
          <div>
            <label htmlFor={`${id}-sesion`} className="etiqueta">Sesión *</label>
            <select id={`${id}-sesion`} name="sesionId" defaultValue="" className="campo">
              <option value="">Elige la sesión…</option>
              {sesiones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
            </select>
          </div>
        )}
        <div className="order-1">
          <label htmlFor={`${id}-tipo`} className="etiqueta">Tipo *</label>
          <select id={`${id}-tipo`} name="tipo" className="campo">
            {tipos.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
          </select>
        </div>
        <div className="order-3 min-w-0">
          <label htmlFor={`${id}-archivo`} className="etiqueta">Archivo(s) *</label>
          <input
            id={`${id}-archivo`}
            name="archivo"
            type="file"
            multiple
            disabled={subiendo}
            onChange={(e) => {
              setSeleccionados(Array.from(e.target.files ?? []));
              setItems([]);
              setError(null);
            }}
            accept={accept ?? ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.odp,.odt,.jpg,.jpeg,.png,.heic,.zip,.rar,.mp4,.mov,.avi,.3gp"}
            className="campo w-full min-w-0 py-2"
          />
          <p className="mt-0.5 text-[11px] text-texto-2">{seccion === "fotos" ? "Fotos en JPG, PNG o HEIC." : seccion === "video" ? "Videos en MP4, MOV, AVI o 3GP." : "PowerPoint, PDF, Word, Excel, imágenes y videos."}</p>
          {seleccionados.length > 0 && (
            <div className="mt-3 rounded-lg border border-borde bg-[#f7f9fc] p-3" aria-live="polite">
              <p className="mb-2 text-xs font-semibold text-marino">Archivos seleccionados ({seleccionados.length})</p>
              <ul className="space-y-2 text-sm text-texto-2">
                {seleccionados.map((archivo, indice) => (
                  <li key={`${indice}-${archivo.name}`} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 break-all">{archivo.name}</span>
                    <button type="button" disabled={subiendo} onClick={() => quitarSeleccionado(indice)} aria-label={`Quitar ${archivo.name}`} title="Quitar archivo seleccionado" className="shrink-0 rounded-md p-2 text-[#991b1b] hover:bg-[#fee2e2] disabled:opacity-50">
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="order-2">
          <label htmlFor={`${id}-nombre`} className="etiqueta">Nombre (opcional)</label>
          <input id={`${id}-nombre`} name="nombre" placeholder="Ejemplo: (textil)" className="campo" />
          <p className="mt-0.5 text-[11px] text-texto-2">Nombre opcional - Nombre del documento.</p>
        </div>
        <div className="order-4 border-t border-borde pt-4">
          <button disabled={subiendo} className="btn-oscuro">{subiendo ? "Subiendo…" : "Subir archivo"}</button>
        </div>
      </div>
      <ListaSubidas items={items} />
      {error && <p role="alert" className="text-sm text-[#991b1b]">{error}</p>}
      {!subiendo && items.length > 0 && items.every((x) => x.id) && (
        <p role="status" className="text-sm text-[#166534]">{items.length === 1 ? "Archivo guardado en el repositorio." : `${items.length} archivos guardados en el repositorio.`}</p>
      )}
    </form>
      </div>
    </div>
  );
}
