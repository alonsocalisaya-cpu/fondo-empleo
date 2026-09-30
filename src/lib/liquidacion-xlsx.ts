import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { crearZip } from "./zip";
import { MAX_LINEAS, importeTotalTexto, saldo, totalGastos, type DatosLiquidacion } from "./liquidacion";

/**
 * Llena el formato oficial «Liquidación de viáticos» (plantillas/liquidacion-viaticos) SIN tocar su diseño:
 * solo se escriben valores en las celdas en blanco del formato, conservando su estilo, bordes, logo,
 * celdas combinadas, fórmulas (total y saldo) y área de impresión.
 */
const DIR = path.join(process.cwd(), "plantillas", "liquidacion-viaticos");

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Reemplaza el contenido de una celda existente del formato, manteniendo su estilo (s="…"). */
function poner(xml: string, ref: string, valor: string | number | null | undefined, formula?: string) {
  const re = new RegExp(`<c r="${ref}"( s="\\d+")?[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (!m) throw new Error(`La celda ${ref} no existe en el formato.`);
  const s = m[1] ?? "";
  let c: string;
  if (formula) c = `<c r="${ref}"${s}><f>${formula}</f><v>${Number(valor) || 0}</v></c>`;
  else if (valor == null || valor === "") c = `<c r="${ref}"${s}/>`;
  else if (typeof valor === "number") c = `<c r="${ref}"${s}><v>${valor}</v></c>`;
  else c = `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(valor)}</t></is></c>`;
  return xml.replace(re, c);
}

async function archivos(dir: string, base = ""): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(path.join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await archivos(dir, rel)));
    else if (!e.name.startsWith("ORIGINAL")) out.push(rel);
  }
  return out;
}

export async function liquidacionXlsx(d: DatosLiquidacion) {
  const lista = await archivos(DIR);
  const partes = await Promise.all(lista.map(async (nombre) => ({ nombre, datos: await readFile(path.join(DIR, nombre)) })));

  let hoja = partes.find((p) => p.nombre === "xl/worksheets/sheet1.xml")!.datos.toString("utf8");
  hoja = poner(hoja, "D6", d.osft);
  hoja = poner(hoja, "K6", d.fecha);
  hoja = poner(hoja, "D8", d.nombre);
  hoja = poner(hoja, "L8", Number(d.presupuestado) || 0);
  hoja = poner(hoja, "D9", d.puesto);
  hoja = poner(hoja, "D10", d.descripcion);
  hoja = poner(hoja, "D11", d.cliente);
  d.lineas.slice(0, MAX_LINEAS).forEach((l, i) => {
    const r = 21 + i;
    hoja = poner(hoja, `B${r}`, i + 1);
    hoja = poner(hoja, `C${r}`, l.descripcion);
    hoja = poner(hoja, `G${r}`, l.cantidad ?? "");
    hoja = poner(hoja, `H${r}`, l.unidad);
    hoja = poner(hoja, `I${r}`, Number(l.monto) || 0);
    hoja = poner(hoja, `K${r}`, l.comprobante);
    hoja = poner(hoja, `M${r}`, l.obs);
  });
  hoja = poner(hoja, "F42", importeTotalTexto(d));
  // Las fórmulas del formato se conservan; solo se actualiza el valor ya calculado
  hoja = poner(hoja, "M42", totalGastos(d), "SUM(I21:J41)");
  hoja = poner(hoja, "M43", saldo(d), "L8-M42");

  // Que Excel recalcule al abrir
  let libro = partes.find((p) => p.nombre === "xl/workbook.xml")!.datos.toString("utf8");
  libro = libro.replace("<calcPr ", '<calcPr fullCalcOnLoad="1" ');

  return crearZip(
    partes.map((p) =>
      p.nombre === "xl/worksheets/sheet1.xml" ? { nombre: p.nombre, datos: hoja }
      : p.nombre === "xl/workbook.xml" ? { nombre: p.nombre, datos: libro }
      : { nombre: p.nombre, datos: new Uint8Array(p.datos) },
    ),
  );
}
