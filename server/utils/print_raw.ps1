param (
    [string]$PrinterType,
    [string]$PrinterPath,
    [string]$PrinterName,
    [string]$HexData
)

# Convert Hex string to Byte array
if ([string]::IsNullOrEmpty($HexData)) {
    Write-Error "Error: HexData is empty."
    exit 1
}

$bytes = New-Object byte[] ($HexData.Length / 2)
for ($i = 0; $i -lt $bytes.Length; $i++) {
    $bytes[$i] = [Convert]::ToByte($HexData.Substring(($i * 2), 2), 16)
}

# 1. Print via USB Direct Path
if ($PrinterType -eq "usb") {
    if ([string]::IsNullOrEmpty($PrinterPath)) {
        Write-Error "Error: PrinterPath is empty for USB printing."
        exit 1
    }

    # Load C# helper class if not already loaded
    if (-not ([System.Management.Automation.PSTypeName]"UsbDirectPrinter").Type) {
        $dllPath = Join-Path $PSScriptRoot "UsbDirectPrinter.dll"
        try {
            if (Test-Path $dllPath) {
                Add-Type -Path $dllPath
            } else {
                Add-Type -TypeDefinition @"
            using System;
            using System.Runtime.InteropServices;
            using Microsoft.Win32.SafeHandles;

            public class UsbDirectPrinter {
                [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
                public static extern SafeFileHandle CreateFile(
                    string lpFileName, uint dwDesiredAccess, uint dwShareMode,
                    IntPtr lpSecurityAttributes, uint dwCreationDisposition,
                    uint dwFlagsAndAttributes, IntPtr hTemplateFile);

                [DllImport("kernel32.dll", SetLastError = true)]
                public static extern bool WriteFile(
                    SafeFileHandle hFile, byte[] lpBuffer, uint nNumberOfBytesToWrite,
                    out uint lpNumberOfBytesWritten, IntPtr lpOverlapped);

                public const uint GENERIC_WRITE = 0x40000000;
                public const uint OPEN_EXISTING = 3;
                public const uint FILE_SHARE_RW = 3;
            }
"@ -OutputAssembly $dllPath
                Add-Type -Path $dllPath
            }
        } catch {
            Write-Error "Error loading UsbDirectPrinter class: $_"
            exit 1
        }
    }

    Write-Host "Opening direct USB path: $PrinterPath"
    $handle = [UsbDirectPrinter]::CreateFile(
        $PrinterPath,
        [UsbDirectPrinter]::GENERIC_WRITE,
        [UsbDirectPrinter]::FILE_SHARE_RW,
        [IntPtr]::Zero,
        [UsbDirectPrinter]::OPEN_EXISTING,
        0,
        [IntPtr]::Zero
    )

    if ($handle.IsInvalid) {
        $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Error "Error: Failed to open printer path (Win32 Error: $err)"
        exit 1
    }

    $written = [uint32]0
    $ok = [UsbDirectPrinter]::WriteFile($handle, $bytes, [uint32]$bytes.Length, [ref]$written, [IntPtr]::Zero)
    $handle.Close()

    if ($ok) {
        Write-Host "Success: Sent $written bytes to USB printer."
        exit 0
    } else {
        $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Error "Error: WriteFile failed (Win32 Error: $err)"
        exit 1
    }
}

# 2. Print via Windows Print Spooler (Named Printer)
elseif ($PrinterType -eq "windows_print") {
    if ([string]::IsNullOrEmpty($PrinterName)) {
        Write-Error "Error: PrinterName is empty for Windows Print Spooler."
        exit 1
    }

    # Load C# Spooler class if not already loaded
    if (-not ([System.Management.Automation.PSTypeName]"RawPrinterHelper").Type) {
        $dllPath = Join-Path $PSScriptRoot "RawPrinterHelper.dll"
        try {
            if (Test-Path $dllPath) {
                Add-Type -Path $dllPath
            } else {
                Add-Type -TypeDefinition @"
            using System;
            using System.Runtime.InteropServices;

            public class RawPrinterHelper {
                [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
                public class DOCINFOA {
                    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
                    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
                    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
                }

                [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
                public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

                [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
                public static extern bool ClosePrinter(IntPtr hPrinter);

                [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
                public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

                [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
                public static extern bool EndDocPrinter(IntPtr hPrinter);

                [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
                public static extern bool StartPagePrinter(IntPtr hPrinter);

                [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
                public static extern bool EndPagePrinter(IntPtr hPrinter);

                [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
                public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

                public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes, string docName) {
                    IntPtr hPrinter = IntPtr.Zero;
                    DOCINFOA di = new DOCINFOA();
                    di.pDocName = docName;
                    di.pDataType = "RAW";

                    if (!OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) return false;
                    if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
                    if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }

                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                    Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);

                    int dwWritten = 0;
                    bool bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);

                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return bSuccess;
                }
            }
"@ -OutputAssembly $dllPath
                Add-Type -Path $dllPath
            }
        } catch {
            Write-Error "Error loading RawPrinterHelper class: $_"
            exit 1
        }
    }

    Write-Host "Sending print job to Windows Printer: $PrinterName"
    $ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes, "POS Ticket")
    if ($ok) {
        Write-Host "Success: Sent raw bytes to Windows printer Spooler."
        exit 0
    } else {
        $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Error "Error: OpenPrinter/WritePrinter failed (Win32 Error: $err)"
        exit 1
    }
}

elseif ($PrinterType -eq "ethernet" -or $PrinterType -eq "network") {
    if ([string]::IsNullOrEmpty($PrinterPath)) {
        Write-Error "Error: PrinterPath (IP Address) is empty for Ethernet printing."
        exit 1
    }

    $ip = $PrinterPath.Trim()
    $port = 9100
    if ($ip -like "*:*") {
        $parts = $ip.Split(":")
        $ip = $parts[0]
        $port = [int]$parts[1]
    }

    Write-Host "Sending print job directly to TCP socket $($ip):$($port)"
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect($ip, $port)
        $stream = $client.GetStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Close()
        Write-Host "Success: Sent raw bytes directly to Ethernet printer at $($ip):$($port)."
        exit 0
    } catch {
        Write-Error "Error: Failed to connect or write to $($ip):$($port). Detail: $_"
        exit 1
    } finally {
        $client.Close()
    }
}

else {
    Write-Error "Error: Invalid PrinterType '$PrinterType'. Must be 'usb', 'windows_print' or 'ethernet'."
    exit 1
}
