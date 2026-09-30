CREATE TABLE "revisiones_equipo" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipo_id" integer NOT NULL,
	"programacion_id" integer,
	"fecha" date NOT NULL,
	"usado" boolean DEFAULT true NOT NULL,
	"horas_uso" numeric(5, 1),
	"chequeos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resultado" varchar(20) NOT NULL,
	"observacion" varchar(300),
	"revisado_por" varchar(150),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "revisiones_equipo" ADD CONSTRAINT "revisiones_equipo_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisiones_equipo" ADD CONSTRAINT "revisiones_equipo_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "revisiones_equipo_idx" ON "revisiones_equipo" USING btree ("equipo_id");