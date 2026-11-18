# SaleListo

**Plataforma gastronómica en tiempo real para pedidos por QR sobre 4G/5G (sin Wi-Fi), ruteo simultáneo a Cocina y Barra, y coordinación inteligente de mozos.**

SaleListo elimina los tiempos muertos en la mesa y alivia la exigencia física del personal de salón en horas pico. Funciona al instante desde cualquier navegador móvil sin descargar aplicaciones, sin requerir clave de Wi-Fi y con **0% de comisión sobre las ventas del restaurante**.

---

## Pilares Principales

- **Autogestión en mesa por 4G/5G con QR seguro**: Cada mesa posee un código QR vectorial propio con token fijo anti-spoofing (`cliente.html?t=...`). El comensal mira la carta con fotos reales, envía su pedido, llama al mozo o solicita la cuenta indicando medio de pago y porcentaje de propina.
- **Constructor visual por bloques**: Configuración ágil del plano del local mediante plantillas (*Interior*, *Terraza*, *Exterior / Vereda*, *Barra*, *Sectores*, *Patio* y *Salón VIP*) con grillas dinámicas de mesas.
- **Separación directa entre Cocina y Barra**: Cada categoría dirige sus ítems automáticamente a **Cocina** o a **Barra** en el mismo segundo en que el cliente confirma el pedido, evitando que las bebidas queden demoradas detrás de los platos calientes.
- **Alivio real y balanceo en vivo para los mozos**: Asignación híbrida (pre-asignación por bloque o reparto automático al mozo activo con menor carga) y **reasignación automática inmediata** de mesas abiertas cuando un mozo corta turno. El celular del mozo suena y vibra recién cuando hay un plato o trago listo para retirar o cuando una mesa solicita asistencia.
- **Carta anti-inflación y caja integrada**: Alta de categorías y fotos reales, pausa instantánea de platos agotados, ajuste porcentual masivo de precios (`+%`), anulación segura de comandas equivocadas y arqueo de sesiones cerradas con reporte de propinas por mozo.
- **Cero dependencias externas en el servidor**: Construido íntegramente sobre la biblioteca estándar de Python 3 (`http.server`, `sqlite3` en modo WAL y generador QR propio en `qrgen.py`), listo para correr en local o desplegarse en la nube en minutos.

---

## Mapa del Repositorio

```text
.
├── app/                          # Aplicación web completa de SaleListo (Backend + 4 vistas + Demo)
│   ├── server.py                 # Servidor HTTP multihilo, API REST, sesiones por rol y streaming SSE
│   ├── db.py                     # Motor transaccional SQLite, balanceador de mozos y arqueo de caja
│   ├── qrgen.py                  # Generador propio de códigos QR vectoriales (SVG puro, sin CDNs)
│   ├── iniciar.bat               # Lanzador directo en un clic para Windows
│   ├── PUBLICAR_EN_INTERNET.md   # Guía rápida de publicación cloud para operar con 4G/5G
│   ├── data/                     # Carpeta de datos en ejecución (salelisto.db se crea al iniciar)
│   └── public/                   # Frontend responsivo en HTML5, CSS3 y Vanilla JS
│       ├── index.html            # Portada general con accesos a todas las pantallas
│       ├── demo.html             # Simulador interactivo de 4 pantallas en vivo
│       ├── restaurante.html      # Panel del encargado (Salón, Bloques, Mozos, Carta, QRs y Caja)
│       ├── mozo.html             # App móvil del mozo con alertas sonoras, vibración y carga manual
│       ├── cocina.html           # Comandera digital (KDS) filtrable por Cocina, Barra o Ambos
│       ├── cliente.html          # Carta interactiva y seguimiento en vivo para el comensal
│       ├── qr.html               # Planchas de códigos QR listas para imprimir por bloque
│       └── logo.svg · logo-dark.svg · mark.svg  # Identidad oficial (copia idéntica de branding/)
├── branding/                     # Sistema de marca unificado de SaleListo (fuente de verdad visual)
│   ├── sistema_de_marca.md       # Paleta, tipografía, radios, sombras, motion sobrio y Tarjeta Maestra del video
│   ├── tokens.css                # Tokens CSS compartidos por la app y el spot publicitario
│   ├── logo.svg · logo-dark.svg  # Logotipo horizontal oficial (Propuesta 06 · Salón en Orden), claro y oscuro
│   ├── mark.svg                  # Isotipo oficial 64x64 (favicon, cabezal de la app y del video)
│   └── propuestas_logos/         # Las 6 propuestas de logos bocetadas, lámina comparativa y fundamentos
├── comercial/                    # Estrategia comercial y prospección B2B verificada
│   ├── modelo_de_negocios.md     # Unit economics, ROI para el local y matriz de planes SaaS
│   ├── propuestas_restaurantes.md# Playbook comercial, ICPs y propuestas para 26 locales reales
│   └── prospectos_restaurantes.csv# Base estructurada de prospectos gastronómicos
├── video-ad/                     # Spot publicitario vertical (1080x1920, 60 fps) y pipeline v2
│   ├── SaleListo_Ad.mp4          # Video comercial final listo para Reels, TikTok, Shorts y WhatsApp
│   ├── locucion_argentina.mp3    # Toma continua original en español argentino (ElevenLabs)
│   ├── guion.md                  # Guion creativo v3 y escaleta de 6 escenas respiradas (E01 a E06)
│   ├── referencias_ads.md        # Relevamiento de referencias Gastro-Tech y Motion SaaS
│   └── v2/                       # Motor programático de composición (Tarjeta Maestra), audio y mezcla
├── docs/                         # Documentación técnica y evolución arquitectónica
│   ├── arquitectura_salelisto.md # Diseño del sistema, flujo en tiempo real y reglas de negocio
│   └── auditoria_inicial_beta.md # Diagnóstico histórico del prototipo inicial y resolución de bugs
├── render.yaml                   # Blueprint de despliegue directo en Render desde la raíz del repo
└── Procfile                      # Comando de arranque web para plataformas cloud (Railway / Render)
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

Al iniciar por primera vez, el servidor crea y puebla automáticamente `app/data/salelisto.db` con bloques, mesas, mozos y carta de demostración listos para probar.

### Vistas Disponibles (`http://localhost:8123`)

| Vista | Ruta | Rol / Uso |
| :--- | :--- | :--- |
| **Portada** | [`/`](http://localhost:8123/) | Punto de entrada con acceso directo a todos los módulos. |
| **Modo Demo (4 pantallas)** | [`/demo.html`](http://localhost:8123/demo.html) | Vista cuádruple interactiva (Cliente + Mozo + Cocina/Barra + Encargado) sincronizada en tiempo real. |
| **Panel del Restaurante** | [`/restaurante.html`](http://localhost:8123/restaurante.html) | Gestión integral del salón, bloques, mesas, mozos, carta, fotos y caja *(PIN inicial: `1234`)*. |
| **App Móvil del Mozo** | [`/mozo.html`](http://localhost:8123/mozo.html) | Alertas sonoras y vibratorias de platos/bebidas listas, llamados de mesa, cuentas y pedidos manuales. |
| **Pantalla Cocina y Barra** | [`/cocina.html`](http://localhost:8123/cocina.html) | Tablero KDS en tiempo real con filtro por estación (`Cocina`, `Barra` o `Ambos`). |
| **Vista del Comensal** | `/cliente.html?t=<token>` | Carta digital por mesa accesible desde los códigos QR o desde el simulador. |
| **Impresión de QRs** | [`/qr.html`](http://localhost:8123/qr.html) | Planchas imprimibles de códigos QR con token fijo organizadas por bloque. |

*(Para usar otro puerto local, pasar el número como argumento: `python app/server.py 9000` o definir la variable de entorno `PORT`).*

---

## Despliegue en la Nube (Operación Real con 4G/5G sin Wi-Fi)

El repositorio está preparado en su raíz para publicarse directamente con HTTPS de modo que los clientes escaneen los QRs usando sus propios datos móviles:

1. Subí este repositorio a tu cuenta de **GitHub**.
2. En **Render.com** (o **Railway.app**), creá un nuevo servicio web o Blueprint conectado al repositorio:
   - [`render.yaml`](./render.yaml) define automáticamente `rootDir: app` y `startCommand: python server.py`.
   - [`Procfile`](./Procfile) define `web: python app/server.py`.
3. Una vez publicado el enlace seguro (`https://<tu-servicio>.onrender.com`), ingresá a `/restaurante.html`:
   - Cambiá el PIN de administrador inicial (`1234`) en **Caja y Ajustes**.
   - Desactivá el *Modo Demo* para exigir sesión con PIN en las vistas de personal.
   - Cargá tu plano de bloques, tus mozos y tu carta real.
4. Abrí `/qr.html` e imprimí los códigos QR definitivos para las mesas.

Más detalles en [`app/PUBLICAR_EN_INTERNET.md`](./app/PUBLICAR_EN_INTERNET.md) y en [`docs/arquitectura_salelisto.md`](./docs/arquitectura_salelisto.md).

---

## Identidad Visual y Sistema de Marca

- **Sistema unificado ([`branding/`](./branding/sistema_de_marca.md))**: Una sola línea gráfica para la app web y el spot publicitario. [`sistema_de_marca.md`](./branding/sistema_de_marca.md) documenta la paleta maestra (crema `#faf7f2`, tinta `#1c1917`, bermellón `#d9412b`, verde `#2f8a57`, Barra `#6d28d9`, Cocina `#d97706`), la tipografía `Plus Jakarta Sans`, radios, sombras y el motion sobrio con curva única sin rebote. Los mismos valores viven como variables en [`tokens.css`](./branding/tokens.css).
- **Logo oficial (Propuesta 06 · Salón en Orden)**: Tres módulos redondeados a 45° sobre squircle bermellón que forman un check, más el wordmark **SaleListo** trazado a curvas. Los archivos [`logo.svg`](./branding/logo.svg), [`logo-dark.svg`](./branding/logo-dark.svg) y [`mark.svg`](./branding/mark.svg) son idénticos byte a byte en `branding/`, `app/public/` y `video-ad/v2/assets/`.
- **Exploración de logos ([`branding/propuestas_logos/`](./branding/propuestas_logos/README.md))**: Las 6 propuestas bocetadas en SVG (logo + isotipo de cada una), con la lámina comparativa [`catalogo_logos.png`](./branding/propuestas_logos/catalogo_logos.png) en fondo claro, oscuro y favicon de 24 px.

---

## Documentación Comercial y Pieza Publicitaria

- **Estrategia y Prospección B2B ([`comercial/`](./comercial/))**: Incluye el modelo financiero y estructura de planes SaaS en [`modelo_de_negocios.md`](./comercial/modelo_de_negocios.md), junto con el relevamiento de perfiles ideales y propuestas personalizadas en [`propuestas_restaurantes.md`](./comercial/propuestas_restaurantes.md) y [`prospectos_restaurantes.csv`](./comercial/prospectos_restaurantes.csv).
- **Spot Audiovisual Vertical ([`video-ad/`](./video-ad/README.md))**: Incluye el anuncio terminado [`SaleListo_Ad.mp4`](./video-ad/SaleListo_Ad.mp4), la locución continua [`locucion_argentina.mp3`](./video-ad/locucion_argentina.mp3), el guion técnico [`guion.md`](./video-ad/guion.md) y las herramientas de generación en [`video-ad/v2/`](./video-ad/v2/README.md).

---

## Autor y Contacto

**Simón Martínez de Guereñu**  
- **WhatsApp / Teléfono:** `(+54)1138436571`  
- **Correo electrónico:** `simonguerenu@gmail.com`
