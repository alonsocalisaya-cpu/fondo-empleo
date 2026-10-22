CREATE TABLE "historial_beneficiarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"participante_id" integer NOT NULL,
	"sede_anterior" varchar(120),
	"sede_nueva" varchar(120),
	"turno_anterior" varchar(10),
	"turno_nuevo" varchar(10) NOT NULL,
	"usuario_id" integer NOT NULL,
	"registrado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "historial_beneficiarios" ADD CONSTRAINT "historial_beneficiarios_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "historial_beneficiarios_participante_idx" ON "historial_beneficiarios" USING btree ("participante_id");