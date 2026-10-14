import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadoExamen, promedioNotas, resumenRegistroNotas } from "./seguimiento-examenes";

test("una nota cero se muestra y participa en el promedio; las faltantes no", () => {
  assert.deepEqual(resultadoExamen({ nota: 0, estado: "presente", inscrito: true, pendiente: false }), { estado: "registrada", nota: 0 });
  assert.equal(promedioNotas([0, 20, null, undefined]), 10);
  assert.equal(promedioNotas([null, undefined]), null);
});
test("diferencia exámenes futuros, no rendidos, no inscritos y no ejecutados", () => {
  assert.equal(resultadoExamen({ inscrito: true, pendiente: true }).estado, "pendiente");
  assert.equal(resultadoExamen({ inscrito: true, pendiente: false, estado: "ausente" }).estado, "no_rindio");
  assert.equal(resultadoExamen({ inscrito: true, pendiente: false, estado: "justificado" }).estado, "no_rindio");
  assert.equal(resultadoExamen({ inscrito: false, pendiente: false }).estado, "no_inscrito");
  assert.equal(resultadoExamen({ inscrito: true, pendiente: false, realizada: false }).estado, "no_realizada");
  assert.equal(resultadoExamen({ inscrito: true, pendiente: false, estado: "presente" }).estado, "sin_nota");
});

test("compara asistentes con personas con notas y exige ambas cuando corresponde", () => {
  const a = { presentes: 20, tardanzas: 3, conNotaEntrada: 22, conNotaSalida: 21, conAmbasNotas: 20 };
  assert.equal(resumenRegistroNotas(a, "entrada").asistentes, 23);
  assert.equal(resumenRegistroNotas(a, "entrada").diferencia, 1);
  assert.equal(resumenRegistroNotas(a, "salida").diferencia, 2);
  assert.equal(resumenRegistroNotas(a, "ambos").conNotas, 20);
  assert.equal(resumenRegistroNotas(a, "ambos").diferencia, 3);
  assert.equal(resumenRegistroNotas({ ...a, conAmbasNotas: 23 }, "ambos").diferencia, 0);
});
