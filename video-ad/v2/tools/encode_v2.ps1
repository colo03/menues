# Codifica el spot v2: frames 60 fps + mezcla de audio -> SaleListo_Ad.mp4
# Uso: powershell -ExecutionPolicy Bypass -File encode_v2.ps1 [-AudioOnly]
#   -AudioOnly: reutiliza el video ya codificado y solo reemplaza la pista de audio (tras regenerar la voz).
param([switch]$AudioOnly)
$ErrorActionPreference = "Stop"
$FF = if ($env:FFMPEG_BIN) { $env:FFMPEG_BIN } elseif (Get-Command ffmpeg -ErrorAction SilentlyContinue) { (Get-Command ffmpeg).Source } else { (python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())").Trim() }
$V2 = Split-Path -Parent $PSScriptRoot
$OUT = Join-Path (Split-Path -Parent $V2) "SaleListo_Ad.mp4"
$VID = "$V2\build\video_only.mp4"
if (-not $AudioOnly) {
  & $FF -y -hide_banner -loglevel error -framerate 60 -i "$V2\build\frames_out\f_%05d.jpg" `
    -c:v h264_nvenc -preset p7 -tune hq -profile:v high -level 4.2 -rc vbr -cq 19 -b:v 10M -maxrate 15M -bufsize 20M `
    -spatial-aq 1 -temporal-aq 1 -bf 3 -g 120 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv `
    -an $VID
  if ($LASTEXITCODE -ne 0) { throw "fallo codificando video" }
}
& $FF -y -hide_banner -loglevel error -i $VID -i "$V2\audio\mix_v2.wav" -map 0:v:0 -map 1:a:0 -c:v copy `
  -c:a aac -b:a 256k -ar 48000 -ac 2 -shortest -movflags +faststart `
  -metadata title="SaleListo - Spot v2" -metadata comment="Musica: Gimme that Groove! (Mixkit Stock Music Free License). B-roll: Mixkit Free License." $OUT
if ($LASTEXITCODE -ne 0) { throw "fallo muxeando" }
$ErrorActionPreference = "Continue"; & $FF -hide_banner -i $OUT 2>&1 | Out-String -Stream | Select-String "Duration|Stream"
