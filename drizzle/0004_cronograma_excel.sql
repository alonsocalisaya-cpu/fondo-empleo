ALTER TABLE "programaciones" ADD COLUMN "observacion" varchar(300);--> statement-breakpoint
ALTER TABLE "programaciones" ADD COLUMN "codigo_externo" varchar(40);--> statement-breakpoint
ALTER TABLE "programaciones" ADD CONSTRAINT "programaciones_codigo_externo_unique" UNIQUE("codigo_externo");