"use client";

import { useId, useState, type ReactNode } from "react";
import SubirArchivos from "@/components/SubirArchivos";

export default function ProgramaViaje({ programacionId, plantillas }: { programacionId: number; plantillas: ReactNode }) {
  const id = useId();
  const [corresponde, setCorresponde] = useState<boolean | null>(null);
  return <fieldset className="space-y-3">
    <legend className="mb-2 text-sm font-semibold">¿Corresponde presentar un programa de viaje?</legend>
    <label className="flex items-center gap-2 text-sm"><input type="radio" name="viajeCorresponde" value="si" required checked={corresponde === true} onChange={() => setCorresponde(true)} />Sí, presentar programa de viaje.</label>
    <label className="flex items-center gap-2 text-sm"><input type="radio" name="viajeCorresponde" value="no" required checked={corresponde === false} onChange={() => setCorresponde(false)} />No corresponde.</label>
    {corresponde && <div className="space-y-3">
      {plantillas}
      <SubirArchivos programacionId={programacionId} tipo="otro" version="programa_viaje" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" etiqueta="Archivo del programa de viaje" ayuda="Adjunta el programa de viaje o descríbelo en el campo de abajo." />
      <div><label htmlFor={id} className="etiqueta">Itinerario o detalle (opcional si adjuntas un archivo)</label><textarea id={id} name="itinerario" maxLength={5000} rows={5} placeholder="Indica las fechas, horarios, ruta, transporte y actividades del viaje." className="campo" /></div>
    </div>}
  </fieldset>;
}
