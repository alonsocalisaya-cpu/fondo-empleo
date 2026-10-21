import type { ReactNode } from "react";

export type CampoFicha = { titulo: string; valor: string };
export type ResumenFicha = {
  numero: string;
  generales: CampoFicha[];
  recursos: { nombre: string; cantidad: number; unidad: string; retorno: number | null; detalle?: string }[];
  recursosAprobados: boolean;
  devolucionRegistrada: boolean;
  ejecucion: CampoFicha[];
  asistencia: CampoFicha[];
  notas: CampoFicha[];
  entregables: CampoFicha[];
  gastos: { concepto: string; monto: number }[] | null;
  cierre: string;
};

const corto = (texto: string, maximo = 100) => {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > maximo ? `${limpio.slice(0, maximo - 1)}…` : limpio || "—";
};
const soles = (monto: number) => monto.toFixed(2);

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="ficha-bloque"><h2>{titulo}</h2>{children}</section>;
}

function Campos({ filas, limite = 100 }: { filas: CampoFicha[]; limite?: number }) {
  return <dl className="ficha-campos">{filas.map((fila) => <div key={fila.titulo}><dt>{fila.titulo}</dt><dd>{corto(fila.valor, limite)}</dd></div>)}</dl>;
}

function TablaResumen({ campos }: { campos: CampoFicha[] }) {
  return <table className="ficha-tabla-resumen"><thead><tr>{campos.map((campo) => <th key={campo.titulo} scope="col">{campo.titulo}</th>)}</tr></thead><tbody><tr>{campos.map((campo) => <td key={campo.titulo}>{campo.valor}</td>)}</tr></tbody></table>;
}

/** Resumen continuo para impresión. Las listas extensas conservan su detalle en el expediente. */
export default function FichaResumen({ ficha }: { ficha: ResumenFicha }) {
  const gastos = ficha.gastos?.slice(0, 5) ?? [];
  const otrosGastos = ficha.gastos?.slice(5) ?? [];
  const total = ficha.gastos?.reduce((suma, gasto) => suma + gasto.monto, 0) ?? 0;
  const encabezado = <header className="ficha-cabecera"><h1>Ficha de capacitación</h1><div>N.° {ficha.numero}</div></header>;

  return <div className="ficha-capacitacion">
    <article className="ficha-hoja">
      {encabezado}
      <Bloque titulo="Datos generales"><Campos filas={ficha.generales} limite={75} /></Bloque>
      <Bloque titulo="Ejecución e incidencias"><Campos filas={ficha.ejecucion} limite={100} /></Bloque>
      <Bloque titulo="Asistencia"><TablaResumen campos={ficha.asistencia} /></Bloque>
      <Bloque titulo="Registro de notas"><TablaResumen campos={ficha.notas} /></Bloque>
      <Bloque titulo="Entregables"><table><thead><tr><th>Categoría</th><th>Estado</th></tr></thead><tbody>{ficha.entregables.map((fila) => <tr key={fila.titulo}><td>{fila.titulo}</td><td>{fila.valor}</td></tr>)}</tbody></table></Bloque>
      <Bloque titulo="Viáticos">
        {ficha.gastos ? <table><colgroup><col style={{ width: "78%" }} /><col style={{ width: "22%" }} /></colgroup><thead><tr><th>Concepto</th><th className="ficha-importe">Importe (S/)</th></tr></thead><tbody>
          {gastos.map((gasto, i) => <tr key={i}><td>{corto(gasto.concepto, 75)}</td><td className="ficha-importe">{soles(gasto.monto)}</td></tr>)}
          {otrosGastos.length > 0 && <tr><td>Otros {otrosGastos.length} gastos (detalle en el expediente)</td><td className="ficha-importe">{soles(otrosGastos.reduce((suma, gasto) => suma + gasto.monto, 0))}</td></tr>}
          <tr className="ficha-total"><th>Total de viáticos</th><td className="ficha-importe">{soles(total)}</td></tr>
        </tbody></table> : <p>Pendiente de registro.</p>}
      </Bloque>
    </article>
  </div>;
}
