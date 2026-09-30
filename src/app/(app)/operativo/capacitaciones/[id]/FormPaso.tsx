"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { agregarItem, registrarPaso } from "./actions";

type Persona = { valor: string; nombre: string };

function Aviso({ r }: { r: { ok?: string; error?: string } | undefined }) {
  if (!r) return null;
  return r.error ? (
    <p role="alert" className="rounded-md bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]">{r.error}</p>
  ) : (
    <p role="status" className="rounded-md bg-[#f0fdf4] px-3 py-2 text-[13px] text-[#166534]">{r.ok}</p>
  );
}

/** Formulario para registrar una actividad del flujo. Los campos llegan como `children`. */
export default function FormPaso({
  programacionId,
  clave,
  personas,
  boton,
  children,
}: {
  programacionId: number;
  clave: string;
  personas: Persona[];
  boton: string;
  children?: ReactNode;
}) {
  const [res, accion, enviando] = useActionState(registrarPaso, undefined);
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => accion(datos));
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 border-t border-[#eef1f5] pt-3">
      <input type="hidden" name="programacionId" value={programacionId} />
      <input type="hidden" name="clave" value={clave} />
      {children}
      <div className="flex flex-wrap items-end gap-3">
        {personas.length > 0 && (
          <div className="min-w-48 flex-1">
            <label htmlFor={`por-${clave}`} className="etiqueta">Registrado por</label>
            <select id={`por-${clave}`} name="por" className="campo py-2" defaultValue={personas[0].nombre}>
              {personas.map((p) => <option key={p.valor} value={p.nombre}>{p.nombre}</option>)}
            </select>
          </div>
        )}
        {boton && <button disabled={enviando} className="btn-oscuro py-2">{enviando ? "Guardando…" : boton}</button>}
        {!boton && enviando && <span className="pb-2 text-[13px] text-texto-2">Guardando…</span>}
      </div>
      <Aviso r={res} />
    </form>
  );
}

/** Formulario genérico de la ficha (refrigerio, equipos): los campos llegan como `children`. */
export function FormAccion({
  accion,
  programacionId,
  boton,
  children,
}: {
  accion: (prev: { ok?: string; error?: string } | undefined, f: FormData) => Promise<{ ok?: string; error?: string } | undefined>;
  programacionId: number;
  boton: string;
  children: ReactNode;
}) {
  const [res, enviar, enviando] = useActionState(accion, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (res?.ok) ref.current?.reset();
  }, [res]);
  const alEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => enviar(datos));
  };
  return (
    <form ref={ref} onSubmit={alEnviar} className="mt-2 flex flex-col gap-2 rounded-md border border-dashed border-borde-fuerte bg-white p-2.5">
      <input type="hidden" name="programacionId" value={programacionId} />
      {children}
      <button disabled={enviando} className="btn-secundario self-start py-1.5 text-[13px]">{enviando ? "Guardando…" : boton}</button>
      {res?.error && <p role="alert" className="text-[13px] text-[#991b1b]">{res.error}</p>}
      {res?.ok && <p role="status" className="text-[13px] text-[#166534]">{res.ok}</p>}
    </form>
  );
}

/** Botones Sí / No para las compuertas del diagrama. Envían el formulario con decision=si|no. */
export function BotonesDecision({ si = "Sí", no = "No" }: { si?: string; no?: string }) {
  return (
    <div className="flex gap-2">
      <button name="decision" value="si" className="btn border border-[#86efac] bg-[#f0fdf4] py-2 text-[#166534] hover:bg-[#dcfce7]">{si}</button>
      <button name="decision" value="no" className="btn border border-[#fca5a5] bg-[#fef2f2] py-2 text-[#991b1b] hover:bg-[#fee2e2]">{no}</button>
    </div>
  );
}

type ItemInventario = { id: number; nombre: string; stock: number; unidad: string; categoria: "material" | "refrigerio" };

/** Formulario para agregar un ítem a la 1ra sección de la ficha: del inventario (descuenta stock) o extra. */
export function FormItem({ programacionId, inventario }: { programacionId: number; inventario: ItemInventario[] }) {
  const [res, accion, enviando] = useActionState(agregarItem, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [origen, setOrigen] = useState("");
  const elegido = inventario.find((i) => String(i.id) === origen);
  useEffect(() => {
    if (res?.ok) ref.current?.reset(); // el origen elegido se mantiene para agregar otro similar
  }, [res]);
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => accion(datos));
  };
  const grupo = (cat: ItemInventario["categoria"], titulo: string) => (
    <optgroup label={titulo}>
      {inventario.filter((i) => i.categoria === cat).map((i) => (
        <option key={i.id} value={i.id} disabled={i.stock === 0}>{i.nombre} (stock {i.stock})</option>
      ))}
    </optgroup>
  );
  return (
    <form ref={ref} onSubmit={enviar} className="flex flex-wrap items-end gap-2 border-t border-[#eef1f5] px-5 py-3">
      <input type="hidden" name="programacionId" value={programacionId} />
      <div className="w-full sm:w-56">
        <label htmlFor="it-inv" className="etiqueta">Origen</label>
        <select id="it-inv" name="insumoId" value={origen} onChange={(e) => setOrigen(e.target.value)} className="campo py-2">
          <option value="">Extra (no está en inventario)</option>
          {grupo("material", "Inventario · material")}
        </select>
      </div>
      <div className="w-full sm:w-48">
        <label htmlFor="it-cat" className="etiqueta">Categoría</label>
        <select id="it-cat" name="categoria" defaultValue="material_capacitador" className="campo py-2">
          <option value="material_capacitador">Material del capacitador</option>
          <option value="refrigerio">Insumos de refrigerio</option>
          <option value="tecnologico">Tecnológico</option>
          <option value="dinamica">Dinámicas</option>
        </select>
      </div>
      <div className="w-20">
        <label htmlFor="it-cant" className="etiqueta">Cant.</label>
        <input id="it-cant" name="cantidad" type="number" min={1} max={elegido?.stock} defaultValue={1} className="campo py-2" />
      </div>
      <div className="min-w-48 flex-1">
        <label htmlFor="it-desc" className="etiqueta">{elegido ? "Detalle (opcional)" : "Descripción"}</label>
        <input id="it-desc" name="descripcion" required={!elegido} placeholder={elegido ? `Ej. color azul · hay ${elegido.stock} ${elegido.unidad}` : "Ej. Hojas de colores"} className="campo py-2" />
      </div>
      <button disabled={enviando} className="btn-secundario py-2">{elegido ? "Sacar del inventario" : "Agregar extra"}</button>
      {res?.error && <p role="alert" className="w-full text-[13px] text-[#991b1b]">{res.error}</p>}
      {res?.ok && <p role="status" className="w-full text-[13px] text-[#166534]">{res.ok}</p>}
    </form>
  );
}
