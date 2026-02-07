param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$AuthToken = "dev"
)

$ErrorActionPreference = "Stop"

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )

    $jsonBody = $null
    if ($null -ne $Body) {
        $jsonBody = $Body | ConvertTo-Json -Depth 6 -Compress
    }

    try {
        $resp = Invoke-WebRequest `
            -Method $Method `
            -Uri $Url `
            -Headers $Headers `
            -UseBasicParsing `
            -ContentType "application/json" `
            -Body $jsonBody
        return @{
            status = [int]$resp.StatusCode
            body = if ($resp.Content) { $resp.Content | ConvertFrom-Json } else { $null }
            raw = $resp.Content
        }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode.value__
        }
        $rawBody = ""
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $rawBody = $reader.ReadToEnd()
            $reader.Close()
        }

        $parsedBody = $null
        if ($rawBody) {
            try { $parsedBody = $rawBody | ConvertFrom-Json } catch { $parsedBody = $null }
        }

        return @{
            status = $statusCode
            body = $parsedBody
            raw = $rawBody
        }
    }
}

Write-Host "== Smoke Test: License + Entitlement =="
Write-Host "Base URL: $BaseUrl"
Write-Host "Auth token source: -AuthToken"

$health = Invoke-JsonRequest -Method "GET" -Url "$BaseUrl/health"
if ($health.status -ne 200) {
    if ($health.status -eq 0) {
        throw "Health check failed: could not connect to $BaseUrl. Is uvicorn running on that URL?"
    }
    throw "Health check failed. Status=$($health.status) Body=$($health.raw)"
}
Write-Host "[PASS] /health"

$genOutput = & python scripts/generate_license_keys.py --count 1 --plan family --days 30
if ($LASTEXITCODE -ne 0) {
    throw "Key generation failed."
}

$licenseKey = ($genOutput | Where-Object { $_ -match "^FISHY-[A-Z0-9]{4}-[A-Z0-9]{4}$" } | Select-Object -Last 1)
if (-not $licenseKey) {
    throw "No license key found in generator output."
}
Write-Host "[PASS] generated key: $licenseKey"

$familyBefore = Invoke-JsonRequest `
    -Method "POST" `
    -Url "$BaseUrl/analyze" `
    -Headers @{ Authorization = "Bearer $AuthToken" } `
    -Body @{ mode = "family"; input_type = "text"; content_text = "smoke test before redeem" }

if ($familyBefore.status -ne 402) {
    if (($familyBefore.status -eq 200) -or ($familyBefore.status -eq 502)) {
        Write-Host "[WARN] family mode already accessible before redeem (status $($familyBefore.status)); dev_user likely already has active family entitlement."
    }
    else {
        throw "Expected family mode to be blocked before redeem (402). Got $($familyBefore.status)."
    }
}
if ($familyBefore.status -eq 402) {
    Write-Host "[PASS] family blocked before redeem (402)"
}

$redeemUnauth = Invoke-JsonRequest `
    -Method "POST" `
    -Url "$BaseUrl/redeem" `
    -Body @{ license_key = $licenseKey }

if ($redeemUnauth.status -ne 401) {
    throw "Expected unauth redeem to return 401. Got $($redeemUnauth.status)."
}
Write-Host "[PASS] redeem requires auth (401)"

$redeem = Invoke-JsonRequest `
    -Method "POST" `
    -Url "$BaseUrl/redeem" `
    -Headers @{ Authorization = "Bearer $AuthToken" } `
    -Body @{ license_key = $licenseKey }

if ($redeem.status -ne 200) {
    throw "Expected redeem success (200). Got $($redeem.status). Body=$($redeem.raw)"
}
if (-not $redeem.body.ok -or $redeem.body.plan -ne "family" -or $redeem.body.status -ne "active") {
    throw "Redeem response shape mismatch: $($redeem.raw)"
}
Write-Host "[PASS] redeem success, family entitlement active"

$familyAfter = Invoke-JsonRequest `
    -Method "POST" `
    -Url "$BaseUrl/analyze" `
    -Headers @{ Authorization = "Bearer $AuthToken" } `
    -Body @{ mode = "family"; input_type = "text"; content_text = "smoke test after redeem" }

if ($familyAfter.status -eq 402) {
    throw "Family mode is still blocked after redeem."
}
if (($familyAfter.status -ne 200) -and ($familyAfter.status -ne 502)) {
    throw "Unexpected family analyze status after redeem: $($familyAfter.status)."
}
Write-Host "[PASS] family allowed after redeem (status $($familyAfter.status))"

Write-Host ""
Write-Host "Smoke test completed successfully."
