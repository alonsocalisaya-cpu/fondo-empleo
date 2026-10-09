import { test } from "node:test";
import assert from "node:assert/strict";
import { leerRecursos, leerEquipos } from "./recursos-sesion";
import { estadoPaso, PASO, type ContextoFlujo } from "./flujo-pre";

function solicitud(recursos: [string, string, string][]) {
  const f = new FormData();
  for (const [nombre, cantidad, unidad] of recursos) {
    f.append("recursoDescripcion", nombre);
    f.append("recursoCantidad", cantidad);
    f.append("recursoUnidad", unidad);
  }
  return f;
}

test("acepta los recursos obligatorios junto con materiales adicionales", () => {
  const r = leerRecursos(solicitud([["Gaseosas", "12", "botella"], ["Galletas", "24", "paquete"], ["Papelotes", "3", "unidad"]]));
  assert.equal(r.error, undefined);
  assert.equal(r.recursos.length, 3);
  assert.equal(r.recursos[2].cantidad, 3);
});

test("rechaza solicitudes sin uno de los recursos obligatorios o con cantidades inválidas", () => {
  assert.ok(leerRecursos(solicitud([["Galletas", "24", "paquete"]])).error);
  assert.ok(leerRecursos(solicitud([["Gaseosas", "0", "botella"], ["Galletas", "24", "paquete"]])).error);
  assert.ok(leerRecursos(solicitud([["Gaseosas", "1.5", "botella"], ["Galletas", "24", "paquete"]])).error);
  assert.ok(leerRecursos(new FormData()).error);
});

test("no necesito recursos permite continuar y descarta campos anteriores", () => {
  const f = solicitud([["Gaseosas", "0", ""], ["Galletas", "2", "paquete"]]);
  f.set("sinRecursos", "si");
  assert.deepEqual(leerRecursos(f), { recursos: [] });
});

test("guarda detalles opcionales por fila y permite omitirlos", () => {
  const f = solicitud([["Gaseosas", "2", "unidad"], ["Galletas", "3", "unidad"]]);
  f.append("recursoDetalle", "Botellas de 3 litros");
  f.append("recursoDetalle", "");
  assert.equal(leerRecursos(f).recursos[0].detalle, "Botellas de 3 litros");
  assert.equal(leerRecursos(f).recursos[1].detalle, undefined);
  f.append("equipoDescripcion", "Laptop");
  f.append("equipoCantidad", "1");
  f.append("equipoDetalle", "Con conexión HDMI");
  assert.equal(leerEquipos(f).equipos[0].detalle, "Con conexión HDMI");
});

test("permite solicitar equipos sin refrigerio y descarta equipos con cero unidades", () => {
  const f = new FormData();
  f.set("sinRecursos", "si");
  f.append("equipoDescripcion", "Laptop");
  f.append("equipoCantidad", "1");
  f.append("equipoDescripcion", "Proyector");
  f.append("equipoCantidad", "0");
  assert.deepEqual(leerRecursos(f).recursos, []);
  assert.deepEqual(leerEquipos(f).equipos, [{ descripcion: "Laptop", cantidad: 1, unidad: "unidad" }]);
  f.set("equipoCantidad", "-1");
  assert.ok(leerEquipos(f).error);
});

test("la salida requiere revisión documental, programa de viaje y conformidad del asistente", () => {
  const ctx: ContextoFlujo = { pasos: { validar_programacion: { en: "2026-10-09" } }, examen: null, fueraDeArequipa: false };
  assert.equal(estadoPaso("imprimir_ficha", ctx), "disponible");
  assert.equal(estadoPaso("solicitar_recursos", ctx), "bloqueado");
  ctx.pasos.imprimir_ficha = { en: "2026-10-09", listaImpresa: true };
  assert.equal(estadoPaso("solicitar_recursos", ctx), "disponible");
  ctx.pasos.solicitar_recursos = { en: "2026-10-09" };
  assert.equal(estadoPaso("revisar_recursos", ctx), "disponible");
  assert.equal(PASO.revisar_recursos.rol, "gestion_documental");
  assert.equal(estadoPaso("aprobar_preparacion", ctx), "bloqueado");
  ctx.pasos.revisar_recursos = { en: "2026-10-09", aprobado: true, coordinadoAsistente: true };
  assert.equal(estadoPaso("programa_viaje", ctx), "disponible");
  ctx.pasos.programa_viaje = { en: "2026-10-09", corresponde: false };
  assert.equal(estadoPaso("aprobar_preparacion", ctx), "disponible");
  assert.equal(PASO.aprobar_preparacion.rol, "gestion_documental");
  ctx.pasos.guardar_material = { en: "2026-10-09" };
  assert.equal(estadoPaso("lista", ctx), "bloqueado");
  ctx.pasos.aprobar_preparacion = { en: "2026-10-09", conforme: true };
  assert.equal(estadoPaso("lista", ctx), "disponible");
});
