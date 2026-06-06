# PowerShell script to download and launch Xprinter configuration utility
# --------------------------------------------------------------
# This script automates the download of the Xprinter Test Tool (or Config Utility)
# and launches it so you can configure the ADV-8010N printer's network settings.
# --------------------------------------------------------------

# ---- USER CONFIGURATION ----
# Destination folder for the download (you can change this path if desired)
$downloadFolder = "C:\Antigravity\Gestion Restaurante\scripts\xprinter_tool"
# URL to the Xprinter utility ZIP/EXE – replace with the official download link if needed
$downloadUrl = "https://download.xprinter.net/xprinter_test_tool.zip"
# Desired static IP for the printer (adjust as needed)
$staticIp = "192.168.1.200"
# Subnet mask and gateway – modify if your network differs
$subnetMask = "255.255.255.0"
$gateway = "192.168.1.1"
# --------------------------------------------------------------

# Create the destination folder if it does not exist
if (-Not (Test-Path -Path $downloadFolder)) {
    New-Item -ItemType Directory -Path $downloadFolder | Out-Null
}

# Download the archive
Write-Host "Downloading Xprinter utility..."
$zipPath = Join-Path $downloadFolder "xprinter_tool.zip"
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "Download completed: $zipPath"
} catch {
    Write-Error "Failed to download the file. Check the URL or your internet connection."
    exit 1
}

# Extract if it's a zip archive
if ($zipPath -like "*.zip") {
    Write-Host "Extracting archive..."
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $downloadFolder)
    Write-Host "Extraction finished."
}

# Locate the executable (common names: XprinterTestTool.exe, XprinterConfig.exe)
$exePath = Get-ChildItem -Path $downloadFolder -Filter "*.exe" -Recurse | Select-Object -First 1
if (-Not $exePath) {
    Write-Error "Executable not found in the extracted files. Please verify the download package."
    exit 1
}

# Launch the utility – it should detect the printer via USB
Write-Host "Launching Xprinter utility..."
Start-Process -FilePath $exePath.FullName -WorkingDirectory $exePath.DirectoryName
Write-Host "Utility started. Follow the GUI steps to set the static IP ($staticIp)."

# Optional: after the user sets the IP and reboots the printer, you can verify connectivity.
Write-Host "\nAfter configuring the printer, you can verify connectivity with the following commands:"
Write-Host "Test-NetConnection -ComputerName $staticIp -Port 9100"
Write-Host "Invoke-WebRequest -Uri "http://$staticIp" -UseBasicParsing"

# End of script
