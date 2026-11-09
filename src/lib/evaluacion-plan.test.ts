import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluacionVacia,validarEvaluacionPlan,CRITERIOS_EVALUACION} from "./evaluacion-plan";
test("conserva respuestas y observaciones de los cinco criterios",()=>{const e=evaluacionVacia();for(const c of CRITERIOS_EVALUACION)e.criterios[c.id]={respuesta:"parcialmente",observaciones:`Detalle ${c.id}`};e.observaciones="Ajustar costos";assert.deepEqual(validarEvaluacionPlan(e,"viable_ajustes"),e);});
test("exige los cinco criterios y un resultado antes de guardar",()=>{const e=evaluacionVacia();e.criterios.tecnica.respuesta="si";assert.throws(()=>validarEvaluacionPlan(e,"viable"),/Selecciona/);for(const c of CRITERIOS_EVALUACION)e.criterios[c.id].respuesta="no";assert.throws(()=>validarEvaluacionPlan(e,"sin_evaluacion"),/resultado/);assert.doesNotThrow(()=>validarEvaluacionPlan(e,"reformular"));});
test("rechaza resultados ajenos a los cuatro estados",()=>assert.throws(()=>validarEvaluacionPlan(evaluacionVacia(),"aprobado"),/resultado/));
test("rechaza respuestas y textos inválidos",()=>{const e=evaluacionVacia();for(const c of CRITERIOS_EVALUACION)e.criterios[c.id].respuesta="si";assert.throws(()=>validarEvaluacionPlan({...e,criterios:{...e.criterios,tecnica:{respuesta:"quizas",observaciones:""}}},"viable"));e.observaciones="x".repeat(5001);assert.throws(()=>validarEvaluacionPlan(e,"viable"),/5000/);});
