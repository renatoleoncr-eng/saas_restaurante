#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Desinstala el Agente de Impresion del Programador de Tareas de Windows.
#>

$TaskName = "RestauranteAgentePrint"

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  DESINSTALADOR DEL SERVICIO DE IMPRESION" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Servicio de impresion desinstalado correctamente." -ForegroundColor Green
} else {
    Write-Host "[INFO] No se encontro la tarea '$TaskName'. Nada que desinstalar." -ForegroundColor Yellow
}

Write-Host ""
