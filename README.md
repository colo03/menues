# SaleListo

**Plataforma gastronómica B2B/B2C en tiempo real para pedidos por QR sobre 4G/5G (sin Wi-Fi), ruteo simultáneo a Cocina y Barra con semáforo SLA, coordinación de salón 100% sin celulares en mano (Estación de Mozos fija en el pase + opción de Pulsera Vibradora Xiaomi Band) y ecosistema comercial completo.**

SaleListo elimina los tiempos muertos en la mesa y alivia la exigencia física del personal de salón en horas pico, cuidando la presencia visual frente al comensal. Funciona al instante desde cualquier navegador sin descargar aplicaciones para el cliente, sin requerir clave de Wi-Fi y con **0% de comisión sobre las ventas del restaurante**.

---

## Pilares Principales

- **Landing Comercial B2B (`/`) y Hub Operativo (`/operacion.html`) desacoplados**:
  - **Portada Comercial B2B (`app/public/index.html`)**: diseñada para conversión de dueños y encargados gastronómicos con loops de video optimizados (`app/public/media/` servidos por `HTTP Range 206`), reproductor interactivo del Spot Oficial con control de audio, comparativa operativa, simulador de balanceo de bloques, sección dedicada a operación sin celulares, explorador de pantallas, **calculadora interactiva de ROI**, matriz de planes en **ARS/USD** y formulario real de solicitud de piloto conectado a **`POST /api/leads`**.
  - **Hub Operativo del Restaurante (`app/public/operacion.html`)**: punto de entrada interno para el personal del local con KPIs en vivo (mesas activas, comandas demoradas, retiros en pase, cobrado del día y leads comerciales nuevos), checklist diario de apertura de turno, QR de acceso rápido para TV/tablet y atajos directos a `pase.html`, `cocina.html`, `restaurante.html`, `mozo.html`, `cliente.html`, `qr.html` y `demo.html`.
- **Autogestión en mesa por 4G/5G con QR seguro, buscador y filtros dietarios**: Cada mesa posee un código QR vectorial propio con token fijo anti-spoofing (`cliente.html?t=...`). El comensal explora la carta con fotos reales, **buscador instantáneo tolerante a tildes** y **filtros rápidos combinables (`Populares`, `Sin TACC`, `Veggie`, `Picante`**, además de pastillas `Vegano` y `Sin alcohol`), envía su pedido, llama al mozo o solicita la cuenta indicando medio de pago y porcentaje de propina.
- **Separación directa Cocina / Barra y Semáforo SLA de demora**: Cada categoría dirige sus ítems automáticamente a **Cocina** o a **Barra** en el mismo segundo en que se confirma el pedido. Tanto la Comandera KDS (`cocina.html`) como la Estación de Pase (`pase.html`) y el Panel (`restaurante.html`) integran un **semáforo SLA visual y sonoro** legible a 3 o 4 metros (`🟢 En tiempo`, `🟠 Atención`, `🔴 Demorado`) con refresco liviano cada 15 segundos.
- **Operación 100% sin celulares en el salón (Estación de Mozos fija + Modo Pulsera)**:
  - **De serie en el Plan Base (`Estación de Mozos fija /pase.html`)**: una única pantalla o tablet horizontal en el mostrador del pase/barra dividida en columnas en vivo por cada mozo activo, con modo oscuro/claro, semáforo SLA, alerta sonora y carga rápida de pedidos en mostrador.
  - **Adicional para patios, terrazas o salones grandes (`Kit Pulseras Vibradoras Xiaomi Band`)**: mediante PWA instalable + Service Worker + Web Push nativo en segundo plano, el teléfono queda bloqueado en el bolsillo o en un locker cercano y el camarero recibe vibraciones directas en su muñeca con avisos compactos (`🍸 T2 · Retirar Barra`, `💳 M8 · Tarjeta $34.200`).
  - **Balanceo inteligente y continuidad de turno**: asignación híbrida (por bloque o automática por carga activa) y **reasignación automática inmediata** de mesas abiertas cuando un mozo corta turno.
- **Carta anti-inflación, exportación contable CSV y bandeja de Consultas (`Leads`)**: Alta de categorías, fotos reales y etiquetas dietarias (`items.tags`), pausa instantánea de agotados, ajuste porcentual masivo de precios (`+%`), arqueo de caja con propinas por mozo, **exportación contable directa para Excel Argentina (`GET /api/export/sessions.csv` en UTF-8 con BOM y `;`)** y pestaña **`📨 Consultas`** en el Panel para gestionar en tiempo real los leads recibidos desde la Landing Page.
- **Cero dependencias externas en el servidor**: Construido íntegramente sobre la biblioteca estándar de Python 3 (`http.server`, `sqlite3` en modo WAL, generador QR vectorial propio en `qrgen.py`, motor criptográfico Web Push RFC 8291/8292 en `webpush.py`, streaming parcial `HTTP 206` y exportador CSV), listo para correr en local o desplegarse en la nube sin instalar paquetes `pip`.

---

## Mapa del Repositorio

```text
.
├── app/                              # Aplicación web completa de SaleListo (Backend + Landing + Vistas + PWA)
│   ├── server.py                     # Servidor HTTP multihilo, API REST, Leads, CSV, Range 206, Web Push y SSE
│   ├── db.py                         # Motor transaccional SQLite WAL, balanceador, tags, leads, push y caja
│   ├── webpush.py                    # Motor Web Push RFC 8291 (aes128gcm) + VAPID RFC 8292 en Python puro
│   ├── qrgen.py                      # Generador propio de códigos QR vectoriales (SVG puro, sin CDNs)
│   ├── tests_e2e.py                  # Suite permanente de tests E2E en stdlib pura (DB temporal aislada)
│   ├── iniciar.bat                   # Lanzador directo en un clic para Windows
│   ├── PUBLICAR_EN_INTERNET.md       # Guía rápida de publicación cloud para operar con 4G/5G y HTTPS
│   ├── data/                         # Datos en ejecución (salelisto.db, vapid_keys.json y uploads/)
│   └── public/                       # Frontend responsivo, Landing B2B y PWA en HTML5, CSS3 y Vanilla JS
│       ├── index.html                # Landing Page Comercial B2B (loops, Spot, ROI, planes ARS/USD y leads)
│       ├── operacion.html            # Hub Operativo interno del restaurante con KPIs en vivo y accesos rápidos
│       ├── demo.html                 # Demo multipantalla con Simulador de Hora Pico en 1 clic paso a paso
│       ├── pase.html                 # Estación de Mozos fija por columnas con semáforo SLA (0 celulares)
│       ├── restaurante.html          # Panel del encargado (Salón, Mozos, Carta + tags, Caja CSV y Leads)
│       ├── mozo.html                 # PWA móvil del mozo con Modo Pulsera (Xiaomi Band), test push y carga
│       ├── cocina.html               # Comandera digital (KDS) por Cocina/Barra con semáforo SLA en vivo
│       ├── cliente.html              # Carta QR con buscador instantáneo y filtros (Sin TACC, Veggie, Picante)
│       ├── qr.html                   # Estudio de Impresión QR A4 (Tent-Card, Sticker, Tarjeta, Crema/Carbón y SVG)
│       ├── media/                    # 5 videos web H.264 faststart (4 loops + Spot) y 5 posters JPG optimizados
│       ├── css/ · js/                # Estilos modulares y lógica cliente (incluidos landing.css y landing.js)
│       ├── manifest.json · sw.js     # Manifiesto PWA instalable y Service Worker para Web Push nativo
│       ├── og-salelisto.svg          # Imagen Open Graph 1200x630 para previsualización social de la Landing
│       └── logo.svg · logo-dark.svg · mark.svg  # Identidad oficial (copia idéntica de branding/)
├── branding/                         # Sistema de marca unificado de SaleListo (fuente de verdad visual)
│   ├── sistema_de_marca.md           # Paleta, tipografía, radios, sombras, motion sobrio y reglas de contacto
│   ├── tokens.css                    # Tokens CSS compartidos por la app, la landing, el kit gráfico y los videos
│   ├── logo.svg · logo-dark.svg      # Logotipo horizontal oficial (Propuesta 01 · Pase Limpio), claro y oscuro
│   ├── mark.svg                      # Isotipo oficial 64x64 (favicon, cabezal de app y piezas audiovisuales)
│   └── propuestas_logos/             # Las 6 propuestas bocetadas en SVG, lámina comparativa y fundamentos
├── comercial/                        # Estrategia comercial, dossier ejecutivo A4, pricing y prospección B2B
│   ├── SaleListo_Dossier_Comercial.pdf # Dossier Comercial Ejecutivo A4 de 2 páginas listo para WhatsApp
│   ├── brochure_b2b.html             # Fuente HTML/CSS A4 imprimible autónoma del Dossier Comercial
│   ├── modelo_de_negocios.md         # Unit economics, Plan Base (Pase fijo) + Kit Pulseras Xiaomi Band
│   ├── propuestas_restaurantes.md    # Playbook comercial, ICPs, objeciones y 26 prospectos reales
│   └── prospectos_restaurantes.csv   # Base estructurada de prospectos gastronómicos
├── marketing/                        # Fábrica completa de contenidos B2B lista para publicar (27 PNGs + 5 Reels)
│   ├── README.md                     # Inventario de piezas, sistema gráfico y guía de re-exportación
│   ├── calendario_redes_30dias.md    # Plan editorial de 30 días, 20 copys y estructura de pauta Meta Ads
│   ├── guiones_reels.md              # Escaletas de los 5 Reels producidos + 5 guiones de rodaje en salón real
│   ├── reels/                        # 5 Reels verticales MP4 (1080x1920, 60 fps, voz ElevenLabs) + src/
│   ├── posts/                        # 3 carruseles de 5 slides (1080x1350) + 4 posts individuales de feed
│   ├── banners/                      # 8 banners multicanal (Web, Display, LinkedIn, Meta Ads y WhatsApp)
│   └── src_grafica/                  # Plantillas editables HTML/CSS/JS, galería y exportador PNG Headless
├── video-ad/                         # Spot publicitario vertical oficial (1080x1920, 60 fps) y pipeline v2
│   ├── SaleListo_Ad.mp4              # Spot Oficial (<=5 palabras/escena, Pase + Pulsera, -14 LUFS)
│   ├── locucion_argentina.mp3        # Toma continua original en español argentino (ElevenLabs)
│   ├── guion.md                      # Guion creativo v5 y escaleta de 6 escenas (E01 a E06)
│   ├── referencias_ads.md            # Relevamiento de referencias Gastro-Tech y Motion SaaS
│   └── v2/                           # Motor programático de composición HTML/JS, audio y codificación
├── docs/                             # Documentación técnica y evolución de producto
│   ├── arquitectura_salelisto.md     # Diseño del sistema, API, SLA, Leads, CSV, Range 206 y Web Push
│   ├── mejoras_producto_ux.md        # Diagnóstico UX operativo, mejoras implementadas y hoja de ruta
│   └── auditoria_inicial_beta.md     # Diagnóstico histórico del prototipo inicial y resolución de bugs
├── render.yaml                       # Blueprint de despliegue directo en Render desde la raíz del repo
└── Procfile                          # Comando de arranque web para plataformas cloud (Railway / Render)
```

---

## Ejecución Local Rápida

### Requisitos
- **Python 3.10 o superior** (no requiere `pip install` ni paquetes de terceros).

### Iniciar el servidor

Desde la raíz del repositorio:

```bash
python app/server.py
```

O en Windows, haciendo doble clic sobre [`app/iniciar.bat`](./app/iniciar.bat).

*(Opcional: para correr la suite completa de tests E2E automáticos sobre una base temporal aislada, ejecutar `python app/tests_e2e.py`; para la autoverificación criptográfica de Web Push P-256 + AES-128-GCM + RFC 8291, correr `python app/webpush.py`).*

Al iniciar por primera vez, el servidor crea y puebla automáticamente `app/data/salelisto.db` con bloques, mesas, mozos y carta de demostración (incluidas las etiquetas dietarias iniciales) listos para probar, junto con las claves VAPID locales en `app/data/vapid_keys.json`.

### Vistas Disponibles (`http://localhost:8123`)

| Vista | Ruta | Rol / Uso |
| :--- | :--- | :--- |
| **Landing Comercial B2B** | [`/`](http://localhost:8123/) | Portada pública con videos loop, Spot Oficial, explorador, calculadora de ROI, planes ARS/USD y formulario de piloto (`POST /api/leads`). |
| **Hub Operativo del Local** | [`/operacion.html`](http://localhost:8123/operacion.html) | Tablero interno del restaurante con KPIs en vivo, checklist de apertura, QR para TV y accesos a todas las vistas operativas. |
| **Modo Demo Multipantalla** | [`/demo.html`](http://localhost:8123/demo.html) | Demo interactiva con **`⚡ Simular Hora Pico`** en 1 clic paso a paso (Cliente + Estación de Mozos + Cocina/Barra + Mozo + Encargado). |
| **Estación de Mozos (Pase)** | [`/pase.html`](http://localhost:8123/pase.html) | Pantalla fija en mostrador/barra con columnas por mozo activo, semáforo SLA y carga rápida *(0 celulares en salón)*. |
| **Panel del Restaurante** | [`/restaurante.html`](http://localhost:8123/restaurante.html) | Gestión de salón, bloques, mozos, carta con tags dietarios, comandas SLA, arqueo CSV y bandeja de Consultas (`Leads`) *(PIN inicial: `1234`)*. |
| **PWA Mozo / Modo Pulsera** | [`/mozo.html`](http://localhost:8123/mozo.html) | Configuración de **Modo Pulsera Xiaomi Band** (Web Push con pantalla bloqueada), alertas y pedidos manuales. |
| **Pantalla Cocina y Barra** | [`/cocina.html`](http://localhost:8123/cocina.html) | Tablero KDS en tiempo real por estación (`Cocina`, `Barra` o `Ambos`) con semáforo SLA visual y sonoro. |
| **Vista del Comensal** | `/cliente.html?t=<token>` | Carta QR por mesa con buscador instantáneo y filtros dietarios (`Populares`, `Sin TACC`, `Veggie`, `Picante`). |
| **Estudio de Impresión QR** | [`/qr.html`](http://localhost:8123/qr.html) | Estudio de impresión A4 calibrado en mm (`Tent-Card 10x15 cm`, `Sticker 8x8 cm`, `Tarjeta Compacta`, estilo Crema/Carbón, filtro por bloque y descarga `.svg` individual). |

*(Para usar otro puerto local, pasar el número como argumento: `python app/server.py 9000` o definir la variable de entorno `PORT`).*

---

## Despliegue en la Nube (Operación Real con 4G/5G y Web Push HTTPS)

El repositorio está preparado en su raíz para publicarse directamente con HTTPS de modo que los prospectos naveguen la Landing B2B en `/`, los comensales escaneen los QRs usando sus propios datos móviles y los teléfonos vinculados a pulseras Xiaomi Band reciban notificaciones Web Push en segundo plano:

1. Subí este repositorio a tu cuenta de **GitHub**.
2. En **Render.com** (o **Railway.app**), creá un nuevo servicio web o Blueprint conectado al repositorio:
   - [`render.yaml`](./render.yaml) define automáticamente `rootDir: app` y `startCommand: python server.py`.
   - [`Procfile`](./Procfile) define `web: python app/server.py`.
3. Una vez publicado el enlace seguro (`https://<tu-servicio>.onrender.com`), ingresá a `/operacion.html` o `/restaurante.html`:
   - Cambiá el PIN de administrador inicial (`1234`) en **Caja y Ajustes**.
   - Desactivá el *Modo Demo* para exigir sesión con PIN en las vistas de personal y proteger el arqueo CSV y la bandeja de leads.
   - Cargá tu plano de bloques, tus mozos y tu carta real con sus etiquetas dietarias.
4. Abrí `/pase.html` en la pantalla horizontal del mostrador/barra (o vinculá las pulseras desde `/mozo.html` en versión HTTPS) e imprimí los códigos QR definitivos desde `/qr.html`.

Más detalles en [`app/PUBLICAR_EN_INTERNET.md`](./app/PUBLICAR_EN_INTERNET.md), [`docs/arquitectura_salelisto.md`](./docs/arquitectura_salelisto.md) y [`docs/mejoras_producto_ux.md`](./docs/mejoras_producto_ux.md).

---

## Identidad Visual y Sistema de Marca

- **Sistema unificado ([`branding/`](./branding/sistema_de_marca.md))**: Una sola línea gráfica para la app web, la Landing Comercial, el pack de marketing y los videos. [`sistema_de_marca.md`](./branding/sistema_de_marca.md) documenta la paleta maestra (crema `#faf7f2`, tinta `#1c1917`, bermellón `#d9412b`, verde `#2f8a57`, Barra `#6d28d9`, Cocina `#d97706`), la tipografía `Plus Jakarta Sans`, radios, sombras, el motion sobrio con curva única `cubic-bezier(0.22, 1, 0.36, 1)` sin rebote y los criterios oficiales de contacto. Los mismos valores viven como variables en [`tokens.css`](./branding/tokens.css).
- **Logo oficial (Propuesta 01 · Pase Limpio)**: Campana de pase geométrica con tilde ascendente en espacio negativo sobre squircle bermellón, más el wordmark **SaleListo** trazado a curvas (y variante `logo-dark.svg` con placa redondeada oscura `#1C1917` propia para contraste total sobre fondos blancos u oscuros). Los archivos [`logo.svg`](./branding/logo.svg), [`logo-dark.svg`](./branding/logo-dark.svg) y [`mark.svg`](./branding/mark.svg) son idénticos byte a byte en `branding/`, `app/public/` y `video-ad/v2/assets/`.
- **Exploración de logos ([`branding/propuestas_logos/`](./branding/propuestas_logos/README.md))**: Las 6 propuestas bocetadas en SVG (logo + isotipo de cada una), con la lámina comparativa [`catalogo_logos.png`](./branding/propuestas_logos/catalogo_logos.png) en fondo claro, oscuro y favicon de 24 px.

---

## Estrategia Comercial, Fábrica de Contenidos B2B y Videos

- **Estrategia, Dossier A4 y Prospección B2B ([`comercial/`](./comercial/))**: Incluye el **Dossier Comercial Ejecutivo A4 de 2 páginas** listo para enviar por WhatsApp o imprimir ([`SaleListo_Dossier_Comercial.pdf`](./comercial/SaleListo_Dossier_Comercial.pdf) y fuente editable [`brochure_b2b.html`](./comercial/brochure_b2b.html)), el modelo financiero y matriz de planes SaaS (**Plan Base con Estación de Mozos fija + Adicional Kit Pulseras Vibradoras Xiaomi Band**) con piloto sin riesgo de 14 días en [`modelo_de_negocios.md`](./comercial/modelo_de_negocios.md), junto con el playbook comercial, manejo de objeciones y propuestas personalizadas para 26 locales reales en [`propuestas_restaurantes.md`](./comercial/propuestas_restaurantes.md) y [`prospectos_restaurantes.csv`](./comercial/prospectos_restaurantes.csv).
- **Kit Integral de Marketing y Redes ([`marketing/`](./marketing/README.md))**: Fábrica completa de contenidos B2B lista para pauta y publicación orgánica (**27 PNGs gráficos + 5 Reels verticales**):
  - **5 Reels verticales MP4 (`1080x1920`, `60 fps`, `-14 LUFS`)** en [`marketing/reels/`](./marketing/reels/) con locución continua en español rioplatense generada con ElevenLabs (`Reel_01_Sin_Celulares_En_Salon.mp4`, `Reel_02_Segundas_Rondas_Terraza.mp4`, `Reel_03_Cero_Comision_Precios_Al_Dia.mp4`, `Reel_04_Cobrar_En_Un_Viaje.mp4` y `Reel_05_Piloto_14_Dias_Un_Sector.mp4`) y motor reproducible en `marketing/reels/src/`.
  - **3 carruseles de 5 slides (`1080x1350`)** y **4 posts individuales de feed (`1080x1350`)** en [`marketing/posts/`](./marketing/posts/).
  - **8 banners multicanal al píxel exacto** en [`marketing/banners/`](./marketing/banners/) (Web `1920x600`, Display `728x90` y `300x250`, LinkedIn portada y post, Meta Ads Feed y Story, y catálogo de WhatsApp Business).
  - **Plantillas editables y exportador automatizado** en [`marketing/src_grafica/`](./marketing/src_grafica/), guiones de los 5 Reels y rodaje en salón real en [`guiones_reels.md`](./marketing/guiones_reels.md) y plan de 30 días con 20 copys + estructura de campañas Meta Ads en [`calendario_redes_30dias.md`](./marketing/calendario_redes_30dias.md).
- **Spot Audiovisual Oficial ([`video-ad/`](./video-ad/README.md))**: Incluye [`SaleListo_Ad.mp4`](./video-ad/SaleListo_Ad.mp4) (`1080x1920`, `60 fps`, `-14 LUFS`, máximo 5 palabras en pantalla por escena, Escena 5 dedicada a **`Sin celulares`: `Pase` + `Pulsera`** y cierre institucional con `0% comisión`, `(+54)1138436571` y `ventas@salelisto.com`), la locución continua [`locucion_argentina.mp3`](./video-ad/locucion_argentina.mp3), el guion técnico [`guion.md`](./video-ad/guion.md) y el pipeline en [`video-ad/v2/`](./video-ad/v2/README.md).

---

## Autor y Contacto

**Simón Martínez de Guereñu**  
- **WhatsApp / Teléfono:** `(+54)1138436571`  
- **Correo electrónico (autor y prospección directa):** `simonguerenu@gmail.com`  
- **Correo comercial en piezas de marca (Landing, Spot, Reels, Posts y Banners):** `ventas@salelisto.com`
