# SaleListo: Spot Comercial Vertical (Video Ad)

Pieza audiovisual vertical (`9:16`, `1080x1920`, `60 fps`) diseñada para Instagram Reels, TikTok, YouTube Shorts y prospección B2B por WhatsApp. El enfoque narrativo se centra en **aliviar la carga operativa de los mozos en hora pico** y **simplificar el despacho integral del restaurante** entre salón, cocina y barra.

---

## Entregables Finales

| Archivo | Descripción |
| :--- | :--- |
| [`SaleListo_Ad.mp4`](./SaleListo_Ad.mp4) | Spot comercial definitivo renderizado en `1080x1920` a `60 fps` (`29.11s`, H.264 High + AAC `48 kHz` estéreo normalizado a `-14 LUFS` / `-1.5 dBTP`, `9.7 MB`). |
| [`locucion_argentina.mp3`](./locucion_argentina.mp3) | Locución comercial en español rioplatense generada en una sola toma continua con ElevenLabs (`eleven_v4`, voz `Gabi`). |
| [`guion.md`](./guion.md) | Guion técnico v3, mapa de respiración sobre toma única y escaleta de 6 escenas serenas (`E01` a `E06`, promedio `4.85s`). |
| [`referencias_ads.md`](./referencias_ads.md) | Análisis de referencias publicitarias Gastro-Tech y Motion SaaS aplicadas al ritmo visual, uso de B-roll y tipografía cinética. |

---

## Arquitectura del Pipeline (`v2/`)

El motor programático de composición audiovisual vive dentro de [`v2/`](./v2/README.md):

- **`v2/src/ad_v2.html` y `v2/src/render_v2.js`**: Una sola Tarjeta Maestra persistente (`#ffffff`, borde `1px #e6dfd3`, radio `24px`, cabezal fijo con `mark.svg` + SaleListo + píldora de estado) que cambia de contenido escena a escena con la curva única sin rebote `cubic-bezier(0.22, 1, 0.36, 1)`, deriva lineal suave `1.00 a 1.03` sobre el B-roll y crossfades de `0.48s`. Renderizada cuadro a cuadro a `60 fps` con Chrome Headless (`puppeteer-core`).
- **`v2/tools/gen_vo_continuous.py`**: Síntesis de locución continua con marcas de tiempo por palabra (`vo_words.json`).
- **`v2/tools/plan.py`**: Planificador maestro que ancla cada una de las 6 escenas al inicio de su frase en la locución (sin snap al beat), extrayendo los cuadros base con gradación cálida uniforme.
- **`v2/tools/mix_audio.py`**: Mezclador multipista con *ducking* suave de la música bajo la voz, 6 acentos sonoros discretos (`v2/audio/sfx/`) y normalización EBU R128 (`-14 LUFS` / `-1.5 dBTP`).
- **`v2/tools/encode_v2.ps1`**: Codificación H.264 (`libx264`) de alta calidad y muxeado final con `faststart`.
- **`v2/assets/`**: Copias de trabajo de la identidad visual oficial (`logo.svg`, `logo-dark.svg`, `mark.svg`, idénticas byte a byte a [`../branding/`](../branding/sistema_de_marca.md) y `app/public/`) y familia tipográfica `Plus Jakarta Sans` (licencia OFL).

### Identidad visual compartida (`../branding/`)

El spot no define estilos propios: toma colores, tipografía, radios, sombras y reglas de motion de [`branding/sistema_de_marca.md`](../branding/sistema_de_marca.md) y [`branding/tokens.css`](../branding/tokens.css), el mismo sistema que usa la app web. El logo aplicado es la Propuesta 06 · Salón en Orden, elegida entre las 6 propuestas bocetadas en [`branding/propuestas_logos/`](../branding/propuestas_logos/README.md).

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
