# Continuar Fondoempleo en otra computadora

El código se guarda en GitHub. La base de datos PostgreSQL se entrega como un respaldo separado porque contiene datos operativos y personales.

## 1. Código

```powershell
git clone https://github.com/alonsocalisaya-cpu/fondo-empleo.git
cd fondo-empleo
npm install
```

Crear `.env` con la conexión local:

```env
DATABASE_URL=postgresql://fondoempleo:fondoempleo@localhost:5432/fondoempleo
```

## 2. Base de datos

Instalar PostgreSQL y crear una base vacía y un usuario con el mismo nombre. Luego restaurar el archivo de respaldo que se entrega fuera de GitHub:

```powershell
createdb -U postgres fondoempleo
pg_restore -U postgres -d fondoempleo --clean --if-exists fondoempleo.backup
```

Si se usa otro usuario, actualizar `DATABASE_URL` antes de iniciar la aplicación.

## 3. Migraciones futuras

Después de actualizar el código:

```powershell
npm run db:migrate
npm run dev
```

El respaldo contiene los registros actuales de la aplicación. Debe mantenerse en un lugar privado y no subirse al repositorio público.

Para generar un respaldo actualizado en este equipo:

```powershell
node scripts/respaldar-db.mjs
```

Se guarda en `respaldos-db/` y se comprueba su contenido con `pg_restore --list`. Los documentos subidos se encuentran en `archivos/`; esa carpeta también debe copiarse para trasladar el sistema completo.
