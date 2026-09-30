ALTER TABLE "participantes" ADD COLUMN "sede_id" integer;--> statement-breakpoint
ALTER TABLE "participantes" ADD COLUMN "turno" varchar(10);--> statement-breakpoint
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_sede_id_sedes_id_fk" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE set null ON UPDATE no action;