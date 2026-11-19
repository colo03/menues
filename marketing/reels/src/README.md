# SaleListo Reels · código reproducible

Fuente de los 3 Reels verticales de [`../`](../) (`1080x1920`, `60 fps`, H.264 High CRF 20 + AAC 48 kHz, `faststart`, `-14 LUFS` / `-1.5 dBTP`). Guiones y copys en [`../../guiones_reels.md`](../../guiones_reels.md).

| Archivo | Función |
|---|---|
| `gen_vo_reels.py` | Locuciones con ElevenLabs CLI (`eleven_v4`, voz Gabi `8jv0VaaN6d7mWZAeGj79`, `convert_with_timestamps`). Salida en `vo/` (`rNN.mp3` + `rNN_words.json`). Solo hace falta si se cambia el texto. |
| `plan_reels.py` | Escenas ancladas a palabras de la locución, titulares, marcas de animación, SFX, empalme de música y extracción de B-roll con gradación cálida. |
| `reel.html` | Motor de composición (fondo con deriva 3 %, titulares, lienzo 720x720, cierre de marca). |
| `scenes_r01.js`, `scenes_r02.js`, `scenes_r03.js` | Diagramas vectoriales y animaciones de cada Reel. |
| `render_reels.js` | Captura de frames con Chrome headless (`puppeteer-core`). |
| `mix_reels.py` | Música con ducking suave, voz, SFX y loudnorm en 2 pasadas. |
| `build_reels.ps1` | Pipeline completo y codificación final. |

## Uso

```powershell
powershell -ExecutionPolicy Bypass -File marketing\reels\src\build_reels.ps1 -Clean
```

Todo lo temporal (`node_modules` de `puppeteer-core`, frames JPEG y mezclas WAV) se genera en `$env:SL_REELS_WORK` o `$env:TEMP\sl_reels_work`, nunca dentro del repositorio; `-Clean` borra esa carpeta al terminar. Requiere Node, Python con `numpy` e `imageio-ffmpeg` (o `ffmpeg` en el PATH) y Google Chrome.

Activos de sólo lectura: `video-ad/v2/broll/`, `video-ad/v2/audio/music/`, `video-ad/v2/audio/sfx/` y `video-ad/v2/assets/` (logo, isotipo y `Plus Jakarta Sans`).

## Créditos

B-roll Mixkit (Mixkit Free License). Música *"Gimme that Groove!"* de Michael Ramir C. (Mixkit Stock Music Free License). Voz y SFX: ElevenLabs.
