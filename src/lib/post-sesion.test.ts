import { test } from "node:test";
import assert from "node:assert/strict";
import { leerDatosPost, leerRetornos } from "./post-sesion";
import { estadoPaso, resumenFlujo, PASOS, type ContextoFlujo } from "./flujo-pre";

test("exige horarios e incidencias coherentes para una capacitación ejecutada", () => {
  const f = new FormData();
  f.set("capacitacionRealizada", "si");
  f.set("horarioProgramado", "no");
  f.set("hayIncidencias", "si");
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

test("el cierre exige aprobación después de los viáticos y permite entregables no aplicables", () => {
  const ctx: ContextoFlujo = { pasos: { datos_capacitacion: { en: "2026-10-13", realizada: false }, recursos_post: { en: "2026-10-13" } }, examen: null, fueraDeArequipa: false };
  assert.equal(PASOS.at(-1)?.clave, "aprobar_cierre");
  assert.equal(estadoPaso("aprobar_cierre", ctx), "bloqueado");
  ctx.pasos.rendir_viaticos = { en: "2026-10-13" };
  assert.equal(estadoPaso("aprobar_cierre", ctx), "disponible");
  assert.equal(resumenFlujo(ctx, "completo").cerrada, false);
  ctx.pasos.aprobar_cierre = { en: "2026-10-13", conforme: true };
  assert.equal(resumenFlujo(ctx, "completo").cerrada, true);
});

test("no ejecución exige motivo y omite horarios y entregables", () => {
  const f = new FormData();
  f.set("capacitacionRealizada", "no");
  assert.ok(leerDatosPost(f).error);
  f.set("incidencias", "Local cerrado");
  assert.equal(leerDatosPost(f).datos?.horaInicioReal, null);
  const ctx: ContextoFlujo = { pasos: { datos_capacitacion: { en: "2026-10-12", realizada: false }, recursos_post: { en: "2026-10-12" } }, examen: null, fueraDeArequipa: false };
  assert.equal(estadoPaso("escanear_subir", ctx), "no_aplica");
  assert.equal(estadoPaso("registrar_asistencia", ctx), "no_aplica");
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

test("las notas van después de la devolución y solo aplican a sesiones ejecutadas con examen", () => {
  const ctx: ContextoFlujo = { pasos: {}, examen: "ambos", fueraDeArequipa: false };
  assert.equal(estadoPaso("registrar_notas", ctx), "bloqueado");
  ctx.pasos.recursos_post = { en: "2026-10-14" };
  assert.equal(estadoPaso("registrar_notas", ctx), "disponible");
  assert.equal(estadoPaso("escanear_subir", ctx), "bloqueado");
  ctx.pasos.registrar_notas = { en: "2026-10-14" };
  assert.equal(estadoPaso("escanear_subir", ctx), "disponible");
  ctx.examen = null;
  assert.equal(estadoPaso("registrar_notas", ctx), "no_aplica");
  assert.equal(estadoPaso("escanear_subir", ctx), "disponible");
  ctx.examen = "entrada";
  ctx.pasos.datos_capacitacion = { en: "2026-10-14", realizada: false };
  assert.equal(estadoPaso("registrar_notas", ctx), "no_aplica");
});

test("sin examen no se habilitan entregables saltando los pasos anteriores", () => {
  const ctx: ContextoFlujo = { pasos: {}, examen: null, fueraDeArequipa: false };
  assert.equal(estadoPaso("registrar_notas", ctx), "no_aplica");
  assert.equal(estadoPaso("escanear_subir", ctx), "bloqueado");
  assert.deepEqual(resumenFlujo(ctx, "completo").pendientes.map((p) => p.clave), ["validar_programacion"]);
  ctx.pasos.recursos_post = { en: "2026-10-17" };
  assert.equal(estadoPaso("escanear_subir", ctx), "disponible");
});
