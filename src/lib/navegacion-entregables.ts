export type FiltrosEntregables = { proyecto?: number; vista: "componentes" | "sede"; sede: number; desde: string; hasta: string; sesion: number };

export function enlaceEntregables(f: FiltrosEntregables, detalle?: { sesion: number; programacion: number }) {
  const p = new URLSearchParams({ parte: "sesiones", vista: f.vista });
  if (f.proyecto) p.set("proyecto", String(f.proyecto));
  if (f.sede) p.set("sede", String(f.sede));
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  if (detalle) {
    p.set("sesion", String(detalle.sesion));
    p.set("programacion", String(detalle.programacion));
    p.set("sesionFiltro", String(f.sesion));
  } else if (f.sesion) p.set("sesion", String(f.sesion));
  return `/soporte/gestion-documental?${p}`;
}
