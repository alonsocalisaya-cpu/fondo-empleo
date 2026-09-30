CREATE TYPE "public"."rol_usuario" AS ENUM('admin', 'jefe_proyecto', 'jefe_comercial', 'asistente', 'capacitador', 'gestion_documental', 'administradora', 'rrhh');--> statement-breakpoint
CREATE TABLE "sesiones_usuario" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"expira" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario" varchar(150) NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"rol" "rol_usuario" NOT NULL,
	"clave_hash" varchar(200) NOT NULL,
	"personal_id" integer,
	"capacitador_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"debe_cambiar_clave" boolean DEFAULT true NOT NULL,
	"ultimo_ingreso" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_usuario_unique" UNIQUE("usuario")
);
--> statement-breakpoint
ALTER TABLE "sesiones_usuario" ADD CONSTRAINT "sesiones_usuario_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_personal_id_personal_id_fk" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_capacitador_id_capacitadores_id_fk" FOREIGN KEY ("capacitador_id") REFERENCES "public"."capacitadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones_usuario" USING btree ("usuario_id");