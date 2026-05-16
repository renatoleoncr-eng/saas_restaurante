node .agent/tesseract-lite/analyzer.js
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "Tesseract Lite: Code Map Updated!" -ForegroundColor Green
Write-Host "Open the following file in your browser:"
Write-Host "file://$((Get-Location).Path.Replace('\', '/'))/.agent/tesseract-lite/viewer.html" -ForegroundColor Yellow
Write-Host "----------------------------------------"
