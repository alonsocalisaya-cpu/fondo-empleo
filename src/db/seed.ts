/**
 * Datos de ejemplo. Ejecutar con:  npm run db:seed
 * ¡Borra todos los datos existentes antes de insertar!
 */
import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";
import { importarEstructura } from "./estructura";
import { db } from "./index";
import * as s from "./schema";
import { hoyISO, sumarDias, turnoDesdeHora } from "../lib/fechas";

async function main() {
  console.log("Limpiando tablas…");
  await db.execute(sql`TRUNCATE equipos, documentos, ficha_items, preparaciones, personal, acciones_correctivas, asistencias, inscripciones, programaciones, sesiones, modulos,
    actividades, componentes, participantes, capacitadores, sedes RESTART IDENTITY CASCADE`);

  const [estructura] = await db.insert(s.estructuras).values({nombre: "Arequipa"}).onConflictDoUpdate({target: s.estructuras.nombre, set: {nombre: "Arequipa"}}).returning();
  console.log("Sedes y capacitadores…");
  const sedes = await db
    .insert(s.sedes)
    .values([
      { estructuraId: estructura.id, nombre: "Sede Norte", distrito: "Cayma", contacto: "Rosa Llerena (administración)", telefono: "954 000 001" },
      { estructuraId: estructura.id, nombre: "Sede Centro", distrito: "Cercado de Arequipa", contacto: "Jorge Díaz (recepción)", telefono: "954 000 002" },
      { estructuraId: estructura.id, nombre: "Sede Sur", distrito: "Paucarpata", contacto: "Elena Cáceres", telefono: "954 000 003" },
      { estructuraId: estructura.id, nombre: "Sede Camaná", distrito: "Camaná", fueraDeArequipa: true, contacto: "Luis Vera", telefono: "954 000 004" },
    ])
    .returning();

  const caps = await db
    .insert(s.capacitadores)
    .values([
      { nombres: "Ana", apellidos: "Torres", especialidad: "Liderazgo y habilidades emprendedoras" },
      { nombres: "Luis", apellidos: "Paredes", especialidad: "Gestión de procesos y mejora" },
      { nombres: "María", apellidos: "Quispe", especialidad: "Finanzas y costos" },
      { nombres: "Carlos", apellidos: "Rojas", especialidad: "Marketing y ventas" },
    ])
    .returning();

  console.log("Personal interno…");
  const per = await db
    .insert(s.personal)
    .values([
      { nombres: "Fernando", apellidos: "Salas", rol: "jefe_comercial" },
      { nombres: "Patricia", apellidos: "Núñez", rol: "jefe_proyecto" },
      { nombres: "Kevin", apellidos: "Mamani", rol: "asistente" },
      { nombres: "Lucero", apellidos: "Apaza", rol: "asistente" },
      { nombres: "Gabriel", apellidos: "Zeballos", rol: "gestion_documental" },
      { nombres: "Silvia", apellidos: "Chávez", rol: "administradora" },
    ])
    .returning();
  const asistentes = per.filter((x) => x.rol === "asistente");

  console.log("Estructura de capacitaciones (Excel «programación de sesiones»)…");
  await importarEstructura({}, db);
  const porCodigo = async (codigos: string[]) => {
    const filas = await db.select().from(s.sesiones).where(inArray(s.sesiones.codigo, codigos));
    return codigos.map((c) => filas.find((f) => f.codigo === c)!);
  };
  // Sesiones usadas en las programaciones de ejemplo
  const ses = await porCodigo([
    "1.1.2-M1-S1", // primera sesión de la actividad 1.1.2 → examen de entrada
    "1.1.2-M1-S2",
    "1.1.2-M1-S3",
    "1.1.2-M3-S1", // última sesión de la actividad 1.1.2 → examen de salida
    "1.1.3-M1-S1",
    "1.1.3-M2-S1",
    "2.1.1-M1-S1",
    "2.1.2-M1-S2",
  ]);
  const [c2] = await db.select().from(s.componentes).where(eq(s.componentes.codigo, "2.1"));

  console.log("Participantes…");
  const nombres = [
    ["Rosa", "Mamani Huamán"], ["Jorge", "Castillo Vega"], ["Lucía", "Fernández Ríos"],
    ["Pedro", "Huaranga Soto"], ["Carmen", "Salazar Díaz"], ["Miguel Ángel", "Ccori Quispe"],
    ["Diana", "Espinoza León"], ["Raúl", "Villanueva Poma"], ["Sofía", "Gutiérrez Arce"],
    ["Andrés", "Chávez Llanos"], ["Patricia", "Ramos Céspedes"], ["Julio", "Mendoza Tello"],
    ["Elena", "Vargas Cruz"], ["Óscar", "Palomino Rey"], ["Gabriela", "Núñez Ortiz"],
    ["Héctor", "Cárdenas Silva"], ["Milagros", "Rivera Luna"], ["Iván", "Aguilar Campos"],
  ];
  const areas = ["Comercio", "Artesanía", "Servicios", "Alimentos", "Textil"];
  const parts = await db
    .insert(s.participantes)
    .values(
      nombres.map(([n, a], i) => ({
        nombres: n,
        apellidos: a,
        dni: String(40000000 + i * 1537291).slice(0, 8),
        area: areas[i % areas.length],
      })),
    )
    .returning();

  console.log("Programaciones, inscripciones y asistencias…");
  const hoy = hoyISO();
  // [sesión, sede, capacitador|null, díasDesdeHoy, inicio, fin, aula, estado]
  const plan: [number, number, number | null, number, string, string, string, s.EstadoProg][] = [
    [0, 0, 0, -7, "08:00", "10:00", "Aula 201", "finalizada"],
    [5, 1, 1, -3, "09:00", "11:00", "Auditorio", "finalizada"],
    [0, 0, 0, 0, "08:00", "10:00", "Aula 201", "confirmada"],
    [5, 1, 1, 0, "09:00", "11:00", "Auditorio", "confirmada"],
    [2, 2, 0, 0, "11:00", "13:00", "Aula 3", "programada"],
    [6, 0, 2, 0, "15:00", "17:00", "Lab. cómputo", "programada"],
    [3, 1, 3, 0, "19:00", "21:00", "Aula 105", "programada"],
    [1, 0, 0, 2, "08:00", "10:00", "Aula 201", "confirmada"],
    [0, 2, 0, 2, "11:00", "13:00", "Aula 3", "confirmada"],
    [4, 1, 1, 2, "15:00", "17:00", "Auditorio", "programada"],
    [7, 0, 2, 3, "09:00", "11:00", "Lab. cómputo", "programada"],
    [0, 1, 3, 3, "19:00", "21:00", "Aula 105", "confirmada"],
    [5, 3, null, 4, "08:00", "10:00", "Aula 1", "programada"],
    [0, 3, 2, 5, "15:00", "17:00", "Aula 2", "reprogramada"],
  ];

  const creadas: { id: number; dias: number; sesionIdx: number }[] = [];
  for (const [si, sedeI, capI, dias, ini, fin, aula, estado] of plan) {
    const [p] = await db
      .insert(s.programaciones)
      .values({
        sesionId: ses[si].id,
        sedeId: sedes[sedeI].id,
        capacitadorId: capI === null ? null : caps[capI].id,
        asistenteId: dias <= 0 ? asistentes[creadas.length % 2].id : null,
        fecha: sumarDias(hoy, dias),
        horaInicio: ini,
        horaFin: fin,
        turno: turnoDesdeHora(ini),
        aula,
        cupo: 25,
        estado,
        listaCerrada: dias < 0,
      })
      .returning();
    creadas.push({ id: p.id, dias, sesionIdx: si });

    // Inscribe 10 participantes (rotando según la sede)
    const inscritos = Array.from({ length: 10 }, (_, k) => parts[(sedeI * 4 + k) % parts.length]);
    await db
      .insert(s.inscripciones)
      .values(inscritos.map((pa) => ({ programacionId: p.id, participanteId: pa.id })));

    // Sesiones pasadas (y la primera de hoy) ya tienen asistencia registrada
    if (dias < 0 || (dias === 0 && ini === "08:00")) {
      await db.insert(s.asistencias).values(
        inscritos.map((pa, k) => {
          const estado: s.EstadoAsis = k === 4 || k === 9 ? "ausente" : k === 2 ? "tarde" : "presente";
          return {
            programacionId: p.id,
            participanteId: pa.id,
            estado,
            horaIngreso: estado === "ausente" ? null : estado === "tarde" ? "08:18" : "07:58",
            observacion: estado === "tarde" ? "Ingresó después de la tolerancia" : null,
          };
        }),
      );
    }
  }

  console.log("Repositorio documental y equipos…");
  const url = (n: string) => `https://nextcloud.ejemplo.com/s/${n}`; // reemplazar por los enlaces reales de NextCloud
  await db.insert(s.documentos).values(
    ses.flatMap((x) => [
      { sesionId: x.id, tipo: "diapositiva" as const, nombre: `${x.codigo} - Diapositivas.pptx`, url: url(`${x.codigo}-ppt`), version: "1.0" },
      { sesionId: x.id, tipo: "taller" as const, nombre: `${x.codigo} - Taller.docx`, url: url(`${x.codigo}-taller`), version: "1.0" },
    ]),
  );
  await db.insert(s.documentos).values([
    { sesionId: ses[0].id, tipo: "examen_entrada", nombre: "Examen de entrada - Taller de comunicación.pdf", url: url("examen-entrada-tc") },
    { sesionId: ses[3].id, tipo: "examen_salida", nombre: "Examen de salida - Taller de comunicación.pdf", url: url("examen-salida-tc") },
  ]);
  await db.insert(s.equipos).values([
    { codigo: "PRY-01", nombre: "Proyector Epson", sedeId: sedes[0].id },
    { codigo: "PRY-02", nombre: "Proyector BenQ", sedeId: sedes[1].id },
    { codigo: "PRY-03", nombre: "Proyector Epson", sedeId: sedes[2].id, estado: "en_reparacion", observacion: "Lámpara quemada" },
    { codigo: "LAP-01", nombre: "Laptop Lenovo", sedeId: null },
    { codigo: "LAP-02", nombre: "Laptop HP", sedeId: null },
    { codigo: "PAR-01", nombre: "Parlante portátil", sedeId: null },
    { codigo: "PRY-04", nombre: "Proyector portátil", sedeId: sedes[3].id },
  ]);

  console.log("Flujos de pre-capacitación de ejemplo…");
  const ahora = new Date().toISOString();
  const futuras = creadas.filter((c) => c.dias >= 2);
  // 1) Sesión con fase 1 y 2 completas
  const f1 = futuras[0];
  await db.update(s.programaciones).set({ asistenteId: asistentes[0].id }).where(eq(s.programaciones.id, f1.id));
  await db.insert(s.preparaciones).values({
    programacionId: f1.id,
    pasos: {
      confirmar_sede: { en: ahora, por: "Fernando Salas", localConfirmado: true, contacto: "Rosa Llerena" },
      comunicar: { en: ahora, por: "Patricia Núñez", capacitador: "Ana Torres", asistente: "Kevin Mamani", aTiempo: true, limite: sumarDias(hoy, -1) },
      descargar_material: { en: ahora, por: "Ana Torres" },
    },
  });
  await db.insert(s.fichaItems).values([
    { programacionId: f1.id, categoria: "material_capacitador", descripcion: "Plumones de pizarra", cantidad: 4, listo: true },
    { programacionId: f1.id, categoria: "refrigerio", descripcion: "Galletas y agua", cantidad: 25 },
    { programacionId: f1.id, categoria: "tecnologico", descripcion: "Proyector y extensión", cantidad: 1 },
  ]);
  // 2) Sesión recién iniciada
  await db.insert(s.preparaciones).values({
    programacionId: futuras[1].id,
    pasos: { confirmar_sede: { en: ahora, por: "Fernando Salas", localConfirmado: true } },
  });

  console.log("Acciones correctivas…");
  await db.insert(s.accionesCorrectivas).values([
    {
      titulo: "Baja asistencia en Sede Sur",
      problema: "La asistencia del último mes en Sede Sur está por debajo de la meta (85%).",
      causa: "Horario de 11:00 coincide con el almuerzo de los participantes de operaciones.",
      accion: "Reprogramar las sesiones de Sede Sur al turno de la mañana (08:00) y confirmar por WhatsApp un día antes.",
      origen: "indicador",
      indicador: "Asistencia promedio",
      sedeId: sedes[2].id,
      responsable: "Coordinación de sede Sur",
      prioridad: "alta",
      estado: "en_proceso",
      fechaDeteccion: sumarDias(hoy, -6),
      fechaLimite: sumarDias(hoy, 8),
    },
    {
      titulo: "Sesión sin consultor asignado",
      problema: "Hay una sesión en Sede Camaná sin consultor a menos de una semana.",
      accion: "Asignar consultor de reemplazo con experiencia en gestión de procesos.",
      origen: "supervision",
      sedeId: sedes[3].id,
      componenteId: c2.id,
      responsable: "Recursos humanos",
      prioridad: "media",
      estado: "abierta",
      fechaDeteccion: hoy,
      fechaLimite: sumarDias(hoy, 2),
    },
  ]);

  console.log("✔ Datos de ejemplo cargados.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
