"use client";

import { useState } from "react";

import { TIPOS_INCIDENCIA } from "@/lib/post-sesion";

export default function DatosPost() {
  const [realizada, setRealizada] = useState<boolean | null>(null);
  return <div className="space-y-4">
    <fieldset className="space-y-2"><legend className="mb-2 font-semibold text-marino">¿Se ejecutó la capacitación?</legend>
      <label className="flex items-center gap-2"><input type="radio" name="capacitacionRealizada" value="si" required onChange={() => setRealizada(true)} />Sí, se ejecutó.</label>
      <label className="flex items-center gap-2"><input type="radio" name="capacitacionRealizada" value="no" required onChange={() => setRealizada(false)} />No se ejecutó.</label>
    </fieldset>
    {realizada === true && <div className="grid gap-3 sm:grid-cols-2">
      <label className="etiqueta">Hora de inicio real<input type="time" name="horaInicioReal" required className="campo" /></label>
      <label className="etiqueta">Hora de fin real<input type="time" name="horaFinReal" required className="campo" /></label>
    </div>}
    <fieldset className="space-y-3"><legend className="mb-2 font-semibold text-marino">Gestión de incidencias</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{TIPOS_INCIDENCIA.map((tipo) => <label key={tipo} className="flex items-center gap-2 text-sm"><input type="checkbox" name="tipoIncidencia" value={tipo} />{tipo}</label>)}</div>
      <label className="etiqueta">{realizada === false ? "Motivo de no ejecución e incidencias" : "Descripción de las incidencias (si hubo)"}<textarea name="incidencias" rows={3} maxLength={5000} required={realizada === false} className="campo" placeholder="Describe lo ocurrido. Si no hubo incidencias, deja el campo vacío." /></label>
    </fieldset>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="datosConfirmados" value="si" required className="mt-1" />Confirmo la ejecución o no ejecución, los horarios y las incidencias registradas.</label>
  </div>;
}
