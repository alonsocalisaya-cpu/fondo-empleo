const coloresGrupo:Record<string,{backgroundColor:string;color:string;borderColor:string}>={
 "Vender y conseguir clientes":{backgroundColor:"#e0f2fe",color:"#075985",borderColor:"#7dd3fc"},
 "Dinero y cuentas":{backgroundColor:"#dcfce7",color:"#166534",borderColor:"#86efac"},
 "Productos y existencias":{backgroundColor:"#f3e8ff",color:"#6b21a8",borderColor:"#d8b4fe"},
 "Entregas y tiempo":{backgroundColor:"#ffedd5",color:"#9a3412",borderColor:"#fdba74"},
 "Presentación del producto":{backgroundColor:"#fce7f3",color:"#9d174d",borderColor:"#f9a8d4"},
 "Formalización del negocio":{backgroundColor:"#e2e8f0",color:"#334155",borderColor:"#cbd5e1"},
 "Otro":{backgroundColor:"#fef9c3",color:"#854d0e",borderColor:"#fde047"},
};
export const nombreGrupo=(grupo:string)=>grupo==="Papeles del negocio"?"Formalización del negocio":grupo;
export const colorGrupo=(grupo:string)=>coloresGrupo[nombreGrupo(grupo)]??{backgroundColor:"#f1f5f9",color:"#475569",borderColor:"#cbd5e1"};
