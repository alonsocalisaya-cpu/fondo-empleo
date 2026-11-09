ALTER TABLE participantes ADD COLUMN evaluacion_plan_mejora jsonb;
ALTER TABLE participantes ADD COLUMN evaluacion_plan_revision integer NOT NULL DEFAULT 0;
