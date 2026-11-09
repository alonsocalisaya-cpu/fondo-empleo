import {test} from "node:test";
import assert from "node:assert/strict";
import {porcentajeRegistrado,compararSemanas,totalSemana,type CeldaSemanal} from "./asistencia-semanal";
const completa:CeldaSemanal={programados:20,programadosRegistrados:20,asistentes:10,sesiones:1,registradas:1};
test("una lista pendiente no aporta cero ni porcentaje",()=>{const c={programados:20,programadosRegistrados:0,asistentes:0,sesiones:1,registradas:0};assert.equal(porcentajeRegistrado(c),null);assert.equal(compararSemanas(c,completa),null);});
test("programados de listas pendientes no reducen el porcentaje total",()=>{const c={programados:120,programadosRegistrados:20,asistentes:10,sesiones:3,registradas:1};assert.equal(porcentajeRegistrado(c),50);assert.equal(compararSemanas(c,completa),null);assert.equal(compararSemanas(completa,c),null);});
test("cero asistentes registrado es un cero real comparable",()=>{const c={...completa,asistentes:0};assert.equal(porcentajeRegistrado(c),0);assert.equal(compararSemanas(c,completa),"baja");});
test("solo semanas completas con base válida se comparan",()=>{assert.equal(compararSemanas({...completa,asistentes:15},completa),"sube");assert.equal(compararSemanas({...completa,programadosRegistrados:0},completa),null);});

test("el total contiene solo las sedes visibles del filtro",()=>{const semana="2026-10-26";const arequipa={id:1,semanas:{[semana]:{programados:183,programadosRegistrados:183,asistentes:94,sesiones:5,registradas:5}}};const puno={id:2,semanas:{[semana]:{programados:169,programadosRegistrados:169,asistentes:73,sesiones:5,registradas:5}}};assert.equal(totalSemana([arequipa,puno],semana).asistentes,167);assert.equal(totalSemana([arequipa],semana).asistentes,94);assert.equal(totalSemana([puno],semana).asistentes,73);assert.equal(totalSemana([],semana).asistentes,0);});
