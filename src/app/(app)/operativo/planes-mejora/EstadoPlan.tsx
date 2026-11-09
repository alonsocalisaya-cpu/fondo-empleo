import {ESTADOS_PLAN} from "@/lib/estados-plan";
export default function EstadoPlan({valor}:{valor:string}) {
 const estado=ESTADOS_PLAN.find(e=>e.valor===valor)??ESTADOS_PLAN[0];
 return <span className="inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium" style={{backgroundColor:estado.fondo,color:estado.color}}>{estado.nombre}</span>;
}
