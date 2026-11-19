# Sistema de Marca y Diseño Unificado · SaleListo

Este documento establece la **única línea de diseño, identidad visual y movimiento** para todo el ecosistema **SaleListo**: Aplicación Web y Landing Comercial (`app/public/`), Dossier y Acuerdos Comerciales (`comercial/`), Kit de Marketing y Reels (`marketing/`), Documentación Técnica (`docs/`) y Spot Audiovisual (`video-ad/`). Ninguna pieza del proyecto puede introducir tipografías, paletas, estilos de tarjeta o físicas de animación por fuera de este sistema.

---

## 1. Esencia y Posicionamiento Visual

**SaleListo** es una plataforma gastronómica B2B/B2C que alivia la exigencia operativa de los mozos y ordena el salón en tiempo real: el cliente escanea el QR fijo de su mesa con su propio 4G/5G (sin pedir clave de Wi-Fi), la comanda viaja separada y automática hacia **Cocina**, **Barra** y **Mostrador**, el restaurante equilibra bloques y mesas en vivo, y el plantel se coordina **100% sin celulares en la mano**: ya sea desde la **Estación de Mozos fija en el pase** (con los teléfonos guardados en locker o caja) o mediante vibración háptica en **pulsera Xiaomi Smart Band por Bluetooth BLE** (con el teléfono guardado y bloqueado en el bolsillo del mozo, sin sacarlo jamás en el salón), avisando recién cuando hay algo listo para llevar o cuando una mesa solicita atención.

### Principio Rector: "Calma Operativa y Hospitalidad Editorial"
En un salón gastronómico en hora pico ya existe movimiento físico constante. Por eso, la identidad visual y cinética de **SaleListo** actúa como **ancla de serenidad, claridad y control** (inspirada en referentes globales como *Toast*, *Square for Restaurants*, *Linear* y *Stripe*):
- Superficies cálidas y luminosas en lugar de pantallas oscuras estresantes o saturadas.
- Una sola familia geométrica de contenedores y etiquetas en todas las vistas y escenas.
- Movimiento pausado, intencional y libre de sacudidas o rebotes elásticos.

---

## 2. Identidad Vectorial Oficial ("Pase Limpio")

Tras explorar y contrastar seis caminos conceptuales en `branding/propuestas_logos/` ([catalogo_logos.png](propuestas_logos/catalogo_logos.png)), la identidad oficial adoptada en todo el proyecto corresponde a la **Propuesta 01 · Pase Limpio**.

### 2.1. Activos Oficiales Canónicos
| Archivo | Aplicación | Especificación Técnica |
| :--- | :--- | :--- |
| [logo.svg](logo.svg) (`app/public/logo.svg`) | Portadas, cierres institucionales y cabeceras sobre fondos claros (`#faf7f2` o `#ffffff`) | `viewBox="0 0 239 64"` · Isotipo bermellón `#D9412B` (campana geométrica con corte en espacio negativo `#FAF7F2`) + wordmark **SaleListo** trazado 100% a curvas `<path>` en tinta carbón `#1C1917` con punto de la `i` en `#D9412B`. |
| [logo-dark.svg](logo-dark.svg) (`app/public/logo-dark.svg`) | Barras oscuras (`demo.html`), insignias oscuras y visores sobre cualquier fondo (incluido blanco `#ffffff` en GitHub) | `viewBox="0 0 274 96"` · Insignia oscura auto-contenida con placa redondeada `<rect width="274" height="96" rx="20" fill="#1C1917"/>` y margen óptico equilibrado alrededor del isotipo oficial y del wordmark en crema cálido `#FAF7F2` con punto de la `i` en `#D9412B`. |
| [mark.svg](mark.svg) (`app/public/mark.svg`) | Favicon (`24px`), barras laterales, tarjetas QR, cabezal de Comandera y símbolo central en Video Ad | `viewBox="0 0 64 64"` · Squircle continuo G2 en `#D9412B` con campana de pase minimalista esculpida en curvas `<path>` booleanas `#FAF7F2` y tilde ascendente a `45°` en espacio negativo, sin trazos ni parches externos. |

### 2.2. Fundamento y Reglas de Uso del Logo
1. **Significado estructural**: La campana de pase geométrica en `#FAF7F2` sobre el squircle bermellón `#D9412B` es atravesada en su hombro superior derecho por un tilde ascendente en espacio negativo, sintetizando el instante exacto en que el pedido sale listo desde Cocina o Barra hacia el salón (*"SaleListo"*).
2. **Independencia tipográfica y contraste garantizado**: El wordmark está convertido íntegramente a contornos vectoriales a partir de `Plus Jakarta Sans` (`Sale` en `700 Bold` + `Listo` en `800 ExtraBold`) con kerning óptico par por par. La variante `logo-dark.svg` incluye su propia placa carbón `#1C1917` (`rx="20"`) para impedir que la tipografía crema pierda contraste cuando el archivo se previsualiza sobre lienzos blancos.
3. **Integridad geométrica**:
   - **Prohibido** aplicar `border-radius` CSS pequeños sobre `<img src="mark.svg">` que recorten o deformen la curvatura squircle nativa del archivo vectorial.
   - **Área de resguardo mínima**: equivalente al `25%` del alto del isotipo alrededor de todo el bloque de marca.
   - **Prohibido** aplicar resplandores neón, sombras duras desplazadas, rotaciones o animaciones con rebote sobre el logotipo.

---

## 3. Paleta Cromática Maestra

Todos los productos y piezas audiovisuales utilizan exclusivamente los tokens definidos en [tokens.css](tokens.css).

### 3.1. Tokens Principales
| Token CSS | Valor Hex | Nombre de Marca | Rol en UI, Documentación y Video Ad |
| :--- | :--- | :--- | :--- |
| `--bg` | `#faf7f2` | **Crema Cálido** | Lienzo base de la aplicación, láminas de marca y fondo del cierre institucional en video. |
| `--surface` | `#ffffff` | **Superficie Pura** | Fondo principal de tarjetas operativas, modales y de la Tarjeta Maestra del spot. |
| `--surface-2` | `#f3eee6` | **Superficie Suave** | Agrupadores secundarios, sub-bloques internos de tarjeta, pasos y selectores pasivos. |
| `--line` | `#e6dfd3` | **Línea Editorial** | Único color de borde estructural fino (`1px solid`) y divisores internos. |
| `--ink` | `#1c1917` | **Tinta Carbón** | Tipografía principal de máxima legibilidad, botones activos neutros y barras oscuras. |
| `--ink-2` | `#57534e` | **Tinta Secundaria** | Subtítulos, descripciones de platos, etiquetas de campo y copy de apoyo. |
| `--accent` | `#d9412b` | **Bermellón SaleListo** | Acento primario de marca, CTA principal, estado *Nuevo / Cuenta* y punto focal de titulares. |
| `--ok` | `#2f8a57` | **Verde Servicio** | Confirmación operativa: *Listo para llevar*, *Mozo en turno* y *Pedido entregado*. |
| `--bar` | `#6d28d9` | **Violeta Barra** | Identificador exclusivo y consistente de la estación **Barra** (tragos, cafetería, bebidas). |
| `--kitchen` | `#d97706` | **Ámbar Cocina** | Identificador exclusivo y consistente de la estación **Cocina** y preparación en curso (`--warn`). |

### 3.2. Superficies Suaves de Píldoras Semánticas y Modo Oscuro KDS
- **Fondos semánticos suaves** (para chips y píldoras sin saturar la vista):
  - Bermellón suave `--accent-soft`: `#fceae6` (texto `#d9412b`)
  - Éxito suave `--ok-soft`: `#e3f3ea` (texto `#2f8a57`)
  - Barra suave `--bar-soft`: `#efeafe` (texto `#6d28d9`)
  - Cocina suave `--kitchen-soft`: `#fef1dc` (texto `#d97706`)
- **Superficies oscuras de alto contraste** (exclusivas para Comandera `cocina.html`, barra superior de `demo.html`, barra compacta del mozo y velos cálidos sobre B-roll):
  - Fondo carbón `--dark-bg`: `#1c1917`
  - Panel oscuro `--dark-surface`: `#26221f`
  - Borde oscuro `--dark-line`: `#38322e`
- **Proporción cromática obligatoria `75 / 18 / 7`**:
  - `75%` superficies luminosas y cálidas (`#faf7f2`, `#ffffff`, `#f3eee6`).
  - `18%` estructura tipográfica carbón (`#1c1917`, `#57534e`, `#e6dfd3`).
  - `7%` acentos semánticos con función informativa real (`#d9412b`, `#2f8a57`, `#6d28d9`, `#d97706`).

---

## 4. Sistema Tipográfico (`Plus Jakarta Sans`)

**Plus Jakarta Sans** es la única familia tipográfica permitida en todo el ecosistema (pesos `400`, `500`, `600`, `700` y `800`).

### 4.1. Jerarquía en Aplicación Web (`app/public/`)
- **Display / Portada (`--text-2xl`)**: `clamp(30px, 4.5vw, 44px)` · peso `800` · `line-height: 1.12` · `letter-spacing: -0.025em`.
- **Título de Vista (`--text-xl`)**: `24px` · peso `800` · `line-height: 1.18` · `letter-spacing: -0.02em`.
- **Encabezado de Bloque / Mesa (`--text-lg`)**: `20px` · peso `800` · `line-height: 1.2`.
- **Título de Tarjeta (`--text-md`)**: `17px` · peso `700` · `line-height: 1.25`.
- **Cuerpo Base (`--text-base`)**: `15px` · peso `400` / `500` / `600` · `line-height: 1.45`.
- **Metadato / Subtítulo (`--text-sm`)**: `13.5px` · peso `500` / `600` · color `--ink-2`.
- **Chip / Píldora (`--text-xs`)**: `12px` · peso `700` · `line-height: 1.2`.

### 4.2. Jerarquía Equivalente en Video Ad Vertical (`1080x1920`)
- **Titular Superior de Escena**: `58px a 64px` · peso `800` · `line-height: 1.08` · `letter-spacing: -0.025em` · máximo 2 líneas breves y directas sobre tercio superior limpio. Palabras clave puntuales en `#d9412b` (sobre fondo claro) o crema `#faf7f2` con subrayado/píldora sobria `#d9412b` (sobre velo cálido oscuro).
- **Cabezal de Tarjeta Maestra**: nombre `SaleListo` en `24px` (`800`, `#1c1917`) + píldora contextual derecha en `20px` (`700`).
- **Título Interno de Acción**: `30px a 32px` · peso `700` / `800` · `#1c1917`.
- **Líneas de Comanda / Detalle**: `23px a 25px` · peso `600` · `#57534e` y `#1c1917`.

---

## 5. Geometría, Elevación y Anatomía de Componentes

### 5.1. Radios y Sombras Invariables
1. **Tarjetas y contenedores principales**: `16px` (`--radius-card: 16px` en Web App; `24px` en escala `1.5x` para lienzo `1080x1920`).
2. **Controles, botones, campos y sub-tarjetas internas**: `10px` (`--radius-control: 10px` en Web App; `14px a 15px` en `1080x1920`).
3. **Chips, filtros de estado y píldoras**: `999px` (`--radius-pill: 999px`).
4. **Bordes y sombras**:
   - Preferir siempre borde editorial fino `1px solid #e6dfd3` acompañado de sombra cálida difusa `--shadow-card` (`0 1px 2px rgba(28, 25, 23, 0.04), 0 8px 24px -4px rgba(28, 25, 23, 0.06)`).
   - Para elementos flotantes sobre fotografía o video, emplear `--shadow-float` (`0 4px 12px rgba(28, 25, 23, 0.06), 0 20px 48px -8px rgba(28, 25, 23, 0.14)`).
   - **Prohibidos** los bordes negros gruesos, contornos dobles estridentes o sombras duras tipo cómic.

### 5.2. Anatomía de la "Tarjeta Maestra SaleListo" en el Video Ad
Para garantizar **una única línea gráfica común de principio a fin** en el spot audiovisual, todas las escenas demostrativas (`E01` a `E05`) deben ocurrir dentro de **una misma familia y estructura de Tarjeta Maestra flotante**, evitando crear widgets dispares en cada corte:

1. **Anclaje espacial estable**: centrada horizontalmente en el lienzo `1080x1920` (ancho recomendado `880px a 920px`), con superficie `#ffffff`, borde `1px solid #e6dfd3`, radio `24px` y sombra `--shadow-float`.
2. **Cabezal Fijo de Identidad (`Header`)**:
   - Izquierda: isotipo oficial `mark.svg` (`38px a 42px`, sin recortar su squircle) + texto `SaleListo` en `#1c1917` (`800`).
   - Derecha: una **píldora semántica (`999px`)** que actualiza con suavidad el contexto operativo de cada escena (por ejemplo: *Salón en orden*, *Mesa T2 · 4G*, *Comanda automática*, *3 Bloques en equilibrio*, *Listo para llevar*).
   - Separador inferior limpio de `1px solid #e6dfd3`.
3. **Cuerpo de Demostración Pausada (`Body`)**:
   - Utiliza exclusivamente sub-bloques `#faf7f2` o `#f3eee6` (`border-radius: 15px`, `border: 1px solid #e6dfd3`), chips oficiales (`Cocina` en `#fef1dc`/`#d97706`, `Barra` en `#efeafe`/`#6d28d9`, `Listo` en `#e3f3ea`/`#2f8a57`) y botones primarios en `#d9412b`.
   - Muestra **una sola acción clara y comprensible por escena**, manteniendo unidad visual absoluta desde el primer segundo hasta el cierre institucional (`E06`), donde el lienzo `#faf7f2` presenta [logo.svg](logo.svg), la píldora `0% comisión mensual` y el contacto directo.

---

## 6. Reglas de Movimiento Sobrio y Cohesivo (UI y Video Ad)

El lenguaje de movimiento de **SaleListo** refleja calma profesional, precisión y alivio operativo. Cualquier animación hiperactiva contradice el mensaje central del producto.

### 6.1. Prácticas Terminantemente Prohibidas
- **Cámara frenética**: prohibidos los *whip-pans* con desenfoque direccional (`whip-blur`), los barridos bruscos entre planos, los cortes hiperactivos de `1.5s` y las pantallas partidas caóticas.
- **Física elástica o saltarina**: prohibidos los resortes subamortiguados (`spring` con oscilación), las curvas con sobreimpulso (`overshoot`, `cubic-bezier` con valores superiores a `1.0` o funciones tipo `easeOutBack`) y cualquier rebote al aterrizar textos o tarjetas.
- **Efectos agresivos al ritmo musical**: prohibidos los flashes blancos/rojos, los golpes de zoom en cada beat (`beat-punch` / `zoom-punch`), los temblores artificiales (`shake` / `jitter` sinusoidal) y las aberraciones cromáticas (`glitch`).
- **Saturación simultánea**: prohibido disparar múltiples animaciones competidoras en el mismo segundo; el ojo del espectador debe tener un único foco claro por escena.

### 6.2. Parámetros Obligatorios de Motion
1. **Curva Maestra Única**:
   - Usar exclusivamente desaceleración suave con amortiguación crítica: `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease-out`).
   - Los elementos parten con respuesta limpia y se posan con serenidad milimétrica sin rebotar jamás.
2. **Ventana Temporal Serena (`450ms a 650ms`)**:
   - En Video Ad y transiciones estructurales: duraciones de **`450ms a 650ms`** (`0.45s a 0.65s`), dejando luego **`3.0s a 4.0s` de reposo legible** por escena para leer y asimilar la información sin apuro.
   - En controles interactivos de la Web App (hover/focus de botones y pestañas): `180ms` a `320ms` con la misma curva `cubic-bezier(0.22, 1, 0.36, 1)`.
3. **Cadencia y Cámara sobre B-Roll (`Video Ad`)**:
   - Estructura de **6 escenas amplias (`~4.5s a 5.5s` cada una)** en un spot de `~28s a 30s`.
   - Movimiento sobre B-rolls reales limitado a una **deriva lineal continua del `2.5% al 3.5%`** (`scale(1.00)` a `scale(1.03)` lineal durante toda la escena), con velo cálido constante (`rgba(28, 25, 23, 0.46)`) que asegure contraste uniforme.
   - Transición entre fondos B-roll mediante **`crossfade` editorial limpio de `450ms a 500ms`**, mientras la Tarjeta Maestra permanece anclada y renueva su estado interno con un deslizamiento vertical corto (`12px a 16px`) y opacidad progresiva.

---

## 7. Integridad Editorial y Datos Oficiales de Contacto

En todas las pantallas, documentos, piezas gráficas, tarjetas y cierres de video rigen sin excepción las siguientes normas editoriales:
1. **Teléfono y WhatsApp único e inalterable**: `(+54)1138436571` (escrito exactamente carácter por carácter: sin espacios, sin guiones y sin el dígito `9`; en enlaces `wa.me` se emplea únicamente `541138436571`).
2. **Correos electrónicos oficiales según contexto**:
   - **Piezas públicas comerciales de la marca SaleListo** (Landing Page B2B, Spot Oficial, Reels, Carruseles, Posts y Banners): se utiliza junto al WhatsApp `(+54)1138436571` el correo comercial **`ventas@salelisto.com`**.
   - **Firma personal de autor y prospección directa**: se mantiene **`simonguerenu@gmail.com`**.
3. **Cero enlaces inventados**: no incluir dominios web ficticios, perfiles sociales no verificados ni URLs externas inventadas.
4. **Puntuación limpia**: no utilizar el carácter de raya larga (`U+2014`); emplear dos puntos, punto y coma, coma o paréntesis según corresponda.
