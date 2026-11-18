# Guion Audiovisual v4: SaleListo (Diagramas Simples, Casi Sin Texto)

**Pieza:** Spot vertical de marca y producto (Reels, TikTok, Shorts y WhatsApp B2B)  
**Devolución que resuelve:** "El video está mal. Tiene mucho texto. Las animaciones deben ser más intuitivas y simples."  
**Idea rectora:** se entiende con el sonido apagado. Cada escena es **un solo diagrama vectorial grande** dentro de un lienzo blanco, con un titular de 2 o 3 palabras arriba.  
**Duración:** `29.11s` (`1747 frames` a `60 fps`) sobre la toma continua aprobada `video-ad/locucion_argentina.mp3`  
**Salida:** `video-ad/SaleListo_Ad.mp4`, `1080x1920`, `60 fps`, H.264 (`libx264 -preset slow -crf 20 -movflags +faststart`, `< 25 MB`) + AAC `48 kHz` (`-14 LUFS`)  
**Identidad:** tokens de `branding/tokens.css`, `v2/assets/logo.svg` y `v2/assets/mark.svg` (logo oficial vigente del proyecto)  
**Contacto único:** `(+54)1138436571` | `simonguerenu@gmail.com`

---

## 1. Regla de oro v4

1. **Escenas 1 a 5: máximo 5 palabras en pantalla al mismo tiempo** (titular + etiquetas del lienzo). Nada de oraciones, subtítulos, descripciones, listas ni encabezados secundarios.
2. **Ningún texto menor a `28px`.** Titulares de `88px` (`800`) y etiquetas del lienzo de `36px a 46px`.
3. **Todo se cuenta con íconos vectoriales propios** de `90px a 184px`, trazo de `3px a 4px`, mucho aire blanco.
4. **Un único lienzo persistente** blanco `#FFFFFF` de `720x720px`, radio `36px`, sombra suave (`--shadow-float`), anclado en `left: 180px`, `top: 660px` durante las escenas 1 a 5. Sin cabezal, sin marca escrita, sin píldoras de estado.
5. **Calma:** 6 actos de `4.0s a 5.5s`, deriva lineal del `3%` sobre el B-roll de `v2/broll/`, crossfade de `0.48s` entre fondos, curva única `cubic-bezier(0.22, 1, 0.36, 1)` sin rebote. Los textos de una escena salen antes de que entren los de la siguiente (nunca se superponen dos titulares).

---

## 2. Locución (intacta)

```text
¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia. Con SaleListo, el cliente escanea el QR con 4G, sin esperar carta ni wifi, y pide tranquilo. La comanda se separa sola entre cocina y barra, y el salón reparte bloques equilibrando al equipo en vivo. Cero viajes en vano: el celu les vibra recién cuando está listo para llevar. Simplificales la vida a ellos y al restaurante, con cero comisión. Escribinos por WhatsApp, y probalo.
```

---

## 3. Escaleta de 6 escenas

| Escena | Tiempo | B-roll | Titular | Palabras en pantalla | Diagrama dentro del lienzo |
|---|---|---|---|---|---|
| **1** | `0.00s - 4.93s` | `bar_busy_4043.mp4` | **Menos `corridas`** | 2 | En el centro, una campana de servicio sobre bandeja (el mozo). Tres alertas circulares (rojo, ámbar, rojo) aparecen en `0.55s`, `0.87s` y `1.19s`, laten con calma y se conectan al centro con líneas punteadas que fluyen. En *"Bajales"* (`3.26s`) las alertas y las líneas se apagan, la bandeja se transforma en el isotipo `mark.svg`, se dibuja un único anillo verde `#2F8A57` y aparece su tilde. |
| **2** | `4.93s - 9.98s` | `phone_hands_4915.mp4` | **Escaneá con `4G`** | 3 + `4G` + `Pedir` = 5 | Un código QR grande (con el isotipo al centro) y arriba una píldora verde **`4G`**. En *"QR"* (`6.92s`) una barra bermellón lo recorre de arriba hacia abajo. En `7.92s` el QR se funde en una **hamburguesa** y una **copa** ilustradas y aparece el botón coral **`Pedir`**, que en `9.04s` recibe un *tap* con dos ondas suaves. |
| **3** | `9.98s - 13.98s` | `kitchen_plating_13261.mp4` | **Se divide `sola`** | 3 + `Cocina` + `Barra` = 5 | Un nodo bermellón (la comanda) arriba y dos cajas apagadas abajo: olla + **`Cocina`** y copa + **`Barra`**. En `11.18s` se dibujan dos curvas. En `11.86s` la hamburguesa baja por la curva izquierda y la copa por la derecha; al llegar, cada caja se enciende en su color (`#D97706` y `#6D28D9`) justo sobre *"cocina y barra"*. |
| **4** | `13.98s - 18.54s` | `resto_customers_4385.mp4` | **Salón `parejo`** | 2 + `Interior` + `Terraza` + `Barra` = 5 | Tres columnas con 4 mesitas mudas cada una. Arriba entran 3 círculos de color (3 mozos). En *"bloques"* (`14.85s`) cada mozo baja a encastrar sobre su columna y sus 4 mesas se iluminan en su color: `4 · 4 · 4`. |
| **5** | `18.54s - 24.03s` | `waiter_drinks_43984.mp4` | **Vibra al `salir`** | 3 + `¡Listo!` = 4 | Un celular grande en el centro. En *"vibra"* (`19.19s`) se expanden dos ondas curvas a cada lado (la cámara no se mueve). En *"listo"* (`20.38s`) la pantalla pasa a verde suave, se dibuja un gran tilde y aparece **`¡Listo!`**. |
| **6** | `24.03s - 29.11s` | `friends_cafe_43248.mp4` (desenfoque + velo crema `#FAF7F2` al 90%) | *(placa final)* | Logo + `0% comisión` + contacto | El lienzo se va con el crossfade a crema. Entran el logo oficial grande (`24.13s`), la píldora **`0% comisión`** (*"cero comisión"*, `24.53s`) y en *"Escribinos"* (`25.30s`) un bloque blanco con **`(+54)1138436571`** y **`simonguerenu@gmail.com`**. |

---

## 4. Sonido

- **Voz:** `v2/audio/vo/vo_fast.wav` (idéntica a `locucion_argentina.mp3`), entrada `0.12s`.
- **Música:** *"Gimme that Groove!"* (Mixkit) con ducking suave bajo la voz y remate en `27.99s` / `28.52s`.
- **6 SFX sutiles:** `pop` (`3.26s`, calma), `scan` (`6.90s`, barrido del QR), `pop` (`12.01s`, división), `vibrate` (`19.14s`), `ding` (`20.38s`, ¡Listo!) y `success` (`24.53s`, 0% comisión).
- **Master:** `-14 LUFS` integrados, *true peak* `<= -1.2 dBTP`.

---

## 5. Checklist antes de entregar

- [ ] Escenas 1 a 5 con 5 palabras o menos por cuadro (verificado en fotogramas).
- [ ] Ningún texto menor a `28px`; cero oraciones, subtítulos o listas.
- [ ] Lienzo blanco único `720x720` radio `36px` en escenas 1 a 5; logo y mark oficiales vigentes.
- [ ] Crossfade `0.48s`, deriva `3%`, curva `cubic-bezier(0.22, 1, 0.36, 1)` sin rebote.
- [ ] `SaleListo_Ad.mp4` `1080x1920`, `60 fps`, `< 25 MB`, `-14 LUFS`; `v2/build/` borrado.
- [ ] Único teléfono `(+54)1138436571`, único correo `simonguerenu@gmail.com`, cero enlaces inventados, cero rayas largas.
