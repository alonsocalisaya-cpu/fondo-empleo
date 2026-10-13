import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { generarProgramaViaje, partesDocx } from "./programa-viaje-docx";
import { leerActividadesViaje } from "./actividades-viaje";

test("completa los campos sin alterar las demás partes de la plantilla Word", () => {
  const plantilla = readFileSync(path.join(process.cwd(), "plantillas/programa-viaje/Programa_viaje_formato.docx"));
  const salida = Buffer.from(generarProgramaViaje(plantilla, { consultor: "María & José <Consultor>", fecha: "2026-10-13", sede: "Paucarpata", proyecto: "FONDOEMPLEO AREQUIPA", actividades: [{ actividad: "Traslado", descripcion: "Salida a sede\nCon material", fecha: "2026-10-13", hora: "08:30" }, { actividad: "Capacitación", descripcion: "Desarrollo de la sesión", fecha: "2026-10-13", hora: "10:00" }] }));
  const originales = partesDocx(plantilla);
  const editados = partesDocx(salida);
  assert.equal(originales.length, editados.length);
  for (const original of originales) {
    const nuevo = editados.find((a) => a.nombre === original.nombre);
    assert.ok(nuevo);
    if (original.nombre !== "word/document.xml") assert.deepEqual(nuevo.datos, original.datos);
  }
  const documento = editados.find((a) => a.nombre === "word/document.xml")!.datos.toString("utf8");
  assert.ok(documento.includes("María &amp; José &lt;Consultor&gt;"));
  assert.ok(documento.includes("13/10/2026"));
  assert.ok(documento.includes("FONDOEMPLEO AREQUIPA"));
  assert.ok(documento.includes('xml:space="preserve">X</w:t>'));
  assert.ok(documento.includes("Traslado"));
  assert.ok(documento.includes("08:30"));
  assert.ok(documento.includes("Desarrollo de la sesión"));
  assert.ok(documento.includes("<w:br/>"));
  assert.equal((documento.match(/<w:tbl\b/g) ?? []).length, 3);
});

test("valida las filas del programa y el espacio máximo de la plantilla", () => {
  const fila = { actividad: "Traslado", descripcion: "Salida a sede", fecha: "2026-10-13", hora: "08:00" };
  assert.equal(leerActividadesViaje([fila]).error, undefined);
  assert.ok(leerActividadesViaje([]).error);
  assert.ok(leerActividadesViaje(Array.from({ length: 14 }, () => fila)).error);
  assert.ok(leerActividadesViaje([{ ...fila, fecha: "2026-02-30" }]).error);
  assert.ok(leerActividadesViaje([{ ...fila, hora: "25:00" }]).error);
  assert.ok(leerActividadesViaje([{ ...fila, descripcion: "" }]).error);
});

test("rechaza archivos que no sean una plantilla DOCX válida", () => {
  assert.throws(() => generarProgramaViaje(Buffer.alloc(30), { consultor: "Prueba", fecha: "2026-10-13", sede: "Sede", proyecto: "FONDOEMPLEO AREQUIPA" }));
});
