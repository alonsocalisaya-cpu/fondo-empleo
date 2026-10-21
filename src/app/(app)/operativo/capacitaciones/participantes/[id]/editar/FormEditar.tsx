"use client";

import Link from "next/link";
import { startTransition, useActionState, type FormEvent } from "react";
import { editarBeneficiario } from "./actions";

type Beneficiario = { id: number; dni: string | null; nombres: string; apellidos: string; sedeId: number | null; email: string | null; telefono: string | null; area: string | null };

export default function FormEditar({ beneficiario: b, sedes }: { beneficiario: Beneficiario; sedes: { id: number; nombre: string }[] }) {
  const [resultado, guardar, guardando] = useActionState(editarBeneficiario, undefined);
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => guardar(datos));
  };
  return <form onSubmit={enviar} className="card space-y-5 p-5 sm:p-6">
    <input type="hidden" name="id" value={b.id} />
    <h2 className="font-semibold text-marino">Datos del beneficiario</h2>
    <fieldset disabled={guardando} className="grid gap-4 sm:grid-cols-2">
      <label className="etiqueta">DNI (opcional)<input name="dni" defaultValue={b.dni ?? ""} inputMode="numeric" pattern="[0-9]{8,12}" maxLength={12} className="campo mt-1" /></label>
      <label className="etiqueta">Sede<select name="sedeId" defaultValue={b.sedeId ?? ""} className="campo mt-1"><option value="">Sin sede</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
      <label className="etiqueta">Nombres *<input name="nombres" defaultValue={b.nombres} required maxLength={100} className="campo mt-1" /></label>
      <label className="etiqueta">Apellidos *<input name="apellidos" defaultValue={b.apellidos} required maxLength={100} className="campo mt-1" /></label>
      <label className="etiqueta">Correo<input name="email" type="email" defaultValue={b.email ?? ""} maxLength={150} className="campo mt-1" /></label>
      <label className="etiqueta">Teléfono<input name="telefono" type="tel" defaultValue={b.telefono ?? ""} maxLength={30} className="campo mt-1" /></label>
      <label className="etiqueta sm:col-span-2">Área (opcional)<input name="area" defaultValue={b.area ?? ""} maxLength={120} className="campo mt-1" /></label>
    </fieldset>
    {resultado?.error && <p role="alert" className="rounded-lg bg-[#fef2f2] p-3 text-sm text-[#991b1b]">{resultado.error}</p>}
    <div className="flex flex-wrap gap-3 border-t border-borde pt-4"><button disabled={guardando} className="btn-oscuro">{guardando ? "Guardando…" : "Guardar cambios"}</button><Link href="/operativo/capacitaciones/participantes" className="btn-secundario">Cancelar</Link></div>
  </form>;
}
