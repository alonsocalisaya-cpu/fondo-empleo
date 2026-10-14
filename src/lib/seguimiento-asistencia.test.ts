import { test } from "node:test";
import assert from "node:assert/strict";
import { marcaSeguimiento, totalizarAsistencia } from "./seguimiento-asistencia";

test("conserva cada marca registrada, incluida una tardanza o justificación", () => {
  for (const estado of ["presente", "tarde", "justificado", "ausente"] as const) {
    assert.equal(marcaSeguimiento({ estado, inscrito: false, pendiente: true, cerrada: false }), estado);
  }
});
test("no cuenta futuras, no inscritos ni sesiones no ejecutadas como ausencias", () => {
  assert.equal(marcaSeguimiento({ inscrito: true, pendiente: true, cerrada: false }), "programada");
  assert.equal(marcaSeguimiento({ inscrito: false, pendiente: false, cerrada: true }), "no_inscrito");
  assert.equal(marcaSeguimiento({ inscrito: true, pendiente: false, cerrada: false, realizada: false }), "no_realizada");
});
test("un inscrito sin marca es ausente al terminar la sesión o cerrar la lista", () => {
  assert.equal(marcaSeguimiento({ inscrito: true, pendiente: false, cerrada: false }), "ausente");
  assert.equal(marcaSeguimiento({ inscrito: true, pendiente: true, cerrada: true }), "ausente");
});

test("el porcentaje total semanal se calcula sobre la suma, no promediando porcentajes", () => {
  assert.deepEqual(totalizarAsistencia([{ programados: 10, asistentes: 10 }, { programados: 90, asistentes: 45 }]), { programados: 100, asistentes: 55, porcentaje: 55 });
  assert.deepEqual(totalizarAsistencia([]), { programados: 0, asistentes: 0, porcentaje: null });
});
