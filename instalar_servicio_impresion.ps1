#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instala el Agente de Impresion del Restaurante como una Tarea Programada de Windows.
    El agente se iniciara automaticamente al encender la PC, sin necesidad de abrir nada.
    
.DESCRIPTION
    Crea una tarea en el Programador de Tareas de Windows que:
    - Se ejecuta automaticamente al iniciar sesion del usuario actual
    - Corre en segundo plano (sin ventana visible)
    - Se reinicia automaticamente si falla
    - Conecta con el servidor en la nube para obtener trabajos de impresion

.USAGE
    Clic derecho -> "Ejecutar como Administrador" en este archivo .ps1
    O desde PowerShell Admin: .\instalar_servicio_impresion.ps1
#>

$TaskName    = "RestauranteAgentePrint"
$TaskDesc    = "Agente de impresion local para Gestion Restaurante El Makala. Conecta con el servidor en la nube y envia trabajos a la impresora termica local."
$NodePath    = "C:\Program Files\nodejs\node.exe"
$ScriptPath  = "C:\Antigravity\Gestion Restaurante\print-agent.js"
$WorkingDir  = "C:\Antigravity\Gestion Restaurante"

# Validate that node.exe exists
if (-not (Test-Path $NodePath)) {
    $NodePath = (Get-Command node -ErrorAction SilentlyContinue)?.Source
    if (-not $NodePath) {
        Write-Error "ERROR: No se encontro Node.js. Instale Node.js antes de continuar."
        exit 1
    }
}

# Validate that print-agent.js exists
if (-not (Test-Path $ScriptPath)) {
    Write-Error "ERROR: No se encontro print-agent.js en: $ScriptPath"
    exit 1
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR DEL SERVICIO DE IMPRESION - RESTAURANTE" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Node.js : $NodePath" -ForegroundColor Green
Write-Host "  Script  : $ScriptPath" -ForegroundColor Green
Write-Host "  Usuario : $env:USERNAME" -ForegroundColor Green
Write-Host ""

# Remove existing task if it exists
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[INFO] Se encontro una tarea existente. Eliminando..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Tarea anterior eliminada." -ForegroundColor Green
}

# --- Build the Scheduled Task ---

# Action: run node print-agent.js (hidden window)
$Action = New-ScheduledTaskAction `
    -Execute $NodePath `
    -Argument "`"$ScriptPath`"" `
    -WorkingDirectory $WorkingDir

# Trigger: at user logon (for current user) + at system startup
$TriggerLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

# Settings: allow running on batteries, restart on failure, etc.
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -RestartCount 999 `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

# Principal: run as current user, highest available privilege
$Principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Highest

# Register the task
try {
    $Task = Register-ScheduledTask `
        -TaskName $TaskName `
        -Description $TaskDesc `
        -Action $Action `
        -Trigger $TriggerLogon `
        -Settings $Settings `
        -Principal $Principal `
        -Force

    Write-Host "[OK] Tarea programada registrada exitosamente." -ForegroundColor Green
} catch {
    Write-Error "ERROR al registrar la tarea: $_"
    exit 1
}

# Start the task NOW so it runs immediately without needing to reboot
Write-Host ""
Write-Host "[INFO] Iniciando el agente ahora mismo..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 2

$Status = (Get-ScheduledTask -TaskName $TaskName).State
Write-Host "[OK] Estado actual: $Status" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  El agente de impresion esta ACTIVO y se iniciara" -ForegroundColor White
Write-Host "  automaticamente cada vez que encienda la PC." -ForegroundColor White
Write-Host ""
Write-Host "  Para verificar: abra 'Programador de Tareas' y busque:" -ForegroundColor White
Write-Host "  -> $TaskName" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Para desinstalar ejecute: .\desinstalar_servicio_impresion.ps1" -ForegroundColor White
Write-Host ""
