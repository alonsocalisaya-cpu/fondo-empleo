export type CeldaSemanal={programados:number;programadosRegistrados:number;asistentes:number;sesiones:number;registradas:number};
export function porcentajeRegistrado(c?:CeldaSemanal):number|null {return c&&c.registradas>0&&c.programadosRegistrados>0?Math.round(c.asistentes*1000/c.programadosRegistrados)/10:null;}
export function compararSemanas(actual?:CeldaSemanal,anterior?:CeldaSemanal):"sube"|"baja"|null {
 if(!actual||!anterior||actual.registradas!==actual.sesiones||anterior.registradas!==anterior.sesiones)return null;
 const a=porcentajeRegistrado(actual),b=porcentajeRegistrado(anterior);
 return a===null||b===null||a===b?null:a>b?"sube":"baja";
}

/** Suma exclusivamente las filas que recibe: deben ser las sedes visibles. */
export function totalSemana(filas:{semanas:Record<string,CeldaSemanal>}[],semana:string):CeldaSemanal {
 return filas.reduce((total,fila)=>{const c=fila.semanas[semana];if(c){total.programados+=c.programados;total.programadosRegistrados+=c.programadosRegistrados;total.asistentes+=c.asistentes;total.sesiones+=c.sesiones;total.registradas+=c.registradas;}return total;},{programados:0,programadosRegistrados:0,asistentes:0,sesiones:0,registradas:0});
}
