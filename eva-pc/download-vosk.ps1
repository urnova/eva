$ErrorActionPreference = "Stop"

$publicDir = "f:\code\eva\evaprojectmultiplatforme\eva-pc\public"
$libDir = "f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\lib"
$modelsDir = "$publicDir\models"

if (!(Test-Path -Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir | Out-Null
}

Write-Host "Downloading vosk.js..."
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js" -OutFile "$libDir\vosk.js"

Write-Host "Downloading Vosk French Model..."
$zipPath = "$modelsDir\vosk-model-small-fr-0.22.zip"
if (!(Test-Path -Path $zipPath)) {
    Invoke-WebRequest -Uri "https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip" -OutFile $zipPath
}

Write-Host "Extracting model..."
$extractPath = "$modelsDir"
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

# Rename the extracted folder if necessary to make it simple
if (Test-Path -Path "$extractPath\vosk-model-small-fr-0.22") {
    Write-Host "Model extracted successfully."
}

Write-Host "Done!"
