import { test } from "node:test";
import assert from "node:assert/strict";
import { puede, puedeRegistrarPaso, puedeReabrirAsistencia, moduloDe, puedeAbrir, modulosDe } from "./permisos";

test("capacitador y asistente editan operaciones y actividades del asistente", () => {
  for (const rol of ["capacitador", "asistente"] as const) {
    for (const ruta of ["/operativo/capacitaciones", "/operativo/seguimiento-asistencia", "/operativo/seguimiento-examenes"]) {
      assert.equal(moduloDe(ruta), "capacitaciones");
      assert.equal(puede([rol], "capacitaciones", "editar"), true);
    }
    assert.equal(puedeRegistrarPaso([rol], ["asistente"]), true);
    assert.equal(puedeRegistrarPaso([rol], ["gestion_documental"]), false);
    assert.equal(puedeRegistrarPaso([rol], ["jefe_proyecto"]), false);
    assert.equal(puedeReabrirAsistencia([rol]), false);
  }
});

test("Soporte solo está disponible para administrador y Gestión Documental", () => {
  const modulos = ["logistica", "sedes", "mantenimiento", "documental"] as const;
  for (const roles of [["asistente"], ["capacitador"], ["asistente", "capacitador"], ["jefe_proyecto"], ["administradora"]] as const) {
    for (const m of modulos) { assert.equal(puede(roles, m), false); assert.equal(modulosDe(roles).includes(m), false); }
    for (const ruta of ["/soporte", "/soporte/logistica", "/soporte/gestion-documental", "/soporte/sedes", "/soporte/mantenimiento"]) assert.equal(puedeAbrir(roles, ruta), false);
    assert.equal(puede(roles, "capacitaciones", "editar"), true);
  }
  for (const rol of ["admin", "gestion_documental"] as const) for (const m of modulos) assert.equal(puede([rol], m, "editar"), true);
});
