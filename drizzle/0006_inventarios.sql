CREATE TYPE "public"."categoria_insumo" AS ENUM('material', 'refrigerio');--> statement-breakpoint
CREATE TYPE "public"."tipo_equipo" AS ENUM('laptop', 'proyector', 'cable_hdmi', 'extension', 'cargador_laptop', 'enchufe_proyector', 'mochila', 'otro');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('entrada', 'salida', 'ajuste');--> statement-breakpoint
CREATE TABLE "insumos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"categoria" "categoria_insumo" NOT NULL,
	"unidad" varchar(40) DEFAULT 'unidades' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "movimientos_insumo" (
	"id" serial PRIMARY KEY NOT NULL,
	"insumo_id" integer NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"cantidad" integer NOT NULL,
	"stock_resultante" integer NOT NULL,
	"programacion_id" integer,
	"motivo" varchar(200),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipos" ADD COLUMN "tipo" "tipo_equipo" DEFAULT 'otro' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipos" ADD COLUMN "serie" varchar(80);--> statement-breakpoint
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_insumo_id_insumos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_insumo" ADD CONSTRAINT "movimientos_insumo_programacion_id_programaciones_id_fk" FOREIGN KEY ("programacion_id") REFERENCES "public"."programaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimientos_insumo_idx" ON "movimientos_insumo" USING btree ("insumo_id");--> statement-breakpoint
INSERT INTO "insumos" ("nombre", "categoria", "unidad", "stock_minimo") VALUES
  ('Lapiceros', 'material', 'unidades', 50),
  ('Plumones', 'material', 'unidades', 20),
  ('Papelotes', 'material', 'unidades', 30),
  ('Papel kraft', 'material', 'pliegos', 10),
  ('Tableros', 'material', 'unidades', 10),
  ('Motas', 'material', 'unidades', 5),
  ('Galletas', 'refrigerio', 'paquetes', 50),
  ('Gaseosas', 'refrigerio', 'botellas', 30)
ON CONFLICT ("nombre") DO NOTHING;
