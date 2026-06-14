# Asistente de Configuración de Impresora Local - Gestión Restaurante
# ------------------------------------------------------------------
# Este script ayuda a configurar las impresoras locales conectadas a esta PC
# y guarda la configuración en 'local-printer-config.json'.

$OutputEncoding = [System.Text.Encoding]::UTF8
$configFile = Join-Path $PSScriptRoot "local-printer-config.json"

# Cargar configuración existente o crear una por defecto
$config = @{
    caja = @{ type = "disabled"; path = ""; printerName = "" }
    cocina = @{ type = "disabled"; path = ""; printerName = "" }
    barra = @{ type = "disabled"; path = ""; printerName = "" }
}

if (Test-Path $configFile) {
    try {
        $content = Get-Content $configFile -Raw -ErrorAction SilentlyContinue
        if ($content) {
            $parsed = ConvertFrom-Json $content
            if ($parsed.caja) { $config.caja = @{ type = $parsed.caja.type; path = $parsed.caja.path; printerName = $parsed.caja.printerName } }
            if ($parsed.cocina) { $config.cocina = @{ type = $parsed.cocina.type; path = $parsed.cocina.path; printerName = $parsed.cocina.printerName } }
            if ($parsed.barra) { $config.barra = @{ type = $parsed.barra.type; path = $parsed.barra.path; printerName = $parsed.barra.printerName } }
        }
    } catch {}
}

function Show-Header {
    Clear-Host
    Write-Host "=============================================================" -ForegroundColor Cyan
    Write-Host "     ASISTENTE DE CONFIGURACION DE IMPRESORAS LOCALES" -ForegroundColor Cyan
    Write-Host "=============================================================" -ForegroundColor Cyan
    Write-Host " Configure qué impresoras están físicamente conectadas a ESTA PC." -ForegroundColor Gray
    Write-Host ""
}

function Show-CurrentConfig {
    Write-Host "Configuración Actual de esta PC:" -ForegroundColor Yellow
    Write-Host "-------------------------------------------------------------" -ForegroundColor Gray
    foreach ($key in "caja", "cocina", "barra") {
        $ptype = $config[$key].type
        $pname = $config[$key].printerName
        $ppath = $config[$key].path
        
        $details = ""
        if ($ptype -eq "disabled") { $details = "[DESHABILITADA]" }
        elseif ($ptype -eq "windows_print") { $details = "Cola de Windows -> '$pname'" }
        elseif ($ptype -eq "usb") { $details = "Directo USB -> '$ppath'" }
        elseif ($ptype -eq "ethernet") { $details = "IP Ethernet -> '$ppath'" }
        
        Write-Host " * Impresora $($key.ToUpper().PadRight(6)): $details" -ForegroundColor White
    }
    Write-Host "-------------------------------------------------------------" -ForegroundColor Gray
    Write-Host ""
}

function List-WindowsPrinters {
    Write-Host "Impresoras instaladas en Windows detectadas:" -ForegroundColor Gray
    $printers = Get-Printer | Select-Object -ExpandProperty Name
    foreach ($p in $printers) {
        Write-Host "  -> $p" -ForegroundColor Green
    }
    Write-Host ""
}

while ($true) {
    Show-Header
    Show-CurrentConfig
    
    Write-Host "Seleccione qué impresora desea configurar en esta PC:" -ForegroundColor White
    Write-Host " 1. Impresora Caja / General" -ForegroundColor White
    Write-Host " 2. Impresora Cocina" -ForegroundColor White
    Write-Host " 3. Impresora Barra" -ForegroundColor White
    Write-Host " 4. Guardar y Salir" -ForegroundColor Green
    Write-Host " 5. Cancelar sin guardar" -ForegroundColor Red
    Write-Host ""
    
    $opt = Read-Host "Opción (1-5)"
    
    if ($opt -eq "4") {
        # Guardar en archivo
        $jsonStr = ConvertTo-Json $config -Depth 4
        [System.IO.File]::WriteAllText($configFile, $jsonStr, [System.Text.Encoding]::UTF8)
        
        Write-Host ""
        Write-Host "[OK] Configuración guardada en: $configFile" -ForegroundColor Green
        Write-Host "El Agente de Impresión aplicará estos cambios automáticamente en su próximo ciclo." -ForegroundColor Green
        Write-Host ""
        Pause
        break
    }
    elseif ($opt -eq "5") {
        Write-Host "`nCambios descartados." -ForegroundColor Yellow
        break
    }
    
    $printerKey = ""
    if ($opt -eq "1") { $printerKey = "caja" }
    elseif ($opt -eq "2") { $printerKey = "cocina" }
    elseif ($opt -eq "3") { $printerKey = "barra" }
    else { continue }
    
    Show-Header
    Write-Host "Configurando Impresora: $($printerKey.ToUpper())" -ForegroundColor Yellow
    Write-Host "-------------------------------------------------------------" -ForegroundColor Gray
    Write-Host "Seleccione el tipo de conexión física:" -ForegroundColor White
    Write-Host " 1. Cola de Windows (Spooler) - [RECOMENDADO]" -ForegroundColor Green
    Write-Host "    (Usa el driver de Windows. Muy estable y no depende de puertos dinámicos)"
    Write-Host " 2. Red Ethernet (IP Directo)" -ForegroundColor White
    Write-Host "    (Conexión directa por cable de red a la IP de la impresora)"
    Write-Host " 3. USB Directo (RAW)" -ForegroundColor White
    Write-Host "    (Envío directo por puerto USB, requiere la ruta de puerto USB)"
    Write-Host " 4. Deshabilitada" -ForegroundColor Red
    Write-Host "    (Esta PC no se encargará de imprimir este ticket)"
    Write-Host ""
    
    $typeOpt = Read-Host "Opción (1-4)"
    
    $newConfig = @{ type = "disabled"; path = ""; printerName = "" }
    
    if ($typeOpt -eq "1") {
        $newConfig.type = "windows_print"
        Show-Header
        List-WindowsPrinters
        $name = Read-Host "Escriba o copie el nombre EXACTO de la impresora en Windows"
        if ($name) {
            $newConfig.printerName = $name.Trim()
        } else {
            Write-Host "Nombre no puede estar vacío." -ForegroundColor Red
            Pause
            continue
        }
    }
    elseif ($typeOpt -eq "2") {
        $newConfig.type = "ethernet"
        Show-Header
        Write-Host "Recuerde configurar una IP estática en su impresora usando el software del fabricante." -ForegroundColor Yellow
        Write-Host "Ejemplo de IP: 192.168.1.200" -ForegroundColor Gray
        Write-Host ""
        $ip = Read-Host "Ingrese la Dirección IP de la impresora"
        if ($ip) {
            $newConfig.path = $ip.Trim()
        } else {
            Write-Host "La dirección IP no puede estar vacía." -ForegroundColor Red
            Pause
            continue
        }
    }
    elseif ($typeOpt -eq "3") {
        $newConfig.type = "usb"
        Show-Header
        Write-Host "Ejemplo de ruta USB: \\?\USB#VID_0456&PID_0808#6&2defd777&0&2#{28d78fad-5a12-11d1-ae5b-0000f803a8c2}" -ForegroundColor Gray
        Write-Host ""
        $path = Read-Host "Ingrese la Ruta del Dispositivo USB (Device Path)"
        if ($path) {
            $newConfig.path = $path.Trim()
        } else {
            Write-Host "La ruta USB no puede estar vacía." -ForegroundColor Red
            Pause
            continue
        }
    }
    elseif ($typeOpt -eq "4") {
        $newConfig.type = "disabled"
    }
    else {
        continue
    }
    
    $config[$printerKey] = $newConfig
    Write-Host ""
    Write-Host "[OK] Impresora $($printerKey.ToUpper()) configurada temporalmente." -ForegroundColor Green
    Start-Sleep -Seconds 1
}
