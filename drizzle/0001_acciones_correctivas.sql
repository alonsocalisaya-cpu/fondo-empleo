CREATE TYPE "public"."estado_accion" AS ENUM('abierta', 'en_proceso', 'cerrada');--> statement-breakpoint
CREATE TYPE "public"."origen_accion" AS ENUM('indicador', 'supervision', 'queja', 'auditoria', 'otro');--> statement-breakpoint
CREATE TYPE "public"."prioridad" AS ENUM('alta', 'media', 'baja');--> statement-breakpoint
CREATE TABLE "acciones_correctivas" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"problema" text NOT NULL,
	"causa" text,
	"accion" text NOT NULL,
	"origen" "origen_accion" DEFAULT 'indicador' NOT NULL,
	"indicador" varchar(120),
	"sede_id" integer,
	"componente_id" integer,
	"responsable" varchar(150) NOT NULL,
	"prioridad" "prioridad" DEFAULT 'media' NOT NULL,
	"estado" "estado_accion" DEFAULT 'abierta' NOT NULL,
	"fecha_deteccion" date NOT NULL,
	"fecha_limite" date NOT NULL,
	"fecha_cierre" date,
	"resultado" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acciones_correctivas" ADD CONSTRAINT "acciones_correctivas_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acciones_correctivas" ADD CONSTRAINT "acciones_correctivas_componente_id_componentes_id_fk" FOREIGN KEY ("componente_id") REFERENCES "public"."componentes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acciones_estado_idx" ON "acciones_correctivas" USING btree ("estado");