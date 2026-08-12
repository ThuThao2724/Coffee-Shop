$loginBody = @{ email = 'admin.test@coffeeshop.local'; password = 'Admin@123' } | ConvertTo-Json
try {
    $login = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/users/login' -Method Post -ContentType 'application/json' -Body $loginBody -TimeoutSec 10
    Write-Output "TOKEN: $($login.token)"
    $branches = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/branches' -Headers @{ Authorization = "Bearer $($login.token)" } -TimeoutSec 10
    Write-Output 'BRANCHES:'
    $branches | ConvertTo-Json -Depth 5
} catch {
    Write-Output 'ERROR'
    Write-Output $_.Exception.Message
    if ($_.Exception.Response -ne $null) {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream -ne $null) {
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Output $reader.ReadToEnd()
            $reader.Close()
        }
    }
}
