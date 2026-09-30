-- El refrigerio que asigna el asistente desde el inventario ya queda marcado como listo
UPDATE "ficha_items" SET "listo" = true WHERE "categoria" = 'refrigerio' AND "insumo_id" IS NOT NULL;
