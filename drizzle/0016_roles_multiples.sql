CREATE TABLE "permisos_rol" (
	"rol" "rol_usuario" NOT NULL,
	"modulo" varchar(30) NOT NULL,
	"nivel" varchar(10) NOT NULL,
	CONSTRAINT "permisos_rol_rol_modulo_pk" PRIMARY KEY("rol","modulo")
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "roles" "rol_usuario"[] DEFAULT '{}'::rol_usuario[] NOT NULL;--> statement-breakpoint
UPDATE "usuarios" SET "roles" = ARRAY["rol"] WHERE cardinality("roles") = 0;
