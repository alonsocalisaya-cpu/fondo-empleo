import { inflateRawSync } from "node:zlib";
import { crearZip } from "./zip";
import type { ActividadViaje } from "./actividades-viaje";

export type DatosProgramaViaje = { consultor: string; fecha: string; sede: string; proyecto: string; actividades?: ActividadViaje[] };

/** Lee las partes del DOCX conservando intacto el contenido de cada archivo del paquete. */
export function partesDocx(datos: Buffer) {
  let fin = datos.length - 22;
  for (; fin >= Math.max(0, datos.length - 65557); fin--) if (datos.readUInt32LE(fin) === 0x06054b50) break;
  if (fin < 0 || datos.readUInt32LE(fin) !== 0x06054b50) throw new Error("Plantilla Word no válida.");
  const cantidad = datos.readUInt16LE(fin + 10);
  let posicion = datos.readUInt32LE(fin + 16);
  const partes: { nombre: string; datos: Buffer }[] = [];
  for (let i = 0; i < cantidad; i++) {
    if (datos.readUInt32LE(posicion) !== 0x02014b50) throw new Error("Paquete Word no válido.");
    const metodo = datos.readUInt16LE(posicion + 10);
    const tamano = datos.readUInt32LE(posicion + 20);
    const nNombre = datos.readUInt16LE(posicion + 28);
    const nExtra = datos.readUInt16LE(posicion + 30);
    const nComentario = datos.readUInt16LE(posicion + 32);
    const local = datos.readUInt32LE(posicion + 42);
    const nombre = datos.subarray(posicion + 46, posicion + 46 + nNombre).toString("utf8");
    const inicio = local + 30 + datos.readUInt16LE(local + 26) + datos.readUInt16LE(local + 28);
    const contenido = datos.subarray(inicio, inicio + tamano);
    if (metodo !== 0 && metodo !== 8) throw new Error("Compresión de la plantilla no compatible.");
    partes.push({ nombre, datos: metodo === 8 ? inflateRawSync(contenido) : contenido });
    posicion += 46 + nNombre + nExtra + nComentario;
  }
  return partes;
}

const xml = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Completa únicamente los cinco espacios de la plantilla original; no cambia tablas ni estilos. */
export function generarProgramaViaje(plantilla: Buffer, datos: DatosProgramaViaje) {
  const partes = partesDocx(plantilla);
  const documento = partes.find((p) => p.nombre === "word/document.xml");
  if (!documento) throw new Error("La plantilla no contiene el documento Word.");
  const original = documento.datos.toString("utf8");
  const tabla = original.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/)?.[0];
  if (!tabla) throw new Error("No se encontró la tabla del programa de viaje.");
  const filas = tabla.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? [];
  const cambios = new Map<number, [number, string][]>([[0, [[2, datos.consultor]]], [2, [[3, "X"]]], [5, [[2, datos.fecha.split("-").reverse().join("/")]]], [6, [[2, datos.sede]]], [7, [[2, datos.proyecto]]]]);
  if ((datos.actividades?.length ?? 0) > 13) throw new Error("La plantilla admite hasta 13 actividades.");
  datos.actividades?.forEach((a, i) => cambios.set(11 + i, [[1, a.actividad], [2, a.descripcion], [3, a.fecha.split("-").reverse().join("/")], [4, a.hora]]));
  const editadas = filas.map((fila, i) => {
    const cambiosFila = cambios.get(i);
    if (!cambiosFila) return fila;
    let editada = fila;
    for (const cambio of cambiosFila) {
    const celdas = fila.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? [];
    const celda = celdas[cambio[0]];
    if (!celda) throw new Error("La estructura de la plantilla cambió.");
    const parrafo = celda.match(/<w:p\b[\s\S]*?<\/w:p>/)?.[0];
    if (!parrafo || /<w:t\b/.test(parrafo)) throw new Error("El campo de la plantilla ya contiene texto o no está disponible.");
    let formato = parrafo;
    if (i >= 11) {
      formato = formato.replace(/<w:rPr\b[\s\S]*?<\/w:rPr>/g, (propiedades) => propiedades.replace(/<w:b(?:Cs)?\b[^>]*\/>/g, "").replace("</w:rPr>", '<w:b w:val="0"/><w:bCs w:val="0"/></w:rPr>'));
      if (cambio[0] === 1 || cambio[0] === 2) {
        if (/<w:jc\b/.test(formato)) formato = formato.replace(/<w:jc\b[^>]*\/>/g, '<w:jc w:val="left"/>');
        else if (formato.includes("<w:pPr>")) formato = formato.replace("<w:pPr>", '<w:pPr><w:jc w:val="left"/>');
        else formato = formato.replace(/(<w:p\b[^>]*>)/, '$1<w:pPr><w:jc w:val="left"/></w:pPr>');
      }
    }
    const estilo = formato.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0] ?? (i >= 11 ? '<w:rPr><w:b w:val="0"/><w:bCs w:val="0"/></w:rPr>' : "");
    const texto = cambio[1].split(/\r?\n/).map((linea) => `<w:t xml:space="preserve">${xml(linea)}</w:t>`).join("<w:br/>");
    const nuevo = formato.replace("</w:p>", `<w:r>${estilo}${texto}</w:r></w:p>`);
    editada = editada.replace(celda, celda.replace(parrafo, nuevo));
    }
    return editada;
  });
  if (filas.length < 8) throw new Error("La plantilla de programa de viaje no tiene los campos esperados.");
  let nuevaTabla = tabla;
  filas.forEach((fila, i) => { nuevaTabla = nuevaTabla.replace(fila, editadas[i]); });
  documento.datos = Buffer.from(original.replace(tabla, nuevaTabla), "utf8");
  return crearZip(partes);
}
