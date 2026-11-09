/** Compara contenido JSON ignorando el orden de claves, pero conservando el de las filas. */
function canonico(valor:unknown):unknown {
 if(Array.isArray(valor))return valor.map(canonico);
 if(valor!==null&&typeof valor==="object")return Object.fromEntries(Object.entries(valor).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonico(v)]));
 return valor;
}
export function mismosDatos(a:unknown,b:unknown):boolean{return JSON.stringify(canonico(a))===JSON.stringify(canonico(b));}
