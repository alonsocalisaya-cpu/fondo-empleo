"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { guardarProgramacion } from "./actions";

type Opcion = { id: number; nombre: string };
type Grupo = { estructuraId: number; grupo: string; sesiones: Opcion[] };

export type ValoresProgramacion = {
  id?: number;
  sesionId?: number;
  sedeId?: number;
  capacitadorId?: number | null;
  asistenteId?: number | null;
  combinadas?: number[];
  fecha?: string;
  horaInicio?: string;
  horaFin?: string;
  aula?: string | null;
  cupo?: number | null;
  estado?: string;
  observacion?: string | null;
};

export default function FormProgramacion({
  valores,
  estructuras,
  sesiones,
  sedes,
  capacitadores,
  asistentes,
  estados,
}: {
  valores: ValoresProgramacion;
  estructuras: Opcion[];
  sesiones: Grupo[];
  sedes: (Opcion & { estructuraId:number; horarios:{id:number;nombre:string;horaInicio:string;horaFin:string}[] })[];
  capacitadores: Opcion[];
  asistentes: Opcion[];
  estados: { valor: string; txt: string }[];
}) {
  const [estado, accion, enviando] = useActionState(guardarProgramacion, undefined);
  const v = valores;
  // Sesiones combinadas: se dictan en la misma programación ("A + B")
  const [extras, setExtras] = useState<string[]>((v.combinadas ?? []).map(String));
  // Primero se elige la estructura (Arequipa, …) y luego una sesión de esa estructura
  const estructuraDe = (id?: number) => sesiones.find((g) => g.sesiones.some((x) => x.id === id))?.estructuraId;
  const [estructura, setEstructura] = useState<string>(
    String(estructuraDe(v.sesionId) ?? (estructuras.length === 1 ? estructuras[0].id : "")),
  );
  const [sesion, setSesion] = useState<string>(v.sesionId ? String(v.sesionId) : "");
  const grupos = sesiones.filter((g) => String(g.estructuraId) === estructura);
  const [sede, setSede] = useState(v.sedeId ? String(v.sedeId) : "");
  const [inicio, setInicio] = useState(v.horaInicio?.slice(0,5) ?? "");
  const [fin, setFin] = useState(v.horaFin?.slice(0,5) ?? "");
  const sedesPrograma = sedes.filter(s=>String(s.estructuraId)===estructura);


  // Enviamos con onSubmit (y no con action) para que React no limpie el formulario si hay un error.
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => accion(datos));
  };

  return (
    <form onSubmit={enviar} className="card flex max-w-4xl flex-col gap-5 p-6">
      {v.id && <input type="hidden" name="id" value={v.id} />}

      {estado?.error && (
        <p role="alert" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          {estado.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
      <div>
        <label htmlFor="estructura" className="etiqueta">Estructura</label>
        <select
          id="estructura"
          value={estructura}
          onChange={(e) => {
            setEstructura(e.target.value);
            setSesion("");
            setExtras([]);
            setSede(""); setInicio(""); setFin("");
          }}
          required
          className="campo"
        >
          <option value="" disabled>Elige la estructura…</option>
          {estructuras.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sesionId" className="etiqueta">Sesión (Componente › Módulo)</label>
        <select id="sesionId" name="sesionId" required value={sesion} onChange={(e) => setSesion(e.target.value)} disabled={!estructura} className="campo disabled:opacity-50">
          <option value="" disabled>{estructura ? "Elige una sesión…" : "Primero elige la estructura"}</option>
          {grupos.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.sesiones.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-dashed border-borde-fuerte p-4">
        <legend className="px-1 text-xs font-semibold text-marino">Sesiones combinadas (opcional)</legend>
        <p className="text-xs text-texto-2">
          Si en este mismo horario se dictan varias sesiones juntas (por ejemplo «Analizando el Entorno + Planificación del Negocio»), agrégalas aquí.
        </p>
        {extras.map((valor, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm font-bold text-acento" aria-hidden="true">+</span>
            <select
              name="sesionExtra"
              value={valor}
              onChange={(e) => setExtras((xs) => xs.map((x, k) => (k === i ? e.target.value : x)))}
              aria-label={`Sesión combinada ${i + 1}`}
              className="campo flex-1 py-2"
            >
              <option value="">Elige la sesión…</option>
              {grupos.map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.sesiones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="button" onClick={() => setExtras((xs) => xs.filter((_, k) => k !== i))} className="btn-secundario py-2 text-[13px]">
              Quitar
            </button>
          </div>
        ))}
        <div>
          <button type="button" onClick={() => setExtras((xs) => [...xs, ""])} className="btn-secundario py-2 text-[13px]">
            + Combinar con otra sesión
          </button>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sedeId" className="etiqueta">Sede</label>
          <select id="sedeId" name="sedeId" required value={sede} disabled={!estructura} onChange={e=>{setSede(e.target.value);const h=sedesPrograma.find(s=>String(s.id)===e.target.value)?.horarios[0];setInicio(h?.horaInicio??"");setFin(h?.horaFin??"");}} className="campo">
            <option value="" disabled>Elige una sede / turno…</option>
            {sedesPrograma.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="aula" className="etiqueta">Aula / ambiente</label>
          <input id="aula" name="aula" defaultValue={v.aula ?? ""} placeholder="Ej. Aula 201" className="campo" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="fecha" className="etiqueta">Fecha</label>
          <input id="fecha" name="fecha" type="date" required defaultValue={v.fecha} className="campo" />
        </div>
        <div>
          <label htmlFor="horaInicio" className="etiqueta">Hora de inicio</label>
          <input id="horaInicio" name="horaInicio" type="time" required value={inicio} onChange={e=>{setInicio(e.target.value);}} className="campo" />
        </div>
        <div>
          <label htmlFor="horaFin" className="etiqueta">Hora de fin</label>
          <input id="horaFin" name="horaFin" type="time" required value={fin} onChange={e=>{setFin(e.target.value);}} className="campo" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="capacitadorId" className="etiqueta">Consultor (capacitador)</label>
          <select id="capacitadorId" name="capacitadorId" defaultValue={v.capacitadorId ?? ""} className="campo">
            <option value="">Por asignar</option>
            {capacitadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="asistenteId" className="etiqueta">Asistente de capacitación (soporte)</label>
          <select id="asistenteId" name="asistenteId" defaultValue={v.asistenteId ?? ""} className="campo">
            <option value="">Por asignar</option>
            {asistentes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cupo" className="etiqueta">Cupo máximo</label>
          <input id="cupo" name="cupo" type="number" min={1} defaultValue={v.cupo ?? 25} className="campo" />
        </div>
        <div>
          <label htmlFor="estado" className="etiqueta">Estado</label>
          <select id="estado" name="estado" defaultValue={v.estado ?? "programada"} className="campo">
            {estados.map((e) => <option key={e.valor} value={e.valor}>{e.txt}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="observacion" className="etiqueta">Observación (opcional)</label>
        <input id="observacion" name="observacion" defaultValue={v.observacion ?? ""} placeholder="Ej. Parte 1 de 2" maxLength={300} className="campo" />
      </div>

      <p className="text-[13px] text-texto-2">
        El turno (mañana, tarde o noche) se calcula automáticamente con la hora de inicio. Si el consultor o el asistente ya tienen otra
        sesión que se cruza ese día, el sistema te avisará.
      </p>

      <div className="flex gap-3">
        <button disabled={enviando} className="btn-primario">
          {enviando ? "Guardando…" : v.id ? "Guardar cambios" : "Programar sesión"}
        </button>
        <Link href="/estrategico/cronograma" className="btn-secundario">Cancelar</Link>
      </div>
    </form>
  );
}
