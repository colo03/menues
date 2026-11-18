# Guion Audiovisual Definitivo v3: SaleListo (Línea Gráfica Unificada y Motion Sobrio)

**Pieza:** Spot Comercial Vertical de Marca y Producto (Reels, TikTok, Shorts y WhatsApp B2B)  
**Eje Narrativo Central:** Bajarle la exigencia a los mozos de estar en diez lugares a la vez, simplificándole la vida al equipo y ordenando toda la operación del restaurante desde una única experiencia serena y conectada.  
**Sistema de Diseño Obligatorio:** Alineado 100% a `branding/sistema_de_marca.md` y `branding/tokens.css` (**Propuesta 06 · Salón en Orden**).  
**Duración Exacta:** `29.11s` (`1747 frames` a `60 fps`, calibrado al milisegundo sobre la toma continua aprobada + remate musical limpio)  
**Formato Técnico de Salida:** Vertical `1080x1920` (`9:16`), `60 fps`, H.264 High (`libx264 -preset slow -crf 20 -movflags +faststart`, peso `< 25 MB`) + AAC `48 kHz` estéreo (`-14.0 LUFS` / `<= -1.2 dBTP`)  
**Activos y Rutas Oficiales:**
- Video maestro final: `video-ad/SaleListo_Ad.mp4`
- Locución continua aprobada (reutilizar intacta): `video-ad/locucion_argentina.mp3` (`27.03s`, entrada en `0.12s`, fin de voz en `27.26s`)
- Identidad vectorial canónica (copiar de `app/public/` a `video-ad/v2/assets/`): `logo.svg` (`viewBox="0 0 239 64"`), `logo-dark.svg` y `mark.svg` (`viewBox="0 0 64 64"`, squircle bermellón `#D9412B` con 3 módulos arquitectónicos `#FAF7F2` en proporción áurea)

**Contacto Único e Inalterable:** `WhatsApp: (+54)1138436571` | `simonguerenu@gmail.com`

---

## 1. Dirección de Arte y Movimiento v3 ("Calma Operativa y Hospitalidad Editorial")

Atendiendo de raíz la devolución creativa sobre la versión previa, este guion reemplaza los 14 cortes hiperactivos, los barridos con desenfoque, las sacudidas y los 12 widgets dispares por **una sola línea gráfica común de principio a fin** inspirada en los spots B2B más efectivos (*Toast POS*, *Square for Restaurants*, *Apple UI Films*, *Stripe* y *Linear*, documentados en `video-ad/referencias_ads.md`):

1. **Ritmo respirado de 6 escenas (`~4.0s a 5.5s` cada una):** Cada escena acompaña una frase completa de la locución aprobada y aterriza en una pausa sintáctica natural, dejando **`3.0s a 4.0s` de reposo legible** para apreciar el beneficio sin prisa.
2. **Un único contenedor persistente ("Tarjeta Maestra SaleListo") en `E01` a `E05`:**
   - Anclada en las mismas coordenadas horizontales del lienzo `1080x1920` (`width: 900px`, `left: 90px`), con superficie `--surface: #ffffff`, borde fino `1px solid #e6dfd3`, `border-radius: 24px` y sombra difusa cálida `--shadow-float` (`0 4px 12px rgba(28,25,23,0.06), 0 20px 48px -8px rgba(28,25,23,0.14)`).
   - **Cabezal Fijo de Identidad (`Header`):** permanece siempre visible arriba con el nuevo isotipo `mark.svg` (`40x40`, sin `border-radius` que recorte su squircle) + `SaleListo` (`Plus Jakarta Sans 800`, `26px`, `#1c1917`) a la izquierda, y a la derecha una píldora semántica (`border-radius: 999px`, `20px`, `700`) que actualiza suavemente el estado operativo de cada escena, separada del cuerpo por `1px solid #e6dfd3`.
   - **Cuerpo de Demostración (`Body`):** emplea únicamente sub-tarjetas `--bg: #faf7f2` o `--surface-2: #f3eee6` (`border-radius: 15px`, `1px solid #e6dfd3`) y la paleta semántica oficial: bermellón `--accent: #d9412b` (`#fceae6`), verde servicio `--ok: #2f8a57` (`#e3f3ea`), ámbar cocina `--kitchen: #d97706` (`#fef1dc`) y violeta barra `--bar: #6d28d9` (`#efeafe`).
3. **Cámara serena y transiciones editoriales:**
   - Sobre cada B-roll real se aplica únicamente una **deriva lineal continua del `3%`** (`scale(1.00) -> scale(1.03)` lineal durante la escena, sin giros ni paneos violentos) y un velo cálido constante (`--scrim-warm: rgba(28, 25, 23, 0.46)` + degradado superior suave para lectura del titular).
   - Transición entre fondos B-roll mediante **`crossfade` limpio de `0.48s` (`480ms`)**. Mientras el fondo funde con suavidad, la Tarjeta Maestra permanece firme en su lugar y renueva su vista interior con un desplazamiento corto (`14px -> 0px`) y fundido de opacidad.
4. **Física estricta "Cero Rebote / Cero Frenesí":**
   - Curva única obligatoria en todo el video: `cubic-bezier(0.22, 1, 0.36, 1)` (`450ms a 650ms`).
   - **Terminantemente prohibidos:** `whipL/R/U`, `zoom` agresivos, `split-screen`, `beat-punch` en los compases, curvas `spring` con oscilación (`cos`), `eBack` con *overshoot*, `glitch`, temblores (`Math.sin`), carcasas 3D inclinadas y estelas de orbes voladores.

---

## 2. Locución Continua Aprobada (Intacta en `video-ad/locucion_argentina.mp3`)

Se conserva exactamente la toma única continua en español rioplatense que ya fue aprobada (`Gabi - Friendly, Publicity & Casual`, `eleven_v4`, `27.03s` en `video-ad/locucion_argentina.mp3` / `v2/audio/vo/vo_fast.wav` con `VO_OFFSET = 0.12s` y `vo_words.json` a `ATEMPO = 1.07`):

```text
¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia. Con SaleListo, el cliente escanea el QR con 4G, sin esperar carta ni wifi, y pide tranquilo. La comanda se separa sola entre cocina y barra, y el salón reparte bloques equilibrando al equipo en vivo. Cero viajes en vano: el celu les vibra recién cuando está listo para llevar. Simplificales la vida a ellos y al restaurante, con cero comisión. Escribinos por WhatsApp, y probalo.
```

### Sincronía Exacta de las 6 Escenas sobre `vo_words.json` (`VO_OFFSET = 0.12`, `ATEMPO = 1.07`)
- **`E01` (`0.00s - 4.93s`, dur. `4.93s`):** *"¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia."* (`0.12s - 4.76s`, pausa natural `4.76s - 4.98s`).
- **`E02` (`4.93s - 9.98s`, dur. `5.05s`):** *"Con SaleListo, el cliente escanea el QR con 4G, sin esperar carta ni wifi,"* (`4.98s - 9.99s`).
- **`E03` (`9.98s - 13.98s`, dur. `4.00s`):** *"y pide tranquilo. La comanda se separa sola entre cocina y barra,"* (`10.03s - 13.80s`).
- **`E04` (`13.98s - 18.54s`, dur. `4.56s`):** *"y el salón reparte bloques equilibrando al equipo en vivo. Cero viajes en vano:"* (`13.83s - 18.51s`).
- **`E05` (`18.54s - 24.03s`, dur. `5.49s`):** *"el celu les vibra recién cuando está listo para llevar. Simplificales la vida a ellos y al restaurante,"* (`18.59s - 23.97s`, pausa de coma `23.97s - 24.08s`).
- **`E06` (`24.03s - 29.11s`, dur. `5.08s`):** *"con cero comisión. Escribinos por WhatsApp, y probalo."* (`24.08s - 27.26s`) + resolución musical limpia en los dos acordes reales del groove (`27.99s` y `28.52s`) hasta `29.11s`.

---

## 3. Escaleta Maestra de 6 Escenas Serenas y Cohesivas (`E01` a `E06`)

Todos los planos emplean clips reales en alta definición de `video-ad/v2/broll/` (sin repetir clips y sin partir la pantalla), con gradación cálida uniforme, deriva lineal `1.00 -> 1.03` y titulares superiores sobrios (`Plus Jakarta Sans 800`, `60px`, crema `#faf7f2`, máximo 2 líneas en `y ~ 230px`, entrada suave de `500ms` sin palabra por palabra saltarín).

| Escena | Tiempo y Duración | Ancla Exacta (`plan.py`) | B-Roll Real (`v2/broll/`) | Titular Editorial Superior | Píldora Cabezal (`Tarjeta Maestra`) | Acción Única, Pausada y Auto-Explicativa dentro de la Tarjeta Maestra |
|---|---|---|---|---|---|---|
| **E01** | `0.00s - 4.93s` (`4.93s`) | Inicio `0.00s` | `bar_busy_4043.mp4` (`in: 1.5s`, `focus: 0.50`) | **Bajales esa `exigencia`** | `Hora pico` -> `Salón en orden` (`3.26s`) | **Del trajín repetitivo a la calma operativa:** La Tarjeta Maestra entra suavemente (`0.18s - 0.72s`, `translateY 16px -> 0`) mostrando en 3 filas limpias (`#f3eee6`) la carga mecánica habitual del mozo (`Repartir cartas y Wi-Fi`, `Llevar comandas en papel`, `Ir y venir a la barra`). En `"Bajales"` (`3.26s`), sin sacudidas ni barridos bruscos, las filas se iluminan con serenidad en `#e3f3ea` con tildes `#2f8a57` (`Carga resuelta por SaleListo`) y la píldora superior pasa a `Salón en orden`. |
| **E02** | `4.93s - 9.98s` (`5.05s`) | `("con", 1, 0)` (`4.98s - 0.05s`) | `phone_hands_4915.mp4` (`in: 2.0s`, `focus: 0.50`) | **Escanean el QR con su `4G`** | `Mesa T2 · 4G activo` (`#e3f3ea` / `#2f8a57`) | **Autogestión limpia en mesa sin pedir Wi-Fi:** El fondo funde en `crossfade` (`0.48s`) mientras dentro de la misma Tarjeta Maestra aparece el bloque limpio de `Mesa T2` con su código QR ilustrativo (con el nuevo `mark.svg` centrado, cero URLs). En `"QR"` (`6.92s`), una única barra luminosa suave recorre el QR (`550ms`) y en `"4G"` (`7.52s`) se enciende con calma el indicador lateral `4G directo · Sin clave Wi-Fi · Carta abierta`, permaneciendo estable y legible más de `2.4s`. |
| **E03** | `9.98s - 13.98s` (`4.00s`) | `("pide", 1, -1)` (`10.03s - 0.05s`) | `kitchen_plating_13261.mp4` (`in: 4.5s`, `focus: 0.50`) | **Cocina y Barra, `sin papel`** | `Mesa T2 · Comanda dividida` (`#fceae6` / `#d9412b`) | **División clara en dos estaciones dentro de la misma tarjeta:** En `"pide tranquilo"` (`10.14s`), el encabezado del pedido `Mesa T2` muestra `Burger Doble x1 + Gin Tonic x2`. En `"separa"` (`12.01s`), dentro del mismo cuerpo blanco, dos sub-tarjetas limpias (`radius: 15px`) se despliegan suavemente lado a lado o apiladas con un conector fino editorial: **`Cocina`** (`#fef1dc` / `#d97706`: `Burger Doble x1 · En preparación`) y **`Barra`** (`#efeafe` / `#6d28d9`: `Gin Tonic x2 · En preparación`). |
| **E04** | `13.98s - 18.54s` (`4.56s`) | `("salón", 1, 0)` (`14.03s - 0.05s`) | `resto_customers_4385.mp4` (`in: 2.5s`, `focus: 0.54`) | **Salón y equipo en `equilibrio`** | `3 Bloques equilibrados` (`#e3f3ea` / `#2f8a57`) | **Asignación armónica de bloques y mozos:** El cuerpo de la Tarjeta Maestra presenta las 3 columnas limpias del salón (`Interior`, `Terraza`, `Barra` sobre `#f3eee6`, con mesas `I1-I2`, `T1-T2`, `B1-B2`). En `"bloques"` (`14.85s`) y `"equilibrando"` (`15.30s`), las etiquetas de turno (`Sofi · Interior`, `Lucas · Terraza`, `Nico · Barra`) se asientan suavemente sin rebotar (`550ms`) y una barra inferior confirma `Carga pareja en vivo · Reasignación automática`, quedando en reposo sereno hasta `18.54s`. |
| **E05** | `18.54s - 24.03s` (`5.49s`) | `("celu", 1, -1)` (`18.59s - 0.05s`) | `waiter_drinks_43984.mp4` (`in: 1.2s`, `focus: 0.50`) | **Avisa recién al estar `listo`** | `Vista Mozo · Listo para llevar` (`#e3f3ea` / `#2f8a57`) | **Aviso puntual al mozo y cero viajes en vano:** Manteniendo intacta la misma Tarjeta Maestra (sin reemplazarla por un teléfono 3D negro inclinado), su interior muestra la tarjeta limpia de aviso móvil al mozo (`Lucas · Terraza · Mesa T2`). En `"vibra"` (`19.19s`), dos halos concéntricos sutiles en verde suave (`#2f8a57`, opacidad `0.35 -> 0`, cero inclinación/sacudida) acompañan la aparición del estado **`Listo para llevar`** (`Barra: Gin Tonic x2` + `Cocina: Burger Doble x1`) y en `"Simplificales"` (`21.62s`) suma al pie el resumen humano `Mozos aliviados · 1 solo viaje efectivo`. |
| **E06** | `24.03s - 29.11s` (`5.08s`) | `find("cero", occ=2, shift=-1)` (`24.08s - 0.05s`) | `friends_cafe_43248.mp4` (`in: 1.0s`, `focus: 0.52`, `blur(12px)` + velo `#faf7f2` al `90%`) | *(Cierre limpio centrado en marca)* | *(Lienzo institucional `#faf7f2`)* | **Cierre institucional cohesivo sobre crema oficial (`#faf7f2`):** Transición `crossfade` serena (`0.55s`) hacia el lienzo luminoso `#faf7f2` (con suave textura viva desenfocada detrás). Entran con deslizamiento corto (`14px -> 0`, `cubic-bezier(0.22, 1, 0.36, 1)`, cero rebote): (1) en `24.10s` el nuevo **`logo.svg`** oficial centrado en gran formato; (2) en `"cero comisión"` (`24.27s`) la píldora `0% comisión mensual` (`#fceae6` / `#d9412b`, borde `#f5c9bf`); (3) en `"Escribinos"` (`25.35s`) el llamado `Simplificá tu salón hoy` + tarjeta editorial blanca (`#ffffff`, `1px solid #e6dfd3`, `radius: 24px`, `--shadow-card`) con **`WhatsApp: (+54)1138436571`** y **`simonguerenu@gmail.com`**, manteniéndose nítida y serena hasta el cierre en `29.11s`. |

---

## 4. Especificación Técnica de Implementación para Producción (`video-ad/v2/`)

### 4.1. Geometría Exacta de Pantalla (`1080x1920`)
- **Zona de Titular Superior (`E01` a `E05`):**
  - Ubicación: `top: 220px`, `left: 80px`, `width: 920px`, centrado, `Plus Jakarta Sans 800`, `60px`, `line-height: 1.08`, `letter-spacing: -0.025em`, color `#faf7f2`.
  - Énfasis en palabra clave: color directo `#ff7a66` / píldora suave `#d9412b` de radio `12px` integrada con serenidad (sin animación *stomp* ni entrada palabra por palabra con rebote).
  - Entrada/salida por escena: `opacity 0 -> 1` y `translateY(14px -> 0px)` en `0.48s` con `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Tarjeta Maestra Persistente (`E01` a `E05`):**
  - Contenedor único en el DOM (`#masterCard`) que **no se destruye ni se arrastra fuera de pantalla** entre `E01` y `E05`: `left: 90px`, `width: 900px`, centrado ópticamente en la mitad media-inferior (`top: 640px` aprox., `padding: 38px 42px`), `background: #ffffff`, `border: 1px solid #e6dfd3`, `border-radius: 24px`, `box-shadow: 0 4px 12px rgba(28, 25, 23, 0.06), 0 20px 48px -8px rgba(28, 25, 23, 0.14)`.
  - **Cabezal (`#masterHead`):** altura fija, `img` de `../assets/mark.svg` (`44px x 44px`, sin `border-radius` extra) + texto `SaleListo` (`28px`, `800`, `#1c1917`) + píldora contextual derecha (`padding: 10px 22px`, `border-radius: 999px`, `font-size: 22px`, `font-weight: 700`).
  - **Transición interna entre vistas (`view_E01` .. `view_E05`):** al cruzar el umbral de cada escena (`t_cut`), la vista saliente hace `opacity: 1 -> 0` y `translateY(0 -> -10px)` en `0.32s`, y la vista entrante hace `opacity: 0 -> 1` y `translateY(14px -> 0)` en `0.48s` con `cubic-bezier(0.22, 1, 0.36, 1)`, garantizando **0 frames fantasma** y continuidad absoluta.
- **Continuidad de Datos Gastronómicos:**
  - Mantener exactamente la misma mesa y los mismos ítems en todas las escenas demostrativas: **`Mesa T2`**, **`Burger Doble x1`** (`Cocina`) y **`Gin Tonic x2`** (`Barra`), asignada al bloque **`Terraza`** (`Lucas`).

### 4.2. Diseño Sonoro Sobrio y Mezcla Masterizada (`-14.0 LUFS`)
- **Voz:** Toma continua `v2/audio/vo/vo_fast.wav` (`video-ad/locucion_argentina.mp3`), `start = 0.12s`, clara y presente al frente de la mezcla.
- **Música:** `"Gimme that Groove!"` (`v2/audio/music/gimme_that_groove_872.mp3`, `112 BPM`), conservando el empalme musical exacto de cierre para que los dos acordes finales reales (`27.99s` y `28.52s`) coronen la placa institucional `E06` después de `"probalo"` (`27.26s`).
- **Ducking suave:** Música `-13.5 dB` bajo la locución continua y recuperación progresiva suave a `-5.5 dB` tras `27.30s`, con sonoridad integrada final **`-14.0 LUFS`** (`±0.4 LU`) y *true peak* **`<= -1.2 dBTP`**.
- **Reducción drástica de SFX (solo 5 acentos orgánicos y sutiles, eliminando `glitch`, `impact_low`, `riser_up` y `whoosh` agresivos):**
  1. `3.26s` (`"Bajales"` en `E01`): `pop.mp3` muy suave (`-16 dB`) al pasar el cabezal a `Salón en orden`.
  2. `6.92s` (`"QR"` en `E02`): `scan.mp3` cristalino y discreto (`-14 dB`).
  3. `12.01s` (`"separa"` en `E03`): `pop.mp3` sutil (`-15 dB`) al dividirse `Cocina` y `Barra`.
  4. `19.19s` (`"vibra"` en `E05`): `vibrate.mp3` contenido (`-10 dB`) + `ding.mp3` cálido de pase (`-13 dB` en `"listo"`, `20.38s`).
  5. `24.27s` (`"cero comisión"` en `E06`): `success.mp3` armónico y suave (`-14 dB`) acompañando la apertura de marca.

---

## 5. Checklist de Auditoría antes de Cerrar Producción

- [ ] **Identidad oficial unificada:** `video-ad/v2/assets/logo.svg` y `video-ad/v2/assets/mark.svg` sincronizados byte a byte con los nuevos activos de `app/public/` (**Propuesta 06 · Salón en Orden**).
- [ ] **Una sola línea gráfica de punta a punta:** misma Tarjeta Maestra `#ffffff` (`border: 1px solid #e6dfd3`, `radius: 24px`, cabezal fijo con `mark.svg`) durante `E01` a `E05` y cierre crema `#faf7f2` coherente en `E06`.
- [ ] **Cero frenesí y cero rebote:** 6 escenas amplias (`4.00s a 5.50s`), deriva lineal del `3%`, `crossfade` de `0.48s`, curva única `cubic-bezier(0.22, 1, 0.36, 1)`, sin `whip-blur`, sin `beat-punch` y sin `spring` elástico.
- [ ] **Calidad técnica y limpieza:** `video-ad/SaleListo_Ad.mp4` en `1080x1920`, `60 fps`, `< 25 MB`, `-14.0 LUFS`, `0` frames fantasma y `video-ad/v2/build/` eliminado tras codificar.
- [ ] **Cumplimiento estricto de reglas críticas:** único teléfono `(+54)1138436571` (sin espacios, sin guiones y sin `9`), único correo `simonguerenu@gmail.com`, cero enlaces web inventados, cero rutas absolutas locales y cero rayas largas.
