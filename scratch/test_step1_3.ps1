$bytes = [System.IO.File]::ReadAllBytes("lab_report_clean.pdf")
$b64 = [System.Convert]::ToBase64String($bytes)
$body = @{ image = $b64 } | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText("scratch/body.json", $body)
curl.exe -i -X POST http://localhost:3001/api/ocr/extract `
  -H "Authorization: Bearer medikiosk-demo-token" `
  -H "Content-Type: application/json" `
  --data-binary "@scratch/body.json"
