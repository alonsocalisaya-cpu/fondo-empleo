import {ESTADOS_PLAN} from "./estados-plan";
export const CRITERIOS_EVALUACION=[
 {id:"tecnica",titulo:"Viabilidad técnica",pregunta:"¿Cuento con los conocimientos y capacidades necesarios para implementar la mejora?"},
 {id:"economica",titulo:"Viabilidad económica",pregunta:"¿Los costos de implementación son razonables y puedo cubrirlos?"},
 {id:"comercial",titulo:"Viabilidad comercial",pregunta:"¿La mejora responde a una necesidad del negocio o de sus clientes?"},
 {id:"operativa",titulo:"Viabilidad operativa",pregunta:"¿Dispongo del tiempo y las condiciones necesarias para ejecutar las actividades?"},
 {id:"sostenibilidad",titulo:"Sostenibilidad",pregunta:"¿Podré mantener la mejora después de finalizar el acompañamiento del proyecto?"},
] as const;
export type CriterioEvaluacion=typeof CRITERIOS_EVALUACION[number]["id"];
export type EvaluacionPlan={criterios:Record<CriterioEvaluacion,{respuesta:""|"si"|"no"|"parcialmente";observaciones:string}>;observaciones:string};
export function evaluacionVacia():EvaluacionPlan{return {criterios:Object.fromEntries(CRITERIOS_EVALUACION.map(c=>[c.id,{respuesta:"",observaciones:""}])) as EvaluacionPlan["criterios"],observaciones:""};}
export function validarEvaluacionPlan(valor:unknown,estado:string):EvaluacionPlan {
 if(!ESTADOS_PLAN.some(e=>e.valor===estado)||estado==="sin_evaluacion")throw Error("Selecciona el resultado de la evaluación.");
 if(!valor||typeof valor!=="object")throw Error("Evaluación inválida.");
 const v=valor as EvaluacionPlan;const salida=evaluacionVacia();
 for(const c of CRITERIOS_EVALUACION){const item=v.criterios?.[c.id];if(!item||!["si","no","parcialmente"].includes(item.respuesta)||typeof item.observaciones!=="string"||item.observaciones.length>3000)throw Error(`Selecciona Sí, No o Parcialmente en ${c.titulo.toLowerCase()} y revisa sus observaciones.`);salida.criterios[c.id]={respuesta:item.respuesta,observaciones:item.observaciones.trim()};}
 if(typeof v.observaciones!=="string"||v.observaciones.length>5000)throw Error("Las observaciones generales admiten hasta 5000 caracteres.");
 salida.observaciones=v.observaciones.trim();return salida;
}
