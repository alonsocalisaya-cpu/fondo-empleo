"use client";

import { useState } from "react";
import { tablaXlsx, type CeldaExcel } from "@/lib/tabla-xlsx";

export default function ExportarSeguimiento({ titulo, contexto, totales = false }: { titulo: string; contexto: string; totales?: boolean }) {
  const [error, setError] = useState("");
  function descargar() {
    setError("");
    try {
      const tabla = document.querySelector<HTMLTableElement>("table[data-exportar-seguimiento]");
      if (!tabla) { setError("No hay datos para exportar con los filtros seleccionados."); return; }
      const ocupadas = new Set<string>();
      const celdas: CeldaExcel[] = [];
      Array.from(tabla.rows).forEach((fila, r) => {
        let c = 0;
        for (const celda of Array.from(fila.cells)) {
          while (ocupadas.has(`${r}:${c}`)) c++;
          const rgb = getComputedStyle(celda).backgroundColor.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
          const color = rgb ? rgb.slice(1).map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase() : "FFFFFF";
          celdas.push({ texto: celda.innerText, fila: r, columna: c, filas: celda.rowSpan, columnas: celda.colSpan, cabecera: fila.parentElement?.tagName === "THEAD", color });
          for (let y = 0; y < celda.rowSpan; y++) for (let x = 0; x < celda.colSpan; x++) ocupadas.add(`${r + y}:${c + x}`);
          c += celda.colSpan;
        }
      });
      const temas = Array.from(document.querySelectorAll<HTMLElement>('[aria-label^="Leyenda de temas"] dl > div')).map((e) => e.innerText.replace(/\s+/g, " "));
      const leyenda = [totales ? "Asistentes: presentes + tardanzas. Porcentaje: asistentes / programados." : titulo.includes("notas") ? "Nota E: entrada · Nota S: salida · S/N: sin nota · N/R: no rindió · N/E: no ejecutada · —: no inscrito · ·: pendiente" : "P: presente · T: tardanza · J: justificado · A: ausente · N/E: no ejecutada · —: no inscrito · ·: programada", ...temas];
      const bytes = tablaXlsx(celdas, titulo, contexto, leyenda, totales ? 1 : 3);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `${titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xlsx`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("No se pudo generar el Excel. Inténtalo nuevamente."); }
  }
  return <div className="flex flex-wrap items-center gap-3"><button type="button" className="btn-secundario" onClick={descargar}>↓ Exportar Excel</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}
