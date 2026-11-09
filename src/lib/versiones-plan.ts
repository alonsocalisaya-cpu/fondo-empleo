export type ArchivoPlan = {nombre:string;ruta:string;tipo:"plan"|"escaneado"|"editable"|"evidencia"};
export function errorPublicacion(cambios:string,archivos:ArchivoPlan[],estadoDocumento?:string|null) {
 if(!cambios.trim())return "Describe qué cambió antes de publicar.";
 if(!archivos.some(a=>a.tipo==="escaneado" || a.tipo==="plan"))return "Adjunta el escaneado para publicar como vigente.";
 if(!archivos.some(a=>a.tipo==="editable"))return "Adjunta el editable para publicar como vigente.";
 if(estadoDocumento!=="completo"&&estadoDocumento!=="observado")return "Selecciona Completo u Observado antes de publicar.";
 return null;
}
export function vigenteDe<T extends {numero:number;estado:string}>(versiones:T[]):T|undefined {
 return versiones.filter(v=>v.estado==="publicada").sort((a,b)=>b.numero-a.numero)[0];
}
