Add-Type -AssemblyName System.Net.HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:8080/")
$listener.Start()
Write-Host "Listening on http://localhost:8080/ ..."

while ($true) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    if ($request.Url.AbsolutePath -eq "/run-onboarding") {
        try {
            # Run your existing photo script
            & "C:\Scripts\Set-PhotoForNewGroupMembers.ps1" | Out-String
            $result = "✅ Photo script executed."
        } catch {
            $result = "❌ Error running script: $_"
        }
    } else {
        $result = "404 Not Found"
        $response.StatusCode = 404
    }

    $buffer = [System.Text.Encoding]::UTF8.GetBytes($result)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}
