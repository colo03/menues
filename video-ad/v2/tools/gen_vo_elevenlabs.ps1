# Regenera SOLO la locucion con ElevenLabs (voz femenina argentina) y re-mezcla el audio del spot v2.
# Requiere creditos disponibles en la cuenta (elevenlabs auth status / user subscription get).
# Uso: powershell -ExecutionPolicy Bypass -File gen_vo_elevenlabs.ps1 [-VoiceId 8jv0VaaN6d7mWZAeGj79] [-Speed 1.06]
#   Voces es-AR sugeridas: 8jv0VaaN6d7mWZAeGj79 (Gabi - Publicity), YLtqUTaEXb7a9MAYuJu4 (Julieta - Warm & Friendly),
#                          ijxn8I4NzJccD2Sa7lcj (Sol - Warm Publicity), LZj1dIzYRl9rc9TIXnMt (Agustina - Young Professional)
param([string]$VoiceId = "8jv0VaaN6d7mWZAeGj79", [double]$Speed = 1.06, [string]$Model = "eleven_multilingual_v2")
$ErrorActionPreference = "Continue"
$FF = if ($env:FFMPEG_BIN) { $env:FFMPEG_BIN } elseif (Get-Command ffmpeg -ErrorAction SilentlyContinue) { (Get-Command ffmpeg).Source } else { (python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())").Trim() }
$V2 = Split-Path -Parent $PSScriptRoot
$VO = "$V2\audio\vo"
$bak = "$V2\audio\vo_edge_backup"
if (-not (Test-Path $bak)) { New-Item -ItemType Directory $bak | Out-Null; Copy-Item "$VO\*" $bak }

$blocks = [ordered]@{
  "V1" = "¿Salón lleno y el Wi-Fi no da más? ¡Olvidate!"
  "V2" = "Con SaleListo, tus clientes escanean el QR con 4G y piden al toque."
  "V3" = "La comanda se divide sola: platos a cocina, y tragos a la barra."
  "V4" = "Armás el salón por bloques, y asignás mozos en vivo."
  "V5" = "A cada mozo le vibra el celu apenas sale su pedido."
  "V6" = "Sumá SaleListo hoy, cero comisión. Escribinos por WhatsApp y probalo."
}
$keys = @($blocks.Keys)
for ($i = 0; $i -lt $keys.Count; $i++) {
  $k = $keys[$i]; $txt = $blocks[$k]
  $prev = if ($i -gt 0) { $blocks[$keys[$i - 1]] } else { $null }
  $next = if ($i -lt $keys.Count - 1) { $blocks[$keys[$i + 1]] } else { $null }
  $elArgs = @("text-to-speech", "convert", "--voice-id", $VoiceId, "--model-id", $Model, "--text", $txt,
            "--output-format", "mp3_44100_128", "--voice-settings.stability", "0.42", "--voice-settings.similarity-boost", "0.8",
            "--voice-settings.style", "0.35", "--voice-settings.use-speaker-boost", "true", "--voice-settings.speed", "$Speed", "-o", "$VO\${k}_el.mp3")
  if ($prev) { $elArgs += @("--previous-text", $prev) }
  if ($next) { $elArgs += @("--next-text", $next) }
  & elevenlabs @elArgs 2>&1 | Out-String | Write-Output
  if (-not (Test-Path "$VO\${k}_el.mp3")) { Write-Output "FALLO ${k}: se mantiene la version Edge-TTS"; exit 1 }
  & $FF -y -loglevel error -i "$VO\${k}_el.mp3" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,aresample=48000" -ac 1 "$VO\$k.wav"
}
# actualiza duraciones, timeline y mezcla; luego reemplaza solo el audio del MP4
python -c "import json,subprocess,re;FF=r'$FF';d='$VO'.replace('\\','/');j=json.load(open(d+'/vo_blocks.json',encoding='utf-8'));`nfor k in j:`n r=subprocess.run([FF,'-hide_banner','-i',d+'/'+k+'.wav'],capture_output=True,text=True).stderr;h,m,s=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r).groups();j[k]['dur']=round(int(h)*3600+int(m)*60+float(s),3);print(k,j[k]['dur'])`njson.dump(j,open(d+'/vo_blocks.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)"
python "$V2\tools\plan.py" --no-extract
python "$V2\tools\mix_audio.py"
powershell -ExecutionPolicy Bypass -File "$V2\tools\encode_v2.ps1" -AudioOnly
