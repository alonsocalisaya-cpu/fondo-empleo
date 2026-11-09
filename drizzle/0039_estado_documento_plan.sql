ALTER TABLE planes_mejora_versiones ADD COLUMN estado_documento varchar(20);
ALTER TABLE planes_mejora_versiones ADD CONSTRAINT planes_estado_documento_check CHECK (estado_documento IS NULL OR estado_documento IN ('completo','observado'));
