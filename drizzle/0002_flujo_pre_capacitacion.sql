CREATE TYPE "public"."categoria_ficha" AS ENUM('material_capacitador', 'dinamica', 'refrigerio', 'tecnologico');--> statement-breakpoint
CREATE TYPE "public"."estado_equipo" AS ENUM('operativo', 'en_reparacion', 'de_baja');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('jefe_comercial', 'jefe_proyecto', 'asistente', 'gestion_documental', 'administradora', 'rrhh');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('diapositiva', 'taller', 'examen_entrada', 'examen_salida', 'ficha', 'otro');--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"sesion_id" integer,
	"tipo" "tipo_documento" NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"version" varchar(20),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipos" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"sede_id" integer,
	"estado" "estado_equipo" DEFAULT 'operativo' NOT NULL,
	"observacion" varchar(300),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "ficha_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"programacion_id" integer NOT NULL,
	"categoria" "categoria_ficha" NOT NULL,
	"descripcion" varchar(200) NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"listo" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombres" varchar(100) NOT NULL,
	"apellidos" varchar(100) NOT NULL,
	"rol" "rol" NOT NULL,
	"dni" varchar(15),
	"email" varchar(150),
	"telefono" varchar(30),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE "preparaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"programacion_id" integer NOT NULL,
	"pasos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preparaciones_programacion_id_unique" UNIQUE("programacion_id")
);
--> statement-breakpoint
ALTER TABLE "programaciones" ADD COLUMN "asistente_id" integer;--> statement-breakpoint
ALTER TABLE "sedes" ADD COLUMN "fuera_de_arequipa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sedes" ADD COLUMN "contacto" varchar(150);--> statement-breakpoint
ALTER TABLE "sedes" ADD COLUMN "telefono" varchar(30);--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_items" ADD CONSTRAINT "ficha_items_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparaciones" ADD CONSTRAINT "preparaciones_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_sesion_idx" ON "documentos" USING btree ("sesion_id");--> statement-breakpoint
CREATE INDEX "ficha_items_prog_idx" ON "ficha_items" USING btree ("programacion_id");--> statement-breakpoint
ALTER TABLE "programaciones" ADD CONSTRAINT "programaciones_asistente_id_personal_id_fk" FOREIGN KEY ("asistente_id") REFERENCES "public"."personal"("id") ON DELETE set null ON UPDATE no action;