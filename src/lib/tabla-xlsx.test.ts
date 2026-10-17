import { test } from "node:test";
import assert from "node:assert/strict";
import { partesDocx } from "./programa-viaje-docx";
import { tablaXlsx, columnaExcel, type CeldaExcel } from "./tabla-xlsx";

test("Excel conserva DNI, cero, porcentajes y texto sin ejecutar fórmulas", () => {
  const celda = (texto: string, columna: number, fila = 1): CeldaExcel => ({ texto, columna, fila, filas: 1, columnas: 1, cabecera: false, color: "FFFFFF" });
  const datos = [celda("00123456", 2), celda("0", 3), celda("75%", 4), celda("=HYPERLINK(\"x\") & nombre", 1)];
  datos.push({ ...celda("Fechas", 3, 0), cabecera: true, columnas: 2 });
  const partes = partesDocx(Buffer.from(tablaXlsx(datos, "Notas", "Chivay", ["S1 · Tema"])));
  const hoja = partes.find((p) => p.nombre === "xl/worksheets/sheet1.xml")!.datos.toString();
  assert.match(hoja, /r="C5"[^>]*t="inlineStr".*00123456/);
  assert.match(hoja, /r="D5"[^>]*><v>0<\/v>/);
  assert.match(hoja, /r="E5" s="6"><v>0.75<\/v>/);
  assert.ok(!hoja.includes("<f>"));
  assert.ok(hoja.includes("&amp; nombre"));
  assert.ok(hoja.includes('mergeCell ref="D4:E4"'));
  assert.ok(hoja.includes("S1 · Tema"));
  assert.ok(partes.some((p) => p.nombre === "[Content_Types].xml"));
  assert.equal(columnaExcel(26), "AA");
});
