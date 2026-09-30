"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { guardarAccion } from "./actions";
import { ORIGENES } from "./constantes";

type Opcion = { id: number; nombre: string };
export type ValoresAccion = {
  id?: number;
  titulo?: string;
  problema?: string;
  causa?: string | null;
  accion?: string;
  origen?: string;
  indicador?: string | null;
  sedeId?: number | null;
  componenteId?: number | null;
  responsable?: string;
  prioridad?: string;
  estado?: string;
  fechaDeteccion?: string;
  fechaLimite?: string;
  fechaCierre?: string | null;
  resultado?: string | null;
};



export default function FormAccion({
  valores: v,
  sedes,
  componentes,
}: {
  valores: ValoresAccion;
  sedes: Opcion[];
  componentes: Opcion[];
}) {
  const [res, accion, enviando] = useActionState(guardarAccion, undefined);
  const [estado, setEstado] = useState(v.estado ?? "abierta");

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => accion(datos));
  };

  return (
    <form onSubmit={enviar} className="card flex max-w-4xl flex-col gap-5 p-6">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {res?.error && (
        <p role="alert" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          {res.error}
        </p>
      )}

      <div>
        <label htmlFor="titulo" className="etiqueta">Título *</label>
        <input id="titulo" name="titulo" required defaultValue={v.titulo} placeholder="Ej. Baja asistencia en Sede Sur" className="campo" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="origen" className="etiqueta">Origen</label>
          <select id="origen" name="origen" defaultValue={v.origen ?? "indicador"} className="campo">
            {ORIGENES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="indicador" className="etiqueta">Indicador relacionado</label>
          <input id="indicador" name="indicador" defaultValue={v.indicador ?? ""} placeholder="Ej. Asistencia promedio" className="campo" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="sedeId" className="etiqueta">Sede (opcional)</label>
          <select id="sedeId" name="sedeId" defaultValue={v.sedeId ?? ""} className="campo">
            <option value="">Todas / no aplica</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="componenteId" className="etiqueta">Componente (opcional)</label>
          <select id="componenteId" name="componenteId" defaultValue={v.componenteId ?? ""} className="campo">
            <option value="">Todos / no aplica</option>
            {componentes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="problema" className="etiqueta">Problema detectado *</label>
        <textarea id="problema" name="problema" required rows={2} defaultValue={v.problema} className="campo resize-y" />
      </div>
      <div>
        <label htmlFor="causa" className="etiqueta">Causa identificada</label>
        <textarea id="causa" name="causa" rows={2} defaultValue={v.causa ?? ""} placeholder="¿Por qué ocurrió?" className="campo resize-y" />
      </div>
      <div>
        <label htmlFor="accion" className="etiqueta">Acción a realizar *</label>
        <textarea id="accion" name="accion" required rows={2} defaultValue={v.accion} className="campo resize-y" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="responsable" className="etiqueta">Responsable *</label>
          <input id="responsable" name="responsable" required defaultValue={v.responsable} className="campo" />
        </div>
        <div>
          <label htmlFor="prioridad" className="etiqueta">Prioridad</label>
          <select id="prioridad" name="prioridad" defaultValue={v.prioridad ?? "media"} className="campo">
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div>
          <label htmlFor="estado" className="etiqueta">Estado</label>
          <select id="estado" name="estado" value={estado} onChange={(e) => setEstado(e.target.value)} className="campo">
            <option value="abierta">Abierta</option>
            <option value="en_proceso">En proceso</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="fechaDeteccion" className="etiqueta">Fecha de detección</label>
          <input id="fechaDeteccion" name="fechaDeteccion" type="date" required defaultValue={v.fechaDeteccion} className="campo" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="fechaLimite" className="etiqueta">Fecha límite</label>
          <input id="fechaLimite" name="fechaLimite" type="date" required defaultValue={v.fechaLimite} className="campo" />
        </div>
      </div>

      {estado === "cerrada" && (
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-[#f0fdf4] p-4 sm:grid-cols-4">
          <div className="sm:col-span-3">
            <label htmlFor="resultado" className="etiqueta">Resultado / verificación de eficacia *</label>
            <textarea id="resultado" name="resultado" rows={2} defaultValue={v.resultado ?? ""} placeholder="¿Se resolvió el problema? ¿Cómo se comprobó?" className="campo resize-y" />
          </div>
          <div>
            <label htmlFor="fechaCierre" className="etiqueta">Fecha de cierre</label>
            <input id="fechaCierre" name="fechaCierre" type="date" defaultValue={v.fechaCierre ?? ""} className="campo" />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button disabled={enviando} className="btn-primario">{enviando ? "Guardando…" : v.id ? "Guardar cambios" : "Registrar acción"}</button>
        <Link href="/estrategico/acciones-correctivas" className="btn-secundario">Cancelar</Link>
      </div>
    </form>
  );
}
