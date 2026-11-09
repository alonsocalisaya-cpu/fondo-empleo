import {test} from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {idCliente} from "./id-cliente";
import {planInicial,validarPlan} from "./plan-mejora";
const redLocal={getRandomValues:webcrypto.getRandomValues.bind(webcrypto)} as Pick<Crypto,"getRandomValues">;
test("genera IDs únicos y válidos cuando randomUUID no está disponible",()=>{const ids=Array.from({length:1000},()=>idCliente(redLocal));assert.equal(new Set(ids).size,1000);for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);});
test("conserva la API nativa cuando está disponible",()=>{const id="12345678-1234-4234-8234-123456789abc";assert.equal(idCliente({...redLocal,randomUUID:()=>id}),id);});
test("los elementos creados por IP mantienen vínculos y pasan la validación de guardado",()=>{const p=planInicial([]);p.problemas[0].id=idCliente(redLocal);p.problemas[0].indicadores=[{id:idCliente(redLocal),nombre:"Ventas (S/)",metas:[{id:idCliente(redLocal),texto:"Aumento del 20 %",valor:"",unidad:""}]}];p.presupuesto=[{id:idCliente(redLocal),problemaId:p.problemas[0].id,nombre:"Equipo",cantidad:"1",costo:"10",fuente:"propios"}];p.actividades=[{id:idCliente(redLocal),problemaId:p.problemas[0].id,nombre:"Comprar",meses:[1],responsable:"Usuario"}];assert.deepEqual(validarPlan(p),p);});
