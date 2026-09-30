"use client";

export default function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secundario print:hidden">
      🖨 Imprimir
    </button>
  );
}
