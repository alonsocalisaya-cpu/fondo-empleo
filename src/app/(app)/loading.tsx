/** Se muestra al instante mientras carga la página elegida (sobre todo en celular o por la red). */
export default function Cargando() {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-sm text-texto-2">
      <span className="size-9 animate-spin rounded-full border-4 border-[#d8eee8] border-t-acento" aria-hidden="true" />
      Cargando…
    </div>
  );
}
