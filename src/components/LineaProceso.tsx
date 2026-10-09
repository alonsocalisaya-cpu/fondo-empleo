import Link from "next/link";
import type { EstadoPaso } from "@/lib/flujo-pre";

type Paso = { clave: string; titulo: string; corto: string; estado: EstadoPaso; fase: number; carril: string };
type Est = EstadoPaso | "detenido";

const FASE_CORTA: Record<number, string> = { 1: "Programación", 2: "Preparación", 3: "Salida", 4: "Cierre", 5: "Entregables", 6: "Documentación", 7: "Revisión y cierre" };

const COLOR: Record<Est, { relleno: string; borde: string; texto: string; etiqueta: string }> = {
  hecho: { relleno: "#16a34a", borde: "#16a34a", texto: "#ffffff", etiqueta: "#166534" },
  disponible: { relleno: "#c2410c", borde: "#c2410c", texto: "#ffffff", etiqueta: "#9a3412" },
  bloqueado: { relleno: "#ffffff", borde: "#cbd5e1", texto: "#64748b", etiqueta: "#64748b" },
  no_aplica: { relleno: "#f1f5f9", borde: "#cbd5e1", texto: "#94a3b8", etiqueta: "#94a3b8" },
  detenido: { relleno: "#dc2626", borde: "#dc2626", texto: "#ffffff", etiqueta: "#991b1b" },
};
const TXT: Record<Est, string> = {
  hecho: "Hecho",
  disponible: "En curso",
  bloqueado: "Pendiente",
  no_aplica: "No aplica",
  detenido: "Detenido",
};

/**
 * Línea del proceso: un punto por actividad, unidos por una línea y coloreados según su estado.
 * La fase 1 reúne la validación de programación y local; en la fase 2 se abren dos carriles
 * en paralelo que se vuelven a unir en la fase 3. Bajo cada punto va un nombre corto.
 */
export default function LineaProceso({
  pasos,
  detenido = false,
  compacto = false,
  info = {},
  titulo = "Seguimiento de la sesión",
  enlace,
  seleccionado,
}: {
  /** Adónde lleva cada punto (por defecto, a su tarjeta en la página) */
  enlace?: (clave: string) => string;
  /** Actividad abierta ahora (se resalta con un anillo) */
  seleccionado?: string;
  titulo?: string;
  pasos: Paso[];
  detenido?: boolean; // local no confirmado → reprogramar
  compacto?: boolean; // versión mini, sin textos (bandeja)
  info?: Record<string, string>; // detalle por actividad (quién / cuándo) para el mensaje al pasar el mouse
}) {
  const W = compacto ? 22 : 62; // ancho de columna
  const R = compacto ? 6 : 8;
  const D = compacto ? 11 : 27; // separación de carriles
  const yCap = compacto ? R + 4 : 36;
  const yMid = yCap + D;
  const yAsi = yMid + D;
  const xIni = compacto ? R + 2 : 34;

  const num = new Map(pasos.map((p, i) => [p.clave, i + 1]));
  const pos = new Map<string, { x: number; y: number; lugar: "arriba" | "abajo" }>();
  const rangos: { fase: number; x0: number; x1: number }[] = [];
  const xDe = (c: number) => xIni + c * W;
  let col = 0;

  // Fases en el orden en que llegan; una fase con actividades del capacitador y de otros se abre en dos carriles
  const fases = [...new Set(pasos.map((p) => p.fase))];
  const esCap = (p: Paso) => p.carril === "capacitador";
  const conCarriles = new Set(fases.filter((f) => {
    const l = pasos.filter((p) => p.fase === f);
    return l.some(esCap) && l.some((p) => !esCap(p));
  }));

  for (const fase of fases) {
    const deFase = pasos.filter((p) => p.fase === fase);
    const c0 = col;
    if (conCarriles.has(fase)) {
      const cap = deFase.filter(esCap);
      const asi = deFase.filter((p) => !esCap(p));
      const n = Math.max(cap.length, asi.length);
      const ubicar = (lista: Paso[], y: number, lugar: "arriba" | "abajo") =>
        lista.forEach((p, j) =>
          pos.set(p.clave, { x: xDe(col + (lista.length > 1 ? (j * (n - 1)) / (lista.length - 1) : (n - 1) / 2)), y, lugar }),
        );
      col += 0.5; // espacio para la bifurcación
      ubicar(cap, yCap, "arriba");
      ubicar(asi, yAsi, "abajo");
      col += n - 1 + 0.5;
    } else {
      // Una fase de una sola actividad lleva algo de aire a los lados para que su nombre no choque con el de al lado
      const aire = !compacto && deFase.length === 1 && fase !== fases.at(-1) ? 0.6 : 0;
      col += aire;
      deFase.forEach((p) => pos.set(p.clave, { x: xDe(col++), y: yMid, lugar: "abajo" }));
      col--;
      col += aire;
    }
    rangos.push({ fase, x0: xDe(c0), x1: xDe(col) });
    col++;
  }
  const ancho = xDe(col - 1) + xIni;
  const alto = compacto ? yAsi + R + 4 : yAsi + R + 16;

  // El punto donde se detuvo el proceso: local no confirmado (pre) o sesión no realizada (post)
  const estadoDe = (p: Paso): Est => (detenido && (p.clave === "confirmar_sede" || p.clave === "sesion_realizada") ? "detenido" : p.estado);

  // Tramos: consecutivos dentro de cada línea/carril, más bifurcaciones y uniones entre fases
  const segs: [Paso, Paso][] = [];
  const cadena = (l: Paso[]) => l.slice(1).forEach((p, i) => segs.push([l[i], p]));
  const carriles = (f: number) => {
    const l = pasos.filter((p) => p.fase === f);
    return conCarriles.has(f) ? [l.filter(esCap), l.filter((p) => !esCap(p))] : [l];
  };
  fases.forEach((f, i) => {
    carriles(f).forEach(cadena);
    const sig = fases[i + 1];
    if (sig === undefined) return;
    const fin = carriles(f).map((l) => l.at(-1)!).filter(Boolean);
    const ini = carriles(sig).map((l) => l[0]).filter(Boolean);
    if (fin.length === 2 && ini.length === 2) fin.forEach((a, k) => segs.push([a, ini[k]]));
    else for (const a of fin) for (const b of ini) segs.push([a, b]);
  });

  const enCurso = pasos.filter((p) => p.estado === "disponible");
  const hechos = pasos.filter((p) => p.estado === "hecho").length;
  const aplicables = pasos.filter((p) => p.estado !== "no_aplica").length;
  const resumen = detenido
    ? pasos.some((p) => p.clave === "sesion_realizada") ? "Detenido: la sesión no se realizó" : "Detenido: local no confirmado"
    : `${hechos}/${aplicables} hechas${enCurso.length ? ` · Ahora: ${enCurso.map((p) => p.corto).join(", ")}` : ""}`;

  const svg = (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      width="100%"
      className={compacto ? "block h-auto max-w-[340px]" : "block h-auto w-full"}
      role="img"
      aria-label={`${titulo}: ${resumen}`}
    >
      {/* Fases: separadores y nombre */}
      {!compacto &&
        rangos.map((r, i) => (
          <g key={r.fase}>
            {i > 0 && <line x1={r.x0 - W / 2} x2={r.x0 - W / 2} y1={4} y2={alto - 2} stroke="#e6ebf1" />}
            <text
              x={conCarriles.has(r.fase) ? r.x0 - W / 2 + 6 : i === rangos.length - 1 && r.x1 - r.x0 < W ? ancho - 4 : (r.x0 + r.x1) / 2}
              y={11}
              textAnchor={conCarriles.has(r.fase) ? "start" : i === rangos.length - 1 && r.x1 - r.x0 < W ? "end" : "middle"}
              fontSize={9}
              fontWeight={600}
              letterSpacing={0.6}
              fill="#64748b"
            >
              {`FASE ${r.fase} · ${(FASE_CORTA[r.fase] ?? "").toUpperCase()}`}
              {conCarriles.has(r.fase) && (
                <tspan dx={8} fontWeight={400} letterSpacing={0} fill="#94a3b8">▲ capacitador · ▼ asistente</tspan>
              )}
            </text>
          </g>
        ))}

      {/* Líneas */}
      {segs.map(([a, b]) => {
        const pa = pos.get(a.clave)!;
        const pb = pos.get(b.clave)!;
        // El tramo se pinta cuando el proceso ya llegó al punto de destino
        const avanzado = !detenido && (b.estado === "hecho" || b.estado === "disponible" || (b.estado === "no_aplica" && a.estado === "hecho"));
        return (
          <line
            key={`${a.clave}-${b.clave}`}
            x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
            stroke={avanzado ? "#16a34a" : "#dbe2ea"}
            strokeWidth={compacto ? 2 : 2.5}
            strokeLinecap="round"
          />
        );
      })}

      {/* Puntos */}
      {pasos.map((p) => {
        const { x, y, lugar } = pos.get(p.clave)!;
        const est = estadoDe(p);
        const c = COLOR[est];
        const n = num.get(p.clave)!;
        const punto = (
          <>
            {compacto && <title>{`${n}. ${p.titulo} — ${TXT[est]}`}</title>}
            {est === "disponible" && (
              <circle cx={x} cy={y} r={R + (compacto ? 3 : 5)} fill="#c2410c" fillOpacity={0.16} className="motion-safe:animate-pulse" />
            )}
            {seleccionado === p.clave && <circle cx={x} cy={y} r={R + 4} fill="none" stroke="#0f2a47" strokeWidth={2} />}
            <circle cx={x} cy={y} r={R} fill={c.relleno} stroke={c.borde} strokeWidth={1.5} strokeDasharray={est === "no_aplica" ? "2 2" : undefined} />
            {!compacto && (
              <>
                <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill={c.texto}>
                  {est === "hecho" ? "✓" : est === "no_aplica" ? "–" : est === "detenido" ? "!" : n}
                </text>
                <text
                  x={x}
                  y={lugar === "arriba" ? y - R - 5 : y + R + 11}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight={est === "disponible" ? 700 : 500}
                  fill={c.etiqueta}
                >
                  {p.corto}
                </text>
              </>
            )}
          </>
        );
        return <g key={p.clave}>{punto}</g>;
      })}
    </svg>
  );

  if (compacto) return svg;

  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-marino">{titulo}</span>
        <span className="text-xs font-medium text-texto-2">{resumen}</span>
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-texto-2">
          {(["hecho", "disponible", "bloqueado", "no_aplica"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span
                className="inline-block size-2.5 rounded-full border"
                style={{ background: COLOR[k].relleno, borderColor: COLOR[k].borde, borderStyle: k === "no_aplica" ? "dashed" : "solid" }}
              />
              {TXT[k]}
            </span>
          ))}
        </span>
      </figcaption>
      {/* Las líneas cortas no se agrandan de más: como máximo ~1,25× su tamaño natural */}
      {/* En pantallas angostas el gráfico conserva un tamaño legible y se desliza de lado */}
      <div className={compacto ? "" : "-mx-1 overflow-x-auto px-1 pb-2"}>
      <div className="relative w-full" style={{ maxWidth: `${Math.round(ancho * 1.25)}px`, minWidth: compacto ? undefined : `${Math.round(ancho * 0.8)}px` }}>
        {svg}
        {/* Capa de puntos interactivos: mensaje corto al pasar el mouse y enlace a la tarjeta */}
        {pasos.map((p) => {
          const { x, y } = pos.get(p.clave)!;
          const est = estadoDe(p);
          const n = num.get(p.clave)!;
          const rel = x / ancho;
          const lado = rel < 0.12 ? "left-0" : rel > 0.88 ? "right-0" : "left-1/2 -translate-x-1/2";
          const abajo = y / alto < 0.45; // carril de arriba: el mensaje sale hacia abajo
          return (
            <Link
              key={p.clave}
              href={enlace ? enlace(p.clave) : `#paso-${p.clave}`}
              scroll={false}
              aria-current={seleccionado === p.clave ? "step" : undefined}
              aria-label={`${n}. ${p.titulo}: ${TXT[est]}${info[p.clave] ? `, ${info[p.clave]}` : ""}`}
              className="group absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-marino"
              style={{ left: `${rel * 100}%`, top: `${(y / alto) * 100}%` }}
            >
              <span
                role="tooltip"
                className={`pointer-events-none absolute z-30 w-max max-w-[min(16rem,70vw)] rounded-lg bg-marino px-2.5 py-1.5 text-left text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100 ${lado} ${abajo ? "top-full mt-1.5" : "bottom-full mb-1.5"}`}
              >
                <span className="block font-semibold">{n}. {p.titulo}</span>
                <span className="block text-[#cbd5e1]">
                  <span style={{ color: est === "bloqueado" || est === "no_aplica" ? "#cbd5e1" : est === "hecho" ? "#86efac" : "#fdba74" }}>●</span> {TXT[est]}
                  {info[p.clave] ? ` · ${info[p.clave]}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      </div>
    </figure>
  );
}
