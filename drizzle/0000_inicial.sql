CREATE TYPE "public"."estado_asistencia" AS ENUM('presente', 'tarde', 'ausente', 'justificado');--> statement-breakpoint
CREATE TYPE "public"."estado_programacion" AS ENUM('programada', 'confirmada', 'reprogramada', 'cancelada', 'finalizada');--> statement-breakpoint
CREATE TYPE "public"."modalidad" AS ENUM('presencial', 'virtual', 'mixta');--> statement-breakpoint
CREATE TYPE "public"."turno" AS ENUM('manana', 'tarde', 'noche');--> statement-breakpoint
CREATE TABLE "actividades" (
	"id" serial PRIMARY KEY NOT NULL,
	"componente_id" integer NOT NULL,
	"codigo" varchar(30) NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"descripcion" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actividades_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "asistencias" (
	"id" serial PRIMARY KEY NOT NULL,
	"programacion_id" integer NOT NULL,
	"participante_id" integer NOT NULL,
	"estado" "estado_asistencia" NOT NULL,
	"hora_ingreso" time,
	"observacion" varchar(300),
	"registrado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capacitadores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombres" varchar(100) NOT NULL,
	"apellidos" varchar(100) NOT NULL,
	"dni" varchar(15),
	"email" varchar(150),
	"telefono" varchar(30),
	"especialidad" varchar(150),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacitadores_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE "componentes" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(30) NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"descripcion" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "componentes_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "inscripciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"programacion_id" integer NOT NULL,
	"participante_id" integer NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modulos" (
	"id" serial PRIMARY KEY NOT NULL,
	"actividad_id" integer NOT NULL,
	"codigo" varchar(30) NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"descripcion" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modulos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "participantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombres" varchar(100) NOT NULL,
	"apellidos" varchar(100) NOT NULL,
	"dni" varchar(15) NOT NULL,
	"email" varchar(150),
	"telefono" varchar(30),
	"area" varchar(120),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participantes_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE "programaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"sesion_id" integer NOT NULL,
	"sede_id" integer NOT NULL,
	"capacitador_id" integer,
	"fecha" date NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"turno" "turno" NOT NULL,
	"aula" varchar(80),
	"cupo" integer,
	"estado" "estado_programacion" DEFAULT 'programada' NOT NULL,
	"lista_cerrada" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sedes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"direccion" varchar(200),
	"distrito" varchar(100),
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sedes_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" serial PRIMARY KEY NOT NULL,
	"modulo_id" integer NOT NULL,
	"codigo" varchar(30) NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"objetivo" text,
	"duracion_min" integer DEFAULT 120 NOT NULL,
	"modalidad" "modalidad" DEFAULT 'presencial' NOT NULL,
	"asistencia_minima" integer DEFAULT 80 NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sesiones_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_componente_id_componentes_id_fk" FOREIGN KEY ("componente_id") REFERENCES "public"."componentes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asistencias" ADD CONSTRAINT "asistencias_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulos" ADD CONSTRAINT "modulos_actividad_id_actividades_id_fk" FOREIGN KEY ("actividad_id") REFERENCES "public"."actividades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programaciones" ADD CONSTRAINT "programaciones_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programaciones" ADD CONSTRAINT "programaciones_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programaciones" ADD CONSTRAINT "programaciones_capacitador_id_capacitadores_id_fk" FOREIGN KEY ("capacitador_id") REFERENCES "public"."capacitadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_modulo_id_modulos_id_fk" FOREIGN KEY ("modulo_id") REFERENCES "public"."modulos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actividades_componente_idx" ON "actividades" USING btree ("componente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asistencias_unica" ON "asistencias" USING btree ("programacion_id","participante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inscripciones_unica" ON "inscripciones" USING btree ("programacion_id","participante_id");--> statement-breakpoint
CREATE INDEX "modulos_actividad_idx" ON "modulos" USING btree ("actividad_id");--> statement-breakpoint
CREATE INDEX "programaciones_fecha_idx" ON "programaciones" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "programaciones_sede_idx" ON "programaciones" USING btree ("sede_id");--> statement-breakpoint
CREATE INDEX "programaciones_sesion_idx" ON "programaciones" USING btree ("sesion_id");--> statement-breakpoint
CREATE INDEX "programaciones_capacitador_idx" ON "programaciones" USING btree ("capacitador_id");--> statement-breakpoint
CREATE INDEX "sesiones_modulo_idx" ON "sesiones" USING btree ("modulo_id");