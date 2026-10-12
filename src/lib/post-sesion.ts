import type { RecursoSesion } from "./recursos-sesion";

export const TIPOS_INCIDENCIA = ["Local", "Horario", "Participantes", "Recursos y refrigerios", "Equipos", "Transporte", "Capacitador", "Otros"];

export function leerDatosPost(f: FormData) {
  const decision = String(f.get("capacitacionRealizada") ?? "");
  if (decision !== "si" && decision !== "no") return { error: "Indica si se ejecutó la capacitación." };
  const realizada = decision === "si";
  const inicio = realizada ? String(f.get("horaInicioReal") ?? "") : null;
  const fin = realizada ? String(f.get("horaFinReal") ?? "") : null;
  const horaValida = (h: string | null) => h != null && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  if (realizada && (!horaValida(inicio) || !horaValida(fin) || fin! <= inicio!)) return { error: "Registra horarios válidos, con el fin real posterior al inicio." };
  const tipos = [...new Set(f.getAll("tipoIncidencia").map(String))];
  if (tipos.some((t) => !TIPOS_INCIDENCIA.includes(t))) return { error: "Elige tipos de incidencia válidos." };
  const incidencias = String(f.get("incidencias") ?? "").trim();
  if (incidencias.length > 5000 || ((!realizada || tipos.length > 0) && !incidencias)) return { error: "Describe las incidencias o el motivo de no ejecución (máximo 5000 caracteres)." };
  return { datos: { realizada, horaInicioReal: inicio, horaFinReal: fin, tiposIncidencia: tipos, incidencias: incidencias || null } };
}

export function leerRetornos(f: FormData, grupos: { prefijo: string; items: RecursoSesion[] }[]) {
  const retornos: (RecursoSesion & { grupo: string; llevado: number; retorno: number })[] = [];
  for (const grupo of grupos) for (const [i, item] of grupo.items.entries()) {
    const valor = String(f.get(`retorno-${grupo.prefijo}-${i}`) ?? "").trim();
    const retorno = Number(valor);
    if (!valor || !Number.isSafeInteger(retorno) || retorno < 0 || retorno > item.cantidad) return { error: `El retorno de ${item.descripcion} debe ser un entero entre 0 y ${item.cantidad}.` };
    retornos.push({ ...item, grupo: grupo.prefijo, llevado: item.cantidad, retorno });
  }
  return { retornos };
}
