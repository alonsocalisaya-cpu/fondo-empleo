CREATE TABLE "eventos_versiones_plan" (
 "id" serial PRIMARY KEY,
 "participante_id" integer NOT NULL REFERENCES "participantes"("id") ON DELETE RESTRICT,
 "version_id" integer NOT NULL REFERENCES "planes_mejora_versiones"("id") ON DELETE RESTRICT,
 "usuario_id" integer NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
 "autor" text NOT NULL,
 "cambios" jsonb NOT NULL,
 "creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "eventos_versiones_participante_idx" ON "eventos_versiones_plan" ("participante_id");
