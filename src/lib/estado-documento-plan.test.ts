import {test} from "node:test";
import assert from "node:assert/strict";
import {validarEstadoDocumentoPlan} from "./estado-documento-plan";
test("acepta las dos marcas de revisión del documento",()=>{assert.equal(validarEstadoDocumentoPlan("completo"),"completo");assert.equal(validarEstadoDocumentoPlan("observado"),"observado");});
test("mantiene sin marcar los documentos anteriores y los borradores",()=>{assert.equal(validarEstadoDocumentoPlan(null),null);assert.equal(validarEstadoDocumentoPlan(""),null);});
test("no confunde la revisión documental con la evaluación de viabilidad",()=>{assert.throws(()=>validarEstadoDocumentoPlan("viable"));assert.throws(()=>validarEstadoDocumentoPlan({estado:"completo"}));});
