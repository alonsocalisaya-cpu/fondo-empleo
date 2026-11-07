CREATE TABLE "historial_planes_mejora" (
 "id" serial PRIMARY KEY,
 "participante_id" integer NOT NULL REFERENCES "participantes"("id") ON DELETE RESTRICT,
 "revision" integer NOT NULL,
 "usuario_id" integer NOT NULL REFERENCES "usuarios"("id") ON DELETE RESTRICT,
 "autor" text NOT NULL,
 "antes" jsonb NOT NULL,
 "despues" jsonb NOT NULL,
 "cambios" jsonb NOT NULL,
 "creado_en" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "historial_planes_revision_unique" UNIQUE ("participante_id", "revision")
);
