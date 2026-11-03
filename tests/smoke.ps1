#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$source = Split-Path $PSScriptRoot -Parent
$temp = Join-Path ([IO.Path]::GetTempPath()) ('html-library-test-' + [Guid]::NewGuid().ToString('N'))
$repo = Join-Path $temp 'repo'
$remote = Join-Path $temp 'remote.git'
$utf8 = New-Object Text.UTF8Encoding $false
function Check($condition, $message) { if (-not $condition) { throw $message } }
function Invoke-TestGit([string[]]$GitArgs) {
    $saved = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git @GitArgs 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $saved }
    if ($code -ne 0) { throw ($output -join "`n") }
    return $output
}
function Publish([bool]$shouldPass) {
    $caught = $false
    try { & (Join-Path $repo 'publish.ps1') | Out-Host } catch {
        if ($shouldPass) { throw }
        $caught = $true
    }
    Check ($caught -ne $shouldPass) 'Unexpected publish result.'
}
New-Item -ItemType Directory -Path $repo -Force | Out-Null
try {
    foreach ($name in @('publish.ps1', 'update-index.ps1', 'index.template.html')) {
        Copy-Item -LiteralPath (Join-Path $source $name) -Destination $repo
    }
    [IO.File]::WriteAllText((Join-Path $repo 'publish.config.json'), '{"siteUrl":"https://example.github.io/library/","branch":"main"}', $utf8)
    New-Item -ItemType Directory -Path (Join-Path $repo 'pages/nested') -Force | Out-Null
    $special = ([string][char]0xD55C) + ([string][char]0xAE00) + ' & [x] #100%.html'
    $fixture = '<!doctype html><meta charset="utf-8"><p>fixture</p>'
    [IO.File]::WriteAllText((Join-Path $repo ('pages/nested/' + $special)), $fixture, $utf8)
    for ($i = 1; $i -le 50; $i++) {
        [IO.File]::WriteAllText((Join-Path $repo ('pages/doc-{0:D2}.html' -f $i)), $fixture, $utf8)
    }
    [IO.File]::WriteAllText((Join-Path $repo 'pages/style.css'), 'body{color:black}', $utf8)
    $null = Invoke-TestGit @('init', '--bare', $remote)
    $null = Invoke-TestGit @('-C', $repo, 'init', '-b', 'main')
    $null = Invoke-TestGit @('-C', $repo, 'config', 'user.name', 'Library test')
    $null = Invoke-TestGit @('-C', $repo, 'config', 'user.email', 'test@example.invalid')
    $null = Invoke-TestGit @('-C', $repo, 'remote', 'add', 'origin', $remote)
    $null = Invoke-TestGit @('-C', $repo, 'add', '.')
    $null = Invoke-TestGit @('-C', $repo, 'commit', '-m', 'Initial fixtures')
    Publish $true
    $html = [IO.File]::ReadAllText((Join-Path $repo 'index.html'))
    Check (([regex]::Matches($html, '<li><a href=')).Count -eq 51) 'Batch file count failed.'
    Check ($html.Contains('pages/nested/' + [Uri]::EscapeDataString($special))) 'Unicode/special URL encoding failed.'
    Check ($html.Contains([Net.WebUtility]::HtmlEncode($special))) 'HTML escaping failed.'
    $first = [string](Invoke-TestGit @('-C', $repo, 'rev-parse', 'HEAD'))
    Publish $true
    Check ($first -eq [string](Invoke-TestGit @('-C', $repo, 'rev-parse', 'HEAD'))) 'No-op created a commit.'
    [IO.File]::WriteAllText((Join-Path $repo 'pages/new.htm'), $fixture, $utf8)
    Publish $true
    Check (([IO.File]::ReadAllText((Join-Path $repo 'index.html'))).Contains('pages/new.htm')) 'Incremental addition failed.'
    Check (([IO.File]::ReadAllText((Join-Path $repo ('pages/nested/' + $special)))) -eq $fixture) 'Existing HTML changed.'
    Check ([string](Invoke-TestGit @('--git-dir', $remote, 'rev-parse', 'refs/heads/main')) -eq [string](Invoke-TestGit @('-C', $repo, 'rev-parse', 'HEAD'))) 'Remote push failed.'
    Remove-Item -LiteralPath (Join-Path $repo 'pages/doc-01.html')
    Publish $false
    $null = Invoke-TestGit @('-C', $repo, 'restore', 'pages/doc-01.html')
    [IO.File]::WriteAllText((Join-Path $repo 'unrelated.txt'), 'unrelated', $utf8)
    $null = Invoke-TestGit @('-C', $repo, 'add', 'unrelated.txt')
    Publish $false
    $null = Invoke-TestGit @('-C', $repo, 'reset', 'HEAD', '--', 'unrelated.txt')
    [IO.File]::WriteAllText((Join-Path $repo 'index.html'), '<p>existing index</p>', $utf8)
    Publish $false
    Check (([IO.File]::ReadAllText((Join-Path $repo 'index.html'))) -eq '<p>existing index</p>') 'Overwrote an existing index.'
    Write-Host 'PASS: 51-file batch, encoded links, incremental additions, preservation, no-op, commit/push, deletion and staging guards.'
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force
}
