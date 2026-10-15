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

/** Resumen continuo para impresión. Las listas extensas conservan su detalle en el expediente. */
export default function FichaResumen({ ficha }: { ficha: ResumenFicha }) {
  const recursos = ficha.recursos.slice(0, 6);
  const gastos = ficha.gastos?.slice(0, 5) ?? [];
  const otrosGastos = ficha.gastos?.slice(5) ?? [];
  const total = ficha.gastos?.reduce((suma, gasto) => suma + gasto.monto, 0) ?? 0;
  const encabezado = <header className="ficha-cabecera"><h1>Ficha de capacitación</h1><div>N.° {ficha.numero}</div></header>;
  const pie = <p className="ficha-pie">Ficha resumida. Los textos extensos y el detalle completo de recursos, devoluciones y gastos se consultan en el expediente de la sesión.</p>;

  return <div className="ficha-capacitacion">
    <article className="ficha-hoja">
      {encabezado}
      <Bloque titulo="Datos generales"><Campos filas={ficha.generales} limite={75} /></Bloque>
      <Bloque titulo="Recursos aprobados y devoluciones">
        <table><colgroup><col style={{ width: "58%" }} /><col style={{ width: "21%" }} /><col style={{ width: "21%" }} /></colgroup><thead><tr><th>Artículo / equipo</th><th>Aprobado</th><th>Devuelto</th></tr></thead><tbody>
          {recursos.map((r, i) => <tr key={i}><td>{corto(r.nombre, 65)}{r.detalle && <small>{corto(r.detalle, 45)}</small>}</td><td>{r.cantidad} {corto(r.unidad, 15)}</td><td>{r.retorno == null ? "Pendiente" : `${r.retorno} ${corto(r.unidad, 15)}`}</td></tr>)}
          {!recursos.length && <tr><td colSpan={3}>{ficha.recursosAprobados ? "No se requieren recursos ni equipos." : "Pendiente de aprobación de recursos."}</td></tr>}
          {ficha.recursos.length > 6 && <tr><td colSpan={3}>Otros {ficha.recursos.length - 6} artículos aprobados: cantidades y devoluciones en el expediente.</td></tr>}
        </tbody></table>
        <p className="ficha-nota">Devolución: {ficha.devolucionRegistrada ? "registrada" : "pendiente de registro"}.</p>
      </Bloque>
      <Bloque titulo="Ejecución e incidencias"><Campos filas={ficha.ejecucion} limite={100} /></Bloque>
      <Bloque titulo="Asistencia"><Campos filas={ficha.asistencia} limite={70} /><p className="ficha-nota">Porcentaje = (presentes + tardanzas) / programados × 100.</p></Bloque>
      <Bloque titulo="Registro de notas"><Campos filas={ficha.notas} limite={75} /></Bloque>
      <Bloque titulo="Entregables"><table><thead><tr><th>Categoría</th><th>Estado</th></tr></thead><tbody>{ficha.entregables.map((fila) => <tr key={fila.titulo}><td>{fila.titulo}</td><td>{fila.valor}</td></tr>)}</tbody></table></Bloque>
      <Bloque titulo="Viáticos">
        {ficha.gastos ? <table><colgroup><col style={{ width: "78%" }} /><col style={{ width: "22%" }} /></colgroup><thead><tr><th>Concepto</th><th className="ficha-importe">Importe (S/)</th></tr></thead><tbody>
          {gastos.map((gasto, i) => <tr key={i}><td>{corto(gasto.concepto, 75)}</td><td className="ficha-importe">{soles(gasto.monto)}</td></tr>)}
          {otrosGastos.length > 0 && <tr><td>Otros {otrosGastos.length} gastos (detalle en el expediente)</td><td className="ficha-importe">{soles(otrosGastos.reduce((suma, gasto) => suma + gasto.monto, 0))}</td></tr>}
          <tr className="ficha-total"><th>Total de viáticos</th><td className="ficha-importe">{soles(total)}</td></tr>
        </tbody></table> : <p>Pendiente de registro.</p>}
      </Bloque>
      <p className="ficha-nota"><strong>Cierre:</strong> {ficha.cierre}</p>
      <div className="ficha-firmas"><div>Asistente de Capacitación<small>Preparación y ejecución</small></div></div>
      {pie}
    </article>
  </div>;
}
