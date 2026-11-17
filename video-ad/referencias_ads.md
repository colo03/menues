# Relevamiento de Referencias Publicitarias: Gastro-Tech y Motion SaaS (v2)

**Proyecto:** SaleListo Video Ad v2 (Vertical 9:16, 1080x1920)  
**Objetivo:** Transformar el spot v1 estático en una pieza audiovisual ágil, sensorial y auto-explicativa inspirada en los mejores anuncios cortos de software gastronómico y SaaS moderno.

---

## 1. Diagnóstico Puntual: Qué Volvió Estático al Video v1

Al auditar `guion.md` y la estructura de producción de la versión 1 (`SaleListo_Ad_1080x1920.mp4`), surgen cinco cuellos de botella concretos que explican el feedback del usuario (*"le falta dinamismo, b-rolls, musica, menos texto y mas animaciones intuitivas"*):

1. **Ritmo de diapositiva (5 planos en 30 segundos):** Cada escena duraba entre `5.0s` y `7.0s` fijos sobre el mismo encuadre. En formatos verticales (Instagram Reels, TikTok, Shorts y estados/mensajes de WhatsApp), un plano estático de más de `2.5s` dispara el abandono inmediato.
2. **Cero video real gastronómico (B-roll ausente):** Toda la pieza dependía de fondos planos CSS (`#181512` y `#faf7f2`). En gastronomía, el dueño o encargado necesita sentir el calor del salón, la barra despachando y la cocina viva; sin imagen real, el software parece frío y abstracto.
3. **Saturación de texto en pantalla:** Cada escena acumulaba un titular largo de 6 a 8 palabras, tres píldoras inferiores con explicaciones entre paréntesis (por ejemplo: `Sin pedir Wi-Fi (Usa 4G / 5G)`), textos de interfaz pequeños y estados parpadeantes (`30 a 40 palabras visibles por corte`), forzando al espectador a leer en lugar de mirar.
4. **Locución sobrecargada y sin colchón musical:** El guion v1 tenía `82 palabras`, lo que obligó a acelerar digitalmente la voz sintetizada (`rate +32%` y `atempo 1.25`), y la pista final salió sin música comercial de fondo ni efectos sonoros táctiles que marcaran cada acción visual.
5. **Beneficios escritos en vez de física visual:** En lugar de ver cómo un pedido viaja y se bifurca solo entre Cocina y Barra o cómo el mapa asigna al mozo y hace vibrar su teléfono, la v1 apilaba etiquetas estáticas descriptivas.

---

## 2. Análisis de Ejemplos Reales de Alto Impacto

### 2.1. Toast POS (Reels y TikTok Ads B2B: "Rush Chaos to Flow")
Los anuncios cortos de mayor conversión de **Toast POS** para captación de restaurantes combinan empatía operativa real con micro-demostraciones de interfaz:

- **Estructura y ritmo de edición:**
  - **Gancho (0.0s - 3.0s):** 2 cortes rápidos (`1.2s` a `1.6s` cada uno) en plena hora pico nocturna. Luz cálida de salón lleno, comandas trabadas o camareros corriendo. Cero logos corporativos lentos al inicio.
  - **Pivote de alivio (3.0s - 4.0s):** Golpe musical limpio (*beat drop*) acompañado de un barrido rápido (*whip-zoom*) hacia la solución en mano.
  - **Demostración en flujo (4.0s - 24.0s):** Cortes cada `1.5s` a `2.2s` alternando acción física en restaurante con tarjetas UI limpias flotando encima.
- **Uso de B-roll + UI flotante:**
  - El B-roll real ocupa el lienzo vertical `9:16` con iluminación cálida (tonos ámbar/madera) y movimiento continuo de cámara.
  - Encima no se pega una captura completa ilegible del sistema, sino **una sola tarjeta modular recortada** con esquinas redondeadas, sombra profunda (`drop-shadow`) y animación de toque (*tap ripple*).
- **Tipografía:** Titulares enormes de 2 a 4 palabras (`Lost tickets = Lost profit`, `Syncs instantly`, `+20% table turns`).

### 2.2. Sunday App (QR Dining Video Ads: "The 10-Second Action")
Las campañas en video corto de **Sunday App** (pedidos y pagos por QR en mesa) son referencia directa para comunicar velocidad sin fricción:

- **Foco visual absoluto en la mesa real:** Primer plano auténtico de una mano acercando el smartphone al QR físico apoyado en una mesa cálida con platos y copas reales en desenfoque (*bokeh*).
- **Demostración sin texto técnico:** Para comunicar *"sin descargar apps"* y *"instantáneo"*, muestran el encuadre del QR disparando un destello y abriendo la carta interactiva en menos de `0.4s`, seguido de un único botón coral/acento que confirma con un tilde verde elástico.
- **Contraste emocional en el personal:** Intercalan planos breves (`1.5s`) del mozo caminando relajado y sonriente entregando el pedido exacto sin libreta ni idas y vueltas innecesarias.

### 2.3. Square for Restaurants (Campañas "Chaos to Control" / Ecosistema Conectado)
Los spots verticales de **Square for Restaurants** resuelven muy bien el desafío de mostrar múltiples pantallas conectadas (cliente, cocina, barra y salón) en menos de 30 segundos:

- **Split-Screen gastronómico en vivo:** Dividen la pantalla vertical en dos mitades horizontales (arriba fuego/emplatado en cocina; abajo coctelería/barra tirando cerveza) y superponen sobre cada mitad el ticket digital correspondiente iluminándose en tiempo real.
- **Montaje causa-efecto:** Cada corte hereda el movimiento del anterior (*match-cut* direccional): el toque del cliente en la mesa lanza un pulso que entra en la pantalla de cocina/barra, y el botón de *"Listo"* en barra dispara el aviso que vibra en el bolsillo del camarero.
- **Diseño sonoro rítmico:** Los cambios de estado en el KDS (`Nuevo` -> `Listo`) suenan con campanas sutiles y clics táctiles sincronizados a la percusión del track musical.

### 2.4. Motion Reels SaaS Estilo Apple / Stripe / Linear (UI 2.5D + Kinetic Type)
Para que las tarjetas de interfaz sobre el B-roll se vean de nivel agencia internacional y no como cajas HTML planas:

- **Profundidad 2.5D y Glassmorphism sutil:** Las tarjetas flotan con leve inclinación o escala elástica (`cubic-bezier(0.22, 1, 0.36, 1)` o curvas *spring*), bordes finos translúcidos (`1px solid`), sombras multicapa suaves y desenfoque selectivo del video de fondo (`backdrop-filter` o oscurecimiento radial suave `scrim`) en el momento exacto en que la UI reclama foco.
- **Coreografía de cursores, trazos y nodos:** En vez de explicar con texto cómo viaja un dato, una línea curva luminosa (`SVG path` animado con `stroke-dashoffset`) conecta el origen con los dos destinos (`Cocina` y `Barra`), o un punto de color salta con imán hacia un bloque del mapa (`Terraza · Mesa T2`).
- **Tipografía cinética minimalista:**
  - Aparición por máscara desde línea base (*mask slide-up*) o golpe seco de escala (*stomp* `1.14 -> 1.00`) clavado en el golpe de bombo o caja de la música.
  - Jerarquía estricta: fuente geométrica ExtraBold (`Plus Jakarta Sans 800`), interlineado compacto (`1.05`), `letter-spacing: -0.03em`, máximo **2 a 4 palabras por plano**.

---

## 3. Patrones Concretos Aplicables a SaleListo v2

| Dimensión | Qué hacía v1 (Problema) | Patrón Extraído de Referencias para v2 (Solución) |
|---|---|---|
| **Ritmo de cortes** | 5 escenas largas de `5.0s` a `7.0s` | **16 cortes dinámicos** de `1.6s` a `2.2s` cada uno (~`1.85s` promedio) dentro de `30.0s` totales. |
| **Fondo visual** | Colores planos CSS (`#181512`, `#faf7f2`) | **B-rolls gastronómicos reales en movimiento** (Ken Burns `scale 1.03 -> 1.10`, paneos suaves, split-screen en Cocina/Barra y grading cálido). |
| **Texto en pantalla** | 25 a 40 palabras simultáneas por escena | **1 a 4 palabras máximas por plano** en tipografía gigante (`Plus Jakarta Sans 800`). Cero párrafos y cero listas largas. |
| **Explicación de producto** | Píldoras de texto descriptivas | **Animaciones intuitivas auto-explicativas:** pulso 4G al escanear QR -> trazo que se bifurca a `🍳 Cocina` y `🍸 Barra` -> grilla de bloques `Interior / Terraza / Barra` asignando punto de color del mozo -> alerta vibrando con rebote en el celular (`Retirar en Barra · Mesa T2`) -> tilde verde. |
| **Locución** | 82 palabras aceleradas con `atempo 1.25` | **66 palabras conversacionales** en voseo argentino natural y fresco, dejando aire entre frases para que respiren la música y los SFX. |
| **Música y SFX** | Sin música ni efectos en la mezcla final | **Track instrumental comercial con groove** (ElevenLabs Music ~120 BPM) con *ducking* automático (`-15 dB` bajo voz, `-5 dB` en intro/respiros/cierre) + **6 micro-SFX puntuales** (`scan`, `pulso 4G`, `whoosh split`, `ding barra`, `vibración celular`, `check pop`). |

---

## 4. Guía Rápida de Contraste y Legibilidad sobre B-Roll (9:16)

1. **Tratamiento del B-Roll:** Aplicar corrección de color cálida uniforme (realce suave en ámbar/dorados, sombras ricas en carbón `#1f1b16`) y un *scrim* degradado superior/inferior (`rgba(31, 27, 22, 0.45)`) para que los titulares blancos o crema nunca pierdan lectura sobre luces del fondo.
2. **Zonas seguras verticales (`1080x1920`):**
   - **Tercio superior (`y: 170px - 390px`):** Titular cinético corto (2 a 4 palabras).
   - **Centro visual (`y: 440px - 1420px`):** Acción principal del B-roll integrada con la tarjeta UI animada de SaleListo.
   - **Margen inferior (`y: 1480px - 1920px`):** Libre de textos críticos durante el spot para no chocar con la interfaz nativa de Reels/TikTok/Shorts (excepto en la placa final limpia centrada).
3. **Identidad gráfica innegociable:** Respetar los activos reales de SaleListo (`logo.svg`, `mark.svg`), fuente `Plus Jakarta Sans` y paleta oficial: crema `#faf7f2`, superficie `#ffffff`, carbón `#1f1b16`, coral `#d9412b`, verde éxito `#2f8a57`, ámbar cocina `#c98a12` / `#f59e0b` y violeta barra `#7c3aed`.
