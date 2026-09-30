CREATE TABLE "avisos" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"programacion_id" integer,
	"origen" varchar(40),
	"titulo" varchar(200) NOT NULL,
	"mensaje" text,
	"href" varchar(300),
	"de" varchar(200),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"leido_en" timestamp with time zone,
	"confirmado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avisos_usuario_idx" ON "avisos" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "avisos_prog_idx" ON "avisos" USING btree ("programacion_id");