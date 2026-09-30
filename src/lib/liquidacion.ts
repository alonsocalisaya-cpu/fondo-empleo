/**
 * Liquidación de viáticos (formato ACIDE-A&A-F-02). Tipos y cálculos que usan tanto el formulario
 * (navegador) como la generación del Excel (servidor). Aquí no se accede a la base de datos.
 */

/** Filas de gastos que tiene el formato (N° 1 a 21). */
export const MAX_LINEAS = 21;

export type LineaGasto = {
  descripcion: string;
  cantidad: number | null;
  unidad: string;
  monto: number;
  comprobante: string;
  obs: string;
};

export type DatosLiquidacion = {
  osft: string;
  fecha: string; // dd/mm/aaaa
  nombre: string;
  puesto: string;
  descripcion: string;
  cliente: string;
  presupuestado: number;
  lineas: LineaGasto[];
};

export const redondear = (n: number) => Math.round(n * 100) / 100;
export const totalGastos = (d: Pick<DatosLiquidacion, "lineas">) => redondear(d.lineas.reduce((s, l) => s + (Number(l.monto) || 0), 0));
export const saldo = (d: DatosLiquidacion) => redondear((Number(d.presupuestado) || 0) - totalGastos(d));

const UNIDADES = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function hasta999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let t = CENTENAS[c];
  if (r) {
    const dec = r < 30 ? UNIDADES[r] : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` Y ${UNIDADES[r % 10]}` : ""}`;
    t = `${t} ${dec}`.trim();
  }
  return t;
}

function enteroALetras(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "UN MILLÓN" : `${hasta999(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? "MIL" : `${hasta999(miles)} MIL`);
  if (resto) partes.push(hasta999(resto));
  return partes.join(" ");
}

/** Importe con letra, como en los documentos contables: «CIENTO VEINTE CON 50/100 SOLES». */
export function importeEnLetras(monto: number) {
  const m = Math.max(0, redondear(monto));
  const entero = Math.floor(m);
  const cent = Math.round((m - entero) * 100);
  return `${enteroALetras(entero)} CON ${String(cent).padStart(2, "0")}/100 SOLES`;
}

/** Texto para la celda «IMPORTE TOTAL (CON LETRA Y NÚMERO)». */
export const importeTotalTexto = (d: Pick<DatosLiquidacion, "lineas">) => `${importeEnLetras(totalGastos(d))} (S/ ${totalGastos(d).toFixed(2)})`;
