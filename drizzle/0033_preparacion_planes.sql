ALTER TABLE "planes_mejora_versiones" ADD COLUMN "estado" varchar(20) DEFAULT 'publicada' NOT NULL;
--> statement-breakpoint
ALTER TABLE "planes_mejora_versiones" ADD COLUMN "edicion" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "planes_mejora_versiones" ADD COLUMN "publicado_en" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "planes_mejora_versiones" ADD COLUMN "actualizado_en" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "planes_mejora_versiones" ADD CONSTRAINT "planes_estado_valido" CHECK ("estado" IN ('preparacion','publicada'));
--> statement-breakpoint
CREATE UNIQUE INDEX "planes_una_preparacion" ON "planes_mejora_versiones" ("participante_id") WHERE "estado" = 'preparacion';
