import { test } from "node:test";
import assert from "node:assert/strict";
import { diferenciaStock, saldoRecursos } from "./stock-recursos";

test("las solicitudes e históricos sin vínculo no descuentan stock", () => {
  assert.deepEqual(saldoRecursos({ solicitar_recursos: { en: "hoy", recursos: [{ descripcion: "Galletas", cantidad: 20 }] }, revisar_recursos: { en: "hoy", recursos: [{ descripcion: "Galletas", cantidad: 20 }] } }), []);
});
test("aprobar descuenta; devolver y deshacer invierten solamente sus cantidades", () => {
  const aprobado = saldoRecursos({ revisar_recursos: { en: "hoy", stockLineas: [{ insumoId: 1, cantidad: 20 }, { insumoId: 1, cantidad: 5 }] } });
  const devuelto = saldoRecursos({ revisar_recursos: { en: "hoy", stockLineas: aprobado }, recursos_post: { en: "hoy", stockLineas: [{ insumoId: 1, cantidad: 3 }] } });
  assert.deepEqual(diferenciaStock([], aprobado), [{ insumoId: 1, cantidad: 25 }]);
  assert.deepEqual(diferenciaStock(aprobado, devuelto), [{ insumoId: 1, cantidad: -3 }]);
  assert.deepEqual(diferenciaStock(devuelto, aprobado), [{ insumoId: 1, cantidad: 3 }]);
  assert.deepEqual(diferenciaStock(aprobado, []), [{ insumoId: 1, cantidad: -25 }]);
  assert.deepEqual(diferenciaStock(aprobado, aprobado), []);
});
