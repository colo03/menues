# SaleListo Spot v2 · Pipeline de Producción

Entregable final: [`../SaleListo_Ad.mp4`](../SaleListo_Ad.mp4) (`1080x1920`, `60 fps`, H.264 High + AAC `48 kHz`, `faststart`, ~`30.0 s`, `-14 LUFS` / `-1.5 dBTP`).

## Pasos (re-ejecutables desde `video-ad/v2/`)

1. `python tools/gen_vo_continuous.py`: genera la locución en una toma continua con ElevenLabs (`eleven_v4`, voz `es-AR` "Gabi" `8jv0VaaN6d7mWZAeGj79`, `stability 0.4`) con alineación por palabra (`audio/vo/vo_full.wav` + `audio/vo/vo_words.json`). `plan.py` aplica ajuste `atempo 1.07` (sin cambiar tono) y exporta `../locucion_argentina.mp3`.
2. `python tools/plan.py`: calcula cortes anclados al inicio de palabras clave de la locución (y al beat musical cuando cae cerca), marcas de animación y SFX sincronizadas a la voz, empalme de la música al remate, extracción de frames B-roll con grading cálido en `build/frames_src/` y archivo maestro `build/timeline.json`.
3. `node src/render_v2.js --workers=7`: compone B-roll + interfaz animada (`src/ad_v2.html`) a `60 fps` en `build/frames_out/` (requiere `npm install` previo en `video-ad/`).
4. `python tools/mix_audio.py`: mezcla música con *ducking* dinámico (`-14 dB` bajo la voz, `-6 dB` en respiros, plena en el remate), SFX y normalización `loudnorm` en dos pasadas hacia `audio/mix_v2.wav`.
5. `powershell -ExecutionPolicy Bypass -File tools/encode_v2.ps1`: codifica el video final y muxea la pista de audio en `../SaleListo_Ad.mp4`.

## Créditos y Licencias

- **B-roll:** Mixkit (Mixkit Free License, uso comercial sin atribución obligatoria). Clips locales en `broll/` (descargables con `python tools/dl_broll.py`).
- **Música:** *"Gimme that Groove!"* de Michael Ramir C. (Mixkit Stock Music Free License).
- **SFX:** `whoosh`, `scan`, `pop`, `ding`, `vibrate` y `success` generados con ElevenLabs; `impact`, `glitch`, `snap`, `riser`, `shimmer` y `split` sintetizados en `tools/mix_audio.py`.
- **Marca:** `assets/logo.svg` y `assets/mark.svg` copiados (solo lectura) desde [`../../app/public/`](../../app/public/). Tipografía `Plus Jakarta Sans` (licencia OFL) en `assets/fonts/`.
