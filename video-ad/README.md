# SaleListo: Spot Comercial Vertical (Video Ad)

Pieza audiovisual vertical (`9:16`, `1080x1920`, `60 fps`) diseñada para Instagram Reels, TikTok, YouTube Shorts y prospección B2B por WhatsApp. El enfoque narrativo se centra en **aliviar la carga operativa de los mozos en hora pico** y **simplificar el despacho integral del restaurante** entre salón, cocina y barra.

---

## Entregables Finales

| Archivo | Descripción |
| :--- | :--- |
| [`SaleListo_Ad.mp4`](./SaleListo_Ad.mp4) | Spot comercial definitivo renderizado en `1080x1920` a `60 fps` (~`30s`, H.264 High + AAC `48 kHz` estéreo normalizado a `-14 LUFS`, `20.9 MB`). |
| [`locucion_argentina.mp3`](./locucion_argentina.mp3) | Locución comercial en español rioplatense generada en una sola toma continua con ElevenLabs (`eleven_v4`, voz `Gabi`). |
| [`guion.md`](./guion.md) | Guion técnico completo, mapa de respiración sobre toma única y escaleta de los 14 cortes dinámicos (`C01` a `C14`). |
| [`referencias_ads.md`](./referencias_ads.md) | Análisis de referencias publicitarias Gastro-Tech y Motion SaaS aplicadas al ritmo visual, uso de B-roll y tipografía cinética. |

---

## Arquitectura del Pipeline (`v2/`)

El motor programático de composición audiovisual vive dentro de [`v2/`](./v2/README.md):

- **`v2/src/ad_v2.html` y `v2/src/render_v2.js`**: Composición visual 2.5D (tarjetas UI animadas con curvas elásticas, cursores táctiles, bifurcación SVG hacia Cocina/Barra y grilla viva de bloques) renderizada cuadro a cuadro a `60 fps` con Chrome Headless (`puppeteer-core`).
- **`v2/tools/gen_vo_continuous.py`**: Síntesis de locución continua con marcas de tiempo por palabra (`vo_words.json`).
- **`v2/tools/plan.py`**: Planificador maestro que ancla cada corte visual y cada efecto sonoro al inicio exacto de las palabras de la locución y al pulso musical (`112 BPM`), extrayendo los cuadros base con corrección de color cálida.
- **`v2/tools/mix_audio.py`**: Mezclador multipista con *ducking* dinámico de la música bajo la voz, efectos sonoros puntuales (`v2/audio/sfx/`) y normalización EBU R128 (`-14 LUFS` / `-1.5 dBTP`).
- **`v2/tools/encode_v2.ps1`**: Codificación H.264 de alta calidad y muxeado final con `faststart`.
- **`v2/assets/`**: Copias de trabajo de la identidad visual (`logo.svg`, `mark.svg`) y familia tipográfica `Plus Jakarta Sans` (licencia OFL).

### Archivos locales excluidos de Git (`.gitignore`)

Para mantener el repositorio liviano y ágil de clonar (`< 30 MB` en total), los insumos pesados e intermedios quedan excluidos del control de versiones:

- `v2/broll/`: Clips de video stock HD de Mixkit (licencia comercial gratuita). Pueden descargarse nuevamente en cualquier momento ejecutando `python v2/tools/dl_broll.py`.
- `v2/build/` y `v2/qa_frames/`: Secuencias temporales de cuadros JPEG y hojas de control de calidad.
- `v2/audio/*.wav` y `v2/audio/vo/*.wav`: Pistas WAV sin comprimir generadas durante la mezcla (se versionan las fuentes livianas `.mp3` y las alineaciones `.json`).
- `node_modules/`: Dependencias de Node instalables mediante `npm install` dentro de `video-ad/`.

---

## Cómo reproducir el render desde cero

1. Instalar dependencias de renderizado en `video-ad/`:
   ```bash
   cd video-ad
   npm install
   ```
2. Asegurar que los clips B-roll estén presentes en `video-ad/v2/broll/` (si se clona en una PC nueva, ejecutar `python v2/tools/dl_broll.py`).
3. Ejecutar la secuencia del pipeline desde `video-ad/v2/`:
   ```powershell
   python tools/plan.py
   node src/render_v2.js --workers=7
   python tools/mix_audio.py
   powershell -ExecutionPolicy Bypass -File tools/encode_v2.ps1
   ```

---

## Créditos y Contacto Comercial

- **Música:** *"Gimme that Groove!"* de Michael Ramir C. (Mixkit Stock Music Free License).
- **B-roll:** Mixkit Stock Video Free License.
- **Contacto directo:** WhatsApp `(+54)1138436571` | `simonguerenu@gmail.com`
