import { test } from "node:test";
import assert from "node:assert/strict";
import { enlaceEntregables, type FiltrosEntregables } from "./navegacion-entregables";

test("abrir entregables conserva sede, fechas, proyecto y el filtro de sesión original", () => {
  const filtros: FiltrosEntregables = { proyecto: 1, vista: "sede", sede: 5, desde: "2026-10-01", hasta: "2026-10-31", sesion: 0 };
  const detalle = new URL(enlaceEntregables(filtros, { sesion: 12, programacion: 46 }), "http://localhost");
  assert.equal(detalle.searchParams.get("sede"), "5");
  assert.equal(detalle.searchParams.get("desde"), "2026-10-01");
  assert.equal(detalle.searchParams.get("hasta"), "2026-10-31");
  assert.equal(detalle.searchParams.get("vista"), "sede");
  assert.equal(detalle.searchParams.get("sesionFiltro"), "0");
  const regreso = new URL(enlaceEntregables(filtros), "http://localhost");
  assert.equal(regreso.searchParams.has("programacion"), false);
  assert.equal(regreso.searchParams.has("sesion"), false);
  assert.equal(regreso.searchParams.get("sede"), "5");
});

test("la vista por componente recupera la sesión que estaba filtrada", () => {
  const filtros: FiltrosEntregables = { proyecto: 1, vista: "componentes", sede: 0, desde: "", hasta: "", sesion: 8 };
  const regreso = new URL(enlaceEntregables(filtros), "http://localhost");
  assert.equal(regreso.searchParams.get("sesion"), "8");
  const detalle = new URL(enlaceEntregables(filtros, { sesion: 8, programacion: 15 }), "http://localhost");
  assert.equal(detalle.searchParams.get("sesionFiltro"), "8");
});
