# Sistema Fondoempleo · Gestión de Capacitaciones

Plataforma web para gestionar capacitaciones organizadas en **Componente › Actividad › Módulo › Sesión**, programarlas en distintas **sedes, horarios y capacitadores**, y tomar **listas de asistencia**.

**Tecnologías:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM

---

## Dónde está el proyecto

Todo el proyecto vive en `C:\Users\jgain\OneDrive\14 Sistema Fondoempleo` y se trabaja desde esa carpeta.

> **Nota sobre OneDrive:** al ejecutar `npm install` se crea la carpeta `node_modules` (miles de archivos). OneDrive la sincronizará, y la primera vez puede tardar. Si notas lentitud, pausa la sincronización mientras instalas (icono de OneDrive › Pausar sincronización).

---

## 1. Instalar Node.js (versión 20 o superior)

1. Descarga el instalador **LTS** desde https://nodejs.org (archivo `.msi`).
2. Instálalo con las opciones por defecto.
3. Abre una terminal nueva (PowerShell) y comprueba: `node -v`. Debe mostrar v22.x o superior.

## 2. Instalar PostgreSQL + pgAdmin 4

1. Descarga el instalador para Windows desde https://www.postgresql.org/download/windows/ (enlace *Download the installer*, de EDB). Elige la última versión.
2. Durante la instalación:
   - Deja marcados **PostgreSQL Server**, **pgAdmin 4** y **Command Line Tools**.
   - Define una contraseña para el usuario `postgres` y **anótala**.
   - Deja el puerto **5432**.
3. Abre **pgAdmin 4**, conéctate con la contraseña de `postgres` y abre la **Query Tool** (clic derecho en *Databases* › *Query Tool*). Ejecuta:

```sql
CREATE USER fondoempleo WITH PASSWORD 'fondoempleo' CREATEDB;
CREATE DATABASE fondoempleo OWNER fondoempleo;
```

## 3. Ver las tablas de la base de datos

| Herramienta | Cómo abrirla | Ideal para |
|---|---|---|
| **pgAdmin 4** (viene con PostgreSQL) | Menú Inicio › pgAdmin 4 › *Servers* › *PostgreSQL* › *Databases* › `fondoempleo` › *Schemas* › `public` › *Tables* | La herramienta oficial: tablas, datos y SQL |
| **Drizzle Studio** (incluido en el proyecto) | `npm run db:studio` → abre https://local.drizzle.studio | Ver y editar datos rápido |
| **DBeaver** (opcional) | https://dbeaver.io/download | Diagramas entidad-relación |

Datos de conexión:

- **Host:** `localhost` · **Puerto:** `5432`
- **Base de datos:** `fondoempleo`
- **Usuario:** `fondoempleo` · **Contraseña:** `fondoempleo`

> Tip: en pgAdmin, clic derecho sobre la base `fondoempleo` › **ERD For Database** para ver el diagrama de todas las tablas.

## 4. Levantar el proyecto

Abre PowerShell en la carpeta del proyecto (en el Explorador: clic derecho dentro de la carpeta › *Abrir en Terminal*) y ejecuta:

```powershell
copy .env.example .env      # ajusta DATABASE_URL si usaste otra contraseña
npm install
npm run db:setup            # crea las tablas y carga datos de ejemplo
npm run dev
```

Abre **http://localhost:4000** 🎉 (desde otros equipos de la oficina: `http://<IP-de-este-PC>:4000`, ver abajo)

---

## Usarlo desde otros equipos de la oficina

1. Una sola vez, en PowerShell **como administrador**: `powershell -ExecutionPolicy Bypass -File scripts\abrir-puerto.ps1`
2. Arranca con `npm run dev` (o `npm run build` y luego `npm start` para modo producción, más rápido).
3. Los demás entran a `http://<IP-de-este-PC>:4000` (el script del paso 1 te muestra la IP).

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` y `npm start` | Compilar y ejecutar en modo producción |
| `npm run db:ver` | **Ver todas las tablas** en el navegador (Drizzle Studio, se abre solo) |
| `npm run db:pgadmin` | Abrir **pgAdmin 4** |
| `npm run db:generate` | Crear una migración después de modificar `src/db/schema.ts` |
| `npm run db:migrate` | Aplicar las migraciones pendientes |
| `npm run db:seed` | **Borra todo** y recarga los datos de ejemplo |
| `npm run lint` | Revisar el código |

### ¿Cómo agrego una columna o tabla?

1. Edita `src/db/schema.ts`.
2. `npm run db:generate -- --name descripcion_del_cambio`
3. `npm run db:migrate`

---

## Estructura del proyecto

El menú se organiza en 3 áreas, y cada carpeta de `src/app/` es una ruta:

```
src/app/
├── page.tsx                          Panel de inicio (clic en el logo)
├── estrategico/
│   ├── cronograma/                   Cronograma de capacitaciones (calendario + estructura)
│   │   └── estructura/               Árbol Componente › Actividad › Módulo › Sesión
│   ├── consultores/                  Asignación de consultores (con control de cruces)
│   ├── indicadores/                  Indicadores con semáforo y metas
│   └── acciones-correctivas/         Registro y seguimiento de acciones correctivas
├── operativo/
│   ├── pre-capacitacion/             Preparación de sesiones + participantes
│   ├── capacitacion/                 Listas de asistencia (+ impresión)
│   └── post-capacitacion/            Resultados: asistencia por sesión y por participante
└── soporte/
    ├── recursos-humanos/             Consultores
    ├── logistica/                    Sedes
    ├── mantenimiento/                (por definir)
    └── gestion-documental/           (por definir)

src/components/   Menú lateral y componentes reutilizables
src/db/           schema.ts (⭐ modelo de datos), conexión y datos de ejemplo
src/lib/          Consultas, fechas, indicadores (metas en indicadores.ts) y menú (navegacion.ts)
drizzle/          Migraciones SQL
scripts/          Utilidades (probar conexión, abrir pgAdmin, abrir puerto, etc.)
```

## Flujo de pre-capacitación

Implementa el diagrama BPMN *FLUJO DE PROCESO – PRE CAPACITACIÓN*. Cada sesión programada tiene un **expediente**
(Operativo › Pre-capacitación › Abrir expediente) con las 20 actividades del diagrama, su responsable y sus compuertas:

| Fase | Actividades (responsable) |
|---|---|
| 1 · Confirmación del local | Confirmar local y ejecución (Jefe de Proyecto) → Confirmar con la sede (Jefe Comercial) · si **no** se confirma → *Reprogramar sesión* |
| 2 · Personal | Revisar disponibilidad y asignar capacitador + asistente (valida cruces) → Comunicar por NextCloud (plazo: 3 días antes) |
| 3 · Capacitador | Descargar diapositivas/talleres (Gestión Documental) → ¿Personalizar? → ¿Material para dinámicas? (pasa a la ficha) → Examen de entrada/salida (solo 1ra o última sesión) → Guardar en medio seguro → Coordinar hora de salida |
| 3 · Asistente | Imprimir ficha y lista → Alistar material de la 1ra sección → Probar equipos (tabla de Mantenimiento) → Solicitar viáticos → Entrega: movilidad (Jefe de Proyecto) o viaje (Administradora) según la sede → Recepción → Llenar ficha → Revisión (Gestión Documental; si hay observaciones vuelve) → Aprobación (Jefe de Proyecto) → Coordinar hora de salida |
| 4 | Sesión lista, sale a sede |

- La bandeja permite ver **pendientes por rol**.
- El plazo de comunicación se cambia en `src/lib/flujo-pre.ts` (`DIAS_ANTICIPACION_COMUNICACION`).
- Registra al personal interno (roles) en Soporte › Recursos humanos; los materiales en Soporte › Gestión documental; los equipos en Soporte › Mantenimiento; y si cada sede está dentro o fuera de Arequipa en Soporte › Logística.

## Modelo de datos

```
componentes ─┬─< actividades ─┬─< modulos ─┬─< sesiones ─┬─< programaciones >─── sedes
                                                          │        │  └──────────── capacitadores
                                                          │        ├─< inscripciones >── participantes
                                                          │        └─< asistencias   >── participantes
```

- **programaciones**: una sesión dictada en una **sede**, **fecha**, **horario** (turno calculado) y con un **capacitador**. Si el capacitador ya tiene otra sesión que se cruza ese día, el sistema lo impide.
- **inscripciones**: quién debe asistir a cada programación.
- **acciones_correctivas**: problema detectado, causa, acción, responsable, fecha límite y resultado al cerrarla.
- **asistencias**: presente / tarde / ausente / justificado, con hora de ingreso y observación. Al **cerrar la lista**, la programación pasa a *Finalizada*.

## Próximas fases sugeridas

- Login de usuarios con roles (Coordinador, Capacitador).
- Importar participantes desde Excel.
- Reportes de asistencia por componente, sede y participante (con exportación a Excel).
- Vista de calendario semanal.

## Guardar el código con Git + GitHub (recomendado)

Instala Git desde https://git-scm.com/download/win y luego, en PowerShell dentro de la carpeta:

```powershell
git init && git add . && git commit -m "Versión inicial"
# crea un repositorio vacío en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/fondoempleo.git
git push -u origin main
```
