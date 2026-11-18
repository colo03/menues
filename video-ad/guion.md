# Guion Audiovisual v5: SaleListo (Sin celulares en el salón)

**Pieza:** Spot vertical de marca y producto (Reels, TikTok, Shorts y WhatsApp B2B)  
**Novedad v5:** la Escena 5 cuenta la estrategia **Estación de Mozos en el pase + Pulsera vibradora**: cero celulares en el salón. La placa final muestra el correo comercial del spot `ventas@salelisto.com`.  
**Idea rectora:** se entiende con el sonido apagado. Cada escena es **un solo diagrama vectorial grande** dentro de un lienzo blanco, con un titular de 2 o 3 palabras arriba.  
**Duración:** `30.19s` (`1811 frames` a `60 fps`) sobre la toma continua v5 `video-ad/locucion_argentina.mp3`  
**Salida:** `video-ad/SaleListo_Ad.mp4`, `1080x1920`, `60 fps`, H.264 (`libx264 -preset slow -crf 20 -movflags +faststart`, `11.57 MB`) + AAC `48 kHz` (`-14 LUFS`)  
**Identidad:** tokens de `branding/tokens.css`, `v2/assets/logo.svg` y `v2/assets/mark.svg` (Propuesta 01, logo oficial vigente del proyecto)  
**Contacto en la placa final del spot:** WhatsApp `(+54)1138436571` | `ventas@salelisto.com`

---

## 1. Regla de oro (se mantiene desde v4)

1. **Escenas 1 a 5: máximo 5 palabras en pantalla al mismo tiempo** (titular + etiquetas del lienzo). Nada de oraciones, subtítulos, descripciones, listas ni encabezados secundarios.
2. **Ningún texto menor a `28px`.** Titulares de `88px` (`800`) y etiquetas del lienzo de `36px a 46px`.
3. **Todo se cuenta con íconos vectoriales propios** de `90px a 280px`, trazo de `3px a 4px`, mucho aire blanco.
4. **Un único lienzo persistente** blanco `#FFFFFF` de `720x720px`, radio `36px`, sombra suave (`--shadow-float`), anclado en `left: 180px`, `top: 660px` durante las escenas 1 a 5. Sin cabezal, sin marca escrita, sin píldoras de estado.
5. **Calma:** 6 actos de `3.3s a 7.2s`, deriva lineal del `3%` sobre el B-roll de `v2/broll/`, crossfade de `0.48s` entre fondos, curva única `cubic-bezier(0.22, 1, 0.36, 1)` sin rebote. Los textos de una escena salen antes de que entren los de la siguiente (nunca se superponen dos titulares).

---

## 2. Locución v5 (una sola toma, ElevenLabs `eleven_v4`, voz `Gabi`, `atempo 1.07`)

```text
¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia. Con SaleListo, el cliente escanea el QR con 4G, sin esperar carta ni wifi, y pide tranquilo. La comanda se separa sola entre cocina y barra, y el salón reparte bloques equilibrando al equipo en vivo. Sin celulares en el salón: miran la estación del pase, o les vibra la pulsera al salir. Simplificales la vida a ellos y al restaurante, con cero comisión. Escribinos por WhatsApp, y probalo.
```

Pausas naturales de la toma: todas entre `0.25s` y `0.55s` (fin de frase), sin cortes ni silencios raros.

---

## 3. Escaleta de 6 escenas

| Escena | Tiempo | B-roll | Titular | Palabras en pantalla | Diagrama dentro del lienzo |
|---|---|---|---|---|---|
| **1** | `0.00s - 4.93s` | `bar_busy_4043.mp4` | **Menos `corridas`** | 2 | En el centro, una campana de servicio sobre bandeja (el mozo). Tres alertas circulares (rojo, ámbar, rojo) aparecen en `0.55s`, `0.87s` y `1.19s`, laten con calma y se conectan al centro con líneas punteadas que fluyen. En *"Bajales"* (`3.26s`) las alertas y las líneas se apagan, la bandeja se transforma en el isotipo `mark.svg`, se dibuja un único anillo verde `#2F8A57` y aparece su tilde. |
| **2** | `4.93s - 9.98s` | `phone_hands_4915.mp4` | **Escaneá con `4G`** | 3 + `4G` + `Pedir` = 5 | Un código QR grande (con el isotipo al centro) y arriba una píldora verde **`4G`**. En *"QR"* (`6.92s`) una barra bermellón lo recorre de arriba hacia abajo. En `7.92s` el QR se funde en una **hamburguesa** y una **copa** ilustradas y aparece el botón coral **`Pedir`**, que en `9.04s` recibe un *tap* con dos ondas suaves. |
| **3** | `9.98s - 14.09s` | `kitchen_plating_13261.mp4` | **Se divide `sola`** | 3 + `Cocina` + `Barra` = 5 | Un nodo bermellón (la comanda) arriba y dos cajas apagadas abajo: olla + **`Cocina`** y copa + **`Barra`**. En `11.26s` se dibujan dos curvas. En `11.93s` la hamburguesa baja por la curva izquierda y la copa por la derecha; al llegar, cada caja se enciende en su color (`#D97706` y `#6D28D9`) justo sobre *"cocina y barra"*. |
| **4** | `14.09s - 17.34s` | `resto_customers_4385.mp4` | **Salón `parejo`** | 2 + `Interior` + `Terraza` + `Barra` = 5 | Tres columnas con 4 mesitas mudas cada una. Arriba entran 3 círculos de color (3 mozos). En *"bloques"* (`15.15s`) cada mozo baja a encastrar sobre su columna y sus 4 mesas se iluminan en su color: `4 · 4 · 4`. |
| **5** | `17.34s - 22.99s` | `waiter_drinks_43984.mp4` | **Sin `celulares`** | 2 + `Pase` + `Pulsera` = 4 | Dos ilustraciones grandes lado a lado, separadas por una sutil línea vertical que se dibuja al entrar. **Izquierda (`Pase`):** pantalla horizontal fija sobre pie (`rx 22`) con 3 columnas apagadas; en *"miran la estación del pase"* (`19.34s`) se encienden en cascada (`0.16s` entre sí) en los colores de los mozos `#D9412B`, `#2F8A57` y `#6D28D9`, cada una con su avatar y dos comandas blancas. **Derecha (`Pulsera`):** pulsera inteligente vista de frente (malla superior con ranuras, malla inferior con orificios y cápsula vertical redondeada oscura con tres puntos de espera); en *"les vibra la pulsera"* (`20.81s`) emite 2 ondas laterales verdes suaves a cada lado con un leve temblor de `2px`; en *"al salir"* (`21.58s`) la cápsula pasa a verde `#2F8A57` y se dibuja un tilde blanco. |
| **6** | `22.99s - 30.19s` | `friends_cafe_43248.mp4` (desenfoque + velo crema `#FAF7F2` al 90%) | *(placa final)* | Logo + `0% comisión` + contacto | El lienzo se va con el crossfade a crema sobre *"Simplificales la vida"* y, recién con el lienzo ya fuera (sin cuadro fantasma), entran el logo oficial grande (`23.34s`), la píldora **`0% comisión`** (*"cero comisión"*, `25.28s`) y en *"Escribinos"* (`26.46s`) un bloque blanco con **`(+54)1138436571`** y **`ventas@salelisto.com`**. |

---

## 4. Sonido

- **Voz:** `v2/audio/vo/vo_fast.wav` (idéntica a `locucion_argentina.mp3`, `atempo 1.07`), entrada `0.12s`, fin `28.53s`.
- **Música:** *"Gimme that Groove!"* (Mixkit) con ducking suave bajo la voz y remate en `29.06s` / `29.59s`.
- **6 SFX sutiles:** `pop` (`3.26s`, calma), `scan` (`6.90s`, barrido del QR), `pop` (`12.08s`, división), `vibrate` (`20.76s`, pulsera), `ding` (`21.58s`, tilde al salir) y `success` (`25.28s`, 0% comisión).
- **Master:** `-14.0 LUFS` integrados, *true peak* `-1.5 dBTP`, LRA `1.9 LU`.

---

## 5. Checklist antes de entregar

- [x] Escenas 1 a 5 con 5 palabras o menos por cuadro (E05: `Sin`, `celulares`, `Pase`, `Pulsera` = 4).
- [x] Ningún texto menor a `28px`; cero oraciones, subtítulos o listas.
- [x] Lienzo blanco único `720x720` radio `36px` en escenas 1 a 5; logo y mark oficiales vigentes.
- [x] Crossfade `0.48s`, deriva `3%`, curva `cubic-bezier(0.22, 1, 0.36, 1)` sin rebote.
- [x] `SaleListo_Ad.mp4` `1080x1920`, `60 fps`, `11.57 MB`, `-14 LUFS`; `v2/build/` y `node_modules/` borrados.
- [x] Placa final con WhatsApp `(+54)1138436571` y correo comercial `ventas@salelisto.com`, cero enlaces inventados, cero rayas largas.
