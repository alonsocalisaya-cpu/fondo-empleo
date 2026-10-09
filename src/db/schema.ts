import {
  real,
  check,
  pgTable,
  pgEnum,
  serial,
  integer,
  bigint,
  varchar,
  text,
  boolean,
  date,
  time,
  timestamp,
  uniqueIndex,
  index,
  jsonb,
  numeric,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ───────────── Enums ───────────── */

export const modalidadEnum = pgEnum("modalidad", ["presencial", "virtual", "mixta"]);
export const turnoEnum = pgEnum("turno", ["manana", "tarde", "noche"]);
export const estadoProgramacionEnum = pgEnum("estado_programacion", [
  "programada",
  "confirmada",
  "reprogramada",
  "cancelada",
  "finalizada",
]);
export const estadoAsistenciaEnum = pgEnum("estado_asistencia", [
  "presente",
  "tarde",
  "ausente",
  "justificado",
]);

const creadoEn = () => timestamp("creado_en", { withTimezone: true }).defaultNow().notNull();

/* ───────────── Maestros ───────────── */

export const sedes = pgTable("sedes", {
  id: serial("id").primaryKey(),
  grupo: varchar("grupo", { length: 36 }).notNull().default(sql`gen_random_uuid()::text`),
  estructuraId: integer("estructura_id").notNull().references(() => estructuras.id, { onDelete: "restrict" }),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  direccion: varchar("direccion", { length: 200 }),
  distrito: varchar("distrito", { length: 100 }),
  // Define qué viáticos corresponden: movilidad (dentro) o viaje (fuera de Arequipa)
  fueraDeArequipa: boolean("fuera_de_arequipa").default(false).notNull(),
  contacto: varchar("contacto", { length: 150 }), // persona de la sede con quien se confirma el local
  telefono: varchar("telefono", { length: 30 }),
  activa: boolean("activa").default(true).notNull(),
  creadoEn: creadoEn(),
}, (t) => [uniqueIndex("sedes_estructura_nombre_unique").on(t.estructuraId, t.nombre)]);

export const sedeHorarios = pgTable("sede_horarios", {
  id: serial("id").primaryKey(),
  sedeId: integer("sede_id").notNull().references(() => sedes.id, { onDelete: "cascade" }),
  nombre: varchar("nombre", { length: 80 }).notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFin: time("hora_fin").notNull(),
}, (t) => [uniqueIndex("sede_horarios_sede_nombre_unique").on(t.sedeId, t.nombre), uniqueIndex("sede_horarios_un_horario_unique").on(t.sedeId), check("sede_horarios_orden", sql`${t.horaFin} > ${t.horaInicio}`)]);

export const capacitadores = pgTable("capacitadores", {
  id: serial("id").primaryKey(),
  nombres: varchar("nombres", { length: 100 }).notNull(),
  apellidos: varchar("apellidos", { length: 100 }).notNull(),
  dni: varchar("dni", { length: 15 }).unique(),
  email: varchar("email", { length: 150 }),
  telefono: varchar("telefono", { length: 30 }),
  especialidad: varchar("especialidad", { length: 150 }),
  activo: boolean("activo").default(true).notNull(),
  creadoEn: creadoEn(),
});

export const participantes = pgTable("participantes", {
  id: serial("id").primaryKey(),
  nombres: varchar("nombres", { length: 100 }).notNull(),
  apellidos: varchar("apellidos", { length: 100 }).notNull(),
  dni: varchar("dni", { length: 15 }).notNull().unique(),
  email: varchar("email", { length: 150 }),
  telefono: varchar("telefono", { length: 30 }),
  area: varchar("area", { length: 120 }),
  // Beneficiario del programa: sede y turno en que se capacita (lista de turno oficial)
  sedeId: integer("sede_id").references(() => sedes.id, { onDelete: "set null" }),
  turno: varchar("turno", { length: 10 }), // "manana" | "tarde" | "ambos"
  creadoEn: creadoEn(),
});

/* ───────────── Personal interno (roles del proceso) ───────────── */

export const rolEnum = pgEnum("rol", [
  "jefe_comercial",
  "jefe_proyecto",
  "asistente",
  "gestion_documental",
  "administradora",
  "rrhh",
]);

export const personal = pgTable("personal", {
  id: serial("id").primaryKey(),
  nombres: varchar("nombres", { length: 100 }).notNull(),
  apellidos: varchar("apellidos", { length: 100 }).notNull(),
  rol: rolEnum("rol").notNull(),
  dni: varchar("dni", { length: 15 }).unique(),
  email: varchar("email", { length: 150 }),
  telefono: varchar("telefono", { length: 30 }),
  activo: boolean("activo").default(true).notNull(),
  creadoEn: creadoEn(),
});

/* ───────────── Usuarios del sistema y sus sesiones de ingreso ───────────── */

export const rolUsuarioEnum = pgEnum("rol_usuario", [
  "admin",
  "jefe_proyecto",
  "jefe_comercial",
  "asistente",
  "capacitador",
  "gestion_documental",
  "administradora",
  "rrhh",
]);

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  /*
   * Cada fila es una PERSONA del equipo (página «Personal»): sus datos, sus roles y, si se le dio,
   * su acceso al sistema. Los registros de consultor (capacitadores) y de personal interno (personal)
   * se mantienen sincronizados solos a partir de aquí.
   */
  usuario: varchar("usuario", { length: 150 }).unique(), // DNI, correo o nombre.apellido (null = sin acceso)
  nombre: varchar("nombre", { length: 200 }).notNull(), // nombre completo para mostrar
  nombres: varchar("nombres", { length: 100 }),
  apellidos: varchar("apellidos", { length: 100 }),
  dni: varchar("dni", { length: 15 }),
  email: varchar("email", { length: 150 }),
  telefono: varchar("telefono", { length: 30 }),
  especialidad: varchar("especialidad", { length: 150 }), // si es consultor
  // ¿Puede ingresar al sistema? (una persona puede estar registrada sin acceso)
  acceso: boolean("acceso").default(true).notNull(),
  // Rol principal (el primero de «roles»); se mantiene por compatibilidad
  rol: rolUsuarioEnum("rol").notNull(),
  // Todos los roles de la persona (una misma persona puede ser, p. ej., asistente y gestión documental)
  roles: rolUsuarioEnum("roles").array().notNull().default(sql`'{}'::rol_usuario[]`),
  claveHash: varchar("clave_hash", { length: 200 }), // scrypt: sal:hash (null = sin acceso)
  // Persona del sistema a la que corresponde (para «sus» actividades y «sus» sesiones)
  personalId: integer("personal_id").references(() => personal.id, { onDelete: "set null" }),
  capacitadorId: integer("capacitador_id").references(() => capacitadores.id, { onDelete: "set null" }),
  activo: boolean("activo").default(true).notNull(), // persona activa en el equipo
  debeCambiarClave: boolean("debe_cambiar_clave").default(true).notNull(),
  ultimoIngreso: timestamp("ultimo_ingreso", { withTimezone: true }),
  // Última vez que abrió la campana de notificaciones (lo posterior se marca como «nuevo»)
  notificacionesVistas: timestamp("notificaciones_vistas", { withTimezone: true }),
  creadoEn: creadoEn(),
});

/** Mensajes para una persona (aparecen en su campana): p. ej. la comunicación de una sesión asignada. */
export const avisos = pgTable(
  "avisos",
  {
    id: serial("id").primaryKey(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    programacionId: integer("programacion_id").references(() => programaciones.id, { onDelete: "cascade" }),
    origen: varchar("origen", { length: 40 }), // actividad que lo generó (p. ej. "comunicar")
    titulo: varchar("titulo", { length: 200 }).notNull(),
    mensaje: text("mensaje"),
    href: varchar("href", { length: 300 }),
    de: varchar("de", { length: 200 }), // quién lo envió
    creadoEn: creadoEn(),
    leidoEn: timestamp("leido_en", { withTimezone: true }),
    confirmadoEn: timestamp("confirmado_en", { withTimezone: true }), // «Enterado»
  },
  (t) => [index("avisos_usuario_idx").on(t.usuarioId), index("avisos_prog_idx").on(t.programacionId)],
);

/** Permisos por rol y módulo editables desde «Usuarios y roles» (si falta una fila, vale el de lib/permisos). */
export const permisosRol = pgTable(
  "permisos_rol",
  {
    rol: rolUsuarioEnum("rol").notNull(),
    modulo: varchar("modulo", { length: 30 }).notNull(),
    nivel: varchar("nivel", { length: 10 }).notNull(), // "ver" | "editar" | "ninguno"
  },
  (t) => [primaryKey({ columns: [t.rol, t.modulo] })],
);

export const sesionesUsuario = pgTable(
  "sesiones_usuario",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // hash SHA-256 del token de la cookie
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    expira: timestamp("expira", { withTimezone: true }).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index("sesiones_usuario_idx").on(t.usuarioId)],
);

/* ───────────── Estructura: Componente › Actividad › Módulo › Sesión ───────────── */

/** Estructura del programa (p. ej. «Arequipa»): agrupa componentes › actividades › módulos › sesiones. */
export const estructuras = pgTable("estructuras", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 120 }).notNull().unique(),
  // Nombre del proyecto que va en la lista de asistencia oficial (si está vacío se usa el de Arequipa)
  proyecto: text("proyecto"),
  descripcion: text("descripcion"),
  orden: integer("orden").default(0).notNull(),
  creadoEn: creadoEn(),
});

export const componentes = pgTable("componentes", {
  id: serial("id").primaryKey(),
  estructuraId: integer("estructura_id")
    .notNull()
    .references(() => estructuras.id, { onDelete: "restrict" }),
  codigo: varchar("codigo", { length: 30 }).notNull().unique(),
  nombre: varchar("nombre", { length: 200 }).notNull(),
  descripcion: text("descripcion"),
  orden: integer("orden").default(0).notNull(),
  creadoEn: creadoEn(),
});

export const actividades = pgTable(
  "actividades",
  {
    id: serial("id").primaryKey(),
    componenteId: integer("componente_id")
      .notNull()
      .references(() => componentes.id, { onDelete: "cascade" }),
    codigo: varchar("codigo", { length: 30 }).notNull().unique(),
    nombre: varchar("nombre", { length: 200 }).notNull(),
    descripcion: text("descripcion"),
    orden: integer("orden").default(0).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index("actividades_componente_idx").on(t.componenteId)],
);

export const modulos = pgTable(
  "modulos",
  {
    id: serial("id").primaryKey(),
    actividadId: integer("actividad_id")
      .notNull()
      .references(() => actividades.id, { onDelete: "cascade" }),
    codigo: varchar("codigo", { length: 30 }).notNull().unique(),
    nombre: varchar("nombre", { length: 200 }).notNull(),
    descripcion: text("descripcion"),
    orden: integer("orden").default(0).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index("modulos_actividad_idx").on(t.actividadId)],
);

export const sesiones = pgTable(
  "sesiones",
  {
    id: serial("id").primaryKey(),
    moduloId: integer("modulo_id")
      .notNull()
      .references(() => modulos.id, { onDelete: "cascade" }),
    codigo: varchar("codigo", { length: 30 }).notNull().unique(),
    nombre: varchar("nombre", { length: 200 }).notNull(),
    objetivo: text("objetivo"), // explicación / objetivo de la sesión
    contenido: text("contenido"), // temas (uno por línea)
    recursoMetodologico: text("recurso_metodologico"), // talleres, ejercicios, dinámicas (uno por línea)
    perfilSalida: text("perfil_salida"), // lo que el participante logra al finalizar
    duracionMin: integer("duracion_min").default(120).notNull(),
    modalidad: modalidadEnum("modalidad").default("presencial").notNull(),
    asistenciaMinima: integer("asistencia_minima").default(80).notNull(), // porcentaje
    orden: integer("orden").default(0).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [index("sesiones_modulo_idx").on(t.moduloId)],
);

/* ───────────── Programación: una sesión dictada en una sede, fecha y horario ───────────── */

export const programaciones = pgTable(
  "programaciones",
  {
    id: serial("id").primaryKey(),
    sesionId: integer("sesion_id")
      .notNull()
      .references(() => sesiones.id, { onDelete: "restrict" }),
    sedeId: integer("sede_id")
      .notNull()
      .references(() => sedes.id, { onDelete: "restrict" }),
    capacitadorId: integer("capacitador_id").references(() => capacitadores.id, {
      onDelete: "set null",
    }),
    // Asistente de capacitación asignado (personal interno)
    asistenteId: integer("asistente_id").references(() => personal.id, { onDelete: "set null" }),
    fecha: date("fecha", { mode: "string" }).notNull(),
    horaInicio: time("hora_inicio").notNull(),
    horaFin: time("hora_fin").notNull(),
    turno: turnoEnum("turno").notNull(),
    aula: varchar("aula", { length: 80 }),
    cupo: integer("cupo"),
    estado: estadoProgramacionEnum("estado").default("programada").notNull(),
    listaCerrada: boolean("lista_cerrada").default(false).notNull(),
    observacion: varchar("observacion", { length: 300 }), // p. ej. "Parte 1" o "Sesión combinada: …"
    codigoExterno: varchar("codigo_externo", { length: 40 }).unique(), // fila del Excel de cronograma (para re-importar)
    creadoEn: creadoEn(),
  },
  (t) => [
    index("programaciones_fecha_idx").on(t.fecha),
    index("programaciones_sede_idx").on(t.sedeId),
    index("programaciones_sesion_idx").on(t.sesionId),
    index("programaciones_capacitador_idx").on(t.capacitadorId),
  ],
);

/** Sesiones adicionales dictadas en la misma programación (sesiones combinadas: "A + B"). */
export const programacionSesiones = pgTable(
  "programacion_sesiones",
  {
    id: serial("id").primaryKey(),
    programacionId: integer("programacion_id")
      .notNull()
      .references(() => programaciones.id, { onDelete: "cascade" }),
    sesionId: integer("sesion_id")
      .notNull()
      .references(() => sesiones.id, { onDelete: "cascade" }),
    orden: integer("orden").default(1).notNull(),
  },
  (t) => [uniqueIndex("programacion_sesiones_unica").on(t.programacionId, t.sesionId)],
);

/* ───────────── Inscripción y asistencia ───────────── */

export const inscripciones = pgTable(
  "inscripciones",
  {
    id: serial("id").primaryKey(),
    programacionId: integer("programacion_id")
      .notNull()
      .references(() => programaciones.id, { onDelete: "cascade" }),
    participanteId: integer("participante_id")
      .notNull()
      .references(() => participantes.id, { onDelete: "cascade" }),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex("inscripciones_unica").on(t.programacionId, t.participanteId)],
);

export const asistencias = pgTable(
  "asistencias",
  {
    id: serial("id").primaryKey(),
    programacionId: integer("programacion_id")
      .notNull()
      .references(() => programaciones.id, { onDelete: "cascade" }),
    participanteId: integer("participante_id")
      .notNull()
      .references(() => participantes.id, { onDelete: "cascade" }),
    estado: estadoAsistenciaEnum("estado").notNull(),
    horaIngreso: time("hora_ingreso"),
    observacion: varchar("observacion", { length: 300 }),
    // Notas del examen (escala 0–20) cuando la sesión tiene examen de entrada y/o salida
    notaEntrada: real("nota_entrada"),
    notaSalida: real("nota_salida"),
    registradoEn: timestamp("registrado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("asistencias_unica").on(t.programacionId, t.participanteId)],
);

/* ───────────── Pre-capacitación: flujo por sesión programada ───────────── */

/**
 * Estado del flujo de pre-capacitación de una programación.
 * `pasos` guarda, por cada actividad del flujo (ver src/lib/flujo-pre.ts), cuándo se hizo,
 * quién la hizo y los datos que registró (decisiones, montos, horas, etc.).
 */
export type PasoRegistro = {
  en: string; // fecha-hora ISO en que se completó
  por?: string | null; // nombre de quien la registró
  [dato: string]: unknown;
};

export const preparaciones = pgTable("preparaciones", {
  id: serial("id").primaryKey(),
  programacionId: integer("programacion_id")
    .notNull()
    .unique()
    .references(() => programaciones.id, { onDelete: "cascade" }),
  pasos: jsonb("pasos").$type<Record<string, PasoRegistro>>().default({}).notNull(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Liquidación de viáticos de una sesión (formato ACIDE-A&A-F-02). Se llena en el sistema y se descarga
 * el formato oficial lleno. `datos` sigue el tipo DatosLiquidacion de src/lib/liquidacion.ts.
 */
export const liquidaciones = pgTable("liquidaciones", {
  programacionId: integer("programacion_id")
    .primaryKey()
    .references(() => programaciones.id, { onDelete: "cascade" }),
  datos: jsonb("datos").$type<import("@/lib/liquidacion").DatosLiquidacion>().notNull(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
  actualizadoPor: varchar("actualizado_por", { length: 200 }),
});

/** Ítems de la 1ra sección de la ficha de capacitación. */
export const categoriaFichaEnum = pgEnum("categoria_ficha", [
  "material_capacitador",
  "dinamica",
  "refrigerio",
  "tecnologico",
]);

export const fichaItems = pgTable(
  "ficha_items",
  {
    id: serial("id").primaryKey(),
    programacionId: integer("programacion_id")
      .notNull()
      .references(() => programaciones.id, { onDelete: "cascade" }),
    categoria: categoriaFichaEnum("categoria").notNull(),
    descripcion: varchar("descripcion", { length: 200 }).notNull(),
    cantidad: integer("cantidad").default(1).notNull(),
    // Si sale del inventario de Logística: se descuenta el stock al agregarlo y se devuelve al quitarlo
    insumoId: integer("insumo_id").references(() => insumos.id, { onDelete: "set null" }),
    // Si es un equipo del inventario de Mantenimiento (laptop, proyector…) asignado a la sesión
    equipoId: integer("equipo_id").references(() => equipos.id, { onDelete: "set null" }),
    listo: boolean("listo").default(false).notNull(), // alistado por el asistente
    creadoEn: creadoEn(),
  },
  (t) => [index("ficha_items_prog_idx").on(t.programacionId)],
);

/* ───────────── Gestión documental: repositorio de materiales ───────────── */

export const tipoDocumentoEnum = pgEnum("tipo_documento", [
  "diapositiva",
  "taller",
  "examen_entrada",
  "examen_salida",
  "ficha",
  "otro",
  "evidencia", // formatos escaneados, fotos y video subidos en la post-capacitación
]);

export const documentos = pgTable(
  "documentos",
  {
    id: serial("id").primaryKey(),
    sesionId: integer("sesion_id").references(() => sesiones.id, { onDelete: "cascade" }),
    tipo: tipoDocumentoEnum("tipo").notNull(),
    nombre: varchar("nombre", { length: 200 }).notNull(),
    url: varchar("url", { length: 1000 }), // enlace (p. ej. NextCloud) — o bien un archivo subido
    archivo: varchar("archivo", { length: 300 }), // ruta relativa dentro de la carpeta «archivos/»
    tamano: bigint("tamano", { mode: "number" }), // bytes, incluidos archivos mayores de 2 GB
    // null = material oficial de la sesión · con valor = versión personalizada para esa programación
    programacionId: integer("programacion_id").references(() => programaciones.id, { onDelete: "cascade" }),
    subidoPor: varchar("subido_por", { length: 150 }),
    version: varchar("version", { length: 20 }),
    // Subcarpeta dentro de la carpeta de la fecha (fotos, video, lista_asistencia…); ver SECCIONES en lib/documentos
    seccion: varchar("seccion", { length: 30 }),
    creadoEn: creadoEn(),
  },
  (t) => [index("documentos_sesion_idx").on(t.sesionId), index("documentos_prog_idx").on(t.programacionId)],
);

/* ───────────── Mantenimiento: equipos y su estado ───────────── */

export const estadoEquipoEnum = pgEnum("estado_equipo", ["operativo", "en_reparacion", "de_baja"]);

export const tipoEquipoEnum = pgEnum("tipo_equipo", [
  "laptop",
  "proyector",
  "cable_hdmi",
  "extension",
  "cargador_laptop",
  "enchufe_proyector",
  "mochila",
  "otro",
]);

export const equipos = pgTable("equipos", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 40 }).notNull().unique(),
  tipo: tipoEquipoEnum("tipo").default("otro").notNull(),
  nombre: varchar("nombre", { length: 150 }).notNull(), // descripción: marca / modelo
  serie: varchar("serie", { length: 80 }), // n.° de serie
  sedeId: integer("sede_id").references(() => sedes.id, { onDelete: "set null" }), // null = equipo itinerante
  estado: estadoEquipoEnum("estado").default("operativo").notNull(),
  observacion: varchar("observacion", { length: 300 }),
  creadoEn: creadoEn(),
});

/** Revisión de un equipo después de cada sesión en que se usó: uso, chequeos y resultado. */
export const revisionesEquipo = pgTable(
  "revisiones_equipo",
  {
    id: serial("id").primaryKey(),
    equipoId: integer("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "cascade" }),
    programacionId: integer("programacion_id").references(() => programaciones.id, { onDelete: "set null" }),
    fecha: date("fecha", { mode: "string" }).notNull(),
    usado: boolean("usado").default(true).notNull(),
    horasUso: numeric("horas_uso", { precision: 5, scale: 1 }),
    chequeos: jsonb("chequeos").$type<Record<string, boolean>>().default({}).notNull(), // punto → ¿OK?
    resultado: varchar("resultado", { length: 20 }).notNull(), // ok | falla | correccion | no_devuelto
    observacion: varchar("observacion", { length: 300 }),
    revisadoPor: varchar("revisado_por", { length: 150 }),
    creadoEn: creadoEn(),
  },
  (t) => [index("revisiones_equipo_idx").on(t.equipoId)],
);

/* ───────────── Logística: inventario de materiales e insumos ───────────── */

export const categoriaInsumoEnum = pgEnum("categoria_insumo", ["material", "refrigerio"]);
export const tipoMovimientoEnum = pgEnum("tipo_movimiento", ["entrada", "salida", "ajuste"]);

export const insumos = pgTable("insumos", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 120 }).notNull().unique(),
  categoria: categoriaInsumoEnum("categoria").notNull(),
  unidad: varchar("unidad", { length: 40 }).default("unidades").notNull(),
  stock: integer("stock").default(0).notNull(),
  stockMinimo: integer("stock_minimo").default(0).notNull(), // alerta cuando el stock baja de aquí
  activo: boolean("activo").default(true).notNull(),
  creadoEn: creadoEn(),
});

export const movimientosInsumo = pgTable(
  "movimientos_insumo",
  {
    id: serial("id").primaryKey(),
    insumoId: integer("insumo_id")
      .notNull()
      .references(() => insumos.id, { onDelete: "cascade" }),
    tipo: tipoMovimientoEnum("tipo").notNull(),
    cantidad: integer("cantidad").notNull(), // entrada/salida: positiva · ajuste: stock final contado
    stockResultante: integer("stock_resultante").notNull(),
    programacionId: integer("programacion_id").references(() => programaciones.id, { onDelete: "set null" }),
    motivo: varchar("motivo", { length: 200 }),
    creadoEn: creadoEn(),
  },
  (t) => [index("movimientos_insumo_idx").on(t.insumoId)],
);

/* ───────────── Acciones correctivas (mejora continua) ───────────── */

export const origenAccionEnum = pgEnum("origen_accion", [
  "indicador",
  "supervision",
  "queja",
  "auditoria",
  "otro",
]);
export const prioridadEnum = pgEnum("prioridad", ["alta", "media", "baja"]);
export const estadoAccionEnum = pgEnum("estado_accion", ["abierta", "en_proceso", "cerrada"]);

export const accionesCorrectivas = pgTable(
  "acciones_correctivas",
  {
    id: serial("id").primaryKey(),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    problema: text("problema").notNull(), // qué se detectó
    causa: text("causa"), // análisis de causa
    accion: text("accion").notNull(), // qué se hará
    origen: origenAccionEnum("origen").default("indicador").notNull(),
    indicador: varchar("indicador", { length: 120 }), // indicador que la originó (si aplica)
    sedeId: integer("sede_id").references(() => sedes.id, { onDelete: "set null" }),
    componenteId: integer("componente_id").references(() => componentes.id, { onDelete: "set null" }),
    responsable: varchar("responsable", { length: 150 }).notNull(),
    prioridad: prioridadEnum("prioridad").default("media").notNull(),
    estado: estadoAccionEnum("estado").default("abierta").notNull(),
    fechaDeteccion: date("fecha_deteccion", { mode: "string" }).notNull(),
    fechaLimite: date("fecha_limite", { mode: "string" }).notNull(),
    fechaCierre: date("fecha_cierre", { mode: "string" }),
    resultado: text("resultado"), // verificación de eficacia al cerrar
    creadoEn: creadoEn(),
  },
  (t) => [index("acciones_estado_idx").on(t.estado)],
);

/* ───────────── Relaciones (para consultas con `with`) ───────────── */

export const estructurasRel = relations(estructuras, ({ many }) => ({ componentes: many(componentes) }));
export const componentesRel = relations(componentes, ({ one, many }) => ({
  estructura: one(estructuras, { fields: [componentes.estructuraId], references: [estructuras.id] }),
  actividades: many(actividades),
}));
export const actividadesRel = relations(actividades, ({ one, many }) => ({
  componente: one(componentes, { fields: [actividades.componenteId], references: [componentes.id] }),
  modulos: many(modulos),
}));
export const modulosRel = relations(modulos, ({ one, many }) => ({
  actividad: one(actividades, { fields: [modulos.actividadId], references: [actividades.id] }),
  sesiones: many(sesiones),
}));
export const sesionesRel = relations(sesiones, ({ one, many }) => ({
  modulo: one(modulos, { fields: [sesiones.moduloId], references: [modulos.id] }),
  programaciones: many(programaciones),
  documentos: many(documentos),
}));
export const programacionesRel = relations(programaciones, ({ one, many }) => ({
  sesion: one(sesiones, { fields: [programaciones.sesionId], references: [sesiones.id] }),
  sede: one(sedes, { fields: [programaciones.sedeId], references: [sedes.id] }),
  capacitador: one(capacitadores, {
    fields: [programaciones.capacitadorId],
    references: [capacitadores.id],
  }),
  asistente: one(personal, { fields: [programaciones.asistenteId], references: [personal.id] }),
  preparacion: one(preparaciones, { fields: [programaciones.id], references: [preparaciones.programacionId] }),
  fichaItems: many(fichaItems),
  inscripciones: many(inscripciones),
  asistencias: many(asistencias),
  combinadas: many(programacionSesiones),
}));
export const inscripcionesRel = relations(inscripciones, ({ one }) => ({
  programacion: one(programaciones, {
    fields: [inscripciones.programacionId],
    references: [programaciones.id],
  }),
  participante: one(participantes, {
    fields: [inscripciones.participanteId],
    references: [participantes.id],
  }),
}));
export const accionesRel = relations(accionesCorrectivas, ({ one }) => ({
  sede: one(sedes, { fields: [accionesCorrectivas.sedeId], references: [sedes.id] }),
  componente: one(componentes, { fields: [accionesCorrectivas.componenteId], references: [componentes.id] }),
}));
export const programacionSesionesRel = relations(programacionSesiones, ({ one }) => ({
  programacion: one(programaciones, { fields: [programacionSesiones.programacionId], references: [programaciones.id] }),
  sesion: one(sesiones, { fields: [programacionSesiones.sesionId], references: [sesiones.id] }),
}));
export const preparacionesRel = relations(preparaciones, ({ one }) => ({
  programacion: one(programaciones, { fields: [preparaciones.programacionId], references: [programaciones.id] }),
}));
export const fichaItemsRel = relations(fichaItems, ({ one }) => ({
  programacion: one(programaciones, { fields: [fichaItems.programacionId], references: [programaciones.id] }),
  insumo: one(insumos, { fields: [fichaItems.insumoId], references: [insumos.id] }),
  equipo: one(equipos, { fields: [fichaItems.equipoId], references: [equipos.id] }),
}));
export const documentosRel = relations(documentos, ({ one }) => ({
  sesion: one(sesiones, { fields: [documentos.sesionId], references: [sesiones.id] }),
  programacion: one(programaciones, { fields: [documentos.programacionId], references: [programaciones.id] }),
}));
export const revisionesEquipoRel = relations(revisionesEquipo, ({ one }) => ({
  equipo: one(equipos, { fields: [revisionesEquipo.equipoId], references: [equipos.id] }),
  programacion: one(programaciones, { fields: [revisionesEquipo.programacionId], references: [programaciones.id] }),
}));
export const equiposRel = relations(equipos, ({ one, many }) => ({
  revisiones: many(revisionesEquipo),
  sede: one(sedes, { fields: [equipos.sedeId], references: [sedes.id] }),
}));
export const insumosRel = relations(insumos, ({ many }) => ({ movimientos: many(movimientosInsumo) }));
export const movimientosInsumoRel = relations(movimientosInsumo, ({ one }) => ({
  insumo: one(insumos, { fields: [movimientosInsumo.insumoId], references: [insumos.id] }),
  programacion: one(programaciones, { fields: [movimientosInsumo.programacionId], references: [programaciones.id] }),
}));
export const asistenciasRel = relations(asistencias, ({ one }) => ({
  programacion: one(programaciones, {
    fields: [asistencias.programacionId],
    references: [programaciones.id],
  }),
  participante: one(participantes, {
    fields: [asistencias.participanteId],
    references: [participantes.id],
  }),
}));

/* ───────────── Tipos útiles ───────────── */
export type EstadoProg = (typeof estadoProgramacionEnum.enumValues)[number];
export type EstadoAsis = (typeof estadoAsistenciaEnum.enumValues)[number];
export type Turno = (typeof turnoEnum.enumValues)[number];
export type Modalidad = (typeof modalidadEnum.enumValues)[number];
export type EstadoAccion = (typeof estadoAccionEnum.enumValues)[number];
export type Prioridad = (typeof prioridadEnum.enumValues)[number];
export type OrigenAccion = (typeof origenAccionEnum.enumValues)[number];
export type Rol = (typeof rolEnum.enumValues)[number];
export type CategoriaFicha = (typeof categoriaFichaEnum.enumValues)[number];
export type TipoDocumento = (typeof tipoDocumentoEnum.enumValues)[number];
export type EstadoEquipo = (typeof estadoEquipoEnum.enumValues)[number];
export type TipoEquipo = (typeof tipoEquipoEnum.enumValues)[number];
export type CategoriaInsumo = (typeof categoriaInsumoEnum.enumValues)[number];

export type RolUsuario = (typeof rolUsuarioEnum.enumValues)[number];
