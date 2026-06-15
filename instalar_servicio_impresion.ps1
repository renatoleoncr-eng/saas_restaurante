<#
.SYNOPSIS
    Instala el Agente de Impresion del Restaurante como una Tarea Programada de Windows.
    El agente se iniciara automaticamente al encender la PC, sin necesidad de abrir nada.
    NO requiere instalar Node.js previamente - el instalador lo gestiona automaticamente.

.DESCRIPTION
    Este script:
    1. Detecta si Node.js esta disponible (en el sistema o en la carpeta local)
    2. Si no hay Node.js, descarga automaticamente el ejecutable portable desde nodejs.org (~35MB)
    3. Descarga el agente (print-agent.js) y el script auxiliar (print_raw.ps1) desde el servidor
    4. Crea una Tarea Programada de Windows que inicia el agente al iniciar sesion
    5. El agente se reinicia automaticamente si falla
    6. No requiere abrir PowerShell ni nada manualmente despues de la instalacion

.USAGE
    Doble clic en este archivo .ps1
    O desde PowerShell: .\instalar_servicio_impresion.ps1
    Si PowerShell bloquea la ejecucion:
    powershell -ExecutionPolicy Bypass -File .\instalar_servicio_impresion.ps1

.NOTE
    NO requiere privilegios de Administrador - corre como el usuario actual.
    NO requiere instalar Node.js - se descarga automaticamente si es necesario.
#>

$TaskName   = "RestauranteAgentePrint"
$ServerUrl  = "https://makala.maksuites.com.pe"
$InstallDir = "$env:LOCALAPPDATA\RestauranteAgente"
$AgentFile  = "$InstallDir\print-agent.js"

# Version LTS de Node.js portable (binario standalone, sin instalador)
$NodeVersion    = "v20.17.0"
$NodePortableUrl = "https://nodejs.org/dist/$NodeVersion/win-x64/node.exe"
$NodePortablePath = "$InstallDir\node.exe"

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR DEL AGENTE DE IMPRESION - RESTAURANTE EL MAKALA" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Crear carpeta de instalacion ---
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Write-Host "[OK] Carpeta creada: $InstallDir" -ForegroundColor Green
} else {
    Write-Host "[OK] Carpeta existente: $InstallDir" -ForegroundColor Green
}

# --- Detectar Node.js (3 pasos escalonados) ---
Write-Host ""
Write-Host "[INFO] Verificando disponibilidad de Node.js..." -ForegroundColor Yellow

# Paso 1: Buscar en el PATH del sistema
$NodePath = (Get-Command node -ErrorAction SilentlyContinue)?.Source

if ($NodePath) {
    Write-Host "[OK] Node.js encontrado en el sistema: $NodePath" -ForegroundColor Green
}

# Paso 2: Buscar node.exe portable en la carpeta local
if (-not $NodePath -and (Test-Path $NodePortablePath)) {
    $NodePath = $NodePortablePath
    Write-Host "[OK] Node.js portable encontrado en: $NodePath" -ForegroundColor Green
}

# Paso 3: Descargar node.exe portable si no hay ninguno disponible
if (-not $NodePath) {
    Write-Host ""
    Write-Host "[INFO] Node.js no encontrado. Descargando Node.js portable ($NodeVersion)..." -ForegroundColor Yellow
    Write-Host "[INFO] Esto puede tardar unos segundos segun la velocidad de internet (~35MB)..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        # Usar BITS (Servicio de Transferencia Inteligente en Segundo Plano) para mostrar progreso
        # Fallback a Invoke-WebRequest si BITS no esta disponible
        $bitsAvailable = Get-Command Start-BitsTransfer -ErrorAction SilentlyContinue
        
        if ($bitsAvailable) {
            Start-BitsTransfer -Source $NodePortableUrl -Destination $NodePortablePath -DisplayName "Descargando Node.js $NodeVersion" -ErrorAction Stop
        } else {
            # Mostrar progreso manual con Invoke-WebRequest
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $NodePortableUrl -OutFile $NodePortablePath -UseBasicParsing -ErrorAction Stop
            $ProgressPreference = 'Continue'
        }
        
        if (Test-Path $NodePortablePath) {
            $sizeMB = [math]::Round((Get-Item $NodePortablePath).Length / 1MB, 1)
            Write-Host "[OK] Node.js portable descargado correctamente ($sizeMB MB)." -ForegroundColor Green
            $NodePath = $NodePortablePath
        } else {
            throw "El archivo no fue creado correctamente."
        }
    } catch {
        Write-Host ""
        Write-Host "[ERROR] No se pudo descargar Node.js automaticamente." -ForegroundColor Red
        Write-Host "        Verifica tu conexion a internet e intenta de nuevo." -ForegroundColor Yellow
        Write-Host "        Detalles: $_" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "        Alternativa manual: descarga node.exe desde:" -ForegroundColor Yellow
        Write-Host "        $NodePortableUrl" -ForegroundColor Cyan
        Write-Host "        y coloca el archivo en: $InstallDir\node.exe" -ForegroundColor Cyan
        Write-Host ""
        Read-Host "Presiona Enter para salir"
        exit 1
    }
}

Write-Host "[OK] Usando Node.js: $NodePath" -ForegroundColor Green

# --- Descargar print-agent.js desde el servidor ---
Write-Host ""
Write-Host "[INFO] Descargando agente desde $ServerUrl ..." -ForegroundColor Yellow
try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri "$ServerUrl/api/config/printers/agent-js" -OutFile $AgentFile -UseBasicParsing -ErrorAction Stop
    $ProgressPreference = 'Continue'
    Write-Host "[OK] print-agent.js descargado." -ForegroundColor Green
} catch {
    # Si falla la descarga, copiar desde la carpeta local si existe
    $LocalAgent = "C:\Antigravity\Gestion Restaurante\print-agent.js"
    if (Test-Path $LocalAgent) {
        Copy-Item $LocalAgent $AgentFile -Force
        Write-Host "[WARN] Descarga fallida, usando copia local." -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] No se pudo obtener el agente: $_" -ForegroundColor Red
        Read-Host "Presiona Enter para salir"
        exit 1
    }
}

# --- Descargar print_raw.ps1 (script auxiliar de impresion) ---
$PsScriptDir = "$InstallDir\server\utils"
if (-not (Test-Path $PsScriptDir)) {
    New-Item -ItemType Directory -Path $PsScriptDir -Force | Out-Null
}
try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri "$ServerUrl/api/config/printers/print-raw-ps1" -OutFile "$PsScriptDir\print_raw.ps1" -UseBasicParsing -ErrorAction Stop
    $ProgressPreference = 'Continue'
    Write-Host "[OK] print_raw.ps1 descargado." -ForegroundColor Green
} catch {
    $LocalPs1 = "C:\Antigravity\Gestion Restaurante\server\utils\print_raw.ps1"
    if (Test-Path $LocalPs1) {
        Copy-Item $LocalPs1 "$PsScriptDir\print_raw.ps1" -Force
        Write-Host "[WARN] Usando copia local de print_raw.ps1." -ForegroundColor Yellow
    } else {
        Write-Host "[WARN] No se encontro print_raw.ps1 - la impresion directa a Windows puede no funcionar." -ForegroundColor Yellow
    }
}

# --- Eliminar tarea anterior si existe ---
$existing = schtasks /Query /TN $TaskName 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[INFO] Eliminando instalacion anterior..." -ForegroundColor Yellow
    schtasks /Delete /TN $TaskName /F | Out-Null
    Write-Host "[OK] Tarea anterior eliminada." -ForegroundColor Green
}

# --- Crear XML de la tarea ---
# Usar siempre la ruta absoluta a node.exe para garantizar que funcione
# independientemente de si Node esta en el PATH o es el portable local
$xmlContent = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Agente de impresion local para Restaurante El Makala. Conecta con el servidor en la nube y envia trabajos a la impresora termica local. Se inicia automaticamente al encender la PC.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$env:USERDOMAIN\$env:USERNAME</UserId>
    </LogonTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$NodePath</Command>
      <Arguments>"$AgentFile"</Arguments>
      <WorkingDirectory>$InstallDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

$xmlFile = "$InstallDir\task_print_agent.xml"
$xmlContent | Out-File -FilePath $xmlFile -Encoding Unicode

# --- Registrar la tarea ---
Write-Host ""
Write-Host "[INFO] Registrando tarea programada '$TaskName'..." -ForegroundColor Yellow
schtasks /Create /XML $xmlFile /TN $TaskName /F 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] No se pudo crear la tarea programada." -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Host "[OK] Tarea programada creada." -ForegroundColor Green

# --- Iniciar el agente ahora mismo ---
Write-Host ""
Write-Host "[INFO] Iniciando el agente ahora..." -ForegroundColor Yellow
schtasks /Run /TN $TaskName | Out-Null
Start-Sleep -Seconds 3

$status = (schtasks /Query /TN $TaskName /FO LIST 2>&1) | Select-String "Estado:"
Write-Host "[OK] $status" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Cyan
Write-Host "=============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  El agente de impresion esta ACTIVO." -ForegroundColor White
Write-Host "  Arrancara automaticamente cada vez que encienda la PC." -ForegroundColor White
Write-Host ""
Write-Host "  Node.js usado: $NodePath" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Para verificar: abra el Programador de Tareas y busque:" -ForegroundColor White
Write-Host "  -> $TaskName" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Para desinstalar: ejecute desinstalar_servicio_impresion.ps1" -ForegroundColor White
Write-Host ""

Read-Host "Presiona Enter para cerrar"
