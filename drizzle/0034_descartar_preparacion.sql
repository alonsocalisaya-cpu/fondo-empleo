ALTER TABLE "planes_mejora_versiones" DROP CONSTRAINT "planes_estado_valido";
--> statement-breakpoint
ALTER TABLE "planes_mejora_versiones" ADD CONSTRAINT "planes_estado_valido" CHECK ("estado" IN ('preparacion','publicada','descartada'));
