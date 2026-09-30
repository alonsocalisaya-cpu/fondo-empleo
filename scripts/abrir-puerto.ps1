# Abre el puerto 4000 en el Firewall de Windows para que otros equipos de la red
# puedan entrar a la plataforma. Ejecutar UNA sola vez, en PowerShell COMO ADMINISTRADOR:
#   powershell -ExecutionPolicy Bypass -File scripts\abrir-puerto.ps1
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$puerto = 4000
$nombre = "Sistema Fondoempleo (puerto $puerto)"

Get-NetFirewallRule -DisplayName $nombre -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $nombre -Direction Inbound -Protocol TCP -LocalPort $puerto `
  -Action Allow -Profile Domain,Private | Out-Null
Write-Host "✔ Puerto $puerto abierto en el firewall (redes privadas y de dominio)." -ForegroundColor Green

$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -ExpandProperty IPAddress
Write-Host "`nDesde otros equipos de la oficina, entra a:"
foreach ($ip in $ips) { Write-Host "   http://${ip}:$puerto" -ForegroundColor Cyan }

$perfiles = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }
if ($perfiles) {
  Write-Host "`n⚠ Tu red '$($perfiles[0].Name)' está marcada como PÚBLICA. Cámbiala a PRIVADA en" -ForegroundColor Yellow
  Write-Host "  Configuración › Red e Internet › (tu conexión) › Tipo de perfil de red › Privada" -ForegroundColor Yellow
}
