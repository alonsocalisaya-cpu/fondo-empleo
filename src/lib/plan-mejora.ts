export const INICIO_PLAN_MEJORA = "2027-01";
export const CATEGORIAS_PROBLEMA = ["Vender y conseguir clientes", "Dinero y cuentas", "Productos y existencias", "Entregas y tiempo", "Presentación del producto", "Formalización del negocio", "Otro"] as const;
export type MetaMejora = { id: string; texto: string; valor: string; unidad: string };
export type IndicadorMejora = { id: string; nombre: string; metas: MetaMejora[] };
export type ProblemaMejora = { id: string; categoria: string; texto: string; objetivo: string; plazo: string; indicadores: IndicadorMejora[]; estrategias: string[]; recursos: string[] };
export type RecursoMejora = { id: string; problemaId: string; nombre: string; cantidad: string; costo: string; fuente: "propios" | "externo" };
export type ActividadMejora = { id: string; problemaId: string; nombre: string; meses: number[]; responsable: string };
export type PlanMejora = { problemas: ProblemaMejora[]; presupuesto: RecursoMejora[]; inicio: string; actividades: ActividadMejora[] };
export type ResultadoPlan = { error?: string; ok?: boolean; revision?: number; plan?: PlanMejora };
export function planInicial(problemas: {texto:string}[]): PlanMejora {
 return { problemas: Array.from({length:Math.max(3,problemas.length)},(_,i)=>({id:`p${i+1}`,categoria:"",texto:problemas[i]?.texto ?? "",objetivo:"",plazo:"",indicadores:[],estrategias:[],recursos:[]})), presupuesto:[], inicio:"", actividades:[] };
}
export function costoRecurso(r:RecursoMejora) { return Math.round(Number(r.cantidad)*Number(r.costo)*100)/100; }
/** Valida también en el servidor: nunca confiar en el JSON del formulario. */
export function validarPlan(entrada: unknown): PlanMejora {
 function obj(x:unknown):Record<string,unknown> {if(!x || typeof x!=="object" || Array.isArray(x)) throw Error("Formato del plan inválido.");return x as Record<string,unknown>;}
 function texto(x:unknown,max=500):string {if(typeof x!=="string" || x.length>max)throw Error("Revisa la longitud de los campos.");return x.trim();}
 function lista(x:unknown,max:number):unknown[] {if(!Array.isArray(x)||x.length>max)throw Error("Hay demasiados elementos o falta un campo del plan.");return x;}
 function id(x:unknown):string {const s=texto(x,80);if(!/^[a-zA-Z0-9_-]+$/.test(s))throw Error("Identificador inválido.");return s;}
 function unico<T extends {id:string}>(l:T[]):T[]{if(new Set(l.map(x=>x.id)).size!==l.length)throw Error("Hay elementos duplicados.");return l;}
 function numero(x:unknown,max:number):string{const s=texto(x,24);if(s!=="" && (!/^\d+(\.\d{1,2})?$/.test(s)||!Number.isFinite(Number(s))||Number(s)>max))throw Error("Usa números positivos con hasta dos decimales.");return s;}
 const d=obj(entrada);
 const problemas=unico(lista(d.problemas,3).map((x)=>{const p=obj(x);return {id:id(p.id),categoria:texto(p.categoria ?? "",120),texto:texto(p.texto),objetivo:texto(p.objetivo,1000),plazo:texto(p.plazo,100),indicadores:unico(lista(p.indicadores,20).map((x)=>{const i=obj(x);return {id:id(i.id),nombre:texto(i.nombre),metas:unico(lista(i.metas,20).map((x)=>{const m=obj(x);return {id:id(m.id),texto:texto(m.texto),valor:numero(m.valor,1e12),unidad:texto(m.unidad,80)};}))};})),estrategias:lista(p.estrategias,30).map(x=>texto(x)),recursos:lista(p.recursos,30).map(x=>texto(x))};}));
 if(!problemas.length)throw Error("Agrega al menos un problema.");
 const vinculacion=(x:unknown)=>{const s=texto(x,80);if(s && !problemas.some(p=>p.id===s))throw Error("Un recurso o actividad apunta a un problema inexistente.");return s;};
 const presupuesto=unico(lista(d.presupuesto,200).map((x)=>{const r=obj(x);if(r.fuente!=="propios" && r.fuente!=="externo")throw Error("Fuente de financiamiento inválida.");return {id:id(r.id),problemaId:vinculacion(r.problemaId),nombre:texto(r.nombre),cantidad:numero(r.cantidad,1e6),costo:numero(r.costo,1e9),fuente:r.fuente as "propios"|"externo"};}));
 const actividades=unico(lista(d.actividades,200).map((x)=>{const a=obj(x);const meses=lista(a.meses,6).map(x=>{if(!Number.isInteger(x)||Number(x)<1||Number(x)>6)throw Error("Mes inválido.");return Number(x);});return {id:id(a.id),problemaId:vinculacion(a.problemaId),nombre:texto(a.nombre),meses:[...new Set(meses)],responsable:texto(a.responsable,150)};}));
 const inicio=texto(d.inicio,7);if(inicio && !/^\d{4}-(0[1-9]|1[0-2])$/.test(inicio))throw Error("Mes de inicio inválido.");
 return {problemas,presupuesto,actividades,inicio};
}

export type SeccionEditorPlan = "problemas" | "presupuesto" | "cronograma";
export function combinarSeccionPlan(base:PlanMejora, entrada:Partial<PlanMejora>, seccion:SeccionEditorPlan):PlanMejora {
 if(seccion==="problemas")return {...base,problemas:entrada.problemas!};
 if(seccion==="presupuesto")return {...base,presupuesto:entrada.presupuesto!};
 return {...base,inicio:entrada.inicio!,actividades:entrada.actividades!};
}
