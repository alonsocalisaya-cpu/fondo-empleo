export default function ImpresionDinamicas() {
  return <label className="flex items-start gap-2 text-sm">
    <input type="checkbox" name="impresionCoordinada" value="si" required className="mt-1" />
    Confirmo que ya comuniqué y/o coordiné la impresión de las dinámicas de esta sesión.
  </label>;
}
