# SaleListo Spot v3 · Pipeline de Producción

Entregable final: [`../SaleListo_Ad.mp4`](../SaleListo_Ad.mp4) (`1080x1920`, `60 fps`, H.264 High `libx264 -preset slow -crf 20` + AAC `48 kHz`, `faststart`, `29.11 s`, `-14 LUFS` / `-1.5 dBTP`).

Dirección de arte: [`../guion.md`](../guion.md) (v3) y [`../../branding/sistema_de_marca.md`](../../branding/sistema_de_marca.md). Una sola línea gráfica de punta a punta: 6 escenas respiradas (`E01` a `E06`, 4.0 s a 5.5 s), Tarjeta Maestra SaleListo persistente con el isotipo `mark.svg` en el cabezal, deriva lineal del 3 % sobre el B-roll, crossfade de 0.48 s, curva única `cubic-bezier(0.22, 1, 0.36, 1)` sin rebote y una sola acción clara por escena. Cierre institucional sobre crema `#faf7f2` con `logo.svg`, `0% comisión mensual`, `(+54)1138436571` y `simonguerenu@gmail.com`.

## Pasos (re-ejecutables desde `video-ad/v2/`)

1. `python tools/gen_vo_continuous.py`: genera la locución en una toma continua con ElevenLabs (`eleven_v4`, voz `es-AR` "Gabi", `stability 0.4`) con alineación por palabra (`audio/vo/vo_full.wav` + `audio/vo/vo_words.json`). La toma aprobada ya está en `audio/vo/vo_fast.wav` (`atempo 1.07`) y en `../locucion_argentina.mp3`; no hace falta regenerarla.
2. `python tools/plan.py`: ubica las 6 escenas en el inicio de cada frase de la locución, calcula la marca de la única acción de cada escena y los 5 acentos SFX suaves, empalma la música al remate y extrae los frames del B-roll con gradación cálida uniforme en `build/frames_src/` + `build/timeline.json`.
3. `node src/render_v2.js --workers=7`: compone B-roll + Tarjeta Maestra (`src/ad_v2.html`) a `60 fps` en `build/frames_out/` (requiere `npm install` previo en `video-ad/`).
4. `python tools/mix_audio.py`: mezcla música con *ducking* suave (`-13.5 dB` bajo la voz, `-6 dB` en respiros, `-5.5 dB` en el remate), los acentos SFX y normalización `loudnorm` en dos pasadas hacia `audio/mix_v2.wav`.
5. `powershell -ExecutionPolicy Bypass -File tools/encode_v2.ps1`: codifica el video final y muxea la pista de audio en `../SaleListo_Ad.mp4`.

## Créditos y Licencias

- **B-roll:** Mixkit (Mixkit Free License, uso comercial sin atribución obligatoria). Clips locales en `broll/` (descargables con `python tools/dl_broll.py`).
- **Música:** *"Gimme that Groove!"* de Michael Ramir C. (Mixkit Stock Music Free License).
- **SFX:** `scan`, `pop`, `ding`, `vibrate` y `success` generados con ElevenLabs (acentos suaves, sin `glitch`, `impact`, `riser` ni `whoosh`).
- **Marca:** `assets/logo.svg`, `assets/logo-dark.svg` y `assets/mark.svg` copiados byte a byte desde [`../../app/public/`](../../app/public/) (Propuesta 06 · Salón en Orden). Tipografía `Plus Jakarta Sans` (licencia OFL) en `assets/fonts/`.
