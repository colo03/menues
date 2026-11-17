# Guion Audiovisual Definitivo: SaleListo (Enfoque Alivio a Mozos y Orden Operativo)

**Pieza:** Spot Comercial Vertical de Alta Retención (Reels, TikTok, Shorts y WhatsApp B2B)  
**Eje Narrativo Central:** Bajarle la exigencia a los mozos de estar en diez lugares a la vez, simplificándole la vida al equipo y la operación entera al restaurante.  
**Duración Objetivo:** `~29.0s a 30.5s` (calibrado sobre toma continua natural + remate musical a tempo)  
**Formato de Entrega:** Vertical `1080x1920` (`9:16`), `60 fps`, H.264 High (`libx264 -preset slow -crf 20 -movflags +faststart`, peso final `< 25 MB`) + AAC `48 kHz` estéreo (`-14.0 LUFS` / `-1.5 dBTP`)  
**Rutas Oficiales de Salida:**
- Video final: `video-ad/SaleListo_Ad.mp4`
- Locución continua limpia: `video-ad/locucion_argentina.mp3`
- Activos originales de marca (solo lectura, intocables): `app/public/logo.svg` y `app/public/mark.svg` (copias de trabajo en `video-ad/v2/assets/`)

**Contacto Único e Inalterable:** `WhatsApp: (+54)1138436571` | `simonguerenu@gmail.com`

---

## 1. Corazón Creativo del Spot

En hora pico, el cuello de botella real de un restaurante o bar no es la falta de ganas del personal: es exigirle a cada mozo estar en diez mesas al mismo tiempo repartiendo cartas, dictando la clave del Wi-Fi, llevando papelitos a cocina, asomándose cinco veces a la barra para ver si salió un trago y corriendo a cobrar.

**SaleListo les saca esa carga mecánica de encima:**
1. **Menos interrupciones repetitivas en la mesa:** El cliente escanea el QR con su propio `4G` (sin pedir clave de Wi-Fi ni esperar carta física) y pide tranquilo, dejando libre al mozo para brindar hospitalidad real.
2. **Coordinación automática detrás de escena:** La comanda viaja sola y separada a `🍳 Cocina` y `🍸 Barra`, mientras el panel reparte bloques (`Interior`, `Terraza`, `Barra`) equilibrando la carga de cada mozo en vivo (y si uno sale o pausa, sus mesas se reasignan solas).
3. **Cero viajes en vano:** El mozo no camina diez veces a preguntar qué salió; su celular vibra recién cuando el plato o trago está listo para llevar (o cuando una mesa realmente necesita atención).
4. **Doble ganancia:** Mozos más aliviados, de mejor humor y dando mejor servicio, y un restaurante ordenado con `0% comisión mensual`.

---

## 2. Locución Continua en Español Argentino (Una Sola Toma Viva)

### 2.1. Texto Exacto para Síntesis Continua (`79 palabras`)
Diseñado específicamente para generarse en **UNA SOLA TOMA DE CORRIDO** (prohibido partir en clips sueltos con baches mudos) con la voz femenina argentina **`Gabi - Friendly, Publicity & Casual`** (`8jv0VaaN6d7mWZAeGj79`) en ElevenLabs **`eleven_v4`** (`stability ~0.38 - 0.42`, leve ajuste `atempo ~1.05 - 1.07` sin alterar tono):

```text
¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia. Con SaleListo, el cliente escanea el QR con 4G, sin esperar carta ni wifi, y pide tranquilo. La comanda se separa sola entre cocina y barra, y el salón reparte bloques equilibrando al equipo en vivo. Cero viajes en vano: el celu les vibra recién cuando está listo para llevar. Simplificales la vida a ellos y al restaurante, con cero comisión. Escribinos por WhatsApp, y probalo.
```

> **Nota fonética probada:** Escribir `wifi` en minúsculas sin guion dentro del prompt de voz de ElevenLabs logra pronunciación rioplatense natural y fluida; en pantalla se escribe siempre `Wi-Fi`.

### 2.2. Mapa de Respiración y Bloques Narrativos (Sobre Toma Única)
- **0.0s - 4.8s (Gancho empático, 13 pal.):** *"¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia."*
- **4.8s - 10.3s (Alivio en toma de pedido, 17 pal.):** *"Con SaleListo, el cliente escanea el QR con 4G, sin esperar carta ni wifi, y pide tranquilo."*
- **10.3s - 17.2s (El sistema coordina por ellos, 19 pal.):** *"La comanda se separa sola entre cocina y barra, y el salón reparte bloques equilibrando al equipo en vivo."*
- **17.2s - 22.8s (Cero viajes en vano, 14 pal.):** *"Cero viajes en vano: el celu les vibra recién cuando está listo para llevar."*
- **22.8s - 28.2s (Doble beneficio + CTA, 16 pal.):** *"Simplificales la vida a ellos y al restaurante, con cero comisión. Escribinos por WhatsApp, y probalo."*
- **28.2s - ~30.0s (Remate musical):** Dos golpes finales reales del tema funk/groove (`stab1`, `stab2`) cerrando limpio sobre la placa viva.

---

## 3. Escaleta Técnica de 14 Cortes Dinámicos (`C01` a `C14`)

Todos los planos usan los 14 clips HD reales ya verificados en `v2/broll/` con grading cálido, movimiento *Ken Burns* continuo, transiciones ágiles (`whipL`, `whipR`, `whipU`, `zoom`, `zoomOut`, `split`, `veil`) y titulares cinéticos de **2 a 4 palabras máximas** (`Plus Jakarta Sans 800`, `118px`).

| Corte | Tiempo Aprox. | Ancla de Voz (`plan.py`) | B-Roll Real (`v2/broll/`) | Animación Intuitiva Auto-Explicativa (`ad_v2.html`) | Titular Cinético (Palabra resaltada coral) | Transición |
|---|---|---|---|---|---|---|
| **C01** | `0.0s - 2.8s` | Inicio `0.00s` | `bar_busy_4043.mp4` (`in: 1.5`) | **Sobrecarga simultánea sobre el mozo:** alrededor de un badge central `🏃 Mozo a tope` brotan y tiemblan 4 reclamos caóticos a la vez (`🙋 Mesa 4 · ¡Carta!`, `🔑 ¿Clave Wi-Fi?`, `🍳 ¿Salió Cocina?`, `💳 Terraza · Cuenta`) con pulso rojo de estrés. | **¿Mozos a `mil?`** *(3 pal., hl: 2)* | Corte inicial con impacto |
| **C02** | `2.8s - 4.9s` | `("bajales", 1, 0)` | `phone_bar_321.mp4` (`in: 0.8`) | **Orden de un golpe:** el isotipo oficial `mark.svg` (squircle coral `#d9412b` con campana y tilde) entra con resorte elástico y onda luminosa barriendo de un solo golpe las 4 alertas caóticas fuera de pantalla. | **Basta de `correr`** *(3 pal., hl: 2)* | `whipL` |
| **C03** | `4.9s - 7.1s` | `("cliente", 1, -1)` | `phone_hands_4915.mp4` (`in: 2.0`) | **Autogestión por 4G:** tarjeta `Mesa T2` con visor QR blanco/verde que enfoca en `"qr"` y dispara 3 anillos concéntricos verdes + chip `📶 4G` en `"4G"`. | **Escanean con `4G`** *(3 pal., hl: 2)* | `zoom` |
| **C04** | `7.1s - 8.7s` | `("sin", 1, 0)` | `friends_cafe_43248.mp4` (`in: 0.6`) | **Mesa pidiendo sin reclamar carta ni clave:** tarjeta limpia `Mesa T2` (`🍔 Burger Doble`, `🍸 Gin Tonic` subiendo `1 -> 2` con tap) coronada por un chip verde `✓ Mozo libre · Sin Wi-Fi`. | **Sin esperar `carta`** *(3 pal., hl: 2)* | `whipU` |
| **C05** | `8.7s - 10.3s` | `("pide", 1, -1)` | `phone_woman_43270.mp4` (`in: 0.8`) | **Confirmación sin fricción:** toque táctil hunde el botón coral `#d9412b` `Pedir ->` (en `"tranquilo"`) y lanza hacia arriba un orbe luminoso coral que viaja solo hacia Cocina y Barra. | **Piden sin `apuro`** *(3 pal., hl: 2)* | `whipL` |
| **C06** | `10.3s - 12.1s` | `("comanda", 1, -1)` | `SPLIT`: `kitchen_wok_47555.mp4` (sup.) + `bar_beer_tap_8710.mp4` (inf.) | **Bifurcación automática sin pase manual:** el orbe se divide en dos curvas Bezier animadas: rama ámbar `#f59e0b` a `🍳 Cocina · Burger Doble x1` y rama violeta `#7c3aed` a `🍸 Barra · Gin Tonic x2`. | **Cocina y Barra** *(3 pal., pos: 1440)* | `split` |
| **C07** | `12.1s - 13.8s` | `("entre", 1, 0)` | `kitchen_plating_13261.mp4` (`in: 5.0`) | **Cocina marcha sola:** tarjeta KDS oscura (`#181512`) `🍳 COCINA · Mesa T2 · Burger Doble x1` llena su barra ámbar y enciende `✓ En marcha` sin que el mozo lleve comandas de papel. | **Cero `papel`** *(2 pal., hl: 1)* | `zoom` |
| **C08** | `13.8s - 15.5s` | `("salón", 1, -2)` | `resto_customers_4385.mp4` (`in: 2.5`) | **Reparto inteligente por bloques (Parte 1):** grilla limpia del `Salón` con 3 bloques (`Interior`, `Terraza`, `Barra`). `Lucas` (`#2f6bd9`), `Sofi` (`#2f8a57`) y `Nico` (`#7c3aed`) encastran con imán cada uno en su sector. | **`Bloques` por mozo** *(3 pal., hl: 0)* | `zoomOut` |
| **C09** | `15.5s - 17.2s` | `("equilibrando", 1, 0)` | `waiter_help_22314.mp4` (`in: 2.5`) | **Balanceo y reasignación automática (Parte 2):** sobre la grilla persistente (mientras de fondo el mozo atiende relajado y sonriente), si un sector sube carga o un mozo pausa, las mesas se iluminan en verde equilibrando el turno (`✓ Carga pareja`). | **Equipo en `equilibrio`** *(3 pal., hl: 2)* | `whipL` |
| **C10** | `17.2s - 19.0s` | `("cero", 1, 0)` | `bar_beer_tap_8709.mp4` (`in: 3.0`) | **Fin a asomarse diez veces a la barra:** en la tarjeta `🍸 BARRA · Mesa T2 · Gin Tonic x2`, un toque pulsa el botón verde `#2f8a57` `¡Listo!` emitiendo dos ondas expansivas de aviso hacia el salón. | **`Cero` viajes en vano** *(4 pal., hl: 0)* | `whipR` |
| **C11** | `19.0s - 21.0s` | `("celu", 1, -1)` | `waiter_pizza_44003.mp4` (`in: 0.8`) | **Aviso exacto al bolsillo:** smartphone del mozo entra con resorte; cae la notificación `🍸 Retirar en Barra · Mesa T2` vibrando físicamente (`rotate ±3deg` + ondas hápticas laterales) justo en la palabra `"vibra"`. | **`Vibra` cuando sale** *(3 pal., hl: 0)* | `whipU` |
| **C12** | `21.0s - 22.8s` | `("cuando", 1, 0)` | `bar_serve_43962.mp4` (`in: 0.6`) | **Un solo viaje efectivo:** el mozo retira directo el trago terminado en barra mientras la tarjeta de aviso colapsa suavemente en un círculo verde `#2f8a57` trazando el tilde blanco grande (`✓`). | **Va sobre `seguro`** *(3 pal., hl: 2)* | `zoom` |
| **C13** | `22.8s - 24.6s` | `("simplificales", 1, 0)` | `waiter_drinks_43984.mp4` (`in: 1.5`) | **Doble beneficio humano y operativo:** mozo caminando distendido con bandeja; tarjeta luminosa muestra dos indicadores en vivo que se encienden con tilde verde: `😊 Mozos aliviados` y `🏪 Salón bajo control`. | **Mozos sin `estrés`** *(3 pal., hl: 2)* | `whipL` |
| **C14** | `24.6s - ~30.0s` | `("restaurante", 1, -2)` | `bar_busy_4043.mp4` (`in: 7.0`, blur `5px`, velo crema `70%` en movimiento real) | **Placa final viva con 3 entradas escalonadas:** (1) En `C14.start` entra `logo.svg` oficial con resorte; (2) en `"cero"` (`occ=2`) despliega con *shimmer* el badge `0% comisión mensual`; (3) en `"Escribinos"` sube `Escribinos hoy` + tarjeta limpia con `WhatsApp: (+54)1138436571` y `simonguerenu@gmail.com` con pulso continuo sobre WhatsApp y push-in `1.00 -> 1.04` hasta los 2 golpes del remate musical. | **Escribinos hoy** *(en placa final)* | `veil` |

---

## 4. Detalles Críticos de Implementación Visual y Sonora (`v2/`)

### 4.1. Cuidados de Animación y Cero Frames Fantasma
1. **Grupo persistente del caos inicial (`C01 -> C02`):** El grupo de las 4 burbujas caóticas de `C01` permanece visible solo hasta `C02.start + 0.42s` mientras el isotipo `mark.svg` las barre lateralmente con aceleración cúbica (`eIn`), ocultándose definitivamente después.
2. **Grupo persistente de la grilla (`C08 -> C09`, antes `C09 -> C10`):** Al mover la grilla `Interior / Terraza / Barra` a los cortes `C08` y `C09`, actualizar en `ad_v2.html` la condición de visibilidad y acompañamiento de transición de salida (`cuts[trans.from].id === 'C09'` aplica `grpFx(G.grid, fx.out)` y corta visibilidad exactamente al terminar la transición hacia `C10`) para garantizar **0 frames fantasma** en los ~1800 frames del video.
3. **Anclas repetidas en `plan.py`:** Atención a la palabra `"cero"`, que aparece dos veces en el guion continuo:
   - Primera aparición (`occ=1`): `"Cero viajes en vano"` -> ancla de inicio del corte `C10`.
   - Segunda aparición (`occ=2`): `"con cero comisión"` -> marca `M["badge"]` (`find("cero", occ=2)["t0"] - 0.08`) en la placa final `C14`.
4. **Continuidad gastronómica:** Mantener `"Burger Doble x1"` y `"Gin Tonic x2"` idénticos en `C04`, `C06`, `C07` y `C10`, todos referidos a `"Mesa T2"`.

### 4.2. Mezcla Musical, Ducking y SFX (`-14.0 LUFS`)
- **Música:** `"Gimme that Groove!"` (`v2/audio/music/gimme_that_groove_872.mp3`, `112 BPM`, licencia libre comercial), empalmada matemáticamente en la grilla de compases para que sus dos golpes reales de cierre (`stab1`, `stab2`) suenen justo después de la palabra `"probalo"`.
- **Ducking dinámico:** Música ~`11.5 a 14 dB` por debajo de la voz durante el habla continua y subiendo limpiamente a `-5 dB` en el remate final, logrando integrado total de **`-14.0 LUFS`** y true peak **`<= -1.2 dBTP`**.
- **Efectos sonoros puntuales (`v2/audio/sfx/`):**
  - `0.00s`: `impact_low` + `pop` escalonados en las 4 alertas de `C01` + `glitch` suave (`~1.3s`).
  - `C02.start`: `whoosh2` al barrer el caos con `mark.svg`.
  - Marca `"qr"` (`C03`): `scan` cristalino.
  - Tap en `C04` y lanzamiento en `C05`: `pop` + `whoosh1`.
  - `C06.start`: `split` estéreo en la bifurcación Cocina/Barra.
  - Botón `¡Listo!` en `C10`: `ding` real de campana de barra (`-9 dB`).
  - Marca `"bloques"` / `"equilibrando"` (`C08-C09`): `snap` magnético + `pop` suave de balanceo.
  - Marca `"vibra"` (`C11`): `vibrate` doble háptico de celular (`-6 dB`, bien perceptible).
  - Tilde verde en `C12`: `success` armónico.
  - Placa final `C14`: `riser_up` previo + `impact_logo` + `shimmer` en `0% comisión mensual` + `pop` suave en tarjeta de WhatsApp.

---

## 5. Checklist de Cumplimiento Obligatorio antes de Cerrar

- [x] **Carpeta `app/` 100% intacta** (cero modificaciones).
- [x] **Locución viva en una sola toma continua** exportada en `video-ad/locucion_argentina.mp3` (sin cortes artificiales ni voz robótica).
- [x] **Video final optimizado `< 25 MB`** exportado directamente en `video-ad/SaleListo_Ad.mp4` (`libx264 -preset slow -crf 20 -movflags +faststart`, `1080x1920`, `60 fps`).
- [x] **Limpieza de temporales:** eliminar `video-ad/v2/build/` al concluir el render para dejar el repositorio liviano para GitHub.
- [x] **Datos de contacto únicos y exactos:** únicamente `(+54)1138436571` (sin espacios, sin guiones y sin `9`) y `simonguerenu@gmail.com`. Cero otros números, cero enlaces web inventados y cero rayas largas.
