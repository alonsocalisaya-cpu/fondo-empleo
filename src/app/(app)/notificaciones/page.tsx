import Link from "next/link";
import { connection } from "next/server";
import { exigirUsuario } from "@/lib/auth";
import { notificacionesDe, type Notificacion } from "@/lib/notificaciones";
import { avisosPara } from "@/lib/avisos";
import { confirmarAviso } from "./actions";
import { nombresRoles } from "@/lib/permisos";
import { fechaCorta } from "@/lib/fechas";
import { Encabezado, Vacio } from "@/components/ui";

export const metadata = { title: "Notificaciones" };

const GRUPOS: { k: string; titulo: string; color: string; filtro: (n: Notificacion) => boolean }[] = [
  { k: "vencida", titulo: "Atrasadas", color: "text-[#b91c1c]", filtro: (n) => n.urgencia === "vencida" },
  { k: "pronto", titulo: "Sesiones en los próximos 3 días", color: "text-[#b45309]", filtro: (n) => n.urgencia === "pronto" },
  { k: "resto", titulo: "Pendientes", color: "text-marino", filtro: (n) => !n.urgencia },
];

export default async function Notificaciones() {
  await connection();
  const u = await exigirUsuario();
  const [todas, mensajes] = await Promise.all([notificacionesDe(u), avisosPara(u.id)]);
  return (
    <>
      <Encabezado
        antetitulo={`Actividades que le tocan a: ${nombresRoles(u.roles)}`}
        titulo="Notificaciones"
      />
      <p className="-mt-3 text-sm text-texto-2">
        Cada actividad del flujo aparece aquí cuando ya se completó lo anterior y es tu turno de registrarla. Desaparece sola al registrarla.
      </p>
      {mensajes.length > 0 && (
        <section className="card">
          <h2 className="border-b border-borde px-5 py-3 text-[15px] font-semibold text-marino">
            Mensajes <span className="font-normal text-texto-2">· {mensajes.filter((m) => !m.confirmadoEn).length} por confirmar</span>
          </h2>
          <ul className="divide-y divide-[#eef1f5]">
            {mensajes.map((m) => (
              <li key={m.id} className={`flex flex-wrap items-start justify-between gap-3 px-5 py-3 ${m.confirmadoEn ? "" : "bg-[#fff7ed]"}`}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-marino">✉️ {m.titulo}</span>
                  {m.mensaje && <span className="whitespace-pre-line text-[13px]">{m.mensaje}</span>}
                  <span className="text-xs text-texto-2">{m.de ? `De ${m.de} · ` : ""}{fechaCorta(m.creadoEn.toISOString().slice(0, 10))}</span>
                </div>
                <div className="flex items-center gap-3">
                  {m.href && <Link href={m.href} className="enlace text-[13px]">Ver la sesión →</Link>}
                  {m.confirmadoEn ? (
                    <span className="text-[13px] font-semibold text-[#166534]">✓ Enterado</span>
                  ) : (
                    <form action={confirmarAviso}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="btn-oscuro py-1.5 text-[13px]">Enterado</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {todas.length === 0 ? (
        <div className="card"><Vacio>No tienes actividades pendientes. 🎉</Vacio></div>
      ) : (
        GRUPOS.map((g) => {
          const lista = todas.filter(g.filtro);
          if (!lista.length) return null;
          return (
            <section key={g.k} className="card">
              <h2 className={`border-b border-borde px-5 py-3 text-[15px] font-semibold ${g.color}`}>
                {g.titulo} <span className="font-normal text-texto-2">· {lista.length}</span>
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">Actividad</th>
                    <th className="th">Sesión</th>
                    <th className="th">Sede</th>
                    <th className="th">Fecha</th>
                    <th className="th">Etapa</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((n) => (
                    <tr key={n.id} className={n.nueva ? "bg-[#fff7ed]" : ""}>
                      <td className="td font-medium text-marino">
                        {n.actividad}
                        {n.nueva && <span className="ml-2 rounded-full bg-acento px-1.5 py-0.5 text-[10px] font-bold text-white">NUEVA</span>}
                      </td>
                      <td className="td">{n.sesion}</td>
                      <td className="td">{n.sede}</td>
                      <td className="td whitespace-nowrap">{fechaCorta(n.fecha)} {n.hora}</td>
                      <td className="td">{n.etapa}</td>
                      <td className="td text-right"><Link href={n.href} className="enlace text-[13px]">Registrar →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })
      )}
    </>
  );
}
