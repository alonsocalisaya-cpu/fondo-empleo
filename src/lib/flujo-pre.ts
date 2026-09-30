/**
 * Flujo del proceso de cada capacitación programada:
 *   - PRE-CAPACITACIÓN  (fases 1–4, según el diagrama BPMN "FLUJO DE PROCESO - PRE CAPACITACIÓN")
 *   - POST-CAPACITACIÓN (fases 5–8, según el diagrama BPMN "FLUJO DE PROCESO - POST CAPACITACIÓN")
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
  fase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
  1: "Confirmación del local",
  2: "Asignación y comunicación al personal",
  3: "Preparación de la sesión",
  4: "Salida a sede",
  5: "Cierre de la sesión",
  6: "Entregables",
  7: "Documentación y entregable",
  8: "Revisión y cierre",
};

export const PASOS: DefPaso[] = [
  // ── Fase 1 ───────────────────────────────────────────────
  // (Antes eran dos actividades: «Confirmar el local» y «Confirmar con la sede». Se unieron en una sola.)
  {
    clave: "confirmar_sede",
    corto: "Local",
    titulo: "Confirmar el local y la sesión con la sede",
    descripcion: "Contactar a la sede y confirmar que el local y la sesión se mantienen. Si no se confirma, la sesión se reprograma.",
    etapa: "pre", fase: 1, carril: "general", rol: "jefe_comercial", rolesAlternos: ["jefe_proyecto"], requiere: [],
  },
  // ── Fase 2 ───────────────────────────────────────────────
  // (Antes «Asignar personal» era una actividad aparte; el personal ya se asigna al programar la sesión,
  //  así que aquí solo se valida —o se cambia— y se comunica en un solo paso.)
  {
    clave: "comunicar",
    corto: "Personal",
    titulo: "Validar el personal y comunicarle la sesión",
    descripcion: `Confirma el capacitador y el asistente asignados al programar la sesión (puedes cambiarlos por otros disponibles) y se les comunica por el sistema: les aparece en sus notificaciones y confirman con «Enterado». Plazo: ${DIAS_ANTICIPACION_COMUNICACION} días antes de la sesión.`,
    etapa: "pre", fase: 2, carril: "general", rol: "jefe_proyecto", requiere: ["confirmar_sede"],
    nota: "Contemplar un parámetro de tiempo para esta actividad",
  },
  // ── Fase 3 · Capacitador ─────────────────────────────────
  {
    clave: "descargar_material",
    corto: "Material",
    titulo: "Descargar diapositivas y talleres",
    descripcion: "Desde el repositorio de Gestión Documental.",
    etapa: "pre", fase: 3, carril: "capacitador", rol: "capacitador", requiere: ["comunicar"],
    nota: "Estos documentos están en el repositorio del sistema (Gestión Documental)",
  },
  {
    clave: "personalizar",
    corto: "Personalizar",
    titulo: "¿Personalizar contenido?",
    descripcion: "Si es necesario, personalizar la diapositiva y/o el taller.",
    etapa: "pre", fase: 3, carril: "capacitador", rol: "capacitador", requiere: ["descargar_material"],
  },
  {
    clave: "dinamicas",
    corto: "Dinámicas",
    titulo: "¿Requiere material para dinámicas?",
    descripcion: "Si requiere, solicitar el material al asistente vía NextCloud (pasa a la ficha).",
    etapa: "pre", fase: 3, carril: "capacitador", rol: "capacitador", requiere: ["personalizar"],
    nota: "El material para dinámicas puede ser vasos, hojas de colores, etc.",
  },
  {
    clave: "examen",
    corto: "Examen",
    titulo: "Imprimir examen de entrada o salida",
    descripcion: "Solo en la primera o la última sesión de la capacitación.",
    etapa: "pre", fase: 3, carril: "capacitador", rol: "capacitador", requiere: ["dinamicas"],
    aplica: (c) => c.examen !== null,
  },
  {
    clave: "guardar_material",
    corto: "Guardar",
    titulo: "Guardar material didáctico en medio seguro e imprimir talleres",
    descripcion: "Registrar el medio donde se guardó el material.",
    etapa: "pre", fase: 3, carril: "capacitador", rol: "capacitador", requiere: ["dinamicas", "examen"],
    nota: "El medio seguro puede ser USB, nube o WhatsApp",
  },
  // ── Fase 3 · Asistente y áreas de apoyo ─────────────────
  {
    clave: "imprimir_ficha",
    corto: "Imprimir",
    titulo: "Descargar e imprimir ficha de capacitación y lista de asistencia",
    descripcion: "La ficha impresa se necesita también en la post-capacitación.",
    etapa: "pre", fase: 3, carril: "asistente", rol: "asistente", requiere: ["comunicar"],
    nota: "La ficha de capacitación se necesitará impresa para el proceso Post",
  },
  {
    clave: "alistar_material",
    corto: "Alistar",
    titulo: "Alistar material según 1ra sección de la ficha",
    descripcion: "Material del capacitador, insumos de refrigerio y tecnológicos. Todos los ítems deben quedar listos.",
    etapa: "pre", fase: 3, carril: "asistente", rol: "asistente", requiere: ["imprimir_ficha", "dinamicas"],
    nota: "La 1ra sección contempla material solicitado por el capacitador, insumos de refrigerio y tecnológicos",
  },
  {
    clave: "probar_equipos",
    corto: "Equipos",
    titulo: "Probar equipos tecnológicos",
    descripcion: "Contrastar con la tabla de equipos y su estado.",
    etapa: "pre", fase: 3, carril: "asistente", rol: "asistente", requiere: ["alistar_material"],
    nota: "Contrastar con tabla de equipos y estado (proceso de mantenimiento)",
  },
  {
    clave: "solicitar_viaticos",
    corto: "Pedir viát.",
    titulo: "Solicitar viáticos (NextCloud)",
    descripcion: "Indicar monto y concepto.",
    etapa: "pre", fase: 3, carril: "asistente", rol: "asistente", requiere: ["probar_equipos"],
  },
  {
    clave: "entregar_viaticos",
    corto: "Entregar viát.",
    titulo: "Entregar viáticos",
    descripcion: "Movilidad (dentro de Arequipa) o viaje (fuera). La registra la Administradora o el Jefe de Proyecto; con esto queda como recibido (ya no hay un paso aparte de «recepción»).",
    etapa: "pre", fase: 3, carril: "asistente",
    rol: "administradora",
    rolesAlternos: ["jefe_proyecto"],
    requiere: ["solicitar_viaticos"],
  },
  {
    clave: "llenar_ficha",
    corto: "Comunicar ficha",
    titulo: "Revisar la ficha digital y comunicar al encargado",
    descripcion: "Verificar que la 1ra sección esté completa (se llena en «Alistar material») y avisar a Gestión Documental.",
    etapa: "pre", fase: 3, carril: "asistente", rol: "asistente", requiere: ["entregar_viaticos"],
  },
  {
    clave: "revisar_ficha",
    corto: "Revisar",
    titulo: "Revisar 1ra sección de la ficha — ¿Todo correcto?",
    descripcion: "Si hay observaciones, la ficha vuelve al asistente.",
    etapa: "pre", fase: 3, carril: "asistente", rol: "gestion_documental", requiere: ["llenar_ficha"],
  },
  {
    clave: "aprobar_ficha",
    corto: "Aprobar",
    titulo: "Aprobar 1ra sección de la ficha",
    descripcion: "Aprobación final antes de la salida.",
    etapa: "pre", fase: 3, carril: "asistente", rol: "jefe_proyecto", requiere: ["revisar_ficha"],
  },
  // ── Fase 4 ───────────────────────────────────────────────
  {
    clave: "lista",
    corto: "Sale a sede",
    titulo: "Sesión lista, sale a sede",
    descripcion: "Todas las actividades completas: la sesión queda confirmada.",
    etapa: "pre", fase: 4, carril: "general", rol: "jefe_proyecto", requiere: ["guardar_material", "aprobar_ficha"],
  },
  // ══ POST-CAPACITACIÓN ════════════════════════════════════
  // ── Fase 5 · Jefe de Proyectos ──────────────────────────
  {
    clave: "sesion_realizada",
    corto: "¿Realizada?",
    titulo: "¿Se realizó la sesión?",
    descripcion: "Sesión concluida o no realizada. Si no se realizó, se reprograma y el flujo termina.",
    etapa: "post", fase: 5, carril: "general", rol: "jefe_proyecto", requiere: ["lista"],
  },
  {
    clave: "solicitar_entregables",
    corto: "Entregables",
    titulo: "Solicitar entregables por NextCloud",
    descripcion: "Pedir al capacitador y al asistente sus entregables de la sesión.",
    etapa: "post", fase: 5, carril: "general", rol: "jefe_proyecto", requiere: ["sesion_realizada"],
  },
  // ── Fase 6 · Capacitador ────────────────────────────────
  {
    clave: "corregir_examenes",
    corto: "Corregir exám.",
    titulo: "Corregir los exámenes",
    descripcion: "Solo si la sesión tuvo examen (primera o última sesión de la capacitación).",
    etapa: "post", fase: 6, carril: "capacitador", rol: "capacitador", requiere: ["solicitar_entregables"],
    aplica: (c) => c.examen !== null,
  },
  {
    clave: "enviar_examenes",
    corto: "Enviar exám.",
    titulo: "Enviar los exámenes corregidos al asistente",
    descripcion: "El envío se hace por NextCloud.",
    etapa: "post", fase: 6, carril: "capacitador", rol: "capacitador", requiere: ["corregir_examenes"],
    aplica: (c) => c.examen !== null,
    nota: "El envío se hará por el medio NextCloud",
  },
  // ── Fase 6 · Asistente y Administradora ─────────────────
  {
    clave: "reportar_incidencias",
    corto: "Incidencias",
    titulo: "Reportar las incidencias al Jefe de Proyecto por NextCloud",
    descripcion: "Lo ocurrido en la sesión: retrasos, problemas con el local, equipos, participantes…",
    etapa: "post", fase: 6, carril: "asistente", rol: "asistente", requiere: ["solicitar_entregables"],
  },
  {
    clave: "llenar_ficha2",
    corto: "Ficha 2da",
    titulo: "Llenar la 2da sección de la ficha",
    descripcion: "Hora de llegada, inicio y término reales, incidencias y observaciones del capacitador.",
    etapa: "post", fase: 6, carril: "asistente", rol: "asistente", requiere: ["reportar_incidencias"],
  },
  {
    clave: "registrar_asistencia",
    corto: "Asistencia",
    titulo: "Registrar la lista de asistencia en el sistema",
    descripcion: "Pasar la lista firmada a la lista de asistencia de la sesión.",
    etapa: "post", fase: 6, carril: "asistente", rol: "asistente", requiere: ["llenar_ficha2"],
  },
  {
    clave: "rendir_viaticos",
    corto: "Liquidar viát.",
    titulo: "Llenar la liquidación de viáticos y enviarla a Administración",
    descripcion: "Formato «Liquidación de viáticos» (ACIDE-A&A-F-02): ya viene con tus datos, la sesión, el monto entregado y los gastos de la 2da sección; completa comprobantes y descarga el formato lleno.",
    etapa: "post", fase: 6, carril: "asistente", rol: "asistente", requiere: ["registrar_asistencia"],
  },
  {
    clave: "recibir_rendicion",
    corto: "Recibir rend.",
    titulo: "Recibir la liquidación de viáticos",
    descripcion: "Administración revisa la liquidación (puede descargar el formato lleno) y la da por recibida. Corre en paralelo al resto del cierre.",
    etapa: "post", fase: 6, carril: "asistente", rol: "administradora", rolesAlternos: ["jefe_proyecto"], requiere: ["rendir_viaticos"],
  },
  // ── Fase 7 · Asistente ──────────────────────────────────
  {
    clave: "escanear_subir",
    corto: "Evidencias",
    titulo: "Escanear y subir formatos, fotos y video al sistema",
    descripcion: "Formatos firmados escaneados, fotos y video de la sesión.",
    etapa: "post", fase: 7, carril: "general", rol: "asistente", requiere: ["rendir_viaticos", "enviar_examenes"],
  },
  {
    clave: "imprimir_ficha_digital",
    corto: "Imprimir",
    titulo: "Imprimir la ficha de capacitación digital",
    descripcion: "Con la 1ra y la 2da sección completas.",
    etapa: "post", fase: 7, carril: "general", rol: "asistente", requiere: ["escanear_subir"],
  },
  {
    clave: "revisar_documentacion",
    corto: "Revisar docs",
    titulo: "Revisar toda la documentación",
    descripcion: "Confirmar los documentos físicos antes de armar la mica; viene de lo declarado en la 2da sección.",
    etapa: "post", fase: 7, carril: "general", rol: "asistente", requiere: ["imprimir_ficha_digital"],
  },
  {
    clave: "elaborar_entregable",
    corto: "Mica G.D.",
    titulo: "Elaborar el entregable y entregar al encargado de G.D.",
    descripcion: "La mica con toda la documentación (ficha de capacitación, exámenes…).",
    etapa: "post", fase: 7, carril: "general", rol: "asistente", requiere: ["revisar_documentacion"],
    nota: "Se considera entregable a la mica con toda la documentación puesta (ficha de capacitación, exámenes…)",
  },
  // ── Fase 8 · Gestión Documental y Jefe de Proyectos ─────
  {
    clave: "contrastar_inventario",
    corto: "Contraste",
    titulo: "Contrastar el inventario y revisar la 2da sección — ¿Cuadra?",
    descripcion: "Lo que salió según la ficha contra lo que volvió y el estado de cada equipo. Si no cuadra, vuelve al asistente.",
    etapa: "post", fase: 8, carril: "general", rol: "gestion_documental", requiere: ["elaborar_entregable"],
  },
  {
    clave: "actualizar_inventario",
    corto: "Aprobar",
    titulo: "Aprobar la 2da sección y actualizar el inventario",
    descripcion: "Al aprobar, el material devuelto vuelve al stock de Logística y los equipos con falla pasan a Mantenimiento.",
    etapa: "post", fase: 8, carril: "general", rol: "jefe_proyecto", requiere: ["contrastar_inventario"],
  },
  {
    clave: "gestionar_carpeta",
    corto: "Carpeta física",
    titulo: "Gestionar la carpeta física",
    descripcion: "Archivar el entregable. Registro de la sesión cerrada.",
    etapa: "post", fase: 8, carril: "general", rol: "jefe_proyecto", requiere: ["actualizar_inventario"],
  },
];

export const PASO = Object.fromEntries(PASOS.map((p) => [p.clave, p])) as Record<string, DefPaso>;

export type EstadoPaso = "hecho" | "disponible" | "bloqueado" | "no_aplica";

export function rolDe(p: DefPaso, c: ContextoFlujo): RolFlujo {
  return typeof p.rol === "function" ? p.rol(c) : p.rol;
}

/** ¿Se detuvo el flujo porque el local no se confirmó? (fin "Reprogramar sesión") */
export function reprogramada(c: ContextoFlujo) {
  return c.pasos.confirmar_sede?.localConfirmado === false;
}

/** ¿Se detuvo la post-capacitación porque la sesión no se realizó? (fin "Sesión no realizada") */
export function noRealizada(c: ContextoFlujo) {
  return c.pasos.sesion_realizada?.realizada === false;
}

export function estadoPaso(clave: string, c: ContextoFlujo): EstadoPaso {
  const p = PASO[clave];
  if (p.aplica && !p.aplica(c)) return "no_aplica";
  if (p.etapa === "post" && clave !== "sesion_realizada" && noRealizada(c)) return "bloqueado";
  const inicio = clave === "confirmar_sede";
  if (c.pasos[clave] && (inicio || !reprogramada(c))) return "hecho";
  if (reprogramada(c) && !inicio) return "bloqueado";
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
    terminado: estadoPaso("lista", c) === "hecho",
    /** Post-capacitación completa: la sesión quedó cerrada */
    cerrada: estadoPaso("gestionar_carpeta", c) === "hecho",
    /** La sesión no se realizó: se reprograma y la post-capacitación termina */
    noRealizada: noRealizada(c),
    reprogramada: reprogramada(c),
  };
}

/** Etapa en la que está la sesión ahora (para abrir el expediente y la bandeja en la vista correcta). */
export function etapaActual(c: ContextoFlujo): Etapa {
  return estadoPaso("lista", c) === "hecho" ? "post" : "pre";
}
