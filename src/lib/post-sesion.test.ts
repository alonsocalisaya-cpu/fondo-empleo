import { test } from "node:test";
import assert from "node:assert/strict";
import { leerDatosPost, leerRetornos } from "./post-sesion";
import { estadoPaso, type ContextoFlujo } from "./flujo-pre";

test("exige horarios e incidencias coherentes para una capacitación ejecutada", () => {
  const f = new FormData();
  f.set("capacitacionRealizada", "si");
  assert.ok(leerDatosPost(f).error);
  f.set("horaInicioReal", "09:00");
  f.set("horaFinReal", "11:00");
  f.append("tipoIncidencia", "Horario");
  assert.ok(leerDatosPost(f).error);
  f.set("incidencias", "Inicio con retraso");
  assert.equal(leerDatosPost(f).datos?.realizada, true);
  f.set("horaFinReal", "08:00");
  assert.ok(leerDatosPost(f).error);
});

test("no ejecución exige motivo y omite horarios y entregables", () => {
  const f = new FormData();
  f.set("capacitacionRealizada", "no");
  assert.ok(leerDatosPost(f).error);
  f.set("incidencias", "Local cerrado");
  assert.equal(leerDatosPost(f).datos?.horaInicioReal, null);
  const ctx: ContextoFlujo = { pasos: { datos_capacitacion: { en: "2026-10-12", realizada: false }, recursos_post: { en: "2026-10-12" } }, examen: null, fueraDeArequipa: false };
  assert.equal(estadoPaso("escanear_subir", ctx), "no_aplica");
  assert.equal(estadoPaso("rendir_viaticos", ctx), "disponible");
});

test("el retorno no puede superar los recursos llevados ni admitir valores negativos", () => {
  const grupos = [{ prefijo: "recurso", items: [{ descripcion: "Gaseosas", cantidad: 5, unidad: "unidad" }] }];
  const f = new FormData();
  assert.ok(leerRetornos(f, grupos).error);
  f.set("retorno-recurso-0", "6");
  assert.ok(leerRetornos(f, grupos).error);
  f.set("retorno-recurso-0", "-1");
  assert.ok(leerRetornos(f, grupos).error);
  f.set("retorno-recurso-0", "2");
  assert.equal(leerRetornos(f, grupos).retornos?.[0].retorno, 2);
});
