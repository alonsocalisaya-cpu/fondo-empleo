ALTER TABLE sedes ADD COLUMN estructura_id integer REFERENCES estructuras(id) ON DELETE RESTRICT;
UPDATE sedes SET estructura_id = (SELECT id FROM estructuras WHERE nombre = 'Arequipa') WHERE estructura_id IS NULL;
ALTER TABLE sedes ALTER COLUMN estructura_id SET NOT NULL;
ALTER TABLE sedes DROP CONSTRAINT IF EXISTS sedes_nombre_unique;
CREATE UNIQUE INDEX sedes_estructura_nombre_unique ON sedes(estructura_id,nombre);
CREATE TABLE sede_horarios (
 id serial PRIMARY KEY,
 sede_id integer NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
 nombre varchar(80) NOT NULL,
 hora_inicio time NOT NULL,
 hora_fin time NOT NULL,
 CONSTRAINT sede_horarios_orden CHECK(hora_fin > hora_inicio)
);
CREATE UNIQUE INDEX sede_horarios_sede_nombre_unique ON sede_horarios(sede_id,nombre);
