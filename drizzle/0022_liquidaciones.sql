CREATE TABLE IF NOT EXISTS "liquidaciones" (
	"programacion_id" integer PRIMARY KEY NOT NULL,
	"datos" jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" varchar(200)
);
--> statement-breakpoint
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;
