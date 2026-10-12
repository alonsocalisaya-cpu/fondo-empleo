/**
 * Flujo del proceso de cada capacitación programada:
 *   - PRE-CAPACITACIÓN  (fases 1–3, según el diagrama BPMN "FLUJO DE PROCESO - PRE CAPACITACIÓN")
 *   - POST-CAPACITACIÓN (fases 4–7, según el diagrama BPMN "FLUJO DE PROCESO - POST CAPACITACIÓN")
 *
 * Cada actividad del diagrama es un "paso". Un paso está:
 *   - hecho:       ya se registró (queda guardado en preparaciones.pasos)
 *   - disponible:  sus pasos previos están hechos → el responsable puede registrarlo
 *   - bloqueado:   falta completar algún paso previo
 *   - no_aplica:   la compuerta del diagrama lo descarta (p. ej. examen si no es 1ra/última sesión)
 *
 * Este archivo no accede a la base de datos: solo define el flujo y calcula estados.
 */
import type { PasoRegistro } from "@/db/schema";

/** Parámetro de tiempo: con cuántos días de anticipación debe comunicarse al personal (NextCloud). */
export const DIAS_ANTICIPACION_COMUNICACION = 3;

export type RolFlujo =
  | "jefe_comercial"
  | "jefe_proyecto"
  | "capacitador"
  | "asistente"
  | "gestion_documental"
  | "administradora";

export const ROLES: Record<RolFlujo, string> = {
  jefe_comercial: "Agente Comercial",
  jefe_proyecto: "Jefe de Proyecto",
  capacitador: "Capacitador",
  asistente: "Asistente de Capacitación",
  gestion_documental: "Encargado de Gestión Documental",
  administradora: "Administradora",
};

export type Carril = "general" | "capacitador" | "asistente";

export type ContextoFlujo = {
  pasos: Record<string, PasoRegistro>;
  fueraDeArequipa: boolean;
  /** Examen que corresponde según la posición de la sesión en la capacitación */
  examen: "entrada" | "salida" | "ambos" | null;
};

export type Etapa = "pre" | "post";
export const ETAPAS: Record<Etapa, string> = { pre: "Pre-capacitación", post: "Post-capacitación" };

export type DefPaso = {
  clave: string;
  titulo: string;
  descripcion: string;
  etapa: Etapa;
  fase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  carril: Carril;
  /** Nombre muy corto para la línea del proceso */
  corto: string;
  rol: RolFlujo | ((c: ContextoFlujo) => RolFlujo);
  /** Otros roles que también pueden registrar la actividad */
  rolesAlternos?: RolFlujo[];
  requiere: string[];
  aplica?: (c: ContextoFlujo) => boolean;
  /** Nota del diagrama */
  nota?: string;
};

export const FASES: Record<DefPaso["fase"], string> = {
  1: "Validación de la programación",
  2: "Preparación de la sesión",
  3: "Aprobación de la preparación",
  4: "Cierre de la sesión",
  5: "Entregables",
  6: "Documentación y entregable",
  7: "Revisión y cierre",
};

export function nombreFase(etapa: Etapa, fase: DefPaso["fase"]) {
  return etapa === "post" ? ({ 1: "Datos de Capacitación", 2: "Entregables" } as Record<number, string>)[fase] ?? FASES[fase] : FASES[fase];
}

export const PASOS: DefPaso[] = [
  {
    clave: "validar_programacion",
    corto: "Programación",
    titulo: "Validar la programación",
    descripcion: "Revisa el programa, las sesiones, la fecha, el horario, la sede y el personal asignado. Si detectas un error, edita los datos en el cronograma antes de validar.",
    etapa: "pre", fase: 1, carril: "general", rol: "jefe_proyecto", requiere: [],
  },
  // ── Fase 2 · Asistente y áreas de apoyo ─────────────────
  {
    clave: "imprimir_ficha",
    corto: "Imprimir",
    titulo: "Impresión de la lista de asistencia",
    descripcion: "Descarga la lista de asistencia y confirma que ya la imprimiste.",
    etapa: "pre", fase: 2, carril: "asistente", rol: "asistente", requiere: ["validar_programacion"],
  },
  {
    clave: "solicitar_recursos",
    corto: "Recursos",
    titulo: "Solicitud de recursos",
    descripcion: "Solicita gaseosas, galletas, papelotes u otros recursos y, en el apartado de equipos de cómputo, laptops, proyectores u otros equipos. Indica las unidades de cada uno.",
    etapa: "pre", fase: 2, carril: "asistente", rol: "asistente", requiere: ["imprimir_ficha"],
  },
  {
    clave: "revisar_recursos",
    corto: "Revisión",
    titulo: "Aprobación de requerimientos y coordinación con el asistente",
    descripcion: "Gestión Documental revisa los recursos solicitados, modifica lo necesario y confirma que ya coordinó con el asistente antes de aprobar.",
    etapa: "pre", fase: 2, carril: "asistente", rol: "gestion_documental", requiere: ["solicitar_recursos"],
  },
  {
    clave: "programa_viaje",
    corto: "Viaje",
    titulo: "Programa de viaje (si corresponde)",
    descripcion: "Indica si corresponde presentar un programa de viaje. Si corresponde, registra el itinerario; en caso contrario, confirma que no corresponde.",
    etapa: "pre", fase: 2, carril: "asistente", rol: "asistente", requiere: ["revisar_recursos"],
  },
  {
    clave: "aprobar_preparacion",
    corto: "Aprobación",
    titulo: "Aprobación de la preparación por Gestión Documental",
    descripcion: "Gestión Documental revisa el resumen de la lista impresa, los recursos y equipos aprobados, la coordinación y el programa de viaje, y aprueba la preparación.",
    etapa: "pre", fase: 3, carril: "general", rol: "gestion_documental", requiere: ["programa_viaje"],
  },
  // ══ POST-CAPACITACIÓN ════════════════════════════════════
  {
    clave: "datos_capacitacion",
    corto: "Datos",
    titulo: "Datos generales de la capacitación",
    descripcion: "Indica si se ejecutó la capacitación, los horarios reales y los tipos y detalles de las incidencias. Confirma los datos registrados.",
    etapa: "post", fase: 1, carril: "general", rol: "asistente", requiere: ["aprobar_preparacion"],
  },
  {
    clave: "recursos_post",
    corto: "Recursos",
    titulo: "Recursos",
    descripcion: "Registra las unidades de retorno de los recursos y equipos llevados a la capacitación y confirma las cantidades.",
    etapa: "post", fase: 2, carril: "asistente", rol: "asistente", requiere: ["datos_capacitacion"],
  },
  {
    clave: "escanear_subir",
    corto: "Entregables",
    titulo: "Entregables",
    descripcion: "Adjunta diapositivas, talleres o prácticas, lista de asistencia, exámenes cuando correspondan, fotos y videos. Confirma los entregables.",
    etapa: "post", fase: 2, carril: "asistente", rol: "asistente", requiere: ["recursos_post"],
    aplica: (c) => c.pasos.datos_capacitacion?.realizada !== false,
  },
  // ── Fase 4 · Jefe de Proyectos ──────────────────────────
  // ── Fase 5 · Asistente y Administradora ─────────────────
  {
    clave: "rendir_viaticos",
    corto: "Viáticos",
    titulo: "Viáticos",
    descripcion: "Selecciona gastos de pasajes, recursos u otros, indica los importes en soles y confirma el total de viáticos.",
    etapa: "post", fase: 2, carril: "asistente", rol: "asistente", requiere: ["escanear_subir"],
  },
  // ── Fase 6 · Asistente ──────────────────────────────────
  // ── Fase 7 · Gestión Documental y Jefe de Proyectos ─────
];

export const PASO = Object.fromEntries(PASOS.map((p) => [p.clave, p])) as Record<string, DefPaso>;

export type EstadoPaso = "hecho" | "disponible" | "bloqueado" | "no_aplica";

export function rolDe(p: DefPaso, c: ContextoFlujo): RolFlujo {
  return typeof p.rol === "function" ? p.rol(c) : p.rol;
}

/** ¿Se detuvo la post-capacitación porque la sesión no se realizó? (fin "Sesión no realizada") */
export function noRealizada(c: ContextoFlujo) {
  return c.pasos.sesion_realizada?.realizada === false;
}

export function estadoPaso(clave: string, c: ContextoFlujo): EstadoPaso {
  const p = PASO[clave];
  if (p.aplica && !p.aplica(c)) return "no_aplica";
  if (p.etapa === "post" && clave !== "sesion_realizada" && noRealizada(c)) return "bloqueado";
  if (c.pasos[clave]) return "hecho";
  const listo = p.requiere.every((r) => {
    const e = estadoPaso(r, c);
    return e === "hecho" || e === "no_aplica";
  });
  return listo ? "disponible" : "bloqueado";
}

export type Vista = Etapa | "completo";

export function resumenFlujo(c: ContextoFlujo, vista: Vista = "pre") {
  const estados = PASOS.filter((p) => vista === "completo" || p.etapa === vista).map((p) => ({
    ...p,
    estado: estadoPaso(p.clave, c),
    rolActual: rolDe(p, c),
    roles: [rolDe(p, c), ...(p.rolesAlternos ?? [])],
  }));
  const aplicables = estados.filter((e) => e.estado !== "no_aplica");
  const hechos = aplicables.filter((e) => e.estado === "hecho").length;
  const pendientes = estados.filter((e) => e.estado === "disponible");
  return {
    estados,
    hechos,
    total: aplicables.length,
    porcentaje: aplicables.length ? Math.round((hechos * 100) / aplicables.length) : 0,
    pendientes,
    /** Pre-capacitación completa: la sesión sale a sede */
    terminado: estadoPaso("aprobar_preparacion", c) === "hecho",
    /** Post-capacitación completa: la sesión quedó cerrada */
    cerrada: estadoPaso("rendir_viaticos", c) === "hecho",
    /** La sesión no se realizó: se reprograma y la post-capacitación termina */
    noRealizada: noRealizada(c),
    reprogramada: false,
  };
}

/** Etapa en la que está la sesión ahora (para abrir el expediente y la bandeja en la vista correcta). */
export function etapaActual(c: ContextoFlujo): Etapa {
  return estadoPaso("aprobar_preparacion", c) === "hecho" ? "post" : "pre";
}
