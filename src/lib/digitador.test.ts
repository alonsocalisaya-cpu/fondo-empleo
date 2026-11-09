import {test} from "node:test";
import assert from "node:assert/strict";
import {puede,puedeAbrir,inicioDe,moduloDe,puedeRegistrarPaso} from "./permisos";
test("Digitador puede editar planes, sus archivos y evaluación",()=>{assert.equal(puede("digitador","planes_mejora","editar"),true);for(const ruta of ["/operativo/planes-mejora","/operativo/planes-mejora/12","/operativo/planes-mejora/archivo/4"])assert.equal(puedeAbrir("digitador",ruta),true);assert.equal(inicioDe("digitador"),"/operativo/planes-mejora");});
test("el nuevo rol no obtiene capacitaciones, beneficiarios ni administración",()=>{for(const ruta of ["/operativo/capacitaciones","/operativo/capacitaciones/participantes","/personal","/personal/permisos","/soporte/gestion-documental"])assert.equal(puedeAbrir("digitador",ruta),false);assert.equal(puedeRegistrarPaso("digitador",["asistente"]),false);});
test("la ruta específica de planes utiliza su propio módulo",()=>assert.equal(moduloDe("/operativo/planes-mejora/12"),"planes_mejora"));
test("los roles existentes conservan sus niveles de planes",()=>{assert.equal(puede("admin","planes_mejora","editar"),true);assert.equal(puede("asistente","planes_mejora","editar"),true);assert.equal(puede("rrhh","planes_mejora","ver"),true);assert.equal(puede("rrhh","planes_mejora","editar"),false);});
