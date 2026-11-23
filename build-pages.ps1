param([string]$Dotnet = "dotnet")

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "BrowserHost/BrowserHost.csproj"
$publish = Join-Path $PSScriptRoot "BrowserHost/obj/pages-runtime"
$site = Join-Path $PSScriptRoot "dist"

& $Dotnet publish $project --configuration Release --output $publish
if ($LASTEXITCODE -ne 0) { throw ".NET WebAssembly publish failed." }

$runtimeLoader = Get-ChildItem -LiteralPath $publish -Filter "dotnet.js" -Recurse -File |
    Where-Object { $_.Directory.Name -eq "_framework" } |
    Select-Object -First 1
if (-not $runtimeLoader) { throw "Could not find the published WebAssembly runtime." }

$runtimeTarget = Join-Path $site "_framework"
New-Item -ItemType Directory -Path $runtimeTarget -Force | Out-Null
Copy-Item -Path (Join-Path $runtimeLoader.Directory.FullName "*") -Destination $runtimeTarget -Recurse -Force
Copy-Item -Path (Join-Path $PSScriptRoot "BrowserHost/wwwroot/*") -Destination $site -Force

$packRoot = (& $Dotnet msbuild $project "-getProperty:NetCoreTargetingPackRoot").Trim()
if ($LASTEXITCODE -ne 0) { throw "Could not locate .NET framework references." }

$referencePack = Get-ChildItem -LiteralPath (Join-Path $packRoot "Microsoft.NETCore.App.Ref") -Directory |
    Where-Object { $_.Name -match "^10\.0\.\d+$" } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
if (-not $referencePack) { throw "Could not find the .NET 10 reference pack." }

$assemblies = Join-Path $referencePack.FullName "ref/net10.0/*.dll"
Compress-Archive -Path $assemblies -DestinationPath (Join-Path $site "references.zip") -Force

$sources = Join-Path $site "sources"
foreach ($exercise in @("ListExercises", "GuessMyNumber", "NumberToWords", "StudentRegistry")) {
    $destination = Join-Path $sources $exercise
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -Path (Join-Path $PSScriptRoot "Exercises/$exercise/*.cs") -Destination $destination -Force
}

New-Item -ItemType File -Path (Join-Path $site ".nojekyll") -Force | Out-Null
