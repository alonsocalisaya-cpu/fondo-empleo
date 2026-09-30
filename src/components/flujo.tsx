import { ROLES, type RolFlujo } from "@/lib/flujo-pre";

export const ROL_COLOR: Record<RolFlujo, string> = {
  jefe_comercial: "bg-[#ede9fe] text-[#5b21b6]",
  jefe_proyecto: "bg-[#dbeafe] text-[#1e3a8a]",
  capacitador: "bg-[#ffedd5] text-[#9a3412]",
  asistente: "bg-[#ccfbf1] text-[#115e59]",
  gestion_documental: "bg-[#fce7f3] text-[#9d174d]",
  administradora: "bg-[#ecfccb] text-[#3f6212]",
};

export function ChipRol({ rol }: { rol: RolFlujo }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROL_COLOR[rol]}`}>
      {ROLES[rol]}
    </span>
  );
}

export function BarraAvance({ porcentaje, etiqueta }: { porcentaje: number; etiqueta?: string }) {
  const color = porcentaje === 100 ? "bg-[#16a34a]" : "bg-marino-2";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 rounded bg-[#e6ebf1]"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta ?? "Avance"}
      >
        <div className={`h-2 rounded ${color}`} style={{ width: `${porcentaje}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-texto-2">{porcentaje}%</span>
    </div>
  );
}
