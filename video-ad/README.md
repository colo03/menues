# SaleListo: Spot Comercial Vertical (Video Ad)

Pieza audiovisual vertical (`9:16`, `1080x1920`, `60 fps`) diseñada para Instagram Reels, TikTok, YouTube Shorts y prospección B2B por WhatsApp. El enfoque narrativo se centra en **aliviar la carga operativa de los mozos en hora pico** y **simplificar el despacho integral del restaurante** entre salón, cocina y barra.

---

## Entregables Finales

| Archivo | Descripción |
| :--- | :--- |
| [`SaleListo_Ad.mp4`](./SaleListo_Ad.mp4) | Spot comercial definitivo renderizado en `1080x1920` a `60 fps` (`30.19s`, H.264 High + AAC `48 kHz` estéreo normalizado a `-14 LUFS` / `-1.5 dBTP`, `11.57 MB`). Versión v5 "sin celulares en el salón": la Escena 5 (**Sin `celulares`**) muestra la estación del **Pase** con 3 columnas por mozo y la **Pulsera** vibradora que marca el tilde al salir; máximo 5 palabras por pantalla en las escenas 1 a 5. Placa final con WhatsApp `(+54)1138436571` y `ventas@salelisto.com`. |
| [`generar_ad_omni.py`](./generar_ad_omni.py) | Pipeline **open-ended** hacia **Gemini Omni 1.2 Flash (Google Flow Ultra)** vía CDP (`9222` / `DevToolsActivePort`). Envía únicamente una breve dirección creativa abierta y la narración completa en español rioplatense, dejando la puesta visual e interpretación cinematográfica a cargo de Omni 1.2 Flash, y exporta el resultado a `video-ad/SaleListo_Ad_Omni.mp4`. |
| [`locucion_argentina.mp3`](./locucion_argentina.mp3) | Locución comercial v5 en español rioplatense generada en una sola toma continua con ElevenLabs (`eleven_v4`, voz `Gabi`): *"Sin celulares en el salón: miran la estación del pase, o les vibra la pulsera al salir."* |
| [`guion.md`](./guion.md) | Guion técnico v5: un diagrama vectorial grande por escena con titular de 2 o 3 palabras, escaleta de 6 escenas (`E01` a `E06`) sobre la toma única de locución. |
| [`referencias_ads.md`](./referencias_ads.md) | Análisis de referencias publicitarias Gastro-Tech y Motion SaaS aplicadas al ritmo visual, uso de B-roll y tipografía cinética. |

---

## Recreación Open-Ended con Gemini Omni 1.2 Flash (Google Flow)

Además del pipeline programático cuadro a cuadro en `v2/`, el repositorio incluye [`generar_ad_omni.py`](./generar_ad_omni.py) para generar una recreación generativa abierta en **Google Flow Ultra** (`https://labs.google/fx/tools/flow`) con **Gemini Omni 1.2 Flash**.

En lugar de pautar cortes rígidos escena por escena, el script entrega una breve descripción conceptual y la locución rioplatense completa para que Omni resuelva con libertad creativa el encuadre, el ritmo cinematográfico y la actuación visual:

```text
Comercial vertical (9:16) cálido y cinematográfico para SaleListo, plataforma para restaurantes y bares donde los clientes piden directo con la cámara desde el QR de su mesa (sin bajar apps ni registrarse), la cocina y la barra reciben cada parte al instante y los mozos trabajan tranquilos sin celular en la mano (usando pantalla fija en el pase o pulsera vibradora), con 0% comisión y contacto WhatsApp (+54)1138436571 | ventas@salelisto.com. Interpretá visualmente con total libertad creativa esta narración en voz femenina rioplatense natural: "¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia. Con SaleListo, el cliente escanea el QR de su mesa con la cámara, sin esperar la carta ni bajar apps, y pide tranquilo. La comanda se separa sola entre cocina y barra, y el salón reparte bloques equilibrando al equipo en vivo. Sin celulares en el salón: miran la estación del pase, o les vibra la pulsera al salir. Simplificales la vida a ellos y al restaurante, con cero comisión. Escribinos por WhatsApp, y probalo."
```

### Ejecución en 1 línea (con Google Chrome)

1. Tener abierto **Google Flow** (`https://labs.google/fx/tools/flow`) con sesión iniciada en **Google Chrome** y depuración remota habilitada en `chrome://inspect/#remote-debugging` (o iniciado con `--remote-debugging-port=9222`).
2. Aceptar el cartel de seguridad de depuración remota haciendo clic en **`[Allow]` / `[Permitir]`** en la ventana de Google Chrome y correr desde la raíz del proyecto:

```powershell
python video-ad/generar_ad_omni.py
```

El script detecta automáticamente el endpoint WebSocket de `DevToolsActivePort` (`ws://127.0.0.1:9222/devtools/browser/...`, reutilizando `omni_bridge.py` si está presente localmente), verifica los selectores activos del DOM de Flow, envía el prompt y guarda el render final en `video-ad/SaleListo_Ad_Omni.mp4`.

### Opciones útiles del CLI

- **Dar margen para pulsar `[Allow]` en vivo al cambiar de ventana:**
  ```powershell
  python video-ad/generar_ad_omni.py --cdp-timeout 25
  ```
- **Adjuntar el isotipo oficial (`app/public/icon-512.png`) como referencia visual:**
  ```powershell
  python video-ad/generar_ad_omni.py --with-logo
  ```
- **Inspeccionar el DOM real de la pestaña activa de Flow sin disparar un render:**
  ```powershell
  python video-ad/generar_ad_omni.py --inspect
  ```
- **Imprimir el prompt open-ended oficial en consola:**
  ```powershell
  python video-ad/generar_ad_omni.py --print-prompt
  ```

---

## Arquitectura del Pipeline (`v2/`)

El motor programático de composición audiovisual vive dentro de [`v2/`](./v2/README.md):

- **`v2/src/ad_v2.html` y `v2/src/render_v2.js`**: Un único lienzo blanco persistente de `720x720px` (radio `36px`, sin cabezal, sin píldoras ni texto de marca) donde cada escena dibuja un diagrama de íconos SVG propios (trazo `3px a 4px`) con la curva única sin rebote `cubic-bezier(0.22, 1, 0.36, 1)`, deriva lineal suave `1.00 a 1.03` sobre el B-roll y crossfades de `0.48s`. Renderizada cuadro a cuadro a `60 fps` con Chrome Headless (`puppeteer-core`).
- **`v2/tools/gen_vo_continuous.py`**: Síntesis de locución continua con marcas de tiempo por palabra (`vo_words.json`).
- **`v2/tools/plan.py`**: Planificador maestro que ancla cada una de las 6 escenas al inicio de su frase en la locución (sin snap al beat), extrayendo los cuadros base con gradación cálida uniforme.
- **`v2/tools/mix_audio.py`**: Mezclador multipista con *ducking* suave de la música bajo la voz, 6 acentos sonoros discretos (`v2/audio/sfx/`) y normalización EBU R128 (`-14 LUFS` / `-1.5 dBTP`).
- **`v2/tools/encode_v2.ps1`**: Codificación H.264 (`libx264`) de alta calidad y muxeado final con `faststart`.
- **`v2/assets/`**: Copias de trabajo de la identidad visual oficial (`logo.svg`, `logo-dark.svg`, `mark.svg`, idénticas byte a byte a [`../branding/`](../branding/sistema_de_marca.md) y `app/public/`) y familia tipográfica `Plus Jakarta Sans` (licencia OFL).

### Identidad visual compartida (`../branding/`)

El spot no define estilos propios: toma colores, tipografía, radios, sombras y reglas de motion de [`branding/sistema_de_marca.md`](../branding/sistema_de_marca.md) y [`branding/tokens.css`](../branding/tokens.css), el mismo sistema que usa la app web. El logo aplicado es la Propuesta 01 · Pase Limpio (campana geométrica + tilde), elegida entre las 6 propuestas bocetadas en [`branding/propuestas_logos/`](../branding/propuestas_logos/README.md).

### Archivos locales excluidos de Git (`.gitignore`)

Para mantener `video-ad/` liviano y ágil de clonar (`< 15 MB` en activos versionados), los insumos pesados e intermedios quedan excluidos del control de versiones:

- `omni_bridge.py` y `renders_omni/`: Puente CDP auxiliar local y carpeta temporal de descargas de Google Flow (`video-ad/generar_ad_omni.py` sí se versiona y opera de forma autónoma si `omni_bridge.py` no está presente).
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
- **Contacto en la placa final del spot:** WhatsApp `(+54)1138436571` | `ventas@salelisto.com`
