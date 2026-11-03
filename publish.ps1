#Requires -Version 5.1
[CmdletBinding()]
param([string]$Message = 'Publish HTML library')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Git {
    param([string[]]$GitArgs)
    # Windows PowerShell 5.1 treats native stderr as errors even on a successful push.
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git @GitArgs 2>&1
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $savedPreference
    }
    if ($code -ne 0) { throw ('git {0} failed: {1}' -f ($GitArgs -join ' '), ($output -join "`n")) }
    return $output
}

Push-Location $PSScriptRoot
try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git for Windows first.' }
    $prefix = [string](Invoke-Git @('rev-parse', '--show-prefix'))
    if ($prefix) {
        throw 'Run this script from its own Git repository, not a parent repository.'
    }
    $config = Get-Content -LiteralPath 'publish.config.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    $site = [Uri]$config.siteUrl
    if (-not $site.IsAbsoluteUri -or $site.Scheme -ne 'https') { throw 'Set siteUrl to the real HTTPS Pages URL in publish.config.json.' }
    $branch = [string](Invoke-Git @('branch', '--show-current'))
    if ($branch -ne $config.branch) { throw ('Switch to branch {0} before publishing.' -f $config.branch) }
    $null = Invoke-Git @('remote', 'get-url', 'origin')
    if (@(Invoke-Git @('diff', '--cached', '--name-only')).Count) {
        throw 'Commit or unstage already staged changes before publishing.'
    }
    $deleted = @(Invoke-Git @('diff', 'HEAD', '--name-only', '--diff-filter=D', '--', 'pages'))
    if ($deleted.Count) { throw ('Restore deleted pages/assets to preserve existing links: ' + ($deleted -join ', ')) }

    & (Join-Path $PSScriptRoot 'update-index.ps1')
    $null = Invoke-Git @('add', '--', 'pages', 'index.html')
    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        Invoke-Git @('commit', '-m', $Message) | Write-Host
    } elseif ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect staged changes.'
    } else {
        Write-Host 'No content changes; retrying push if needed.'
    }
    Invoke-Git @('push', 'origin', $branch) | Write-Host

    $baseUrl = $config.siteUrl.TrimEnd('/') + '/'
    Write-Host "`nPush completed. GitHub Actions is deploying asynchronously."
    Write-Host ('Library: ' + $baseUrl)
    $pages = Join-Path $PSScriptRoot 'pages'
    Get-ChildItem -LiteralPath $pages -File -Recurse -Force |
        Where-Object { $_.Extension -match '^\.html?$' } | Sort-Object FullName | ForEach-Object {
            $relative = $_.FullName.Substring($pages.Length + 1).Replace('\', '/')
            $encoded = ($relative.Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
            Write-Output ($baseUrl + 'pages/' + $encoded)
        }
} finally {
    Pop-Location
}
