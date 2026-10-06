import "server-only";
import { db } from "@/db";
import { nombreCompleto } from "@/components/ui";
import { opcionesFiltros } from "@/lib/consultas";

/** Datos para los desplegables del formulario de programación. */
export async function opcionesFormulario() {
  const [{ sedes, capacitadores, asistentes }, estructuras, arbol, horarios] = await Promise.all([
    opcionesFiltros(),
    db.query.estructuras.findMany({ orderBy: (t, { asc }) => [asc(t.orden), asc(t.id)] }),
    db.query.componentes.findMany({
      orderBy: (t, { asc }) => [asc(t.orden)],
      with: {
        actividades: {
          orderBy: (t, { asc }) => [asc(t.orden)],
          with: {
            modulos: {
              orderBy: (t, { asc }) => [asc(t.orden)],
              with: { sesiones: { orderBy: (t, { asc }) => [asc(t.orden)] } },
            },
          },
        },
      },
    }),
    db.query.sedeHorarios.findMany({orderBy:(t,{asc})=>[asc(t.horaInicio)]}),
  ]);

  const sesiones = arbol.flatMap((c) =>
    c.actividades.flatMap((a) =>
      a.modulos.map((m) => ({
        estructuraId: c.estructuraId,
        grupo: `${c.nombre} › ${a.nombre} › ${m.nombre}`,
        sesiones: m.sesiones.map((s) => ({ id: s.id, nombre: `${s.codigo} · ${s.nombre}` })),
      })),
    ),
  ).filter((g) => g.sesiones.length > 0);

  return {
    estructuras: estructuras.map((e) => ({ id: e.id, nombre: e.nombre })),
    sesiones,
    sedes: sedes.map((s) => ({ id: s.id, nombre: s.nombre, estructuraId: s.estructuraId, horarios: horarios.filter(h=>h.sedeId===s.id).map(h=>({id:h.id,nombre:h.nombre,horaInicio:h.horaInicio.slice(0,5),horaFin:h.horaFin.slice(0,5)})) })),
    capacitadores: capacitadores.map((c) => ({ id: c.id, nombre: nombreCompleto(c) })),
    asistentes: asistentes.map((a) => ({ id: a.id, nombre: nombreCompleto(a) })),
  };
}
