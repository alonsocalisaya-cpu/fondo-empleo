import { crearZip } from "./zip";

export type CeldaExcel = { texto: string; fila: number; columna: number; filas: number; columnas: number; cabecera: boolean; color: string };
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function columnaExcel(n: number): string {
  let s = "";
  for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}

/** Exporta valores de la tabla filtrada, sin interpretar texto del usuario como fórmulas. */
export function tablaXlsx(celdas: CeldaExcel[], titulo: string, contexto: string, leyenda: string[], congelarColumnas = 3) {
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const colores = ["FFFFFF", "E2E8F0", "DCFCE7", "FEF3C7", "FEE2E2", "E0E7FF"];
  const filas = new Map<number, string[]>();
  const merges: string[] = [];
  const ancho = Math.max(1, ...celdas.map((c) => c.columna + c.columnas));
  const agregar = (fila: number, xml: string) => filas.set(fila, [...(filas.get(fila) ?? []), xml]);
  const texto = (ref: string, s: string, estilo = 0) => `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
  agregar(1, texto("A1", titulo, 1));
  agregar(2, texto("A2", contexto));
  for (const c of celdas) {
    const ref = `${columnaExcel(c.columna)}${c.fila + 4}`;
    const normal = c.texto.replace(/\s+/g, " ").trim();
    const numero = !c.cabecera && c.columna >= congelarColumnas && /^-?\d+(?:[.,]\d+)?%?$/.test(normal);
    const porcentaje = numero && normal.endsWith("%");
    const estilo = c.cabecera ? 1 : Math.max(0, colores.indexOf(c.color)) + (porcentaje ? 6 : 0);
    agregar(c.fila + 4, numero ? `<c r="${ref}" s="${estilo}"><v>${Number(normal.replace("%", "").replace(",", ".")) / (porcentaje ? 100 : 1)}</v></c>` : texto(ref, normal, estilo));
    if (c.filas > 1 || c.columnas > 1) merges.push(`${ref}:${columnaExcel(c.columna + c.columnas - 1)}${c.fila + c.filas + 3}`);
  }
  let final = Math.max(4, ...filas.keys()) + 3;
  for (const linea of leyenda) agregar(final, texto(`A${final++}`, linea));
  const encabezados = Math.max(1, ...celdas.filter((c) => c.cabecera).map((c) => c.fila + c.filas));
  const hoja = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane xSplit="${congelarColumnas}" ySplit="${encabezados + 3}" topLeftCell="${columnaExcel(congelarColumnas)}${encabezados + 4}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${Array.from({ length: ancho }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${congelarColumnas === 1 && i === 0 ? 36 : i === 1 ? 38 : i === 2 ? 15 : 14}" customWidth="1"/>`).join("")}</cols><sheetData>${[...filas].sort(([a], [b]) => a - b).map(([r, cells]) => `<row r="${r}">${cells.join("")}</row>`).join("")}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}</worksheet>`;
  const formatos = Array.from({ length: 12 }, (_, i) => `<xf numFmtId="${i >= 6 ? 9 : 0}" fontId="${i === 1 ? 1 : 0}" fillId="${i % 6 > 0 ? i % 6 + 1 : 0}" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`).join("");
  const estilos = `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${colores.slice(1).map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12">${formatos}</cellXfs></styleSheet>`;
  return crearZip([
    { nombre: "[Content_Types].xml", datos: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nombre: "_rels/.rels", datos: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: "xl/workbook.xml", datos: `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Seguimiento" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nombre: "xl/_rels/workbook.xml.rels", datos: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nombre: "xl/worksheets/sheet1.xml", datos: hoja }, { nombre: "xl/styles.xml", datos: estilos },
  ]);
}
