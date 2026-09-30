ALTER TABLE "documentos" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "archivo" varchar(300);--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "tamano" integer;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "programacion_id" integer;--> statement-breakpoint
ALTER TABLE "documentos" ADD COLUMN "subido_por" varchar(150);--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documentos_prog_idx" ON "documentos" USING btree ("programacion_id");