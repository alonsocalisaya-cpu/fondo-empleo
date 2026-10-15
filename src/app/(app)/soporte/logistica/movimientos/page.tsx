import Link from "next/link";
import { connection } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { insumos, movimientosInsumo } from "@/db/schema";
import { Encabezado, Kpi, Vacio } from "@/components/ui";

export const metadata = { title: "Logística · Movimientos" };

const POR_PAGINA = 50;
const MOV = {
  entrada: { txt: "Entrada", cls: "bg-[#dcfce7] text-[#166534]" },
  salida: { txt: "Salida", cls: "bg-[#fee2e2] text-[#991b1b]" },
  ajuste: { txt: "Ajuste", cls: "bg-[#e0e7ff] text-[#3730a3]" },
} as const;

const fechaHora = (d: Date) => d.toLocaleString("es-PE", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima",
});

export default async function MovimientosLogistica({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const valorInsumo = typeof sp.insumo === "string" ? Number(sp.insumo) : 0;
  const item = Number.isSafeInteger(valorInsumo) && valorInsumo > 0
    ? await db.query.insumos.findFirst({ where: eq(insumos.id, valorInsumo), columns: { id: true, nombre: true, stock: true, unidad: true } })
    : undefined;
  const filtro = item ? eq(movimientosInsumo.insumoId, item.id) : undefined;
  const [cuenta] = await db.select({ total: count() }).from(movimientosInsumo).where(filtro);
  const paginas = Math.max(1, Math.ceil(cuenta.total / POR_PAGINA));
  const paginaSolicitada = typeof sp.pagina === "string" ? Number(sp.pagina) : 1;
  const pagina = Number.isSafeInteger(paginaSolicitada) ? Math.min(paginas, Math.max(1, paginaSolicitada)) : 1;
  const movimientos = await db
    .select({ m: movimientosInsumo, nombre: insumos.nombre, unidad: insumos.unidad })
    .from(movimientosInsumo)
    .innerJoin(insumos, eq(movimientosInsumo.insumoId, insumos.id))
    .where(filtro)
    .orderBy(desc(movimientosInsumo.creadoEn), desc(movimientosInsumo.id))
    .limit(POR_PAGINA)
    .offset((pagina - 1) * POR_PAGINA);

  const hrefPagina = (n: number) => {
    const query = new URLSearchParams();
    if (item) query.set("insumo", String(item.id));
    if (n > 1) query.set("pagina", String(n));
    const texto = query.toString();
    return `/soporte/logistica/movimientos${texto ? `?${texto}` : ""}`;
  };

  return <>
    <Link href="/soporte/logistica" className="btn-secundario w-fit">← Volver a Logística</Link>
    <Encabezado antetitulo="Soporte · Logística" titulo={item ? `Movimientos · ${item.nombre}` : "Movimientos de inventario"} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Kpi etiqueta={item ? "Stock actual" : "Movimientos registrados"} valor={item ? `${item.stock} ${item.unidad}` : cuenta.total} />
    </div>

    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-5 py-3">
        <h2 className="font-semibold text-marino">Historial{item ? ` · ${item.nombre}` : " completo"}</h2>
        {item && <Link href="/soporte/logistica/movimientos" className="enlace text-sm">Ver todos</Link>}
      </div>
      {!movimientos.length ? <Vacio>Aún no se registran movimientos.</Vacio> : <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead><tr><th className="th">Fecha</th>{!item && <th className="th">Ítem</th>}<th className="th">Movimiento</th><th className="th">Cantidad</th><th className="th">Stock resultante</th><th className="th">Motivo / sesión</th></tr></thead>
          <tbody>{movimientos.map(({ m, nombre, unidad }) => <tr key={m.id}>
            <td className="td whitespace-nowrap">{fechaHora(m.creadoEn)}</td>
            {!item && <td className="td font-medium">{nombre}</td>}
            <td className="td"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MOV[m.tipo].cls}`}>{MOV[m.tipo].txt}</span></td>
            <td className="td whitespace-nowrap">{m.tipo === "ajuste" ? "Conteo: " : m.tipo === "entrada" ? "+" : "−"}{m.cantidad} {unidad}</td>
            <td className="td font-semibold">{m.stockResultante} {unidad}</td>
            <td className="td text-texto-2">{m.motivo ?? "—"}{m.programacionId && <Link className="enlace mt-1 block text-xs" href={`/operativo/capacitaciones/${m.programacionId}`}>Ver sesión #{m.programacionId}</Link>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>

    {paginas > 1 && <nav aria-label="Páginas del historial" className="flex items-center justify-between gap-3">
      <Link href={hrefPagina(pagina - 1)} aria-disabled={pagina === 1} className={`btn-secundario ${pagina === 1 ? "pointer-events-none opacity-50" : ""}`}>Anterior</Link>
      <span className="text-sm text-texto-2">Página {pagina} de {paginas}</span>
      <Link href={hrefPagina(pagina + 1)} aria-disabled={pagina === paginas} className={`btn-secundario ${pagina === paginas ? "pointer-events-none opacity-50" : ""}`}>Siguiente</Link>
    </nav>}
  </>;
}
