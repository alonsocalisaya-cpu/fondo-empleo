CREATE TABLE "programacion_sesiones" (
	"id" serial PRIMARY KEY NOT NULL,
	"programacion_id" integer NOT NULL,
	"sesion_id" integer NOT NULL,
	"orden" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "programacion_sesiones" ADD CONSTRAINT "programacion_sesiones_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programacion_sesiones" ADD CONSTRAINT "programacion_sesiones_sesion_id_sesiones_id_fk" FOREIGN KEY ("sesion_id") REFERENCES "public"."sesiones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "programacion_sesiones_unica" ON "programacion_sesiones" USING btree ("programacion_id","sesion_id");