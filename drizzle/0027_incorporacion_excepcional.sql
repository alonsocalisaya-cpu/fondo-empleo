CREATE TABLE "incorporaciones_excepcionales" (
	"id" serial PRIMARY KEY NOT NULL,
	"destino_programacion_id" integer NOT NULL,
	"origen_programacion_id" integer NOT NULL,
	"participante_id" integer NOT NULL,
	"motivo" varchar(300) NOT NULL,
	"registrado_por" varchar(150) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incorporaciones_excepcionales" ADD CONSTRAINT "incorporaciones_excepcionales_destino_programacion_id_programaciones_id_fk" FOREIGN KEY ("destino_programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incorporaciones_excepcionales" ADD CONSTRAINT "incorporaciones_excepcionales_origen_programacion_id_programaciones_id_fk" FOREIGN KEY ("origen_programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incorporaciones_excepcionales" ADD CONSTRAINT "incorporaciones_excepcionales_participante_id_participantes_id_fk" FOREIGN KEY ("participante_id") REFERENCES "public"."participantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "incorporaciones_excepcionales_destino_participante" ON "incorporaciones_excepcionales" USING btree ("destino_programacion_id","participante_id");--> statement-breakpoint
CREATE INDEX "incorporaciones_excepcionales_origen_idx" ON "incorporaciones_excepcionales" USING btree ("origen_programacion_id");--> statement-breakpoint
CREATE INDEX "incorporaciones_excepcionales_fecha_idx" ON "incorporaciones_excepcionales" USING btree ("destino_programacion_id","origen_programacion_id");