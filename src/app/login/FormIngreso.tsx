"use client";

import { useActionState } from "react";
import { iniciarSesion } from "./actions";

export default function FormIngreso({ siguiente }: { siguiente: string }) {
  const [res, enviar, enviando] = useActionState(iniciarSesion, undefined);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <div>
        <label htmlFor="usuario" className="etiqueta">Usuario (DNI o correo)</label>
        <input id="usuario" name="usuario" autoComplete="username" autoFocus required className="campo" />
      </div>
      <div>
        <label htmlFor="clave" className="etiqueta">Contraseña</label>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required className="campo" />
      </div>
      {res?.error && <p role="alert" className="rounded-md bg-[#fef2f2] px-3 py-2 text-sm text-[#991b1b]">{res.error}</p>}
      <button disabled={enviando} className="btn-primario">{enviando ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
