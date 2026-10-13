"use client";

import { useState } from "react";

import { TIPOS_INCIDENCIA } from "@/lib/post-sesion";

export default function DatosPost() {
  const [realizada, setRealizada] = useState<boolean | null>(null);
  const [horarioProgramado, setHorarioProgramado] = useState<boolean | null>(null);
  const [hayIncidencias, setHayIncidencias] = useState<boolean | null>(null);
  const fueraDeHorario = realizada === true && horarioProgramado === false;
  return <div className="space-y-4">
    <fieldset className="space-y-2"><legend className="mb-2 font-semibold text-marino">1. ¿Se ejecutó la capacitación?</legend>
      <label className="flex items-center gap-2"><input type="radio" name="capacitacionRealizada" value="si" required onChange={() => { setRealizada(true); setHorarioProgramado(null); setHayIncidencias(null); }} />Sí, se ejecutó.</label>
      <label className="flex items-center gap-2"><input type="radio" name="capacitacionRealizada" value="no" required onChange={() => { setRealizada(false); setHorarioProgramado(null); setHayIncidencias(null); }} />No se ejecutó.</label>
    </fieldset>
    {realizada === true && <fieldset className="space-y-2 rounded-lg border border-borde bg-[#f8fafc] p-3"><legend className="mb-1 font-semibold text-marino">2. ¿Se cumplió el horario programado?</legend>
      <label className="flex items-center gap-2"><input type="radio" name="horarioProgramado" value="si" required onChange={() => setHorarioProgramado(true)} />Sí, se cumplió.</label>
      <label className="flex items-center gap-2"><input type="radio" name="horarioProgramado" value="no" required onChange={() => setHorarioProgramado(false)} />No, se realizó en otro horario.</label>
    </fieldset>}
    {fueraDeHorario && <div className="grid gap-3 sm:grid-cols-2">
      <label className="etiqueta">Hora de inicio real<input type="time" name="horaInicioReal" required className="campo" /></label>
      <label className="etiqueta">Hora de fin real<input type="time" name="horaFinReal" required className="campo" /></label>
    </div>}
    {realizada === true && <fieldset className="space-y-3"><legend className="mb-2 font-semibold text-marino">3. ¿Hubo incidencias?</legend>
      <div className="flex flex-wrap gap-4"><label className="flex items-center gap-2"><input type="radio" name="hayIncidencias" value="si" required onChange={() => setHayIncidencias(true)} />Sí</label><label className="flex items-center gap-2"><input type="radio" name="hayIncidencias" value="no" required onChange={() => setHayIncidencias(false)} />No</label></div>
      {hayIncidencias === true && <>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{TIPOS_INCIDENCIA.map((tipo) => <label key={tipo} className="flex items-center gap-2 text-sm"><input type="checkbox" name="tipoIncidencia" value={tipo} />{tipo}</label>)}</div>
        <label className="etiqueta">Descripción de las incidencias<textarea name="incidencias" rows={3} maxLength={5000} required className="campo" placeholder="Describe lo ocurrido." /></label>
      </>}
    </fieldset>}
    {realizada === false && <label className="etiqueta">Motivo de no ejecución<textarea name="incidencias" rows={3} maxLength={5000} required className="campo" placeholder="Describe por qué no se ejecutó la capacitación." /></label>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="datosConfirmados" value="si" required className="mt-1" />Confirmo la ejecución o no ejecución, los horarios y las incidencias registradas.</label>
  </div>;
}
