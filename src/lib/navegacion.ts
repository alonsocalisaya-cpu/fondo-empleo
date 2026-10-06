// Estructura del menú principal: 3 áreas y sus bloques.
export type Bloque = { href: string; label: string; /** otras rutas que también marcan este bloque como activo */ tambien?: string[] };
export type Area = { id: "estrategico" | "operativo" | "soporte"; label: string; bloques: Bloque[] };

export const AREAS: Area[] = [
  {
    id: "estrategico",
    label: "Estratégico",
    bloques: [
      { href: "/estrategico/cronograma", label: "Cronograma de capacitaciones" },
      { href: "/estrategico/consultores", label: "Carga del personal" },
      { href: "/estrategico/indicadores", label: "Indicadores" },
      { href: "/estrategico/acciones-correctivas", label: "Acciones correctivas" },
    ],
  },
  {
    id: "operativo",
    label: "Operativo",
    bloques: [
      {
        href: "/operativo/capacitaciones",
        label: "Capacitaciones",
        tambien: ["/operativo/capacitacion", "/operativo/post-capacitacion"],
      },
    ],
  },
  {
    id: "soporte",
    label: "Soporte",
    bloques: [
      { href: "/soporte/sedes", label: "Sedes" },
      { href: "/soporte/logistica", label: "Logística" },
      { href: "/soporte/mantenimiento", label: "Mantenimiento" },
      { href: "/soporte/gestion-documental", label: "Gestión documental" },
    ],
  },
];
