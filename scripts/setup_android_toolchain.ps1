<#
.SYNOPSIS
    Idempotent Windows CLI bootstrap for JDK 17 and Android SDK (API 34).
.DESCRIPTION
    Checks/installs Eclipse Temurin JDK 17 and Android SDK cmdline-tools,
    platforms;android-34, and build-tools;34.0.0 under %LOCALAPPDATA%\Android
    without touching or overwriting existing platform-tools\adb.exe.
#>
[CmdletBinding()]
param(
    [switch]$SkipLicenseAccept
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$AndroidBase = Join-Path $env:LOCALAPPDATA "Android"
$SdkRoot     = Join-Path $AndroidBase "Sdk"
$JdkBase     = Join-Path $AndroidBase "jdk-17"
$AdbPath     = Join-Path $SdkRoot "platform-tools\adb.exe"

function Find-ExistingJdk17 {
    if (Test-Path $JdkBase) {
        $direct = Join-Path $JdkBase "bin\java.exe"
        if (Test-Path $direct) { return $JdkBase }
        $nested = Get-ChildItem -Path $JdkBase -Directory -ErrorAction SilentlyContinue |
            Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
            Select-Object -First 1
        if ($nested) { return $nested.FullName }
    }

    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
        $ver = & (Join-Path $env:JAVA_HOME "bin\java.exe") -version 2>&1 | Out-String
        if ($ver -match '"17\.') { return $env:JAVA_HOME }
    }

    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) {
        $ver = & $javaCmd.Source -version 2>&1 | Out-String
        if ($ver -match '"17\.') {
            return Split-Path (Split-Path $javaCmd.Source -Parent) -Parent
        }
    }
    return $null
}

function Install-Jdk17 {
    Write-Host "[1/3] Installing Eclipse Temurin JDK 17 to $JdkBase ..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $JdkBase | Out-Null
    $zipPath = Join-Path $env:TEMP "temurin-jdk17-win-x64.zip"
    $url = "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $JdkBase -Force
    Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    $found = Find-ExistingJdk17
    if (-not $found) {
        throw "JDK 17 extraction completed, but bin\java.exe was not found under $JdkBase."
    }
    return $found
}

function Install-CmdlineTools {
    $latestDir = Join-Path $SdkRoot "cmdline-tools\latest"
    $sdkManager = Join-Path $latestDir "bin\sdkmanager.bat"
    if (Test-Path $sdkManager) {
        Write-Host "[2/3] Android cmdline-tools already installed." -ForegroundColor Green
        return $sdkManager
    }

    Write-Host "[2/3] Installing Android SDK cmdline-tools to $latestDir ..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path (Join-Path $SdkRoot "cmdline-tools") | Out-Null
    $zipPath = Join-Path $env:TEMP "commandlinetools-win-11076708_latest.zip"
    $tmpExtract = Join-Path $env:TEMP "android-cmdline-tools-extract"
    $url = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"

    if (Test-Path $tmpExtract) { Remove-Item -Recurse -Force $tmpExtract }
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $tmpExtract -Force

    $extractedRoot = Join-Path $tmpExtract "cmdline-tools"
    if (-not (Test-Path $extractedRoot)) {
        throw "Unexpected archive layout: $extractedRoot not found."
    }
    if (Test-Path $latestDir) { Remove-Item -Recurse -Force $latestDir }
    Move-Item -Path $extractedRoot -Destination $latestDir

    Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $tmpExtract -ErrorAction SilentlyContinue
    return $sdkManager
}

# --- Step 1: JDK 17 ---
$jdkHome = Find-ExistingJdk17
if ($jdkHome) {
    Write-Host "[1/3] Found JDK 17 at $jdkHome" -ForegroundColor Green
} else {
    $jdkHome = Install-Jdk17
}

$env:JAVA_HOME = $jdkHome
$env:PATH = "$jdkHome\bin;$env:PATH"

# --- Step 2: Android SDK cmdline-tools (never touch platform-tools\) ---
New-Item -ItemType Directory -Force -Path $SdkRoot | Out-Null
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot

$sdkManagerBat = Install-CmdlineTools

# --- Step 3: platforms;android-34 and build-tools;34.0.0 ---
$platform34  = Join-Path $SdkRoot "platforms\android-34"
$buildTools  = Join-Path $SdkRoot "build-tools\34.0.0"

if ((Test-Path $platform34) -and (Test-Path $buildTools)) {
    Write-Host "[3/3] Android SDK platforms;android-34 and build-tools;34.0.0 already installed." -ForegroundColor Green
} else {
    Write-Host "[3/3] Installing platforms;android-34 and build-tools;34.0.0 ..." -ForegroundColor Cyan
    if (-not $SkipLicenseAccept) {
        $yesStream = ("y`n" * 25)
        $yesStream | & $sdkManagerBat "--sdk_root=$SdkRoot" --licenses | Out-Null
    }
    & $sdkManagerBat "--sdk_root=$SdkRoot" "platforms;android-34" "build-tools;34.0.0"
    if ($LASTEXITCODE -ne 0) {
        throw "sdkmanager failed with exit code $LASTEXITCODE"
    }
}

# --- Status Summary ---
Write-Host ""
Write-Host "=== Android CLI Toolchain Ready ===" -ForegroundColor Green
Write-Host "JAVA_HOME    : $env:JAVA_HOME"
Write-Host "ANDROID_HOME : $env:ANDROID_HOME"
Write-Host "sdkmanager   : $sdkManagerBat"
Write-Host "android-34   : $(Test-Path $platform34)"
Write-Host "build-tools  : $(Test-Path $buildTools)"
if (Test-Path $AdbPath) {
    Write-Host "adb.exe      : $AdbPath (preserved)"
} else {
    Write-Host "adb.exe      : NOT FOUND at $AdbPath" -ForegroundColor Yellow
}
