# Investigación de Referencias Publicitarias Exitosas: Gastro-Tech y Motion B2B Sobrio (v3)

**Proyecto:** SaleListo Video Ad v3 (`1080x1920`, `9:16`, `60 fps`, `~30s`)  
**Objetivo de Rediseño Visual:** Conservar el corazón narrativo y la locución argentina continua aprobada (`video-ad/locucion_argentina.mp3`), eliminando el frenesí de cámara, las animaciones saltarinas y la fragmentación gráfica de la v2 para adoptar el estándar visual de las campañas B2B y gastro-tech más exitosas del mundo.

---

## 1. Diagnóstico Comparativo: Por Qué la v2 Generó Fatiga Visual (`v1` vs `v2` vs Estándar v3)

La evolución del spot mostró los dos extremos opuestos antes de llegar al punto de equilibrio profesional:
- **En `v1` (exceso de rigidez):** 5 placas estáticas sin B-roll, sin música y con 35 a 40 palabras por pantalla.
- **En `v2` (sobrecorrección hiperactiva):** 14 cortes en `29.65s` (`~1.8s` por plano en el tramo demostrativo), 7 tipos distintos de transiciones violentas con desenfoque direccional (`whipL`, `whipR`, `whipU` de `70px-80px`, `zoom` `1.7x`, `zoomOut`, `split`, `veil`), golpes de zoom en cada compás (`beat-punch`), paneos bruscos del `9% al 12%` cambiando de dirección en cada corte, física subamortiguada con rebote elástico (`spring(t, 15, 7)` y `eBack` con *overshoot* en más de 25 elementos) y **12 widgets visualmente desconectados entre sí** (círculo oscuro con RGB glitch, visor láser con anillos neón, botón gigante con estela de cometa, KDS negro `#181512`, tarjeta blanca de barra, grilla de 3 columnas, carcasa 3D de teléfono con líneas cómicas de vibración, etcétera).

En publicidad B2B de software operativo, **el exceso de movimiento comunica estrés, exactamente lo opuesto a la promesa de SaleListo** (*bajarle la exigencia a los mozos y ordenar el salón*).

---

## 2. Benchmark de Campañas Reales Exitosas y Principios Transferibles

### 2.1. Toast POS ("Built for Busy" y "Built for Restaurants", agencia Arnold)
- **Contraste emocional entre entorno vivo y software sereno:** Los spots insignia de Toast abren sobre la realidad física y cálida del restaurante (luz ámbar de salón, cocina real, movimiento humano genuino), pero **la cámara y la interfaz jamás entran en pánico**. Mientras el entorno gastronómico tiene vida propia, el encuadre mantiene un movimiento lento, lineal y controlado que posiciona al sistema como el ancla de calma del turno.
- **Integración contextual sin artificios:** En lugar de efectos pirotécnicos (orbes voladores, rayos láser o temblores artificiales), muestran piezas limpias de interfaz con tipografía clara e indicadores de estado reales vinculados directamente con el alivio humano del personal.
- **Aplicación directa a SaleListo v3:** Usar los B-rolls reales en plano completo con gradación cálida uniforme y deriva apenas perceptible, dejando que la serenidad de la tarjeta gráfica transmita control operativo desde el primer segundo.

### 2.2. Square for Restaurants ("Big in Restaurants" / Ecosistema Conectado)
- **Línea editorial unificada sobre imagen real:** Square evita mezclar diez estilos de pantallas distintas en 30 segundos. Utiliza una sola familia cromática y geométrica (superficies claras editoriales, tipografía geométrica limpia, bordes sutiles y sombras suaves) superpuesta con aire generoso sobre escenas reales de salón, barra y cocina.
- **Sincronía por bloques narrativos, no por golpes de batería:** Los cambios visuales acompañan las frases completas de la locución (cada `4.5s a 5.5s`), permitiendo que el dueño o encargado gastronómico comprenda una ventaja operativa completa antes de pasar a la siguiente.
- **Aplicación directa a SaleListo v3:** Sincronizar las **6 escenas** exactamente con los **6 bloques respirados de la locución aprobada**, eliminando cortes intermedios innecesarios a mitad de frase.

### 2.3. Apple Product Films (WWDC y Spots de UI en iOS)
- **Filosofía estricta "No-Bounce" (amortiguación crítica $\zeta = 1.0$):** En los films de producto de Apple, los contenedores estructurales, tarjetas y paneles **nunca rebotan ni oscilan** al llegar a su posición. El rebote elástico se percibe juguetón o amateur; la amortiguación crítica (`cubic-bezier(0.22, 1, 0.36, 1)` o resorte sin *overshoot*) transmite precisión, solidez y madurez de producto.
- **Contenedor Persistente (*Persistent Container*):** En lugar de hacer desaparecer una tarjeta con un barrido brusco para traer otro objeto distinto desde fuera de cuadro, Apple ancla un contenedor maestro en el centro visual y hace evolucionar suavemente su contenido interno (*layout continuity* con escalonamiento suave de `50ms a 80ms` entre jerarquías).
- **Aplicación directa a SaleListo v3:** Prohibir todo `spring` con rebote (`cos(w*t)`), todo `eBack` con sobreimpulso y todo temblor sinusoidal (`Math.sin`). Adoptar un único **Escenario / Tarjeta Maestra SaleListo** que permanece estable en coordenadas y lenguaje visual mientras su interior evoluciona con suavidad escena tras escena.

### 2.4. Stripe y Linear (Product Launch Videos B2B SaaS)
- **Estabilidad espacial que genera confianza empresarial:** El análisis de los videos de lanzamiento de Linear y Stripe demuestra que mantener la ventana o tarjeta principal en un espacio cartesiano fijo evita que el ojo del espectador tenga que "buscar dónde mirar" cada dos segundos. Esa quietud espacial comunica confiabilidad técnica inmediata.
- **Ritmo calmo y legible (*Calm Pacing*):** Sostienen cada estado interactivo un mínimo de `4.0s a 5.5s` con **una sola acción teleológica por escena** (cada movimiento existe únicamente para explicar un cambio de estado del sistema: escaneo confirmado, comanda dividida en dos renglones claros, bloque asignado, aviso de retiro listo).
- **Materialidad sobria:** Bordes finos de `1px` (`--line`), radios consistentes, píldoras semánticas armónicas y sombras difusas editoriales en lugar de resplandores neón saturados o bordes gruesos de `5px`.

### 2.5. Airbnb Product Releases y Uber Eats for Merchants (Spots de 30s)
- **Cadencia de 5 a 6 escenas en 30 segundos:** Los anuncios comerciales de 30 segundos orientados a anfitriones y comercios gastronómicos que logran mayor recordación de marca trabajan con **5 a 6 escenas amplias (`~4.8s` promedio)** unidas por fundidos cruzados suaves (*editorial crossfades* de `0.45s a 0.55s`), sin *whip-pans* ni cortes estroboscópicos.
- **Paneo cinematográfico lineal del `2% al 4%`:** El video de fondo se mueve con una deriva lineal casi imperceptible (`scale 1.00 -> 1.03` o desplazamiento suave de `8px a 14px` a lo largo de `5 segundos`), aportando vida cinematográfica sin marear ni competir con la lectura de la interfaz.

---

## 3. Matriz de Reglas de Oro para SaleListo v3 (`v2` Descartado -> `v3` Adoptado)

| Dimensión Audiovisual | Qué hacía `v2` (Causa de Rechazo) | Estándar Adoptado en `v3` (Inspirado en Referencias) |
|---|---|---|
| **Cantidad y duración de planos** | `14 cortes` hiperactivos (`1.5s a 2.2s`), imposibles de asimilar con calma. | **`6 escenas` amplias y serenas (`4.3s a 5.6s` cada una)** alineadas 1 a 1 con las ideas de la locución. |
| **Coherencia gráfica (Branding)** | `12 widgets` de estilos dispares (KDS negro, teléfono 3D, orbes neón, círculos oscuros, etcétera). | **1 sola Tarjeta Maestra SaleListo persistente** de principio a fin, con cabezal fijo de marca (`mark.svg`), misma tipografía, mismos radios y misma paleta oficial de `branding/sistema_de_marca.md`. |
| **Movimiento de cámara (B-Roll)** | Zooms bruscos del `9% al 12%` + `beat-punch` cada 4 pulsos + `split-screen` partido. | **Deriva lineal serena del `2.5% al 3.5%`** (`scale 1.01 -> 1.04` en `5s`), **cero `beat-punch`** y encuadre completo limpio con velo cálido constante. |
| **Transiciones entre escenas** | `whipL`, `whipR`, `whipU` con blur de `80px`, `zoom 1.7x` y barridos de pantalla completa. | **`Crossfade` editorial suave (`0.48s`) en el B-roll** mientras la Tarjeta Maestra permanece anclada y transiciona su vista interna con fundido y desplazamiento corto (`16px`, sin rebote). |
| **Física de animaciones UI** | Resortes elásticos saltarines (`spring` subamortiguado), `eBack` en cada palabra, sacudidas y ondas múltiples. | **Curva única sin rebote (`cubic-bezier(0.22, 1, 0.36, 1)`)**, duraciones pausadas (`0.45s a 0.65s`) y **1 sola micro-interacción clara por escena**. |
| **Titulares superiores** | 13 titulares saltando palabra por palabra con *stomp* elástico cada `1.7s`. | **5 titulares editoriales breves + cierre de marca**, entrando completos con deslizamiento suave de `14px` y opacidad progresiva (`0.45s`), legibles durante toda la escena. |
| **Diseño sonoro (SFX)** | `18 eventos SFX` incluyendo `glitch`, `impact_low`, múltiples `whoosh` y golpes fuertes. | **Locución continua intacta + groove musical suave (`-14 LUFS`) + solo 5 acentos sonoros sutiles y orgánicos** (`scan` suave, `pop` limpio, `ding` cálido de pase, `vibrate` sobrio y acorde limpio de cierre). |

---

## 4. Arquitectura Visual Común del Spot ("Un Solo Escenario de Marca")

Para cumplir estrictamente el pedido de **mantener una línea gráfica común durante todo el transcurso del video**, las escenas `E01` a `E05` comparten la misma estructura espacial sobre el lienzo `1080x1920`, desembocando con total naturalidad en la escena `E06` (cierre institucional sobre la misma paleta crema y carbón):

1. **Fondo cinematográfico unificado (`1080x1920`):**
   - Selección de 6 planos reales Full HD / HD de `video-ad/v2/broll/` (uno por escena, sin repetir clips ni partir la pantalla, todos con duración nativa holgada entre `9.4s` y `15.0s`).
   - Tratamiento cromático cálido idéntico en las 6 escenas + velo editorial constante `--scrim-warm: rgba(28, 25, 23, 0.46)` para garantizar contraste impecable sin cambios bruscos de tinte.
2. **Franja titular serena (`tercio superior`):**
   - Un único titular conciso por escena en `Plus Jakarta Sans` (`800`, `58px a 64px`, `line-height: 1.08`, `letter-spacing: -0.025em`), en crema `#faf7f2` con palabra clave puntual enfatizada con sobriedad en bermellón oficial `#d9412b` (cero cajas saltarinas y cero *stomp* elástico).
3. **Tarjeta Maestra SaleListo (`centro visual anclado`):**
   - Mismo contenedor editorial claro (`--surface: #ffffff`), borde fino (`1px solid #e6dfd3`), radio invariable (`24px`, equivalente óptico `1.5x` de `--radius-card: 16px`), sub-bloques internos `#faf7f2` / `#f3eee6` con radio `15px` y sombra difusa `--shadow-float` definidos en `branding/sistema_de_marca.md` y `branding/tokens.css`.
   - **Cabezal persistente de identidad (`Header`):** incluye siempre a la izquierda el isotipo oficial **Propuesta 01 · Pase Limpio** (`mark.svg`, squircle bermellón `#D9412B` con campana geométrica y tilde en `#FAF7F2`) (pauta de v3; en v4 el cabezal se eliminó) junto a `SaleListo` (`#1c1917`, `800`), y a la derecha una píldora semántica (`999px`) que actualiza el contexto operativo (`Salón en orden`, `Mesa T2 · Carta QR`, `Comanda automática`, `3 Bloques en equilibrio`, `Listo para llevar`).
   - **Cuerpo de acción única (`Body`):** dentro de ese mismo marco limpio ocurre **una sola demostración pausada por escena** con curva `cubic-bezier(0.22, 1, 0.36, 1)` (`450ms a 650ms`) y `3.0s a 4.0s` de reposo legible, usando los acentos oficiales (`#d9412b` bermellón, `#2f8a57` verde servicio, `#d97706` ámbar cocina y `#6d28d9` violeta barra).
4. **Cierre institucional cohesivo (`E06`):**
   - Fundido editorial sereno (`500ms`) hacia el lienzo cálido de marca (`--bg: #faf7f2` con velo `90%` sobre ambiente desenfocado sutil), presentando el nuevo logotipo vectorial completo (`logo.svg`, `viewBox="0 0 239 64"`), la píldora `0% comisión mensual` (`#fceae6` / `#d9412b`) y la tarjeta editorial limpia con los únicos datos de contacto oficiales (`(+54)1138436571` y `simonguerenu@gmail.com`).
