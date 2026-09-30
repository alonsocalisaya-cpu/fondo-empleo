"use client";

import { useActionState } from "react";
import { cambiarClave } from "@/app/login/actions";

export default function FormClave() {
  const [res, enviar, enviando] = useActionState(cambiarClave, undefined);
  return (
    <form action={enviar} className="card flex max-w-md flex-col gap-4 p-6">
      {[
        ["actual", "Contraseña actual", "current-password"],
        ["nueva", "Nueva contraseña (mínimo 8, con letras y números)", "new-password"],
        ["repetir", "Repite la nueva contraseña", "new-password"],
      ].map(([n, l, ac]) => (
        <div key={n}>
          <label htmlFor={`c-${n}`} className="etiqueta">{l}</label>
          <input id={`c-${n}`} name={n} type="password" autoComplete={ac} required className="campo" />
        </div>
      ))}
      {res?.error && <p role="alert" className="text-sm text-[#991b1b]">{res.error}</p>}
      {res?.ok && <p role="status" className="text-sm text-[#166534]">{res.ok}</p>}
      <button disabled={enviando} className="btn-oscuro self-start">{enviando ? "Guardando…" : "Cambiar contraseña"}</button>
    </form>
  );
}
