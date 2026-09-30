CREATE TABLE "estructuras" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"proyecto" text,
	"descripcion" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estructuras_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
INSERT INTO "estructuras" ("nombre", "proyecto", "orden") VALUES ('Arequipa', '“Fortalecimiento de las competencias emprendedoras y de gestión de negocios de emprendimientos del sector comercio de Arequipa”', 1) ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "componentes" ADD COLUMN "estructura_id" integer;--> statement-breakpoint
UPDATE "componentes" SET "estructura_id" = (SELECT "id" FROM "estructuras" WHERE "nombre" = 'Arequipa') WHERE "estructura_id" IS NULL;--> statement-breakpoint
ALTER TABLE "componentes" ALTER COLUMN "estructura_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "componentes" ADD CONSTRAINT "componentes_estructura_id_estructuras_id_fk" FOREIGN KEY ("estructura_id") REFERENCES "public"."estructuras"("id") ON DELETE restrict ON UPDATE no action;