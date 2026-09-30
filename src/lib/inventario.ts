import type { CategoriaInsumo, TipoEquipo } from "@/db/schema";

/** Etiquetas del inventario de equipos (Mantenimiento). */
export const TIPOS_EQUIPO: Record<TipoEquipo, { singular: string; plural: string; prefijo: string }> = {
  laptop: { singular: "Laptop", plural: "Laptops", prefijo: "LAP" },
  proyector: { singular: "Proyector", plural: "Proyectores", prefijo: "PRY" },
  cable_hdmi: { singular: "Cable HDMI", plural: "Cables HDMI", prefijo: "HDMI" },
  extension: { singular: "Extensión", plural: "Extensiones", prefijo: "EXT" },
  cargador_laptop: { singular: "Cargador de laptop", plural: "Cargadores de laptop", prefijo: "CAR" },
  enchufe_proyector: { singular: "Enchufe del proyector", plural: "Enchufes del proyector", prefijo: "ENP" },
  mochila: { singular: "Mochila", plural: "Mochilas", prefijo: "MOC" },
  otro: { singular: "Otro", plural: "Otros", prefijo: "OTR" },
};

/** Categorías del inventario de materiales (Logística). */
export const CATEGORIAS_INSUMO: Record<CategoriaInsumo, string> = {
  material: "Material de capacitación",
  refrigerio: "Refrigerio",
};

/** Puntos a revisar en cada tipo de equipo al volver de una sesión. */
export const CHEQUEOS_EQUIPO: Record<TipoEquipo, string[]> = {
  laptop: ["Enciende y carga el sistema", "Batería carga y dura", "Pantalla sin daños", "Teclado y touchpad funcionan", "Puertos USB/HDMI funcionan", "Volvió con su cargador"],
  proyector: ["Enciende", "Imagen nítida y con brillo", "Sin sobrecalentamiento", "Entrada HDMI funciona", "Control remoto funciona", "Carcasa y lente sin daños"],
  cable_hdmi: ["Transmite imagen", "Conectores en buen estado", "Cable sin cortes ni dobleces"],
  extension: ["Da energía en todas las tomas", "Cable y enchufe sin daños", "Interruptor funciona"],
  cargador_laptop: ["Carga la laptop", "Cable sin cortes", "Conector en buen estado"],
  enchufe_proyector: ["Da energía al proyector", "Cable y conector sin daños"],
  mochila: ["Cierres funcionan", "Correas y costuras en buen estado", "Compartimentos sin daños"],
  otro: ["Funciona correctamente", "Sin daños visibles"],
};
