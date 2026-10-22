"use client";

import { useState } from "react";
import { tablaXlsx, type CeldaExcel } from "@/lib/tabla-xlsx";

export default function ExportarCalendario({ columnas, filas, inicio, fin, titulo = "Calendario de capacitaciones" }: { columnas: string[]; filas: string[][]; inicio: string; fin: string; titulo?: string }) {
  const [error, setError] = useState("");
  function descargar() {
    setError("");
    try {
      const celdas: CeldaExcel[] = [columnas, ...filas].flatMap((fila, i) => fila.map((texto, columna) => ({ texto, fila: i, columna, filas: 1, columnas: 1, cabecera: i === 0, color: i === 0 ? "E2E8F0" : "FFFFFF" })));
      const bytes = tablaXlsx(celdas, titulo, `Del ${inicio} al ${fin} · ${filas.length} capacitaciones · Filtros y orden seleccionados`, [], 1);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `capacitaciones-${inicio}-${fin}.xlsx`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("No se pudo generar el Excel. Inténtalo nuevamente."); }
  }
  return <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={descargar} disabled={!filas.length} className="btn-secundario">↓ Descargar Excel</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}
