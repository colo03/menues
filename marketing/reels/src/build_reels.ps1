# Pipeline completo de los 3 Reels SaleListo (1080x1920, 60 fps, H.264 High CRF 20 + AAC 48 kHz, faststart).
# Todo lo temporal (puppeteer-core, frames JPEG, mezclas WAV) vive en $env:SL_REELS_WORK o $env:TEMP\sl_reels_work.
# Uso (desde cualquier carpeta):
#   powershell -ExecutionPolicy Bypass -File marketing\reels\src\build_reels.ps1 [-Reels r01,r02,r03] [-Clean]
#   -Clean: borra la carpeta de trabajo temporal al terminar.
# La locucion ya generada vive en src\vo\ (rNN.mp3 + rNN_words.json); para regenerarla: python gen_vo_reels.py rNN
param([string[]]$Reels = @("r01", "r02", "r03"), [switch]$Clean)
$ErrorActionPreference = "Stop"
$SRC = $PSScriptRoot
$OUTDIR = Split-Path -Parent $SRC
$WORK = if ($env:SL_REELS_WORK) { $env:SL_REELS_WORK } else { Join-Path $env:TEMP "sl_reels_work" }
$env:SL_REELS_WORK = $WORK
$FF = if ($env:FFMPEG_BIN) { $env:FFMPEG_BIN } elseif (Get-Command ffmpeg -ErrorAction SilentlyContinue) { (Get-Command ffmpeg).Source } else { (python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())").Trim() }
$NAMES = @{ r01 = "Reel_01_Sin_Celulares_En_Salon"; r02 = "Reel_02_Segundas_Rondas_Terraza"; r03 = "Reel_03_Cero_Comision_Precios_Al_Dia" }
$TITLES = @{ r01 = "SaleListo Reel 01: Sin celulares en el salon"; r02 = "SaleListo Reel 02: Segundas rondas en terraza"; r03 = "SaleListo Reel 03: Cero comision y precios al dia" }

New-Item -ItemType Directory -Force $WORK | Out-Null
if (-not (Test-Path (Join-Path $WORK "node_modules\puppeteer-core"))) {
  Push-Location $WORK; npm init -y | Out-Null; npm install puppeteer-core --silent; Pop-Location
}
python (Join-Path $SRC "plan_reels.py") @Reels
if ($LASTEXITCODE -ne 0) { throw "fallo plan_reels.py" }
foreach ($k in $Reels) {
  $D = Join-Path $WORK $k
  if (Test-Path "$D\frames_out") { Remove-Item -Recurse -Force "$D\frames_out" }
  node (Join-Path $SRC "render_reels.js") $k --workers=7
  if ($LASTEXITCODE -ne 0) { throw "fallo render $k" }
  python (Join-Path $SRC "mix_reels.py") $k
  if ($LASTEXITCODE -ne 0) { throw "fallo mezcla $k" }
  $OUT = Join-Path $OUTDIR "$($NAMES[$k]).mp4"
  & $FF -y -hide_banner -loglevel error -framerate 60 -i "$D\frames_out\f_%05d.jpg" -i "$D\mix.wav" `
    -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 20 -profile:v high -level 4.2 -pix_fmt yuv420p -g 120 `
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv `
    -c:a aac -b:a 160k -ar 48000 -ac 2 -shortest -movflags +faststart `
    -metadata title="$($TITLES[$k])" -metadata comment="Musica: Gimme that Groove! (Mixkit Stock Music Free License). B-roll: Mixkit Free License. Voz: ElevenLabs." $OUT
  if ($LASTEXITCODE -ne 0) { throw "fallo codificando $k" }
  "{0}: {1:N2} MB" -f (Split-Path -Leaf $OUT), ((Get-Item $OUT).Length / 1MB)
}
if ($Clean) { Remove-Item -Recurse -Force $WORK; "carpeta temporal borrada: $WORK" }
