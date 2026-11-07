ALTER TABLE "participantes" ADD COLUMN "plan_mejora" jsonb;
--> statement-breakpoint
ALTER TABLE "participantes" ADD COLUMN "plan_revision" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "planes_mejora_versiones" ADD COLUMN "plan" jsonb;
