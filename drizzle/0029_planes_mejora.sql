CREATE TABLE "planes_mejora_versiones" (
 "id" serial PRIMARY KEY,
 "participante_id" integer NOT NULL REFERENCES "participantes"("id") ON DELETE RESTRICT,
 "numero" integer NOT NULL,
 "cambios" text NOT NULL,
 "problemas" jsonb NOT NULL,
 "archivos" jsonb NOT NULL,
 "autor_id" integer NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
 "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "planes_mejora_version_unique" UNIQUE ("participante_id", "numero")
);
