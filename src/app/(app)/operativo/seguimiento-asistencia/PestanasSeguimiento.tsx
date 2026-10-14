import Link from "next/link";

export default function PestanasSeguimiento({ vista }: { vista: "beneficiarios" | "totales" }) {
  return <nav aria-label="Vistas del seguimiento de asistencia" className="flex gap-1 overflow-x-auto border-b border-borde">
    {[{ clave: "beneficiarios", nombre: "Por beneficiario", href: "/operativo/seguimiento-asistencia" }, { clave: "totales", nombre: "Totales por sede", href: "/operativo/seguimiento-asistencia?vista=totales" }].map((v) => <Link key={v.clave} href={v.href} aria-current={vista === v.clave ? "page" : undefined} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold ${vista === v.clave ? "border-acento text-marino" : "border-transparent text-texto-2 hover:text-marino"}`}>{v.nombre}</Link>)}
  </nav>;
}
