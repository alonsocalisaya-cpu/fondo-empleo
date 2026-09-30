ALTER TABLE "usuarios" ALTER COLUMN "usuario" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ALTER COLUMN "clave_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "nombres" varchar(100);--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "apellidos" varchar(100);--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "dni" varchar(15);--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "email" varchar(150);--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "telefono" varchar(30);--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "especialidad" varchar(150);--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "acceso" boolean DEFAULT true NOT NULL;