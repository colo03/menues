# SaleListo

**Plataforma gastronómica B2B/B2C en tiempo real para pedidos por QR directo desde la mesa (sin apps ni registros), ruteo simultáneo en 3 estaciones (`Cocina`, `Barra` y `Mostrador`) con semáforo SLA, coordinación de salón 100% sin celulares en mano (Estación de Mozos fija en el pase + opción de Pulsera Vibradora Xiaomi Band por Bluetooth BLE) y ecosistema comercial completo.**

SaleListo elimina los tiempos muertos en la mesa y alivia la exigencia física del personal de salón en horas pico con un enfoque **100% pro-equipo**, cuidando la presencia visual frente al comensal y conviviendo con el facturador fiscal ARCA actual del restaurante. Funciona al instante desde la cámara de cualquier teléfono sin descargar aplicaciones ni registrarse, sin permanencia mínima y con **0% de comisión sobre las ventas**.

---

## Pilares Principales

- **Landing Comercial B2B (`/`) y Hub Operativo (`/operacion.html`) desacoplados y seguros**:
  - **Portada Comercial B2B (`app/public/index.html`)**: orientada a dueños y encargados gastronómicos con loops de video optimizados (`app/public/media/` servidos por `HTTP Range 206`), reproductor interactivo del Spot Oficial, comparativa operativa, simulador de bloques, sección de operación sin celulares, acceso directo al Panel en rol aislado `demo_admin` (`restaurante.html?demo=1`), **calculadora interactiva de ROI con enlaces compartibles (`?mesas=&ticket=&turnos=#roi`)**, matriz transparente de planes en **ARS/USD** y formulario del **Piloto de 14 días** conectado a **`POST /api/leads`** con botón directo a WhatsApp seguro en móviles.
  - **Hub Operativo del Restaurante (`app/public/operacion.html`)**: tablero interno conectado por **SSE en tiempo real** con KPIs vivos (mesas activas, comandas demoradas, retiros en pase y recaudación del turno vigente desde las `06:00 AM ART`), checklist diario de apertura, QR rápido para TV/tablet y accesos a todas las vistas operativas.
- **Autogestión en mesa por QR fijo con Calculadora "Vaquita", Vuelto Exacto y Repetir Ronda**: Cada mesa posee un código QR vectorial propio con token fijo anti-spoofing (`/q/<token>` y `cliente.html?t=...`, hasta Versión 10). El comensal escanea directo con la cámara, explora la carta con fotos reales, **buscador tolerante a tildes**, **filtros rápidos combinables (`Populares`, `Sin TACC`, `Veggie`, `Picante`**, más pastillas `Vegano` y `Sin alcohol`), repite rondas en 1 toque (`🔄 Repetir`), llama al mozo indicando motivo y solicita la cuenta con **Calculadora "Vaquita" (`÷ N` personas)**, propina y **declaración de efectivo con cálculo automático de vuelto** para cobrar en un solo viaje.
- **Ruteo simultáneo en 3 Estaciones Reales (`Cocina`, `Barra` y `Mostrador`), Agotados 86 y Semáforo SLA**: Cada categoría o plato dirige sus ítems automáticamente a **Cocina**, **Barra** o **Mostrador** (sushi, parrilla exterior o vitrina de pastelería) en el mismo segundo en que se envía el pedido. La Comandera KDS (`cocina.html`) incluye cajón rápido **`🚫 Agotados`** para pausar platos en 1 toque, *Screen Wake Lock* y **semáforo SLA visual y sonoro** legible a 3 o 4 metros (`🟢 En tiempo`, `🟠 Atención`, `🔴 Demorado`).
- **Operación 100% sin celulares en el salón (física exacta de las dos modalidades)**:
  - **De serie desde el Plan Base (`Estación de Mozos fija /pase.html`)**: una única pantalla o tablet horizontal en el mostrador del pase/barra dividida en columnas por cada mozo activo, con **filtro por sector (`?bloque=`)**, compactación automática de mozos al día en salones grandes (`>= 4` columnas), **confirmación directa en 1 toque (`✔ Atendido` y `✔ Cobrar y cerrar`)**, cobro con detalle completo y vuelto exacto, actualización `tickSla()` no destructiva, *Screen Wake Lock* y carga rápida de pedidos. **Los teléfonos personales del personal quedan guardados en locker o caja.**
  - **Adicional compatible con los 3 planes (`Kit Pulseras Vibradoras Xiaomi Band`)**: mediante PWA instalable (con íconos raster `180/192/512`) + Service Worker + Web Push cifrado en segundo plano y enlace **Bluetooth Low Energy (BLE)**, el teléfono va **guardado y con pantalla bloqueada en el bolsillo del camarero** (jamás se saca en el salón) y la muñeca vibra al instante mostrando avisos compactos (`🍸 T2 · Retirar Barra`, `💳 M8 · Efectivo c/$50k`).
  - **Balanceo híbrido y continuidad de turno**: asignación fija por bloque o automática por carga activa y **reasignación automática inmediata** cuando un mozo corta turno.
- **Carta anti-inflación reversible, integridad contable CSV (`06:00 AM ART`) y privacidad de Leads**: Ajuste porcentual masivo de precios con **Vista Previa Antes/Después (redondeo limpio a `$100`) y botón `↩ Deshacer`**, baja lógica contable (`archived = 1`) que preserva ventas históricas al borrar mesas o bloques, **exportación CSV directa para Excel Argentina (`GET /api/export/sessions.csv` en UTF-8 con BOM y `;`)** con corte de turno gastronómico a las `06:00 AM ART` (`UTC-3`), y aislamiento estricto de PII comercial en **`📨 Consultas`** (rol `demo_admin` aislado y entrega de leads reales exclusivamente al rol `admin` autenticado).
- **Cero dependencias externas en el servidor**: Construido al 100% sobre la biblioteca estándar de Python 3 (`http.server`, `sqlite3` en modo WAL con persistencia monotónica `db.version` + `SERVER_SECRET` + `staff_sessions`, `/api/qrs` autenticado en prod, `qrgen.py` SVG Versión 10 de `271` bytes, `webpush.py` RFC 8291/8292 endurecido con Anti-Blind-SSRF, disco persistente en `render.yaml`, `HTTP 206` y `/api/health`), sin instalar paquetes `pip`.

---

## Mapa del Repositorio

```text
.
├── app/                              # Aplicación web completa de SaleListo (Backend + Landing + Vistas + PWA)
│   ├── server.py                     # Servidor HTTP endurecido, scopes SSE, Leads, CSV, Range 206, Push y Health
│   ├── db.py                         # Motor SQLite WAL, corte 06:00 ART, 3 estaciones, Vaquita/vuelto y baja lógica
│   ├── webpush.py                    # Motor Web Push RFC 8291 (aes128gcm) + VAPID RFC 8292 + Anti-SSRF en stdlib
│   ├── qrgen.py                      # Generador propio de códigos QR vectoriales SVG (Versión 1 a 10, 271 bytes)
│   ├── tests_e2e.py                  # Suite permanente de tests E2E en stdlib pura (DB temporal aislada)
│   ├── iniciar.bat                   # Lanzador directo en un clic para Windows
│   ├── PUBLICAR_EN_INTERNET.md       # Guía rápida de publicación cloud con disco persistente y HTTPS
│   ├── render.yaml                   # Blueprint local de despliegue cloud con volumen persistente /var/data
│   ├── data/                         # Datos en ejecución (salelisto.db, vapid_keys.json, server_secret.key, uploads/)
│   └── public/                       # Frontend responsivo, Landing B2B y PWA en HTML5, CSS3 y Vanilla JS
│       ├── index.html                # Landing Comercial B2B (loops, Spot, ROI compartible, planes ARS/USD y leads)
│       ├── operacion.html            # Hub Operativo interno conectado por SSE en vivo, checklist y QR para TV
│       ├── demo.html                 # Demo multipantalla con Simulador de Hora Pico en 1 clic paso a paso
│       ├── pase.html                 # Estación de Mozos fija por columnas + filtro por bloque (celulares en locker)
│       ├── restaurante.html          # Panel del encargado (Salón, Mozos, 3 Estaciones, Inflación Undo, CSV y Leads)
│       ├── mozo.html                 # PWA móvil del mozo con Modo Pulsera BLE (Xiaomi Band), test push y carga
│       ├── cocina.html               # Comandera KDS en 3 estaciones (Cocina/Barra/Mostrador) + Agotados 86 + SLA
│       ├── cliente.html              # Carta QR interactiva con buscador, filtros, Repetir ronda, Vaquita y vuelto exacto
│       ├── qr.html                   # Estudio de Impresión QR A4 (Tent-Card, Sticker, Tarjeta, Crema/Carbón y SVG)
│       ├── media/                    # 5 videos web H.264 faststart (4 loops + Spot) y 5 posters JPG optimizados
│       ├── css/ · js/                # Estilos modulares y lógica cliente (incluidos landing.css y landing.js)
│       ├── manifest.json · sw.js     # Manifiesto PWA instalable y Service Worker para Web Push nativo
│       ├── icon-180.png · icon-192.png · icon-512.png  # Íconos raster PWA (Android/iOS) desde mark.svg
│       ├── og-salelisto.svg          # Imagen Open Graph 1200x630 para previsualización social de la Landing
│       └── logo.svg · logo-dark.svg · mark.svg  # Identidad oficial (copia idéntica de branding/)
├── branding/                         # Sistema de marca unificado de SaleListo (fuente de verdad visual)
│   ├── sistema_de_marca.md           # Paleta, tipografía, radios, sombras, motion sobrio y reglas de contacto
│   ├── tokens.css                    # Tokens CSS compartidos por la app, la landing, el kit gráfico y los videos
│   ├── logo.svg · logo-dark.svg      # Logotipo horizontal oficial (Propuesta 01 · Pase Limpio), claro y oscuro
│   ├── mark.svg                      # Isotipo oficial 64x64 (favicon, cabezal de app y piezas audiovisuales)
│   └── propuestas_logos/             # Las 6 propuestas bocetadas en SVG, lámina comparativa y fundamentos
├── comercial/                        # Estrategia comercial, deck interactivo, dossier A4, piloto 14d y prospección
│   ├── presentacion_interactiva.html # Deck comercial interactivo de 10 láminas + notas [N] + simuladores en vivo
│   ├── SaleListo_Dossier_Comercial.pdf # Dossier Comercial Ejecutivo A4 (2 páginas exactas) listo para WhatsApp
│   ├── brochure_b2b.html             # Fuente HTML/CSS A4 imprimible autónoma del Dossier Comercial
│   ├── SaleListo_Acuerdo_Piloto_14d.pdf # Acuerdo Simple de Piloto 14 Días + Comodato BLE (1 página A4 exacta)
│   ├── acuerdo_piloto_14_dias.md     # Versión editable Markdown del acuerdo de piloto de 14 días sin riesgo
│   ├── plantilla_carga_carta.csv     # Planilla modelo Excel/Sheets para onboarding llave en mano en 48 horas
│   ├── modelo_de_negocios.md         # Unit economics, ROI exacto, OPEX escalonado, 12 objeciones y checklist MX
│   ├── propuestas_restaurantes.md    # Playbook outbound (DMs <=35 palabras), guion inbound (<15 min) y 26 locales
│   ├── mensajes_personalizados_26_locales.md # Prospección personalizada 1 a 1 para los 26 locales (DM + correo + #roi)
│   └── prospectos_restaurantes.csv   # Base estructurada de 26 prospectos gastronómicos verificados en CABA/GBA
├── marketing/                        # Fábrica completa de contenidos B2B (33 PNGs + 3 PDFs LinkedIn + 5 Reels MP4)
│   ├── README.md                     # Inventario de piezas, sistema gráfico y guía de re-exportación
│   ├── calendario_redes_30dias.md    # Plan editorial cronológico de 30 días (Copy #01-#20) y campaña Meta Ads
│   ├── guiones_reels.md              # Escaletas de los 5 Reels producidos + 5 guiones de rodaje en salón real
│   ├── reels/                        # 5 Reels verticales MP4 (1080x1920, 60 fps, voz ElevenLabs) + src/
│   ├── posts/                        # 3 carruseles (15 PNGs + 3 PDFs nativos para LinkedIn) + 4 posts individuales
│   ├── stories/                      # 6 Historias verticales (1080x1920) con zonas seguras libres (260px/315px)
│   ├── banners/                      # 8 banners multicanal (Web, Display, LinkedIn, Meta Ads y WhatsApp)
│   └── src_grafica/                  # Plantillas editables HTML/CSS/JS, galería y exportador PNG/PDF Headless
├── video-ad/                         # Spot publicitario vertical oficial (1080x1920, 60 fps), v2 y pipeline Omni
│   ├── SaleListo_Ad.mp4              # Spot Oficial v5 (<=5 palabras/escena, Pase + Pulsera, -14 LUFS)
│   ├── generar_ad_omni.py            # Pipeline open-ended hacia Gemini Omni 1.2 Flash (Google Flow Ultra / CDP)
│   ├── locucion_argentina.mp3        # Toma continua original en español argentino (ElevenLabs)
│   ├── guion.md                      # Guion creativo v5 y escaleta de 6 escenas (E01 a E06)
│   ├── referencias_ads.md            # Relevamiento de referencias Gastro-Tech y Motion SaaS
│   └── v2/                           # Motor programático de composición HTML/JS, audio y codificación
├── docs/                             # Documentación de arquitectura, producto y auditoría EGM
│   ├── goldfish_review_report.md     # Informe oficial de auditoría y resolución Elephant-Goldfish Model (EGM)
│   ├── arquitectura_salelisto.md     # Diseño del sistema, seguridad, 3 estaciones, SLA, Leads, CSV y Web Push
│   ├── mejoras_producto_ux.md        # Evolución UX/TRIZ (Oleadas 1 a 4), suite E2E y Roadmap Fase 2-3
│   └── auditoria_inicial_beta.md     # Diagnóstico histórico del prototipo inicial y resolución de bugs
├── render.yaml                       # Blueprint cloud en Render con disco persistente /var/data y TZ Argentina
└── Procfile                          # Comando de arranque web para plataformas cloud (Railway / Render)
```

---

## Ejecución Local Rápida

### Requisitos
- **Python 3.10 o superior** (cero dependencias externas de `pip`).

### Iniciar el servidor

Desde la raíz del repositorio:

```bash
python app/server.py
```

O en Windows, haciendo doble clic sobre [`app/iniciar.bat`](./app/iniciar.bat).

*(Para correr la suite completa de tests E2E automáticos sobre una base temporal aislada, ejecutar `python -B app/tests_e2e.py`; para la autoverificación criptográfica de Web Push P-256 + AES-128-GCM + RFC 8291, correr `python app/webpush.py`).*

### Vistas Disponibles (`http://localhost:8123`)

| Vista | Ruta | Rol / Uso |
| :--- | :--- | :--- |
| **Landing Comercial B2B** | [`/`](http://localhost:8123/) | Portada pública con videos loop, Spot Oficial, explorador, calculadora ROI compartible, planes ARS/USD y formulario de piloto (`POST /api/leads`). |
| **Hub Operativo del Local** | [`/operacion.html`](http://localhost:8123/operacion.html) | Tablero interno conectado por SSE en vivo con KPIs del turno (`06:00 AM ART`), checklist diario, QR para TV y accesos operativos. |
| **Modo Demo Multipantalla** | [`/demo.html`](http://localhost:8123/demo.html) | Demo interactiva con **`⚡ Simular Hora Pico`** en 1 clic paso a paso y limpieza no destructiva de sesiones abiertas. |
| **Estación de Mozos (Pase)** | [`/pase.html`](http://localhost:8123/pase.html) | Pantalla fija en mostrador/barra filtrable por bloque (`?bloque=`), confirmación directa en 1 toque y cobro con vuelto exacto *(celulares en locker)*. |
| **Panel del Restaurante** | [`/restaurante.html`](http://localhost:8123/restaurante.html) | Gestión de salón, mozos, carta con 3 estaciones y tags, ajuste % con deshacer, arqueo CSV y bandeja privada `#consultas` *(PIN inicial: `1234`)*. |
| **PWA Mozo / Modo Pulsera** | [`/mozo.html`](http://localhost:8123/mozo.html) | Configuración de **Modo Pulsera Xiaomi Band** por Bluetooth BLE *(celular bloqueado en bolsillo)*, alertas y carga manual por categorías. |
| **Comandera 3 Estaciones** | [`/cocina.html`](http://localhost:8123/cocina.html) | Tablero KDS en tiempo real (`Cocina`, `Barra`, `Mostrador` o `Todo`) con cajón rápido **`🚫 Agotados`** y semáforo SLA. |
| **Vista del Comensal** | `/cliente.html?t=<token>` | Carta QR interactiva con buscador, filtros dietarios, botón Repetir ronda, calculadora *Vaquita* y declaración de vuelto en efectivo. |
| **Estudio de Impresión QR** | [`/qr.html`](http://localhost:8123/qr.html) | Estudio A4 calibrado en mm (`Tent-Card 10x15 cm`, `Sticker 8x8 cm`, `Tarjeta Compacta`, estilos Crema/Carbón, descarga `.svg` y PIN en prod). |
| **Monitoreo de Salud** | [`/api/health`](http://localhost:8123/api/health) | Endpoint JSON liviano (`{"ok": true, "version": ..., "subscribers": ...}`) para observabilidad cloud. |

---

## Despliegue en la Nube (Persistencia NVMe y Web Push HTTPS)

1. Subí este repositorio a tu cuenta de **GitHub**.
2. En **Render.com** (o **Railway.app**), creá un servicio web o Blueprint conectado al repositorio:
   - [`render.yaml`](./render.yaml) configura automáticamente `rootDir: app`, `startCommand: python server.py`, disco persistente `1 GB` en `/var/data` (`DATA_DIR=/var/data`) y `TZ=America/Argentina/Buenos_Aires`.
   - Opcionalmente definí `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en variables de entorno para respaldo externo de suscripciones Push.
3. Ingresá a `/restaurante.html` en tu URL HTTPS:
   - Cambiá el PIN de administrador inicial (`1234`) en **Caja y Ajustes**.
   - Desactivá el *Modo Demo* (`demoMode = False`) para exigir sesión con PIN en vistas operativas y `/qr.html`, y aislar la bandeja de leads reales.
   - Configurá tus bloques, mozos con PIN y tu carta real en las 3 estaciones (`Cocina`, `Barra`, `Mostrador`).
4. Abrí `/pase.html` en la pantalla horizontal del mostrador/barra (o vinculá las pulseras Bluetooth BLE desde `/mozo.html`) e imprimí los códigos QR definitivos desde `/qr.html`.

Más detalles en [`app/PUBLICAR_EN_INTERNET.md`](./app/PUBLICAR_EN_INTERNET.md), [`docs/arquitectura_salelisto.md`](./docs/arquitectura_salelisto.md), [`docs/mejoras_producto_ux.md`](./docs/mejoras_producto_ux.md) y [`docs/goldfish_review_report.md`](./docs/goldfish_review_report.md).

---

## Identidad Visual y Sistema de Marca

- **Sistema unificado ([`branding/`](./branding/sistema_de_marca.md))**: Una sola línea gráfica para la app web, la Landing Comercial, los documentos comerciales A4, el pack de marketing y los videos. [`sistema_de_marca.md`](./branding/sistema_de_marca.md) documenta la paleta maestra (`#faf7f2`, `#1c1917`, `#d9412b`, `#2f8a57`, `#6d28d9`, `#d97706`), tipografía `Plus Jakarta Sans`, radios, sombras, motion sobrio `cubic-bezier(0.22, 1, 0.36, 1)` y reglas de contacto, replicados en [`tokens.css`](./branding/tokens.css).
- **Logo oficial (Propuesta 01 · Pase Limpio)**: Campana de pase geométrica con tilde ascendente en espacio negativo sobre squircle bermellón, más wordmark **SaleListo** en curvas (`logo.svg`, `logo-dark.svg` con placa `#1C1917` propia y `mark.svg` sincronizados byte a byte en `branding/`, `app/public/` y `video-ad/v2/assets/`).

---

## Estrategia Comercial, Activos Operativos A4, Marketing y Videos

- **Kit Comercial B2B, Deck Interactivo y Onboarding en 48 Horas ([`comercial/`](./comercial/))**:
  - **Deck Comercial Interactivo de 10 Láminas**: [`presentacion_interactiva.html`](./comercial/presentacion_interactiva.html) para reuniones presenciales, tablet o Zoom, con panel de notas del orador conmutable (`[N]`), simuladores interactivos en vivo de *Vaquita*/vuelto y retorno ROI, y selector de moneda `ARS/USD`.
  - **Dossier Ejecutivo A4 de 2 páginas**: [`SaleListo_Dossier_Comercial.pdf`](./comercial/SaleListo_Dossier_Comercial.pdf) y su fuente editable [`brochure_b2b.html`](./comercial/brochure_b2b.html).
  - **Acuerdo Simple de Piloto de 14 Días (2 fines de semana) + Comodato BLE en 1 página A4**: [`SaleListo_Acuerdo_Piloto_14d.pdf`](./comercial/SaleListo_Acuerdo_Piloto_14d.pdf) y [`acuerdo_piloto_14_dias.md`](./comercial/acuerdo_piloto_14_dias.md).
  - **Planilla modelo de relevamiento de carta (48 h)**: [`plantilla_carga_carta.csv`](./comercial/plantilla_carga_carta.csv) lista para Excel/Google Sheets con las 3 estaciones y 5 etiquetas dietarias.
  - **Modelo de Negocios y Playbook Personalizado 1 a 1 para 26 Locales**: unit economics, ROI exacto (`+ USD 2.345/mes`), OPEX escalonado y 12 objeciones en [`modelo_de_negocios.md`](./comercial/modelo_de_negocios.md); estrategia outbound/inbound (`SLA < 15 min`) en [`propuestas_restaurantes.md`](./comercial/propuestas_restaurantes.md); mensajes hechos a medida local por local (ángulo físico real, DM `<= 35` palabras, correo con asunto único y deep-link `#roi`) en [`mensajes_personalizados_26_locales.md`](./comercial/mensajes_personalizados_26_locales.md); y base estructurada en [`prospectos_restaurantes.csv`](./comercial/prospectos_restaurantes.csv).
- **Fábrica de Contenidos B2B ([`marketing/`](./marketing/README.md))**: **33 PNGs gráficos totales + 3 PDFs nativos para LinkedIn + 5 Reels verticales MP4 (`1080x1920`, `60 fps`, `-14 LUFS`)** con locución rioplatense continua: **3 carruseles** (15 slides PNG `1080x1350` + 3 documentos PDF de 5 páginas sin márgenes para LinkedIn), **4 posts individuales** (incluyendo redondeo limpio a `$100`), **6 Historias verticales (`1080x1920`)** en `marketing/stories/`, **8 banners multicanal**, plantillas editables en `src_grafica/`, [`guiones_reels.md`](./marketing/guiones_reels.md) y plan cronológico de 30 días (`Copy #01` a `Copy #20` + campaña consolidada Meta Ads) en [`calendario_redes_30dias.md`](./marketing/calendario_redes_30dias.md).
- **Spot Audiovisual Oficial y Pipeline Gemini Omni 1.2 Flash ([`video-ad/`](./video-ad/README.md))**: Spot Oficial v5 [`SaleListo_Ad.mp4`](./video-ad/SaleListo_Ad.mp4) (`1080x1920`, `60 fps`, `-14 LUFS`, máximo 5 palabras por escena, cierre institucional con `0% comisión`, `(+54)1138436571` y `ventas@salelisto.com`) más el script open-ended [`generar_ad_omni.py`](./video-ad/generar_ad_omni.py) para recreación audiovisual en **Gemini Omni 1.2 Flash (Google Flow Ultra)** vía CDP.

---

## Autor y Contacto

**Simón Martínez de Guereñu**  
- **WhatsApp / Teléfono único:** `(+54)1138436571`  
- **Correo electrónico (autor y prospección directa):** `simonguerenu@gmail.com`  
- **Correo comercial oficial (marca, Dossier, Acuerdo y piezas B2B):** `ventas@salelisto.com`
