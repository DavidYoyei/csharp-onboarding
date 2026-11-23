param([string]$Dotnet = "dotnet")

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "BrowserHost/BrowserHost.csproj"
$publish = Join-Path $PSScriptRoot "BrowserHost/obj/pages-runtime"
$site = Join-Path $PSScriptRoot "dist"
$releaseId = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { [guid]::NewGuid().ToString("N") }
$release = Join-Path $site "releases/$releaseId"

& $Dotnet publish $project --configuration Release --output $publish
if ($LASTEXITCODE -ne 0) { throw ".NET WebAssembly publish failed." }

$runtimeLoader = Get-ChildItem -LiteralPath $publish -Filter "dotnet.js" -Recurse -File |
    Where-Object { $_.Directory.Name -eq "_framework" } |
    Select-Object -First 1
if (-not $runtimeLoader) { throw "Could not find the published WebAssembly runtime." }

$runtimeTarget = Join-Path $release "_framework"
New-Item -ItemType Directory -Path $runtimeTarget -Force | Out-Null
Copy-Item -Path (Join-Path $runtimeLoader.Directory.FullName "*") -Destination $runtimeTarget -Recurse -Force
$web = Join-Path $PSScriptRoot "BrowserHost/wwwroot"
foreach ($asset in @("workspace.js", "workspace.css", "runner.js", "compiler-download.js")) {
    Copy-Item -LiteralPath (Join-Path $web $asset) -Destination $release -Force
}
Copy-Item -LiteralPath (Join-Path $web "isolation-sw.js") -Destination $site -Force
$html = (Get-Content -LiteralPath (Join-Path $web "index.html") -Raw).
    Replace("./workspace.css", "./releases/$releaseId/workspace.css").
    Replace("./workspace.js", "./releases/$releaseId/workspace.js")
Set-Content -LiteralPath (Join-Path $site "index.html") -Value $html -Encoding utf8
Set-Content -LiteralPath (Join-Path $site "coralpay-csharp.html") -Value $html -Encoding utf8

# Compress once, then split the download so a slow request can be retried by itself.
$wasmFiles = @(Get-ChildItem -LiteralPath $runtimeLoader.Directory.FullName -Filter "*.wasm" -File | Sort-Object Name)
if ($wasmFiles.Count -eq 0) { throw "No WebAssembly files were available to bundle." }

$manifest = @($wasmFiles | ForEach-Object { @{ name = $_.Name; size = $_.Length } })
$header = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $manifest -Compress))
$bundle = Join-Path $publish "runtime-bundle.bin"
$targetStream = [System.IO.File]::Create($bundle)
try {
    $compressed = [System.IO.Compression.GZipStream]::new($targetStream, [System.IO.Compression.CompressionLevel]::Optimal)
    try {
        $writer = [System.IO.BinaryWriter]::new($compressed, [System.Text.Encoding]::UTF8, $true)
        try {
            $writer.Write([int]$header.Length)
            $writer.Write([byte[]]$header)
            foreach ($file in $wasmFiles) {
                $sourceStream = $file.OpenRead()
                try { $sourceStream.CopyTo($compressed) } finally { $sourceStream.Dispose() }
            }
        } finally { $writer.Dispose() }
    } finally { $compressed.Dispose() }
} finally { $targetStream.Dispose() }

$hash = (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash.Substring(0, 16).ToLowerInvariant()
$parts = [System.Collections.Generic.List[object]]::new()
$bundleStream = [System.IO.File]::OpenRead($bundle)
try {
    $buffer = [byte[]]::new(2MB)
    while (($count = $bundleStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $name = "runtime-$hash-$($parts.Count).bin"
        $part = [System.IO.File]::Create((Join-Path $runtimeTarget $name))
        try { $part.Write($buffer, 0, $count) } finally { $part.Dispose() }
        $parts.Add(@{ name = $name; size = $count })
    }
} finally { $bundleStream.Dispose() }
$partsJson = ConvertTo-Json -InputObject @($parts.ToArray()) -Compress
Set-Content -LiteralPath (Join-Path $release "runtime-bundle.js") -Encoding ascii -Value "export const parts = $partsJson;"

$packRoot = (& $Dotnet msbuild $project "-getProperty:NetCoreTargetingPackRoot").Trim()
if ($LASTEXITCODE -ne 0) { throw "Could not locate .NET framework references." }

$referencePack = Get-ChildItem -LiteralPath (Join-Path $packRoot "Microsoft.NETCore.App.Ref") -Directory |
    Where-Object { $_.Name -match "^10\.0\.\d+$" } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
if (-not $referencePack) { throw "Could not find the .NET 10 reference pack." }

$assemblies = Join-Path $referencePack.FullName "ref/net10.0/*.dll"
Compress-Archive -Path $assemblies -DestinationPath (Join-Path $release "references.zip") -Force

$sources = Join-Path $release "sources"
foreach ($exercise in @("ListExercises", "GuessMyNumber", "NumberToWords", "StudentRegistry")) {
    $destination = Join-Path $sources $exercise
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -Path (Join-Path $PSScriptRoot "Exercises/$exercise/*.cs") -Destination $destination -Force
}

New-Item -ItemType File -Path (Join-Path $site ".nojekyll") -Force | Out-Null
