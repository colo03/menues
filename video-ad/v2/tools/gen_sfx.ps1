$ErrorActionPreference = "Continue"
$V2 = Split-Path -Parent $PSScriptRoot
$out = Join-Path $V2 "audio\sfx"
New-Item -ItemType Directory -Force $out | Out-Null
$sfx = [ordered]@{
  "whoosh1"  = @("Fast cinematic whoosh swoosh transition, clean airy, short", 0.8)
  "whoosh2"  = @("Quick whip pan swish transition sound, punchy, modern ad", 0.7)
  "scan"     = @("Smartphone QR code scan beep, soft digital confirmation chirp, modern UI", 0.8)
  "pop"      = @("Soft UI bubble pop notification, clean, satisfying, app interface", 0.5)
  "ding"     = @("Restaurant kitchen service bell ding, single clear ring, order ready", 1.5)
  "vibrate"  = @("Smartphone vibrating on hand, two short buzzes, haptic notification", 1.2)
  "success"  = @("Bright positive app success chime, short two-note, checkmark confirmation", 1.0)
  "impact"   = @("Deep cinematic bass hit with soft riser tail, modern commercial logo reveal", 1.6)
  "riser"    = @("Short tension riser swell building up, modern commercial transition", 1.5)
  "split"    = @("Digital glitchy swipe splitting into two, data transfer zip sound, UI", 0.8)
}
foreach ($k in $sfx.Keys) {
  $t = $sfx[$k][0]; $d = $sfx[$k][1]
  elevenlabs text-to-sound-effects convert --text "$t" --duration-seconds $d --prompt-influence 0.6 --output-format mp3_44100_128 -o "$out\$k.mp3" 2>&1 | Out-String | Write-Output
  if (Test-Path "$out\$k.mp3") { "$k OK $((Get-Item "$out\$k.mp3").Length)" } else { "$k FAIL" }
}
