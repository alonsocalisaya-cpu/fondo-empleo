import SiPuede from "@/components/SiPuede";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { documentos, programaciones, programacionSesiones } from "@/db/schema";
import { listarProgramaciones } from "@/lib/consultas";
import { examenes } from "@/lib/preparacion";
import { TIPO_DOC, enlaceDoc } from "@/lib/documentos";
import { fechaCorta, hora } from "@/lib/fechas";
import { ChipEstado, Encabezado, Kpi, Pestanas, TABS_CRONOGRAMA, Vacio, nombreCompleto } from "@/components/ui";
import { eliminarEstructura, eliminarNodo, guardarEstructura, guardarNodo, type Tipo } from "./actions";
import BotonEliminar from "@/components/BotonEliminar";

export const metadata = { title: "Estructura del programa" };

const NIVEL: Record<Tipo, { nombre: string; plural: string; hijo?: Tipo; tag: string }> = {
  c: { nombre: "Componente", plural: "componentes", hijo: "a", tag: "bg-marino text-white" },
  a: { nombre: "Actividad", plural: "actividades", hijo: "m", tag: "bg-[#dce6f2] text-marino" },
  m: { nombre: "Módulo", plural: "módulos", hijo: "s", tag: "bg-[#e8edf3] text-[#334155]" },
  s: { nombre: "Sesión", plural: "sesiones", tag: "bg-[#d8eee8] text-acento-oscuro" },
};

type Nodo = {
  tipo: Tipo;
  id: number;
  estructuraId?: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  meta: string;
  padre?: string;
  ruta: string[];
  duracionMin?: number;
  modalidad?: string;
  asistenciaMinima?: number;
  contenido?: string | null;
  recursoMetodologico?: string | null;
  perfilSalida?: string | null;
};

/** Del código 1.1.2-M1-S3 se muestra lo último (S3); los componentes y actividades, completos. */
const corto = (codigo: string) => codigo.split("-").at(-1) ?? codigo;
const horas = (min: number) => `${Math.round((min / 60) * 10) / 10} h`;
const EXAMEN = { entrada: "Examen de entrada", salida: "Examen de salida", ambos: "Examen de entrada y de salida" } as const;
const EX_CORTO = { entrada: "E", salida: "S", ambos: "E·S" } as const;

type Arbol = Awaited<ReturnType<typeof cargarArbol>>;
type Ses = Arbol[number]["actividades"][number]["modulos"][number]["sesiones"][number];
type Info = { docs: number; progs: number; examen: "entrada" | "salida" | "ambos" | null };

function cargarArbol() {
  return db.query.componentes.findMany({
    orderBy: (t, { asc }) => [asc(t.orden), asc(t.codigo)],
    with: {
      actividades: {
        orderBy: (t, { asc }) => [asc(t.orden), asc(t.codigo)],
        with: {
          modulos: {
            orderBy: (t, { asc }) => [asc(t.orden), asc(t.codigo)],
            with: { sesiones: { orderBy: (t, { asc }) => [asc(t.orden), asc(t.codigo)] } },
          },
        },
      },
    },
  });
}

const url = (nodo?: string) => `/estrategico/cronograma/estructura${nodo ? `?nodo=${nodo}` : ""}`;

/** Ficha de una sesión dentro del mapa: número, nombre corto y marcas de examen / material / programaciones. */
function ChipSesion({ s, info, activa }: { s: Ses; info: Info; activa: boolean }) {
  const sinMaterial = info.docs === 0;
  return (
    <Link
      href={url(`s-${s.id}`)}
      title={`${s.codigo} · ${s.nombre}\n${horas(s.duracionMin)} · ${info.docs} documento(s) · ${info.progs} programación(es)${info.examen ? ` · ${EXAMEN[info.examen]}` : ""}`}
      className={`group flex min-w-0 flex-col gap-1 rounded-lg border bg-white px-2.5 py-2 text-left transition-colors hover:border-acento hover:shadow-sm ${
        activa ? "border-acento ring-2 ring-[#bfe3d9]" : sinMaterial ? "border-[#fcd34d]" : "border-borde"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className="rounded bg-[#d8eee8] px-1.5 text-[10px] font-bold text-acento-oscuro">{corto(s.codigo)}</span>
        {info.examen && <span className="rounded bg-[#ede9fe] px-1.5 text-[10px] font-bold text-[#5b21b6]" title={EXAMEN[info.examen]}>📝 {EX_CORTO[info.examen]}</span>}
        <span className="ml-auto text-[10px] text-texto-2">{horas(s.duracionMin)}</span>
      </span>
      <span className="line-clamp-2 text-xs leading-snug font-medium text-texto group-hover:text-marino">{s.nombre}</span>
      <span className="flex gap-3 whitespace-nowrap text-[10px] text-texto-2">
        <span className={sinMaterial ? "font-semibold text-[#b45309]" : "text-[#166534]"}>{sinMaterial ? "⚠ sin material" : `📄 ${info.docs}`}</span>
        <span>📅 {info.progs}</span>
      </span>
    </Link>
  );
}

/** Mapa visual de una actividad: sus módulos en filas y las sesiones como fichas en orden. */
function MapaActividad({ a, info, sel }: { a: Arbol[number]["actividades"][number]; info: Map<number, Info>; sel: string }) {
  const ses = a.modulos.flatMap((m) => m.sesiones);
  const min = ses.reduce((t, s) => t + s.duracionMin, 0);
  const progs = ses.reduce((t, s) => t + (info.get(s.id)?.progs ?? 0), 0);
  return (
    <article className="card overflow-hidden">
      <Link href={url(`a-${a.id}`)} className={`flex flex-wrap items-baseline justify-between gap-2 border-b border-borde px-5 py-3 hover:bg-fondo ${sel === `a-${a.id}` ? "bg-[#e6f4f0]" : ""}`}>
        <h3 className="font-semibold text-marino">
          <span className="mr-1.5 rounded bg-[#dce6f2] px-1.5 py-0.5 text-xs">{a.codigo}</span>
          {a.nombre}
        </h3>
        <span className="text-xs text-texto-2">{a.modulos.length} módulos · {ses.length} sesiones · {horas(min)} · {progs} programaciones</span>
      </Link>
      {a.modulos.length === 0 ? (
        <p className="px-5 py-3 text-[13px] text-texto-2">Sin módulos todavía.</p>
      ) : (
        <div className="flex flex-col divide-y divide-[#eef1f5]">
          {a.modulos.map((m) => (
            <div key={m.id} className="grid grid-cols-1 gap-2 px-5 py-3 md:grid-cols-[180px_1fr]">
              <Link href={url(`m-${m.id}`)} className={`flex flex-col rounded-md px-2 py-1 hover:bg-fondo ${sel === `m-${m.id}` ? "bg-[#e6f4f0]" : ""}`}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-texto-2">{corto(m.codigo)} · Módulo</span>
                <span className="text-sm font-semibold leading-snug text-[#334155]">{m.nombre}</span>
                <span className="text-[11px] text-texto-2">{m.sesiones.length} ses. · {horas(m.sesiones.reduce((t, s) => t + s.duracionMin, 0))}</span>
              </Link>
              {m.sesiones.length === 0 ? (
                <p className="self-center text-[13px] text-texto-2">Sin sesiones.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                  {m.sesiones.map((s) => <ChipSesion key={s.id} s={s} info={info.get(s.id)!} activa={sel === `s-${s.id}`} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function Estructura({ searchParams }: PageProps<"/estrategico/cronograma/estructura">) {
  await connection();
  const sp = await searchParams;
  const sel = typeof sp.nodo === "string" ? sp.nodo : "";
  const nuevo = sp.nuevo === "1";
  const error = typeof sp.error === "string" ? sp.error : "";

  // Estructuras del programa (Arequipa, …): se trabaja con una a la vez
  const [estructurasLista, arbolCompleto] = await Promise.all([
    db.query.estructuras.findMany({ orderBy: (t, { asc }) => [asc(t.orden), asc(t.id)] }),
    cargarArbol(),
  ]);
  const [tSel, idSel] = sel.split("-");
  const contiene = (c: (typeof arbolCompleto)[number]) =>
    tSel === "c"
      ? c.id === Number(idSel)
      : c.actividades.some((a) =>
          tSel === "a" ? a.id === Number(idSel) : a.modulos.some((m) => (tSel === "m" ? m.id === Number(idSel) : m.sesiones.some((x) => x.id === Number(idSel)))),
        );
  const estructura =
    estructurasLista.find((e) => e.id === Number(sp.estructura)) ??
    (sel ? estructurasLista.find((e) => arbolCompleto.some((c) => c.estructuraId === e.id && contiene(c))) : undefined) ??
    estructurasLista[0];
  const arbol = arbolCompleto.filter((c) => c.estructuraId === estructura?.id);
  const urlEst = (id?: number, extra = "") => `/estrategico/cronograma/estructura?estructura=${id ?? estructura?.id ?? ""}${extra}`;
  const todas = arbol.flatMap((c) => c.actividades.flatMap((a) => a.modulos.flatMap((m) => m.sesiones)));
  const ids = todas.map((s) => s.id);

  // Material oficial, programaciones y examen de cada sesión
  const [docs, progsPrin, progsComb, ex] = await Promise.all([
    ids.length
      ? db.select({ id: documentos.sesionId, n: sql<number>`count(*)::int` }).from(documentos).where(and(inArray(documentos.sesionId, ids), isNull(documentos.programacionId))).groupBy(documentos.sesionId)
      : [],
    db.select({ id: programaciones.sesionId, n: sql<number>`count(*)::int` }).from(programaciones).where(ne(programaciones.estado, "cancelada")).groupBy(programaciones.sesionId),
    db
      .select({ id: programacionSesiones.sesionId, n: sql<number>`count(*)::int` })
      .from(programacionSesiones)
      .innerJoin(programaciones, eq(programaciones.id, programacionSesiones.programacionId))
      .where(ne(programaciones.estado, "cancelada"))
      .groupBy(programacionSesiones.sesionId),
    examenes(ids),
  ]);
  const cuenta = (l: { id: number | null; n: number }[]) => new Map(l.map((x) => [x.id, x.n]));
  const [mDocs, mPrin, mComb] = [cuenta(docs), cuenta(progsPrin), cuenta(progsComb)];
  const info = new Map<number, Info>(
    ids.map((id) => [id, { docs: mDocs.get(id) ?? 0, progs: (mPrin.get(id) ?? 0) + (mComb.get(id) ?? 0), examen: ex.get(id) ?? null }]),
  );

  // Nodos con su ruta (para el panel de edición)
  const nodos: Nodo[] = [];
  for (const c of arbol) {
    nodos.push({ tipo: "c", ...c, meta: "", ruta: [] });
    for (const a of c.actividades) {
      nodos.push({ tipo: "a", ...a, meta: "", padre: `c-${c.id}`, ruta: [c.nombre] });
      for (const m of a.modulos) {
        nodos.push({ tipo: "m", ...m, meta: "", padre: `a-${a.id}`, ruta: [c.nombre, a.nombre] });
        for (const s of m.sesiones) {
          nodos.push({ tipo: "s", ...s, descripcion: s.objetivo, meta: "", padre: `m-${m.id}`, ruta: [c.nombre, a.nombre, m.nombre] });
        }
      }
    }
  }
  const actual = nodos.find((n) => `${n.tipo}-${n.id}` === sel);
  // Nodos abiertos en el árbol: el seleccionado y sus antecesores
  const abiertos = new Set<string>();
  for (let n = actual; n; n = n.padre ? nodos.find((x) => `${x.tipo}-${x.id}` === n!.padre) : undefined) abiertos.add(`${n.tipo}-${n.id}`);

  const [progs, docsSesion] =
    actual?.tipo === "s"
      ? await Promise.all([
          listarProgramaciones(eq(programaciones.sesionId, actual.id)),
          db.select().from(documentos).where(and(eq(documentos.sesionId, actual.id), isNull(documentos.programacionId))).orderBy(documentos.tipo, documentos.nombre),
        ])
      : [[], []];

  const totMin = todas.reduce((t, s) => t + s.duracionMin, 0);
  const sinMaterial = todas.filter((s) => info.get(s.id)!.docs === 0).length;
  const programadas = todas.filter((s) => info.get(s.id)!.progs > 0).length;

  // Qué mostrar en el mapa: todo, o solo el componente / actividad / módulo seleccionado
  const compDe = (t: Tipo, id: number) =>
    arbol.find((c) =>
      t === "c" ? c.id === id : c.actividades.some((a) => (t === "a" ? a.id === id : a.modulos.some((m) => (t === "m" ? m.id === id : m.sesiones.some((s) => s.id === id))))),
    );
  const actDe = (t: Tipo, id: number) =>
    arbol.flatMap((c) => c.actividades).find((a) => (t === "a" ? a.id === id : a.modulos.some((m) => (t === "m" ? m.id === id : m.sesiones.some((s) => s.id === id)))));

  return (
    <>
      <Encabezado
        antetitulo="Estratégico · Cronograma de capacitaciones"
        titulo="Estructura del programa"
        acciones={<SiPuede modulo="cronograma"><Link href={urlEst(undefined, "&nuevo=1")} className="btn-primario">+ Nuevo componente</Link></SiPuede>}
      />
      <Pestanas items={TABS_CRONOGRAMA} actual="/estrategico/cronograma/estructura" />

      {/* ── Estructuras: una por programa o región (Arequipa, …) ── */}
      <section aria-label="Estructuras" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-texto-2">Estructura:</span>
          {estructurasLista.map((e) => (
            <Link
              key={e.id}
              href={urlEst(e.id)}
              aria-current={e.id === estructura?.id ? "page" : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                e.id === estructura?.id ? "border-acento bg-acento text-white shadow-sm" : "border-borde-fuerte bg-white text-marino hover:bg-[#f1f4f3]"
              }`}
            >
              {e.nombre}
              <span className={`ml-1.5 font-normal ${e.id === estructura?.id ? "text-white/80" : "text-texto-2"}`}>
                · {arbolCompleto.filter((c) => c.estructuraId === e.id).length} comp.
              </span>
            </Link>
          ))}
          <SiPuede modulo="cronograma">
            <details className="group/nueva relative">
              <summary className="cursor-pointer list-none rounded-full border border-dashed border-acento px-4 py-1.5 text-sm font-semibold text-acento-oscuro hover:bg-[#e6f4f0]">
                + Nueva estructura
              </summary>
              <form action={guardarEstructura} className="card absolute left-0 z-20 mt-2 flex w-[min(28rem,90vw)] flex-col gap-3 p-4 shadow-lg">
                <h3 className="font-semibold text-marino">Nueva estructura</h3>
                <div>
                  <label htmlFor="ne-nombre" className="etiqueta">Nombre (p. ej. la región o el programa) *</label>
                  <input id="ne-nombre" name="nombre" required placeholder="Lima, Cusco, Programa 2027…" className="campo" />
                </div>
                <div>
                  <label htmlFor="ne-proyecto" className="etiqueta">Nombre del proyecto (sale en la lista de asistencia)</label>
                  <textarea id="ne-proyecto" name="proyecto" rows={2} className="campo resize-y" />
                </div>
                <div>
                  <label htmlFor="ne-desc" className="etiqueta">Descripción</label>
                  <textarea id="ne-desc" name="descripcion" rows={2} className="campo resize-y" />
                </div>
                <p className="text-xs text-texto-2">Luego agrega sus componentes, actividades, módulos y sesiones. Los códigos no pueden repetir los de otra estructura (p. ej. usa «LIM-1.1»).</p>
                <button className="btn-oscuro self-start">Crear estructura</button>
              </form>
            </details>
          </SiPuede>
          {estructura && (
            <SiPuede modulo="cronograma">
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-full px-3 py-1.5 text-sm text-texto-2 hover:bg-white hover:text-marino">✎ Editar «{estructura.nombre}»</summary>
                <div className="card absolute left-0 z-20 mt-2 flex w-[min(28rem,90vw)] flex-col gap-3 p-4 shadow-lg">
                  <form action={guardarEstructura} className="flex flex-col gap-3">
                    <input type="hidden" name="id" value={estructura.id} />
                    <div>
                      <label htmlFor="ee-nombre" className="etiqueta">Nombre *</label>
                      <input id="ee-nombre" name="nombre" required defaultValue={estructura.nombre} className="campo" />
                    </div>
                    <div>
                      <label htmlFor="ee-proyecto" className="etiqueta">Nombre del proyecto (lista de asistencia)</label>
                      <textarea id="ee-proyecto" name="proyecto" rows={2} defaultValue={estructura.proyecto ?? ""} className="campo resize-y" />
                    </div>
                    <div>
                      <label htmlFor="ee-desc" className="etiqueta">Descripción</label>
                      <textarea id="ee-desc" name="descripcion" rows={2} defaultValue={estructura.descripcion ?? ""} className="campo resize-y" />
                    </div>
                    <button className="btn-secundario self-start">Guardar</button>
                  </form>
                  {arbol.length === 0 && (
                    <form action={eliminarEstructura} className="border-t border-borde pt-3">
                      <input type="hidden" name="id" value={estructura.id} />
                      <button className="text-sm font-semibold text-[#991b1b] hover:underline">Eliminar esta estructura (está vacía)</button>
                    </form>
                  )}
                </div>
              </details>
            </SiPuede>
          )}
        </div>
        {estructura?.descripcion && <p className="text-[13px] text-texto-2">{estructura.descripcion}</p>}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi etiqueta="Componentes" valor={arbol.length} />
        <Kpi etiqueta="Actividades" valor={arbol.reduce((t, c) => t + c.actividades.length, 0)} />
        <Kpi etiqueta="Módulos" valor={arbol.reduce((t, c) => t + c.actividades.reduce((u, a) => u + a.modulos.length, 0), 0)} />
        <Kpi etiqueta="Sesiones" valor={todas.length} detalle={`${horas(totMin)} de capacitación`} />
        <Kpi etiqueta="Programadas" valor={`${programadas}/${todas.length}`} detalle="sesiones con fecha en alguna sede" />
        <Kpi etiqueta="Sin material" valor={sinMaterial} detalle="sesiones sin documentos oficiales" tono={sinMaterial ? "alerta" : "ok"} />
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── Árbol plegable ── */}
        <nav aria-label="Árbol del programa" className="card w-full shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-88 lg:overflow-y-auto">
          <div className="flex items-center justify-between border-b border-borde px-4 py-2.5">
            <Link href={urlEst()} className={`text-sm font-semibold ${!sel ? "text-acento-oscuro" : "text-marino hover:underline"}`}>Todo «{estructura?.nombre ?? "el programa"}»</Link>
            <span className="flex gap-1">
              {(["c", "a", "m", "s"] as Tipo[]).map((t) => (
                <span key={t} title={NIVEL[t].nombre} className={`rounded px-1.5 text-[10px] font-bold ${NIVEL[t].tag}`}>{t.toUpperCase()}</span>
              ))}
            </span>
          </div>
          {arbol.length === 0 && <Vacio>Aún no hay componentes.</Vacio>}
          <ul className="flex flex-col py-1.5 text-sm">
            {arbol.map((c) => (
              <li key={c.id}>
                <details open={!actual || abiertos.has(`c-${c.id}`)} className="group/c">
                  <summary className={`flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 font-semibold text-marino hover:bg-fondo ${sel === `c-${c.id}` ? "bg-[#e6f4f0]" : ""}`}>
                    <span className="w-3 text-[10px] text-texto-2 transition-transform group-open/c:rotate-90">▶</span>
                    <Link href={url(`c-${c.id}`)} className="flex-1 hover:underline">{c.nombre}</Link>
                    <span className="text-[11px] font-normal text-texto-2">{c.actividades.length} act.</span>
                  </summary>
                  <ul className="ml-[18px] border-l border-borde">
                    {c.actividades.map((a) => (
                      <li key={a.id}>
                        <details open={abiertos.has(`a-${a.id}`)} className="group/a">
                          <summary className={`flex cursor-pointer list-none items-start gap-2 py-1.5 pl-2 pr-3 hover:bg-fondo ${sel === `a-${a.id}` ? "bg-[#e6f4f0]" : ""}`}>
                            <span className="mt-0.5 w-3 text-[10px] text-texto-2 transition-transform group-open/a:rotate-90">▶</span>
                            <Link href={url(`a-${a.id}`)} className="flex-1 leading-snug hover:underline">
                              <span className="font-semibold text-texto-2">{a.codigo}</span> {a.nombre}
                            </Link>
                          </summary>
                          <ul className="ml-[14px] border-l border-borde">
                            {a.modulos.map((m) => (
                              <li key={m.id}>
                                <details open={abiertos.has(`m-${m.id}`)} className="group/m">
                                  <summary className={`flex cursor-pointer list-none items-start gap-2 py-1.5 pl-2 pr-3 hover:bg-fondo ${sel === `m-${m.id}` ? "bg-[#e6f4f0]" : ""}`}>
                                    <span className="mt-0.5 w-3 text-[10px] text-texto-2 transition-transform group-open/m:rotate-90">▶</span>
                                    <Link href={url(`m-${m.id}`)} className="flex-1 leading-snug text-[#334155] hover:underline">
                                      <span className="text-[11px] font-bold text-texto-2">{corto(m.codigo)}</span> {m.nombre}
                                    </Link>
                                    <span className="text-[11px] text-texto-2">{m.sesiones.length}</span>
                                  </summary>
                                  <ul className="ml-[14px] border-l border-borde">
                                    {m.sesiones.map((s) => {
                                      const i = info.get(s.id)!;
                                      return (
                                        <li key={s.id}>
                                          <Link
                                            href={url(`s-${s.id}`)}
                                            className={`flex items-start gap-2 py-1 pl-3 pr-3 text-[13px] leading-snug hover:bg-fondo ${sel === `s-${s.id}` ? "bg-[#e6f4f0] font-semibold text-acento-oscuro" : ""}`}
                                          >
                                            <span className="mt-0.5 rounded bg-[#d8eee8] px-1 text-[10px] font-bold text-acento-oscuro">{corto(s.codigo)}</span>
                                            <span className="flex-1">{s.nombre}</span>
                                            {i.examen && <span title={EXAMEN[i.examen]} className="text-[10px]">📝</span>}
                                            {i.docs === 0 && <span title="Sin material" className="text-[10px] text-[#b45309]">⚠</span>}
                                          </Link>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </details>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </nav>

        <section className="flex min-w-0 flex-1 flex-col gap-5">
          {actual && (
            <nav aria-label="Ubicación" className="flex flex-wrap items-center gap-1.5 text-[13px] text-texto-2">
              <Link href={urlEst()} className="hover:underline">{estructura?.nombre ?? "Programa"}</Link>
              {[...abiertos].reverse().map((k) => {
                const n = nodos.find((x) => `${x.tipo}-${x.id}` === k)!;
                return (
                  <span key={k} className="flex items-center gap-1.5">
                    ›
                    <Link href={url(k)} className={k === sel ? "font-semibold text-marino" : "hover:underline"}>
                      <span className={`mr-1 rounded px-1 text-[10px] font-bold ${NIVEL[n.tipo].tag}`}>{n.tipo.toUpperCase()}</span>
                      {n.nombre}
                    </Link>
                  </span>
                );
              })}
            </nav>
          )}

          {nuevo && (
            <SiPuede modulo="cronograma">
              <FormNodo tipo="c" estructuraId={estructura?.id} />
            </SiPuede>
          )}

          {/* ── Sesión seleccionada: su ficha completa ── */}
          {actual?.tipo === "s" && (
            <>
              <DetalleSesion n={actual} i={info.get(actual.id)!} docs={docsSesion} />
              <div className="card">
                <div className="flex items-center justify-between border-b border-borde px-6 py-4">
                  <h3 className="text-[17px] font-semibold text-marino">Programaciones de esta sesión</h3>
                  <SiPuede modulo="cronograma">
                    <Link href={`/estrategico/cronograma/nueva?sesion=${actual.id}`} className="btn-primario">+ Programar en sede</Link>
                  </SiPuede>
                </div>
                {progs.length === 0 ? (
                  <Vacio>Esta sesión aún no se ha programado en ninguna sede.</Vacio>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="th">Sede</th><th className="th">Fecha</th><th className="th">Horario</th>
                        <th className="th">Consultor</th><th className="th">Estado</th><th className="th"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {progs.map((p) => (
                        <tr key={p.id}>
                          <td className="td font-medium">{p.sede.nombre}</td>
                          <td className="td">{fechaCorta(p.fecha)}</td>
                          <td className="td">{hora(p.horaInicio)} – {hora(p.horaFin)}</td>
                          <td className="td">{nombreCompleto(p.capacitador)}</td>
                          <td className="td"><ChipEstado estado={p.estado} sinCapacitador={!p.capacitador} /></td>
                          <td className="td"><Link href={`/operativo/capacitaciones/${p.id}`} className="enlace">Expediente</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ── Mapa: todo el programa, o la parte seleccionada ── */}
          {actual?.tipo !== "s" && (
            <>
              {(actual ? [compDe(actual.tipo, actual.id)!] : arbol).map((c) => (
                <section key={c.id} className="flex flex-col gap-3">
                  <Link href={url(`c-${c.id}`)} className="flex items-baseline gap-2 hover:underline">
                    <span className="rounded bg-marino px-2 py-0.5 text-xs font-bold text-white">{c.codigo}</span>
                    <h2 className="text-lg font-bold text-marino">{c.nombre}</h2>
                    <span className="text-xs text-texto-2">{c.actividades.length} actividades</span>
                  </Link>
                  {c.descripcion && <p className="-mt-2 text-[13px] text-texto-2">{c.descripcion}</p>}
                  {(actual && actual.tipo !== "c" ? [actDe(actual.tipo, actual.id)!] : c.actividades).map((a) => (
                    <MapaActividad key={a.id} a={a} info={info} sel={sel} />
                  ))}
                  {c.actividades.length === 0 && <p className="text-[13px] text-texto-2">Sin actividades todavía.</p>}
                </section>
              ))}
              {!actual && (
                <p className="flex flex-wrap items-center gap-3 text-xs text-texto-2">
                  <span className="rounded border border-borde bg-white px-1.5">📄 n</span> documentos de material
                  <span className="rounded border border-[#fcd34d] bg-white px-1.5 text-[#b45309]">⚠ sin material</span>
                  <span>📅 programaciones</span>
                  <span className="rounded bg-[#ede9fe] px-1.5 font-bold text-[#5b21b6]">📝 E / S</span> examen de entrada / salida
                  <span>· Haz clic en cualquier parte para verla o editarla.</span>
                </p>
              )}
            </>
          )}

          {/* ── Edición del elemento seleccionado ── */}
          {actual && (
            <SiPuede modulo="cronograma">
              <details className="card">
                <summary className="cursor-pointer px-6 py-4 font-semibold text-marino">✎ Editar {NIVEL[actual.tipo].nombre.toLowerCase()}</summary>
                <div className="border-t border-borde">
                  <FormNodo key={sel} tipo={actual.tipo} nodo={actual} />
                </div>
              </details>
              {NIVEL[actual.tipo].hijo && (
                <details className="card border-dashed">
                  <summary className="cursor-pointer px-6 py-4 font-semibold text-marino">+ Agregar {NIVEL[NIVEL[actual.tipo].hijo!].nombre.toLowerCase()} en «{actual.nombre}»</summary>
                  <div className="border-t border-borde">
                    <FormNodo key={`nuevo-${sel}`} tipo={NIVEL[actual.tipo].hijo!} padreId={actual.id} padreNombre={actual.nombre} />
                  </div>
                </details>
              )}
            </SiPuede>
          )}
        </section>
      </div>
    </>
  );
}

/** Ficha de lectura de una sesión: objetivo, contenido, recursos, perfil, examen y material. */
function DetalleSesion({ n, i, docs }: { n: Nodo; i: Info; docs: (typeof documentos.$inferSelect)[] }) {
  const lista = (t?: string | null) => (t ? t.split("\n").filter((x) => x.trim()) : []);
  return (
    <article className="card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[13px] text-texto-2">{n.codigo}</span>
          <h2 className="text-[22px] font-semibold leading-tight text-marino">{n.nombre}</h2>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-[#eef1f5] px-2.5 py-1 font-semibold text-marino">⏱ {horas(n.duracionMin ?? 0)}</span>
          <span className="rounded-full bg-[#eef1f5] px-2.5 py-1 font-semibold capitalize text-marino">{n.modalidad}</span>
          <span className="rounded-full bg-[#eef1f5] px-2.5 py-1 font-semibold text-marino">Asistencia mín. {n.asistenciaMinima}%</span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${i.examen ? "bg-[#ede9fe] text-[#5b21b6]" : "bg-[#eef1f5] text-texto-2"}`}>
            📝 {i.examen ? EXAMEN[i.examen] : "Sin examen"}
          </span>
        </div>
      </div>
      {n.descripcion && <p className="text-sm">{n.descripcion}</p>}
      <div className="grid grid-cols-1 gap-5 text-sm md:grid-cols-3">
        {[
          ["Contenido", lista(n.contenido)],
          ["Recurso metodológico", lista(n.recursoMetodologico)],
        ].map(([t, v]) => (
          <div key={t as string}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-texto-2">{t as string}</h3>
            {(v as string[]).length ? <ul className="list-disc space-y-0.5 pl-4">{(v as string[]).map((l, k) => <li key={k}>{l}</li>)}</ul> : <p className="text-texto-2">—</p>}
          </div>
        ))}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-texto-2">Perfil de salida</h3>
          <p>{n.perfilSalida ?? "—"}</p>
        </div>
      </div>
      <div className="border-t border-borde pt-3">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-texto-2">Material oficial ({docs.length})</h3>
        {docs.length === 0 ? (
          <p className="text-[13px] text-[#b45309]">
            ⚠ Aún no hay documentos. Súbelos en <Link href={`/soporte/gestion-documental?sesion=${n.id}`} className="underline">Gestión documental</Link>.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-[13px]">
            {docs.map((d) => (
              <li key={d.id}>
                <a href={enlaceDoc(d)} className="flex items-center gap-1.5 rounded-md border border-borde px-2.5 py-1 hover:bg-fondo">
                  {d.archivo ? "⬇" : "↗"} {d.nombre} <span className="text-xs text-texto-2">· {TIPO_DOC[d.tipo]}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function FormNodo({
  tipo,
  nodo,
  padreId,
  padreNombre,
  estructuraId,
}: {
  tipo: Tipo;
  nodo?: Nodo;
  padreId?: number;
  padreNombre?: string;
  estructuraId?: number;
}) {
  const edita = !!nodo;
  const n = NIVEL[tipo].nombre.toLowerCase();
  const titulo = edita ? nodo.nombre : `Agregar ${n}${padreNombre ? ` en «${padreNombre}»` : ""}`;
  const pre = `${tipo}${nodo?.id ?? "nuevo"}`; // prefijo único para los id de los campos

  return (
    <div className={`card flex flex-col gap-4 p-6 ${edita ? "" : "border-dashed"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {edita && nodo.ruta.length > 0 && <span className="text-[13px] text-texto-2">{nodo.ruta.join(" › ")}</span>}
          <h2 className={`font-semibold text-marino ${edita ? "text-[22px]" : "text-[17px]"}`}>
            {edita && <span className="text-texto-2">{NIVEL[tipo].nombre} · </span>}
            {titulo}
          </h2>
        </div>
        {edita && (
          <BotonEliminar
            accion={eliminarNodo}
            campos={{ tipo, id: nodo.id, padre: nodo.padre ?? "", ...(tipo === "c" && nodo.estructuraId ? { estructura: nodo.estructuraId } : {}) }}
            pregunta={`¿Eliminar ${NIVEL[tipo].nombre.toLowerCase()} «${titulo}»?`}
            detalle={tipo === "s" ? "Se borra su material del repositorio." : "Se borra con todo lo que contiene."}
            grande
          />
        )}
      </div>

      <form action={guardarNodo} className="flex flex-col gap-4">
        <input type="hidden" name="tipo" value={tipo} />
        {edita && <input type="hidden" name="id" value={nodo.id} />}
        {padreId && <input type="hidden" name="padreId" value={padreId} />}
        {tipo === "c" && !edita && estructuraId && <input type="hidden" name="estructuraId" value={estructuraId} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor={`${pre}-codigo`} className="etiqueta">Código</label>
            <input id={`${pre}-codigo`} name="codigo" required defaultValue={nodo?.codigo} className="campo uppercase" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${pre}-nombre`} className="etiqueta">Nombre</label>
            <input id={`${pre}-nombre`} name="nombre" required defaultValue={nodo?.nombre} className="campo" />
          </div>
          <div>
            <label htmlFor={`${pre}-orden`} className="etiqueta">Orden</label>
            <input id={`${pre}-orden`} name="orden" type="number" min={0} defaultValue={nodo?.orden ?? 0} className="campo" />
          </div>
          {tipo === "s" && (
            <>
              <div>
                <label htmlFor={`${pre}-dur`} className="etiqueta">Duración (minutos)</label>
                <input id={`${pre}-dur`} name="duracionMin" type="number" min={15} step={15} defaultValue={nodo?.duracionMin ?? 120} className="campo" />
              </div>
              <div>
                <label htmlFor={`${pre}-mod`} className="etiqueta">Modalidad</label>
                <select id={`${pre}-mod`} name="modalidad" defaultValue={nodo?.modalidad ?? "presencial"} className="campo">
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                  <option value="mixta">Mixta</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`${pre}-min`} className="etiqueta">Asistencia mínima para aprobar (%)</label>
                <input id={`${pre}-min`} name="asistenciaMinima" type="number" min={0} max={100} defaultValue={nodo?.asistenciaMinima ?? 80} className="campo" />
              </div>
            </>
          )}
        </div>
        <div>
          <label htmlFor={`${pre}-desc`} className="etiqueta">{tipo === "s" ? "Explicación / objetivo de la sesión" : "Descripción"}</label>
          <textarea id={`${pre}-desc`} name="descripcion" rows={2} defaultValue={nodo?.descripcion ?? ""} className="campo resize-y" />
        </div>
        {tipo === "s" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label htmlFor={`${pre}-cont`} className="etiqueta">Contenido (un tema por línea)</label>
              <textarea id={`${pre}-cont`} name="contenido" rows={4} defaultValue={nodo?.contenido ?? ""} className="campo resize-y" />
            </div>
            <div>
              <label htmlFor={`${pre}-rec`} className="etiqueta">Recurso metodológico (uno por línea)</label>
              <textarea id={`${pre}-rec`} name="recursoMetodologico" rows={4} defaultValue={nodo?.recursoMetodologico ?? ""} className="campo resize-y" />
            </div>
            <div>
              <label htmlFor={`${pre}-perf`} className="etiqueta">Perfil de salida / objetivo</label>
              <textarea id={`${pre}-perf`} name="perfilSalida" rows={4} defaultValue={nodo?.perfilSalida ?? ""} className="campo resize-y" />
            </div>
          </div>
        )}
        <div>
          <button className={edita ? "btn-secundario" : "btn-oscuro"}>{edita ? "Guardar cambios" : `Agregar ${n}`}</button>
        </div>
      </form>
    </div>
  );
}
