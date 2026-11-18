# SaleListo Spot v5 · Pipeline de Producción

Entregable final: [`../SaleListo_Ad.mp4`](../SaleListo_Ad.mp4) (`1080x1920`, `60 fps`, H.264 High `libx264 -preset slow -crf 20` + AAC `48 kHz`, `faststart`, `30.19 s`, `11.57 MB`, `-14 LUFS` / `-1.5 dBTP`).

Dirección de arte: [`../guion.md`](../guion.md) (v5) y [`../../branding/sistema_de_marca.md`](../../branding/sistema_de_marca.md). Se conserva todo lo ganado en v4: 6 escenas, máximo 5 palabras en pantalla en las escenas 1 a 5 (titular de 2 o 3 palabras + etiquetas de 36 a 46 px), cada idea contada con un único diagrama vectorial grande dentro de un lienzo blanco persistente de 720x720 (radio 36 px), deriva lineal del 3 % sobre el B-roll, crossfade de 0.48 s y curva única `cubic-bezier(0.22, 1, 0.36, 1)` sin rebote.

Novedad v5: la Escena 5 (**Sin `celulares`**) presenta la estrategia de cero celulares en el salón con dos ilustraciones lado a lado: la estación del **Pase** (pantalla horizontal fija con 3 columnas que se encienden en los colores de los mozos sobre *"miran la estación del pase"*) y la **Pulsera** inteligente (2 ondas laterales verdes sobre *"les vibra la pulsera"* y tilde blanco sobre cápsula verde en *"al salir"*). Cierre sobre crema `#faf7f2` con `logo.svg`, `0% comisión`, `(+54)1138436571` y `ventas@salelisto.com`.

## Pasos (re-ejecutables desde `video-ad/v2/`)

1. `python tools/gen_vo_continuous.py`: genera la locución v5 en una toma continua con ElevenLabs (`eleven_v4`, voz `es-AR` "Gabi", `stability 0.4`) con alineación por palabra (`audio/vo/vo_full.wav` + `audio/vo/vo_words.json`) y la copia `../locucion_argentina.mp3`. Si se regenera, borrar `audio/vo/vo_fast.wav` para que `plan.py` vuelva a crearlo con `atempo 1.07`.
2. `python tools/plan.py`: ubica las 6 escenas en el inicio de cada frase de la locución (E05 en *"Sin celulares"*, E06 en *"la vida"*), calcula las marcas de cada acción (`pase`, `vibra`, `salir`, etc.) y los 6 acentos SFX suaves, empalma la música al remate y extrae los frames del B-roll con gradación cálida uniforme en `build/frames_src/` + `build/timeline.json`.
3. `node src/render_v2.js --workers=7`: compone B-roll + lienzo (`src/ad_v2.html`) a `60 fps` en `build/frames_out/` (requiere `npm install` previo en `video-ad/`).
4. `python tools/mix_audio.py`: mezcla música con *ducking* suave (`-13.5 dB` bajo la voz, `-6 dB` en respiros, `-5.5 dB` en el remate), los acentos SFX y normalización `loudnorm` en dos pasadas hacia `audio/mix_v2.wav`.
5. `powershell -ExecutionPolicy Bypass -File tools/encode_v2.ps1`: codifica el video final y muxea la pista de audio en `../SaleListo_Ad.mp4`.

Después del render se borran `../node_modules/` y `build/` para dejar el repositorio liviano.

## Créditos y Licencias

- **B-roll:** Mixkit (Mixkit Free License, uso comercial sin atribución obligatoria). Clips locales en `broll/` (descargables con `python tools/dl_broll.py`).
- **Música:** *"Gimme that Groove!"* de Michael Ramir C. (Mixkit Stock Music Free License).
- **SFX:** `scan`, `pop`, `ding`, `vibrate` y `success` generados con ElevenLabs (acentos suaves, sin `glitch`, `impact`, `riser` ni `whoosh`).
- **Marca:** `assets/logo.svg`, `assets/logo-dark.svg` y `assets/mark.svg` copiados byte a byte desde [`../../app/public/`](../../app/public/) (Propuesta 01 · Pase Limpio). Tipografía `Plus Jakarta Sans` (licencia OFL) en `assets/fonts/`.
