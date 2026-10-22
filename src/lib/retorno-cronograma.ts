/** Solo admite volver a la lista o al calendario interno del cronograma. */
export function retornoCronograma(valor: unknown, alternativa = "/estrategico/cronograma") {
  return typeof valor === "string" && /^\/estrategico\/cronograma(?:\?|$)/.test(valor) && !/[\\\u0000-\u001f]/.test(valor) ? valor : alternativa;
}
