param(
  [string]$ExpectedProjectRef = "dqgrrafuoxaorvyrcuuh"
)

$config = Get-Content (Join-Path $PSScriptRoot "..\supabase\config.toml") -Raw
if ($config -notmatch ('project_id\s*=\s*"' + [regex]::Escape($ExpectedProjectRef) + '"')) {
  throw "Refusing to continue: supabase/config.toml is not targeting $ExpectedProjectRef."
}

$linked = (npx supabase status --output json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue)
if ($linked -and $linked.project_ref -and $linked.project_ref -ne $ExpectedProjectRef) {
  throw "Refusing to continue: linked Supabase project is $($linked.project_ref), expected $ExpectedProjectRef."
}

Write-Output "Target project guard passed: $ExpectedProjectRef"
