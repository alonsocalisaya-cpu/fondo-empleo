ALTER TABLE sedes ADD COLUMN grupo varchar(36) NOT NULL DEFAULT gen_random_uuid()::text;
DO $$
DECLARE s record; h record; nuevo integer; primer boolean; turno_texto text;
BEGIN
 FOR s IN SELECT * FROM sedes WHERE id IN (SELECT sede_id FROM sede_horarios GROUP BY sede_id HAVING count(*) > 1) LOOP
  primer := true;
  FOR h IN SELECT * FROM sede_horarios WHERE sede_id=s.id ORDER BY hora_inicio LOOP
   turno_texto := CASE WHEN extract(hour FROM h.hora_inicio)<13 THEN 'manana' WHEN extract(hour FROM h.hora_inicio)<18 THEN 'tarde' ELSE 'noche' END;
   IF primer THEN
    nuevo := s.id;
    UPDATE sedes SET nombre=s.nombre || ' - Turno ' || h.nombre WHERE id=nuevo;
    primer := false;
   ELSE
    INSERT INTO sedes(estructura_id,nombre,direccion,distrito,fuera_de_arequipa,contacto,telefono,activa,grupo)
    VALUES(s.estructura_id,s.nombre || ' - Turno ' || h.nombre,s.direccion,s.distrito,s.fuera_de_arequipa,s.contacto,s.telefono,s.activa,s.grupo) RETURNING id INTO nuevo;
    UPDATE sede_horarios SET sede_id=nuevo WHERE id=h.id;
    UPDATE programaciones SET sede_id=nuevo WHERE sede_id=s.id AND turno::text=turno_texto;
    UPDATE participantes SET sede_id=nuevo WHERE sede_id=s.id AND turno=turno_texto;
   END IF;
  END LOOP;
 END LOOP;
 UPDATE sedes SET grupo=(SELECT grupo FROM sedes WHERE nombre='Paucarpata - Turno Mañana' AND estructura_id=sedes.estructura_id)
 WHERE nombre='Paucarpata virtual' AND EXISTS(SELECT 1 FROM sedes p WHERE p.nombre='Paucarpata - Turno Mañana' AND p.estructura_id=sedes.estructura_id);
END $$;
CREATE UNIQUE INDEX sede_horarios_un_horario_unique ON sede_horarios(sede_id);
