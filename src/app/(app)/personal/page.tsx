import Link from "next/link";
import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { RolUsuario } from "@/db/schema";
import { exigirUsuario, rolesDe } from "@/lib/auth";
import { ROLES_USUARIO, puede } from "@/lib/permisos";
import { gruposDuplicados, principal, sincronizarPersonas } from "@/lib/personas";
import { hoyISO } from "@/lib/fechas";
import { Encabezado, Vacio } from "@/components/ui";
import BotonEliminar from "@/components/BotonEliminar";
import { alternarPersona, eliminarPersona, unirGrupo, unirTodosLosRepetidos } from "./actions";
import { DarAccesoATodos, FilaPersona, FormPersona } from "./Formularios";

export const metadata = { title: "Personal" };

const fechaHora = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" }).format(d) : "nunca";

export default async function Personal({ searchParams }: PageProps<"/personal">) {
  await connection();
  const yo = await exigirUsuario();
  // Consultores o personal registrados por otra vía (importaciones) también aparecen aquí
  await sincronizarPersonas();
  const sp = await searchParams;
  const filtroRol = typeof sp.rol === "string" && sp.rol in ROLES_USUARIO ? (sp.rol as RolUsuario) : null;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const verBajas = sp.bajas === "1";
  const puedeEditar = puede(yo.roles, "rrhh", "editar");
  const puedeAccesos = puede(yo.roles, "usuarios", "editar");

  const hoy = hoyISO();
  const [gente, porCap, porAsis] = await Promise.all([
    db.query.usuarios.findMany({ orderBy: (t) => [t.nombre] }),
    db.execute<{ id: number; total: number; proximas: number }>(
      sql`select capacitador_id as id, count(*)::int as total, count(*) filter (where fecha >= ${hoy})::int as proximas from programaciones where capacitador_id is not null group by 1`,
    ),
    db.execute<{ id: number; total: number; proximas: number }>(
      sql`select asistente_id as id, count(*)::int as total, count(*) filter (where fecha >= ${hoy})::int as proximas from programaciones where asistente_id is not null group by 1`,
    ),
  ]);
  const cap = new Map(porCap.rows.map((r) => [r.id, r]));
  const asis = new Map(porAsis.rows.map((r) => [r.id, r]));
  const sesiones = (u: (typeof gente)[number]) => {
    const partes: string[] = [];
    const c = u.capacitadorId ? cap.get(u.capacitadorId) : null;
    const a = u.personalId ? asis.get(u.personalId) : null;
    if (c) partes.push(`Consultor: ${c.proximas} próximas de ${c.total}`);
    if (a) partes.push(`Asistente: ${a.proximas} próximas de ${a.total}`);
    return partes.join("\n") || "—";
  };

  const visibles = gente.filter(
    (u) =>
      (verBajas || u.activo) &&
      (!filtroRol || rolesDe(u).includes(filtroRol)) &&
      (!q || `${u.nombre} ${u.dni ?? ""} ${u.email ?? ""} ${u.usuario ?? ""}`.toLowerCase().includes(q)),
  );
  const conteo = (r: RolUsuario) => gente.filter((u) => u.activo && rolesDe(u).includes(r)).length;
  const sinAcceso = gente.filter((u) => u.activo && (!u.acceso || !u.usuario || !u.claveHash)).length;
  const repetidos = gruposDuplicados(gente);
  const otras = gente.map((u) => ({ valor: String(u.id), texto: u.nombre }));
  const roles = (Object.keys(ROLES_USUARIO) as RolUsuario[]).map((r) => ({ valor: r, texto: ROLES_USUARIO[r] }));
  const url = (extra: Record<string, string>) => {
    const p = { ...(filtroRol ? { rol: filtroRol } : {}), ...(q ? { q } : {}), ...(verBajas ? { bajas: "1" } : {}), ...extra };
    return `/personal?${new URLSearchParams(Object.entries(p).filter(([, v]) => v))}`;
  };

  return (
    <>
      <Encabezado
        antetitulo="Equipo y accesos"
        titulo="Personal"
        acciones={puedeAccesos && <Link href="/personal/permisos" className="btn-secundario">Qué puede hacer cada rol →</Link>}
      />
      <p className="-mt-3 text-sm text-texto-2">
        Cada persona se registra una sola vez con sus roles. Con el rol <strong>Capacitador</strong> aparece como consultor para asignar sesiones;
        con <strong>Asistente</strong>, en la lista de asistentes. El acceso al sistema es opcional.
      </p>

      {puedeEditar && <FormPersona roles={roles} puedeAccesos={puedeAccesos} />}
      {puedeEditar && repetidos.length > 0 && (
        <section className="card border-[#fcd34d] bg-[#fffbeb] px-5 py-4" aria-label="Personas repetidas">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-[#92400e]">⚠ Parecen personas repetidas ({repetidos.length})</h2>
            {repetidos.length > 1 && (
              <form action={unirTodosLosRepetidos}>
                <button className="btn-oscuro py-1.5 text-[13px]">Unir todas</button>
              </form>
            )}
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {repetidos.map((g) => {
              const queda = principal(g);
              return (
                <li key={g.map((x) => x.id).join("-")} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                  <span>
                    {g.map((x, i) => (
                      <span key={x.id}>
                        {i > 0 && <span className="text-texto-2"> · </span>}
                        <strong>{x.nombre}</strong>
                        <span className="text-xs text-texto-2"> ({rolesDe(x).map((r) => ROLES_USUARIO[r]).join(", ")}{x.acceso && x.usuario ? ` · usuario ${x.usuario}` : ""})</span>
                      </span>
                    ))}
                  </span>
                  <form action={unirGrupo}>
                    <input type="hidden" name="ids" value={g.map((x) => x.id).join(",")} />
                    <button className="btn-secundario py-1.5 text-[13px]">Unir en una sola: {queda.nombre}</button>
                  </form>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-[#92400e]">Al unir se conservan los roles, las sesiones y el acceso de ambos registros. Si no son la misma persona, ignora este aviso.</p>
        </section>
      )}
      {puedeAccesos && <DarAccesoATodos pendientes={sinAcceso} />}

      <form className="flex flex-wrap items-end gap-2">
        {filtroRol && <input type="hidden" name="rol" value={filtroRol} />}
        {verBajas && <input type="hidden" name="bajas" value="1" />}
        <div className="w-full sm:w-64">
          <label htmlFor="q" className="etiqueta">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="Nombre, DNI, correo o usuario" className="campo py-2" />
        </div>
        <button className="btn-secundario py-2">Buscar</button>
      </form>
      <nav aria-label="Filtrar por rol" className="-mt-2 flex flex-wrap gap-1.5">
        <Link href={url({ rol: "" })} aria-current={!filtroRol ? "page" : undefined} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${!filtroRol ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-white text-marino"}`}>
          Todos · {gente.filter((u) => u.activo).length}
        </Link>
        {roles.map((r) => (
          <Link key={r.valor} href={url({ rol: r.valor })} aria-current={filtroRol === r.valor ? "page" : undefined} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${filtroRol === r.valor ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-white text-marino"}`}>
            {r.texto} · {conteo(r.valor as RolUsuario)}
          </Link>
        ))}
        <Link href={url({ bajas: verBajas ? "" : "1" })} className="ml-auto self-center text-[13px] text-texto-2 underline">
          {verBajas ? "Ocultar a los dados de baja" : "Mostrar también a los dados de baja"}
        </Link>
      </nav>

      <section className="card overflow-x-auto">
        {visibles.length === 0 ? <Vacio>No hay personas con ese filtro.</Vacio> : (
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr><th className="th">Persona</th><th className="th">Roles</th><th className="th">Sesiones</th><th className="th">Acceso</th><th className="th">Estado</th><th className="th"></th></tr>
            </thead>
            <tbody>
              {visibles.map((u) => {
                const rs = rolesDe(u);
                const esYo = u.id === yo.id;
                const c = u.capacitadorId ? cap.get(u.capacitadorId) : null;
                const a = u.personalId ? asis.get(u.personalId) : null;
                const nSes = (c?.total ?? 0) + (a?.total ?? 0);
                return (
                  <FilaPersona
                    key={u.id}
                    p={{
                      id: u.id, nombre: u.nombre, nombres: u.nombres ?? u.nombre, apellidos: u.apellidos ?? "", dni: u.dni ?? "", email: u.email ?? "",
                      telefono: u.telefono ?? "", especialidad: u.especialidad ?? "", roles: rs, usuario: u.usuario, acceso: u.acceso && !!u.claveHash,
                      activo: u.activo, debeCambiarClave: u.debeCambiarClave, ultimoIngreso: fechaHora(u.ultimoIngreso), sesiones: sesiones(u),
                    }}
                    roles={roles}
                    nombresRoles={rs.map((r) => ROLES_USUARIO[r])}
                    esYo={esYo}
                    puedeEditar={puedeEditar}
                    puedeAccesos={puedeAccesos}
                    otras={otras}
                    acciones={
                      !esYo && (
                        <>
                          <form action={alternarPersona}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className="enlace text-[13px]">{u.activo ? "Dar de baja" : "Reactivar"}</button>
                          </form>
                          <BotonEliminar
                            accion={eliminarPersona}
                            campos={{ id: u.id }}
                            pregunta={`¿Eliminar a ${u.nombre}?`}
                            detalle={nSes ? `Sus ${nSes} sesión(es) quedarán sin consultor o asistente asignado. Si solo dejó de trabajar, mejor «Dar de baja».` : "Lo que registró en el sistema se conserva."}
                          />
                        </>
                      )
                    }
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
