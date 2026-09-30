import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { crearZip } from "./zip";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { inscripciones, programaciones } from "@/db/schema";
import { conRuta, combinadas } from "./consultas";
import { TURNO_LABEL } from "./fechas";

/** Textos del formato oficial de la lista de asistencia (plantillas/lista-asistencia). */
export const LISTA_TITULO = "Asistencia Taller de Fortalecimiento Empresarial";
export const LISTA_PROYECTO =
  "“Fortalecimiento de las competencias emprendedoras y de gestión de negocios de emprendimientos del sector comercio de Arequipa”";

export type HojaLista = {
  /** Nombre de la pestaña (máx. 31 caracteres) */
  nombre: string;
  sede: string;
  /** Nombre del proyecto (de la estructura); si falta, el de Arequipa */
  proyecto?: string | null;
  fecha: string; // dd/mm/aaaa
  sesion: string;
  personas: { nombre: string; dni: string }[];
  /** Filas en blanco al final para quien llegue sin estar en la lista */
  enBlanco?: number;
};

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const txt = (ref: string, s: number, t: string) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(t)}</t></is></c>`;
const num = (ref: string, s: number, n: number) => `<c r="${ref}" s="${s}"><v>${n}</v></c>`;
const vacia = (ref: string, s: number) => `<c r="${ref}" s="${s}"/>`;

function hojaXml(h: HojaLista) {
  const filas: string[] = [];
  for (const r of [1, 2, 3]) filas.push(`<row r="${r}" spans="1:4">${vacia(`A${r}`, 18)}${vacia(`B${r}`, 18)}${vacia(`C${r}`, 18)}${vacia(`D${r}`, 19)}</row>`);
  filas.push(`<row r="4" spans="1:4" ht="27.75" customHeight="1">${txt("A4", 29, LISTA_TITULO)}${vacia("B4", 30)}${vacia("C4", 30)}${vacia("D4", 31)}</row>`);
  filas.push(`<row r="5" spans="1:4" ht="46.5" customHeight="1">${txt("A5", 23, `${h.proyecto || LISTA_PROYECTO} -  ${h.sede}`)}${vacia("B5", 24)}${vacia("C5", 24)}${vacia("D5", 25)}</row>`);
  filas.push(`<row r="6" spans="1:4" ht="40" customHeight="1">${txt("A6", 34, `Fecha: ${h.fecha}`)}${vacia("B6", 32)}${txt("C6", 32, `Sesión: ${h.sesion}`)}${vacia("D6", 33)}</row>`);
  filas.push(`<row r="7" spans="1:4" ht="17.25">${vacia("A7", 12)}${txt("B7", 13, "NOMBRES Y APELLIDOS")}${txt("C7", 13, "DNI")}${txt("D7", 13, "FIRMA")}</row>`);
  const total = h.personas.length + (h.enBlanco ?? 0);
  for (let i = 0; i < total; i++) {
    const r = 8 + i;
    const p = h.personas[i];
    const dni = p && /^\d+$/.test(p.dni) ? num(`C${r}`, 7, Number(p.dni)) : p ? txt(`C${r}`, 7, p.dni) : vacia(`C${r}`, 7);
    filas.push(
      `<row r="${r}" spans="1:4" s="5" customFormat="1" ht="52.5" customHeight="1">${num(`A${r}`, 14, i + 1)}${p ? txt(`B${r}`, 7, p.nombre) : vacia(`B${r}`, 7)}${dni}${vacia(`D${r}`, 4)}</row>`,
    );
  }
  const ultima = 7 + total;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:D${ultima}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="4.5" customWidth="1"/><col min="2" max="2" width="51.85546875" customWidth="1"/><col min="3" max="3" width="19.140625" style="6" customWidth="1"/><col min="4" max="4" width="36.28515625" customWidth="1"/></cols><sheetData>${filas.join("")}</sheetData><mergeCells count="5"><mergeCell ref="A1:D3"/><mergeCell ref="A4:D4"/><mergeCell ref="A5:D5"/><mergeCell ref="C6:D6"/><mergeCell ref="A6:B6"/></mergeCells><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToHeight="0"/><drawing r:id="rId1"/></worksheet>`;
}

/** Arma el Excel de la lista de asistencia con el formato oficial (una pestaña por sesión). */
export async function listaAsistenciaXlsx(hojas: HojaLista[]) {
  const dir = path.join(process.cwd(), "plantillas", "lista-asistencia");
  const [estilos, tema, img1, img2, dibujo] = await Promise.all(
    ["styles.xml", "theme1.xml", "image1.png", "image2.png", "drawing1.xml"].map((f) => readFile(path.join(dir, f))),
  );
  const usados = new Set<string>();
  const nombres = hojas.map((h) => {
    const base = h.nombre.replace(/[\\/?*[\]:]/g, " ").slice(0, 31).trim() || "Lista";
    let n = base;
    for (let i = 2; usados.has(n.toLowerCase()); i++) n = `${base.slice(0, 28)} ${i}`;
    usados.add(n.toLowerCase());
    return n;
  });
  const T = "http://schemas.openxmlformats.org";
  const archivos: { nombre: string; datos: Uint8Array | string }[] = [
    {
      nombre: "[Content_Types].xml",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${T}/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`)
        .join("")}<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      nombre: "_rels/.rels",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${T}/package/2006/relationships"><Relationship Id="rId1" Type="${T}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nombre: "xl/workbook.xml",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${T}/spreadsheetml/2006/main" xmlns:r="${T}/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${nombres
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets><definedNames>${nombres
        .map((n, i) => `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${esc(n).replace(/'/g, "''")}'!$1:$7</definedName>`)
        .join("")}</definedNames></workbook>`,
    },
    {
      nombre: "xl/_rels/workbook.xml.rels",
      datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${T}/package/2006/relationships">${hojas
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${T}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rIdE" Type="${T}/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdT" Type="${T}/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/></Relationships>`,
    },
    { nombre: "xl/styles.xml", datos: estilos },
    { nombre: "xl/theme/theme1.xml", datos: tema },
    { nombre: "xl/media/image1.png", datos: img1 },
    { nombre: "xl/media/image2.png", datos: img2 },
  ];
  hojas.forEach((h, i) => {
    archivos.push(
      { nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: hojaXml(h) },
      {
        nombre: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
        datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${T}/package/2006/relationships"><Relationship Id="rId1" Type="${T}/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${i + 1}.xml"/></Relationships>`,
      },
      { nombre: `xl/drawings/drawing${i + 1}.xml`, datos: dibujo },
      {
        nombre: `xl/drawings/_rels/drawing${i + 1}.xml.rels`,
        datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${T}/package/2006/relationships"><Relationship Id="rId2" Type="${T}/officeDocument/2006/relationships/image" Target="../media/image2.png"/><Relationship Id="rId1" Type="${T}/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`,
      },
    );
  });
  return crearZip(archivos);
}

/* ── Datos de una sesión programada para la lista ─────────────────────────── */

export const fechaDMA = (iso: string) => iso.split("-").reverse().join("/");
/** «APELLIDOS NOMBRES» en mayúsculas, como en la lista oficial. */
export const nombreLista = (p: { nombres: string; apellidos: string }) => `${p.apellidos} ${p.nombres}`.replace(/\s+/g, " ").trim().toUpperCase();

export async function datosLista(programacionIds: number[]) {
  if (!programacionIds.length) return [];
  const [progs, ins, estructurasLista] = await Promise.all([
    db.query.programaciones.findMany({ where: inArray(programaciones.id, programacionIds), with: conRuta, orderBy: (t, { asc }) => [asc(t.fecha), asc(t.horaInicio)] }),
    db.query.inscripciones.findMany({ where: inArray(inscripciones.programacionId, programacionIds), with: { participante: true } }),
    db.query.estructuras.findMany(),
  ]);
  return progs.map((p) => {
    const personas = ins
      .filter((i) => i.programacionId === p.id)
      .map((i) => i.participante)
      .sort((a, b) => nombreLista(a).localeCompare(nombreLista(b), "es"))
      .map((x) => ({ nombre: nombreLista(x), dni: x.dni }));
    const hermanas = progs.filter((q) => q.sede.id === p.sede.id && q.fecha === p.fecha);
    return {
      p,
      hoja: {
        nombre: hermanas.length > 1 ? `${p.sede.nombre} ${TURNO_LABEL[p.turno]}` : p.sede.nombre,
        sede: p.sede.nombre,
        proyecto: estructurasLista.find((e) => e.id === p.sesion.modulo.actividad.componente.estructuraId)?.proyecto ?? null,
        fecha: fechaDMA(p.fecha),
        sesion: [p.sesion.nombre, ...combinadas(p)].join(" + "),
        personas,
        enBlanco: 5,
      } satisfies HojaLista,
    };
  });
}
