# ---------------------------------------------------------------------------
# Restablece la contraseña del usuario "postgres" y crea el usuario y la base
# "fondoempleo" que usa el proyecto.
#
# Ejecutar en PowerShell COMO ADMINISTRADOR, dentro de la carpeta del proyecto:
#   powershell -ExecutionPolicy Bypass -File scripts\restablecer-postgres.ps1
#
# Qué hace:
#   1. Respalda pg_hba.conf y permite entrar sin contraseña SOLO desde este equipo.
#   2. Reinicia PostgreSQL, cambia la contraseña de "postgres" y crea "fondoempleo".
#   3. Restaura pg_hba.conf original y reinicia PostgreSQL (pase lo que pase).
# ---------------------------------------------------------------------------
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

# 1) Encontrar el servicio de PostgreSQL y sus carpetas
$svc = Get-CimInstance Win32_Service | Where-Object { $_.Name -like 'postgresql*' } |
       Sort-Object { $_.State -ne 'Running' } | Select-Object -First 1
if (-not $svc) { throw 'No encontré el servicio de PostgreSQL. ¿Está instalado?' }

$ruta = $svc.PathName
if     ($ruta -match '-D\s+"([^"]+)"') { $data = $Matches[1] }
elseif ($ruta -match '-D\s+(\S+)')     { $data = $Matches[1] }
else   { throw "No pude leer la carpeta de datos desde: $ruta" }

$pgctl = if ($ruta -match '^"([^"]+)"') { $Matches[1] } else { ($ruta -split '\s+')[0] }
$psql  = Join-Path (Split-Path $pgctl) 'psql.exe'
$hba   = Join-Path $data 'pg_hba.conf'
$resp  = "$hba.respaldo"

Write-Host "Servicio:        $($svc.Name)"
Write-Host "Datos:           $data"
Write-Host "psql:            $psql`n"
if (-not (Test-Path $psql)) { throw "No encontré psql.exe en $psql" }
if (-not (Test-Path $hba))  { throw "No encontré pg_hba.conf en $hba" }

# 2) Pedir la nueva contraseña para "postgres"
$seg = Read-Host 'Nueva contraseña para el usuario postgres (anótala)' -AsSecureString
$clave = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
           [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seg))
if ([string]::IsNullOrWhiteSpace($clave)) { throw 'La contraseña no puede estar vacía.' }
$claveSql = $clave -replace "'", "''"

function Ejecutar-Sql([string]$sql) {
  & $psql -U postgres -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 -tA -c $sql
  if ($LASTEXITCODE -ne 0) { throw "Falló la instrucción SQL: $sql" }
}

Copy-Item $hba $resp -Force
try {
  # Acceso sin contraseña solo para conexiones locales (127.0.0.1 y ::1)
  $lineas = Get-Content $hba | ForEach-Object {
    $_ -replace '^(\s*host\s+all\s+all\s+(127\.0\.0\.1/32|::1/128)\s+)\S+', '${1}trust'
  }
  [IO.File]::WriteAllLines($hba, [string[]]$lineas)
  Write-Host 'Reiniciando PostgreSQL en modo recuperación…'
  Restart-Service $svc.Name -Force
  Start-Sleep -Seconds 4

  Ejecutar-Sql "ALTER USER postgres WITH PASSWORD '$claveSql';" | Out-Null
  Write-Host '✔ Contraseña de postgres actualizada.'

  $existeUsuario = Ejecutar-Sql "SELECT 1 FROM pg_roles WHERE rolname = 'fondoempleo';"
  if ("$existeUsuario".Trim() -eq '1') {
    Ejecutar-Sql "ALTER USER fondoempleo WITH PASSWORD 'fondoempleo' CREATEDB;" | Out-Null
  } else {
    Ejecutar-Sql "CREATE USER fondoempleo WITH PASSWORD 'fondoempleo' CREATEDB;" | Out-Null
  }
  Write-Host '✔ Usuario fondoempleo listo.'

  $existeBase = Ejecutar-Sql "SELECT 1 FROM pg_database WHERE datname = 'fondoempleo';"
  if ("$existeBase".Trim() -ne '1') {
    Ejecutar-Sql "CREATE DATABASE fondoempleo OWNER fondoempleo;" | Out-Null
  }
  Ejecutar-Sql "ALTER DATABASE fondoempleo OWNER TO fondoempleo;" | Out-Null
  Write-Host '✔ Base de datos fondoempleo lista.'
}
finally {
  # 3) Siempre restaurar la configuración original
  Copy-Item $resp $hba -Force
  Remove-Item $resp -Force
  Write-Host 'Restaurando la seguridad y reiniciando PostgreSQL…'
  Restart-Service $svc.Name -Force
}

Write-Host "`nListo. Ahora ejecuta (en una terminal normal):  npm run db:setup" -ForegroundColor Green
