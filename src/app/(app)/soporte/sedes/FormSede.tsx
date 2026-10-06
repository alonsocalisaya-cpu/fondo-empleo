"use client";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { guardarSede } from "@/lib/acciones-maestros";

type Horario = { nombre:string; horaInicio:string; horaFin:string };
type Sede = {id:number;estructuraId:number;nombre:string;direccion:string|null;distrito:string|null;contacto:string|null;telefono:string|null;fueraDeArequipa:boolean;horarios:Horario[]};
export default function FormSede({sede,programas,programaId}:{sede?:Sede;programas:{id:number;nombre:string}[];programaId:number}){
 const[res,action,pending]=useActionState(guardarSede,undefined);
 const ref=useRef<HTMLFormElement>(null);
 const prefix=`sede-${sede?.id??"nueva"}`;
 const h=sede?.horarios[0];
 const enviar=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const datos=new FormData(e.currentTarget);startTransition(()=>action(datos));};
 useEffect(()=>{if(res?.ok&&!sede) ref.current?.reset();},[res,sede]);
 return <form ref={ref} onSubmit={enviar} className="flex flex-col gap-4">
  {sede&&<input type="hidden" name="id" value={sede.id}/>}
  <input type="hidden" name="horarioNombre" value={h?.nombre??"Principal"}/>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   <div><label className="etiqueta" htmlFor={`${prefix}-programa`}>Programa *</label><select className="campo" id={`${prefix}-programa`} name="estructuraId" required defaultValue={sede?.estructuraId??programaId}>{programas.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
   <div className="lg:col-span-2"><label className="etiqueta" htmlFor={`${prefix}-nombre`}>Sede / turno *</label><input className="campo" id={`${prefix}-nombre`} name="nombre" maxLength={120} required defaultValue={sede?.nombre} placeholder="Ej. Cayma - Turno Mañana"/></div>
   <div className="sm:col-span-2"><label className="etiqueta" htmlFor={`${prefix}-direccion`}>Ubicación / local</label><input className="campo" id={`${prefix}-direccion`} name="direccion" maxLength={200} defaultValue={sede?.direccion??""} placeholder="Nombre del local y dirección"/></div>
   <div><label className="etiqueta" htmlFor={`${prefix}-distrito`}>Distrito</label><input className="campo" id={`${prefix}-distrito`} name="distrito" maxLength={100} defaultValue={sede?.distrito??""}/></div>
   <div><label className="etiqueta" htmlFor={`${prefix}-inicio`}>Hora de inicio *</label><input className="campo" id={`${prefix}-inicio`} name="horaInicio" type="time" required defaultValue={h?.horaInicio.slice(0,5)}/></div>
   <div><label className="etiqueta" htmlFor={`${prefix}-fin`}>Hora de fin *</label><input className="campo" id={`${prefix}-fin`} name="horaFin" type="time" required defaultValue={h?.horaFin.slice(0,5)}/></div>
   <div><label className="etiqueta" htmlFor={`${prefix}-ubicacion`}>Traslado desde Arequipa</label><select className="campo" id={`${prefix}-ubicacion`} name="ubicacion" defaultValue={sede?.fueraDeArequipa||(!sede&&programas.find(p=>p.id===programaId)?.nombre==="Puno")?"fuera":"dentro"}><option value="dentro">Dentro de Arequipa (movilidad)</option><option value="fuera">Fuera de Arequipa (viaje)</option></select></div>
   <div><label className="etiqueta" htmlFor={`${prefix}-contacto`}>Persona de contacto</label><input className="campo" id={`${prefix}-contacto`} name="contacto" maxLength={150} defaultValue={sede?.contacto??""}/></div>
   <div><label className="etiqueta" htmlFor={`${prefix}-telefono`}>Teléfono</label><input className="campo" id={`${prefix}-telefono`} name="telefono" inputMode="tel" maxLength={30} defaultValue={sede?.telefono??""}/></div>
  </div>
  <p className="text-xs text-texto-2">Cada registro tiene un solo horario. Para otro turno del mismo local, crea una nueva sede con un nombre distinto.</p>
  {res?.error&&<p role="alert" className="text-sm text-red-700">{res.error}</p>}
  {res?.ok&&<p role="status" className="text-sm text-green-700">{res.ok}</p>}
  <button disabled={pending} className="btn-primario self-start">{pending?"Guardando…":sede?"Guardar cambios":"Crear sede"}</button>
 </form>;
}
