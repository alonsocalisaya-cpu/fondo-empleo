"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { crearPersona, darAcceso, darAccesoATodos, editarPersona, guardarPermisos, quitarAcceso, restablecerClave, restaurarPermisos, unirCon } from "./actions";

type Opcion = { valor: string; texto: string };
type Res = { ok?: string; error?: string; clave?: string; usuario?: string } | undefined;

/** Envía sin que React reinicie los campos (así los valores editados quedan a la vista). */
const sinReinicio = (enviar: (f: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const datos = new FormData(e.currentTarget);
  startTransition(() => enviar(datos));
};

function ClaveMostrada({ r }: { r: Res }) {
  if (!r?.clave) return null;
  return (
    <p role="status" className="rounded-md border border-[#86efac] bg-[#f0fdf4] px-3 py-2 text-sm text-[#166534]">
      {r.ok} <strong className="font-mono text-base tracking-wider">{r.clave}</strong>
      <span className="block text-xs">Entrégasela a la persona: al ingresar por primera vez deberá cambiarla. No se volverá a mostrar.</span>
    </p>
  );
}

function Aviso({ r }: { r: Res }) {
  if (!r || r.clave) return null;
  return r.error ? <p role="alert" className="text-sm text-[#991b1b]">{r.error}</p> : r.ok ? <p role="status" className="text-sm text-[#166534]">{r.ok}</p> : null;
}

/** Casillas de roles (se pueden marcar varios). */
function Roles({ roles, inicial, alCambiar }: { roles: Opcion[]; inicial?: string[]; alCambiar?: (r: string[]) => void }) {
  const [marcados, setMarcados] = useState<string[]>(inicial ?? []);
  const cambiar = (r: string, si: boolean) => {
    const l = si ? [...marcados, r] : marcados.filter((x) => x !== r);
    setMarcados(l);
    alCambiar?.(l);
  };
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="etiqueta">Roles * <span className="font-normal text-texto-2">(puedes marcar varios: tendrá los permisos de todos)</span></legend>
      <div className="flex flex-wrap gap-1.5">
        {roles.map((r) => {
          const si = marcados.includes(r.valor);
          return (
            <label
              key={r.valor}
              className={`flex cursor-pointer items-center rounded-full border px-3 py-1 text-[13px] ${
                si ? "border-marino bg-marino font-semibold text-white" : "border-borde-fuerte bg-white text-texto-2 hover:bg-[#eef1f5]"
              }`}
            >
              <input type="checkbox" name="roles" value={r.valor} checked={si} onChange={(e) => cambiar(r.valor, e.target.checked)} className="sr-only" />
              {si ? "✓ " : ""}{r.texto}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

type Datos = { nombres: string; apellidos: string; dni: string; email: string; telefono: string; especialidad: string; roles: string[] };

/** Campos de la persona (los mismos al crear y al editar). */
function CamposPersona({ id, roles, d }: { id: string; roles: Opcion[]; d?: Datos }) {
  const [marcados, setMarcados] = useState<string[]>(d?.roles ?? []);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["nombres", "Nombres *", d?.nombres, "text"],
          ["apellidos", "Apellidos", d?.apellidos, "text"],
          ["dni", "DNI", d?.dni, "numeric"],
          ["email", "Correo", d?.email, "email"],
          ["telefono", "Teléfono", d?.telefono, "tel"],
        ].map(([n, l, v, t]) => (
          <div key={n}>
            <label htmlFor={`${id}-${n}`} className="etiqueta">{l}</label>
            <input
              id={`${id}-${n}`}
              name={n}
              defaultValue={v ?? ""}
              required={n === "nombres"}
              type={t === "email" ? "email" : "text"}
              inputMode={t === "numeric" ? "numeric" : t === "tel" ? "tel" : undefined}
              className="campo"
            />
          </div>
        ))}
      </div>
      <Roles roles={roles} inicial={d?.roles} alCambiar={setMarcados} />
      {marcados.includes("capacitador") && (
        <div className="max-w-md">
          <label htmlFor={`${id}-especialidad`} className="etiqueta">Especialidad (como consultor)</label>
          <input id={`${id}-especialidad`} name="especialidad" defaultValue={d?.especialidad ?? ""} className="campo" />
        </div>
      )}
    </>
  );
}

/** Registrar a una persona del equipo (con o sin acceso al sistema). */
export function FormPersona({ roles, puedeAccesos }: { roles: Opcion[]; puedeAccesos: boolean }) {
  const [res, enviar, enviando] = useActionState(crearPersona, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [vez, setVez] = useState(0);
  const [acceso, setAcceso] = useState(true);
  useEffect(() => {
    if (res?.ok) {
      ref.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVez((k) => k + 1); // deja las casillas en blanco para la siguiente persona
    }
  }, [res]);
  return (
    <details className="card border-dashed" open={!!res?.error}>
      <summary className="cursor-pointer px-5 py-3 font-semibold text-marino">+ Registrar persona</summary>
      <form ref={ref} action={enviar} className="flex flex-col gap-3 border-t border-borde px-5 py-4">
        <CamposPersona key={vez} id="n" roles={roles} />
        {puedeAccesos && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-[#f8fafc] p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-marino">
              <input type="checkbox" name="acceso" value="si" checked={acceso} onChange={(e) => setAcceso(e.target.checked)} className="size-4" />
              Darle acceso al sistema
            </label>
            {acceso && (
              <div className="w-full sm:w-64">
                <label htmlFor="n-usuario" className="etiqueta">Usuario <span className="font-normal text-texto-2">(vacío = DNI, correo o nombre.apellido)</span></label>
                <input id="n-usuario" name="usuario" className="campo py-1.5 font-mono text-[13px]" />
              </div>
            )}
          </div>
        )}
        <button disabled={enviando} className="btn-oscuro self-start">{enviando ? "Guardando…" : "Registrar"}</button>
        <Aviso r={res} />
        <ClaveMostrada r={res} />
      </form>
    </details>
  );
}

export type FilaDatos = Datos & {
  id: number;
  nombre: string;
  usuario: string | null;
  acceso: boolean;
  activo: boolean;
  debeCambiarClave: boolean;
  ultimoIngreso: string;
  sesiones: string;
};

/** Una persona en la lista: se ve resumida y con «Editar» se abre el formulario debajo. */
export function FilaPersona({
  p,
  roles,
  nombresRoles,
  esYo,
  puedeEditar,
  puedeAccesos,
  acciones,
  otras,
}: {
  otras: Opcion[];
  p: FilaDatos;
  roles: Opcion[];
  nombresRoles: string[];
  esYo: boolean;
  puedeEditar: boolean;
  puedeAccesos: boolean;
  acciones: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  const [res, enviar, enviando] = useActionState(editarPersona, undefined);
  const conAcceso = p.acceso && !!p.usuario;
  return (
    <>
      <tr className={p.activo ? "" : "text-texto-2 opacity-70"}>
        <td className="td">
          <div className="flex flex-col">
            <span className="font-semibold text-marino">{p.nombre}{esYo && <span className="ml-1 text-xs font-normal text-texto-2">(tú)</span>}</span>
            <span className="text-xs text-texto-2">{[p.dni && `DNI ${p.dni}`, p.email, p.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
            {p.especialidad && <span className="text-xs text-texto-2">Especialidad: {p.especialidad}</span>}
          </div>
        </td>
        <td className="td">
          <div className="flex max-w-[340px] flex-wrap gap-1">
            {nombresRoles.map((r) => <span key={r} className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-xs font-semibold text-marino">{r}</span>)}
          </div>
        </td>
        <td className="td whitespace-pre-line text-[13px]">{p.sesiones}</td>
        <td className="td text-[13px]">
          {conAcceso ? (
            <>
              <span className="font-mono">{p.usuario}</span>
              <span className="block text-xs text-texto-2">{p.debeCambiarClave ? "Aún no cambia su contraseña" : `Último ingreso: ${p.ultimoIngreso}`}</span>
            </>
          ) : (
            <span className="text-xs text-texto-2">Sin acceso</span>
          )}
        </td>
        <td className="td">{p.activo ? "Activo" : "De baja"}</td>
        <td className="td text-right">
          {puedeEditar && (
            <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} className="enlace text-[13px]">
              {abierta ? "Cerrar" : "Editar"}
            </button>
          )}
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={6} className="border-b border-borde bg-[#f8fafc] px-5 py-4">
            <div className="flex flex-col gap-4">
              <form onSubmit={sinReinicio(enviar)} className="flex flex-col gap-3" aria-label={`Datos de ${p.nombre}`}>
                <input type="hidden" name="id" value={p.id} />
                <CamposPersona id={`e${p.id}`} roles={roles} d={p} />
                {puedeAccesos && conAcceso && (
                  <div className="w-full sm:w-64">
                    <label htmlFor={`e${p.id}-usuario`} className="etiqueta">Usuario de acceso</label>
                    <input id={`e${p.id}-usuario`} name="usuario" defaultValue={p.usuario ?? ""} required className="campo py-1.5 font-mono text-[13px]" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button disabled={enviando} className="btn-oscuro py-1.5">{enviando ? "Guardando…" : "Guardar cambios"}</button>
                  <Aviso r={res} />
                </div>
              </form>
              <div className="flex flex-wrap items-start gap-6 border-t border-borde pt-3">
                {puedeAccesos && <Acceso p={p} esYo={esYo} />}
                <UnirCon id={p.id} nombre={p.nombre} otras={otras.filter((o) => o.valor !== String(p.id))} />
                <div className="ml-auto flex items-center gap-4">{acciones}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Acceso al sistema de una persona: darlo, restablecer contraseña o quitarlo. */
function Acceso({ p, esYo }: { p: FilaDatos; esYo: boolean }) {
  const [res, enviar, enviando] = useActionState(darAcceso, undefined);
  const [resR, restablecer, restableciendo] = useActionState(restablecerClave, undefined);
  if (p.acceso && p.usuario) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-texto-2">Acceso al sistema</span>
        <div className="flex flex-wrap items-center gap-3">
          <form action={restablecer}>
            <input type="hidden" name="id" value={p.id} />
            <button disabled={restableciendo} className="btn-secundario py-1.5 text-[13px]">{restableciendo ? "…" : "Restablecer contraseña"}</button>
          </form>
          {!esYo && <QuitarAcceso id={p.id} />}
        </div>
        {/* Recién dado el acceso: su contraseña temporal se muestra aquí una sola vez */}
        <ClaveMostrada r={res} />
        <ClaveMostrada r={resR} />
      </div>
    );
  }
  return (
    <form action={enviar} className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-texto-2">Acceso al sistema</span>
      <input type="hidden" name="id" value={p.id} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-60">
          <label htmlFor={`a${p.id}-usuario`} className="etiqueta">Usuario <span className="font-normal text-texto-2">(vacío = sugerido)</span></label>
          <input id={`a${p.id}-usuario`} name="usuario" defaultValue={p.usuario ?? ""} className="campo py-1.5 font-mono text-[13px]" />
        </div>
        <button disabled={enviando} className="btn-oscuro py-1.5 text-[13px]">{enviando ? "…" : "Dar acceso"}</button>
      </div>
      <Aviso r={res} />
      <ClaveMostrada r={res} />
    </form>
  );
}

function QuitarAcceso({ id }: { id: number }) {
  return (
    <form action={quitarAcceso}>
      <input type="hidden" name="id" value={id} />
      <button className="enlace text-[13px]">Quitar acceso</button>
    </form>
  );
}

/** Da acceso a todas las personas activas que no lo tienen y muestra sus contraseñas una sola vez. */
export function DarAccesoATodos({ pendientes }: { pendientes: number }) {
  const [res, enviar, enviando] = useActionState(darAccesoATodos, undefined);
  if (!pendientes && !res?.creados) return null;
  return (
    <section className="card flex flex-col gap-3 px-5 py-4">
      {!res?.creados && (
        <form action={enviar} className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-texto-2">
            <strong className="text-marino">{pendientes} persona(s) activas no tienen acceso al sistema.</strong> Puedes dárselo una por una (Editar) o a todas de una vez.
          </p>
          <button disabled={enviando} className="btn-secundario">{enviando ? "Dando acceso…" : `Dar acceso a las ${pendientes}`}</button>
        </form>
      )}
      {res?.error && <p role="alert" className="text-sm text-[#991b1b]">{res.error}</p>}
      {res?.ok && !res.creados && <p role="status" className="text-sm text-[#166534]">{res.ok}</p>}
      {res?.creados && (
        <div id="claves-creadas" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-sm font-semibold text-[#166534]">✓ {res.ok} Anota o imprime estas contraseñas temporales: no se volverán a mostrar.</p>
            <button type="button" onClick={() => window.print()} className="btn-secundario py-1.5 text-[13px] print:hidden">🖨 Imprimir</button>
          </div>
          <table className="w-full text-sm">
            <thead><tr><th className="th">Nombre</th><th className="th">Usuario</th><th className="th">Contraseña temporal</th><th className="th">Roles</th></tr></thead>
            <tbody>
              {res.creados.map((c) => (
                <tr key={c.usuario}>
                  <td className="td font-medium">{c.nombre}</td>
                  <td className="td font-mono text-[13px]">{c.usuario}</td>
                  <td className="td font-mono text-base font-semibold tracking-wider">{c.clave}</td>
                  <td className="td text-[13px]">{c.roles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const NIVELES = [
  { v: "ninguno", t: "—", cls: "text-[#94a3b8]" },
  { v: "ver", t: "Ver", cls: "text-marino" },
  { v: "editar", t: "Editar", cls: "font-semibold text-[#166534]" },
];

/** Tabla editable «Qué puede hacer cada rol». */
export function MatrizPermisos({
  roles,
  modulos,
  valores,
  base,
}: {
  roles: Opcion[];
  modulos: Opcion[];
  /** valores[rol][modulo] = "ninguno" | "ver" | "editar" */
  valores: Record<string, Record<string, string>>;
  base: Record<string, Record<string, string>>;
}) {
  const [res, enviar, enviando] = useActionState(guardarPermisos, undefined);
  const [resR, restaurar, restaurando] = useActionState(restaurarPermisos, undefined);
  const [actual, setActual] = useState(valores);
  const [ultimo, setUltimo] = useState(valores);
  if (valores !== ultimo) {
    setUltimo(valores);
    setActual(valores);
  }
  const cambios = roles.reduce((n, r) => n + modulos.filter((m) => actual[r.valor][m.valor] !== valores[r.valor][m.valor]).length, 0);
  return (
    <section className="card overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-5 py-3">
        <div>
          <h2 className="font-semibold text-marino">Qué puede hacer cada rol</h2>
          <p className="text-xs text-texto-2">
            Cambia cada casilla: <strong>—</strong> no lo ve · <strong>Ver</strong> solo consulta · <strong>Editar</strong> puede crear, modificar y eliminar. El punto naranja marca lo que difiere del valor por defecto.
          </p>
        </div>
        <form action={restaurar}>
          <button disabled={restaurando} className="btn-secundario py-1.5 text-[13px]">{restaurando ? "…" : "Restaurar por defecto"}</button>
        </form>
      </div>
      {/* onSubmit (y no action) para que React no reinicie las casillas al guardar */}
      <form
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          startTransition(() => enviar(datos));
        }}
      >
        <table className="w-full min-w-[1040px] text-[13px]">
          <thead>
            <tr>
              <th className="th">Módulo</th>
              <th className="th text-center">Administrador</th>
              {roles.map((r) => <th key={r.valor} className="th text-center">{r.texto.replace(" de Capacitación", "").replace("Encargado de ", "")}</th>)}
            </tr>
          </thead>
          <tbody>
            {modulos.map((m) => (
              <tr key={m.valor}>
                <td className="td font-medium">{m.texto}</td>
                <td className="td text-center font-semibold text-[#166534]" title="El administrador siempre puede todo">Editar 🔒</td>
                {roles.map((r) => {
                  const v = actual[r.valor][m.valor];
                  const distinto = v !== base[r.valor][m.valor];
                  const cambiado = v !== valores[r.valor][m.valor];
                  return (
                    <td key={r.valor} className={`td text-center ${cambiado ? "bg-[#fff7ed]" : ""}`}>
                      <span className="inline-flex items-center gap-1">
                        <select
                          name={`p-${r.valor}-${m.valor}`}
                          value={v}
                          onChange={(e) => setActual({ ...actual, [r.valor]: { ...actual[r.valor], [m.valor]: e.target.value } })}
                          aria-label={`${m.texto} · ${r.texto}`}
                          className={`rounded-md border border-transparent bg-transparent px-1 py-1 text-[13px] hover:border-borde-fuerte ${NIVELES.find((n) => n.v === v)?.cls}`}
                        >
                          {NIVELES.map((n) => <option key={n.v} value={n.v}>{n.t}</option>)}
                        </select>
                        {distinto && <span className="size-1.5 rounded-full bg-acento" title="Distinto del valor por defecto" />}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-3 border-t border-borde px-5 py-3">
          <button disabled={enviando || !cambios} className="btn-oscuro py-2 disabled:opacity-50">
            {enviando ? "Guardando…" : cambios ? `Guardar ${cambios} cambio(s)` : "Sin cambios"}
          </button>
          <Aviso r={res} />
          <Aviso r={resR} />
          <span className="ml-auto text-xs text-texto-2">
            En Capacitaciones, cada persona registra solo las actividades de su rol (el Administrador puede todas). El capacitador ve únicamente sus sesiones.
          </span>
        </div>
      </form>
    </section>
  );
}


/** Unir a esta persona con otra que en realidad es la misma (se conserva esta). */
function UnirCon({ id, nombre, otras }: { id: number; nombre: string; otras: Opcion[] }) {
  const [res, enviar, enviando] = useActionState(unirCon, undefined);
  const [otra, setOtra] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const elegida = otras.find((o) => o.valor === otra)?.texto;
  return (
    <form action={enviar} className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-texto-2">¿Está repetida?</span>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <select name="otra" value={otra} onChange={(e) => { setOtra(e.target.value); setConfirmar(false); }} aria-label="Persona repetida" className="campo w-56 py-1.5 text-[13px]">
          <option value="">Unir con…</option>
          {otras.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
        </select>
        {otra && !confirmar && <button type="button" onClick={() => setConfirmar(true)} className="btn-secundario py-1.5 text-[13px]">Unir</button>}
        {otra && confirmar && (
          <button disabled={enviando} className="btn-oscuro py-1.5 text-[13px]">{enviando ? "Uniendo…" : `Sí, «${elegida}» es ${nombre}`}</button>
        )}
      </div>
      {confirmar && <p className="max-w-80 text-xs text-texto-2">Se queda {nombre} con los roles y sesiones de ambos; el otro registro se elimina.</p>}
      <Aviso r={res} />
    </form>
  );
}
