export type EstadoDocumentoPlan="completo"|"observado"|null;
export function validarEstadoDocumentoPlan(valor:unknown):EstadoDocumentoPlan {
 if(valor===null||valor===""||valor===undefined)return null;
 if(valor==="completo"||valor==="observado")return valor;
 throw Error("Selecciona Completo u Observado para el documento.");
}
