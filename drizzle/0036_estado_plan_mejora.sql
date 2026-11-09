ALTER TABLE participantes ADD COLUMN estado_plan_mejora varchar(40) NOT NULL DEFAULT 'sin_evaluacion';
ALTER TABLE participantes ADD CONSTRAINT participantes_estado_plan_mejora_check CHECK (estado_plan_mejora IN ('sin_evaluacion','viable','viable_ajustes','reformular'));
