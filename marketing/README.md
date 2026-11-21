# Marketing · SaleListo

Pack integral de comunicación para redes sociales, pauta y canales comerciales B2B de **SaleListo** ([`https://salelisto.com`](https://salelisto.com) · demo interactiva [`https://salelisto.com/demo.html`](https://salelisto.com/demo.html)): carruseles en PNG y PDF nativo para LinkedIn, posts de feed, pack de 6 historias verticales interactivas, banners multicanal, 5 Reels verticales renderizados y calendario editorial de 30 días. Todas las piezas respetan el [Sistema de Marca](../branding/sistema_de_marca.md) (identidad *Pase Limpio*, tokens de [`tokens.css`](../branding/tokens.css), tipografía única **Plus Jakarta Sans**, dominio oficial `salelisto.com` y casillas activas `ventas@salelisto.com`, `simon@salelisto.com`, `valentin@salelisto.com` y `consultas@salelisto.com`).

---

## 1. Contenido de la carpeta

```text
marketing/
├── README.md                      Este documento
├── calendario_redes_30dias.md     Plan editorial (20 copys cronológicos #01..#20, Stories y Meta Ads)
├── posts/                         3 carruseles (15 PNG + 3 PDFs LinkedIn) y 4 posts 1080x1350
│   ├── carrusel_01_viajes_muertos/slide_01.png ... slide_05.png
│   ├── carrusel_02_cero_celulares/slide_01.png ... slide_05.png
│   ├── carrusel_03_cocina_y_barra/slide_01.png ... slide_05.png
│   ├── SaleListo_Carrusel_01_Viajes.pdf            (1080x1350 x 5 páginas sin márgenes)
│   ├── SaleListo_Carrusel_02_Cero_Celulares.pdf    (1080x1350 x 5 páginas sin márgenes)
│   ├── SaleListo_Carrusel_03_Cocina_Barra.pdf      (1080x1350 x 5 páginas sin márgenes)
│   ├── post_01_cero_comision_roi.png
│   ├── post_02_division_cocina_barra.png
│   ├── post_03_segundas_rondas_patios.png
│   └── post_04_precios_anti_inflacion.png
├── stories/                       6 Historias verticales 1080x1920 (zonas seguras 250px / 300px)
│   ├── story_01_encuesta_cobro.png
│   ├── story_02_estacion_pase.png
│   ├── story_03_kit_pulsera.png
│   ├── story_04_vaquita_y_vuelto.png
│   ├── story_05_3_estaciones_sla.png
│   └── story_06_piloto_14_dias.png
├── banners/                       8 banners multicanal al píxel exacto
├── src_grafica/                   Plantillas editables HTML/CSS/JS y exportador PNG + PDF
├── reels/                         5 Reels verticales 1080x1920 60 fps (R01 a R05)
└── guiones_reels.md               Guiones de los 5 Reels + 5 guiones de rodaje real
```

> **Activos comerciales complementarios para cierre por WhatsApp:** [`comercial/SaleListo_Dossier_Comercial.pdf`](../comercial/SaleListo_Dossier_Comercial.pdf) (`2 páginas A4`) y [`comercial/SaleListo_Acuerdo_Piloto_14d.pdf`](../comercial/SaleListo_Acuerdo_Piloto_14d.pdf) (`1 página A4`).

### 1.1. Carruseles (`1080x1350`, 5 slides PNG + 3 documentos PDF nativos para LinkedIn)

| Carrusel (PNG para IG/FB) | Documento PDF nativo (LinkedIn) | Slides y mensaje |
| :--- | :--- | :--- |
| [`carrusel_01_viajes_muertos/`](posts/carrusel_01_viajes_muertos/) | [`SaleListo_Carrusel_01_Viajes.pdf`](posts/SaleListo_Carrusel_01_Viajes.pdf) (`5 pág.`) | `01` Portada: *"Cobrar una mesa hoy lleva 4 viajes. Con SaleListo lleva 1."* · `02` Los 4 viajes que queman al mozo · `03` La mesa pide la cuenta desde el QR con medio de pago y propina (`#1C1917`) · `04` Impacto: **+18 a 25 min** recuperados por mesa · `05` Planes con **0% comisión** y contacto |
| [`carrusel_02_cero_celulares/`](posts/carrusel_02_cero_celulares/) | [`SaleListo_Carrusel_02_Cero_Celulares.pdf`](posts/SaleListo_Carrusel_02_Cero_Celulares.pdf) (`5 pág.`) | `01` Portada sobre `#1C1917`: *"Un salón ágil sin mozos mirando el celular."* · `02` La objeción real de imagen · `03` **Plan Base con Estación de Mozos fija** en el pase · `04` **Kit Pulsera Vibradora Xiaomi Band** (celular en el bolsillo, hasta 14 días de batería, `#1C1917`) · `05` CTA Piloto sin riesgo de 14 días en 1 sector (carta lista en **48 h**) |
| [`carrusel_03_cocina_y_barra/`](posts/carrusel_03_cocina_y_barra/) | [`SaleListo_Carrusel_03_Cocina_Barra.pdf`](posts/SaleListo_Carrusel_03_Cocina_Barra.pdf) (`5 pág.`) | `01` Portada: *"Eliminá las comandas perdidas entre Salón, Cocina y Barra."* · `02` Costo del papel manchado y las cantadas (1,5% a 3% en mermas) · `03` Separación en **0 segundos** a Cocina (`#D97706`) y Barra (`#6D28D9`) con aclaraciones · `04` **Semáforo SLA** + baja de agotados en 1 clic · `05` CTA Piloto de 14 días listo en **48 h** |

Todas las slides llevan numeración `01/05`, barra de progreso e indicador `Deslizá →` (la última lo reemplaza por *"Guardalo y compartilo con tu encargado"*). Los 3 PDFs de LinkedIn tienen tamaño de página exacto `1080x1350 px` sin márgenes blancos, listos para subir como *Documento* deslizable.

### 1.2. Posts individuales (`1080x1350`)

| Archivo | Tema | Fondo |
| :--- | :--- | :--- |
| [`post_01_cero_comision_roi.png`](posts/post_01_cero_comision_roi.png) | 0% comisión frente al 18% a 30% + IVA de las apps de delivery y ROI estimado 37x (`+USD 2.410/mes` con abono de `USD 65`) | Crema `#FAF7F2` |
| [`post_02_division_cocina_barra.png`](posts/post_02_division_cocina_barra.png) | Un pedido que se bifurca automáticamente en Cocina (`#D97706`) y Barra (`#6D28D9`) | Carbón `#1C1917` |
| [`post_03_segundas_rondas_patios.png`](posts/post_03_segundas_rondas_patios.png) | Segundas rondas en patios, terrazas y veredas sin esperar al mozo (escaneo directo en la mesa -> trago directo a Barra -> más rotación) | Crema `#FAF7F2` |
| [`post_04_precios_anti_inflacion.png`](posts/post_04_precios_anti_inflacion.png) | Ajuste masivo de precios `+8%` con **redondeo gastronómico limpio a `$100`** (`$14.500 -> $15.700`, `$5.200 -> $5.600`, `$4.800 -> $5.200`) y vista previa sin reimprimir QR | Crema `#FAF7F2` |

### 1.3. Historias verticales interactivas (`1080x1920`, zonas seguras `>= 250 px` arriba y `>= 300 px` abajo)

| Archivo | Mensaje y función comercial | Fondo |
| :--- | :--- | :--- |
| [`story_01_encuesta_cobro.png`](stories/story_01_encuesta_cobro.png) | *"¿Cuánto tarda hoy cobrar una mesa en viernes lleno?"* con contenedor limpio punteado para colocar el sticker nativo de **Encuesta** de Instagram | Crema `#FAF7F2` |
| [`story_02_estacion_pase.png`](stories/story_02_estacion_pase.png) | Plan Base sin celulares: 1 tablet fija en el pase, 1 columna por mozo y celulares personales guardados en locker o caja (`USD 0` hardware) | Crema `#FAF7F2` |
| [`story_03_kit_pulsera.png`](stories/story_03_kit_pulsera.png) | Terrazas y patios grandes: Kit Pulsera Vibradora Xiaomi Band (vibra en la muñeca, celu bloqueado en el bolsillo por Bluetooth BLE, 14 días de batería, compatible con los 3 planes) | Carbón `#1C1917` |
| [`story_04_vaquita_y_vuelto.png`](stories/story_04_vaquita_y_vuelto.png) | Nuevo en el QR: Calculadora grupal *Vaquita* (`÷ personas`) + aviso de con cuánto abonan en efectivo para llevar el vuelto exacto en 1 solo viaje | Crema `#FAF7F2` |
| [`story_05_3_estaciones_sla.png`](stories/story_05_3_estaciones_sla.png) | Ruteo en 0 segundos en 3 estaciones reales (**Cocina**, **Barra** y **Sushi/Mostrador**) + semáforo SLA en vivo + agotados en 1 clic | Carbón `#1C1917` |
| [`story_06_piloto_14_dias.png`](stories/story_06_piloto_14_dias.png) | Cierre directo: *"Probá 14 días en 1 solo sector"* (vereda, patio o terraza), listo en **48 h**, `0% comisión` y contacto WhatsApp `(+54)1138436571` | Crema `#FAF7F2` |

### 1.4. Banners multicanal

| Archivo | Medida | Uso |
| :--- | :---: | :--- |
| [`banner_web_1920x600.png`](banners/banner_web_1920x600.png) | `1920x600` | Cabecera de landing, presentaciones y firma de propuestas |
| [`banner_display_728x90.png`](banners/banner_display_728x90.png) | `728x90` | Display horizontal (leaderboard) |
| [`banner_display_300x250.png`](banners/banner_display_300x250.png) | `300x250` | Display rectángulo mediano |
| [`linkedin_portada_1584x396.png`](banners/linkedin_portada_1584x396.png) | `1584x396` | Portada de perfil o página de LinkedIn (contenido desplazado a la derecha para no quedar bajo la foto de perfil) |
| [`linkedin_post_1200x627.png`](banners/linkedin_post_1200x627.png) | `1200x627` | Post o anuncio de LinkedIn con el caso ROI 37x (`3 a 4 mesas extra al mes` · `+USD 2.410` generados / `+USD 2.345` netos) |
| [`meta_ad_feed_1080x1080.png`](banners/meta_ad_feed_1080x1080.png) | `1080x1080` | Anuncio Meta en feed: *"Mozos sin celular. Salón sin caos."* |
| [`meta_ad_story_1080x1920.png`](banners/meta_ad_story_1080x1920.png) | `1080x1920` | Anuncio vertical para Historias y Reels: Piloto sin riesgo por 14 días, carta cargada en **48 h** (zonas seguras: 260 px arriba y >= 300 px abajo) |
| [`whatsapp_catalogo_1080x1080.png`](banners/whatsapp_catalogo_1080x1080.png) | `1080x1080` | Catálogo de WhatsApp Business y Estados con los 3 planes |

### 1.5. Reels verticales (`1080x1920`, `60 fps`, locución rioplatense)

Documentados en [`guiones_reels.md`](guiones_reels.md) e integrados en el calendario de 30 días (subir limpios con portada en cuadro 0 y **sin subtítulos automáticos superpuestos**):
1. [`reels/Reel_01_Sin_Celulares_En_Salon.mp4`](reels/Reel_01_Sin_Celulares_En_Salon.mp4): estética del salón (Estación de Pase + Pulsera vibradora).
2. [`reels/Reel_02_Segundas_Rondas_Terraza.mp4`](reels/Reel_02_Segundas_Rondas_Terraza.mp4): segundas rondas en patios, veredas y terrazas directo a Barra sin esperar al mozo.
3. [`reels/Reel_03_Cero_Comision_Precios_Al_Dia.mp4`](reels/Reel_03_Cero_Comision_Precios_Al_Dia.mp4): 0% comisión y ajuste masivo de precios sin reimprimir QR.
4. [`reels/Reel_04_Cobrar_En_Un_Viaje.mp4`](reels/Reel_04_Cobrar_En_Un_Viaje.mp4): cierre de cuenta con pago y propina elegidos en 1 solo viaje.
5. [`reels/Reel_05_Piloto_14_Dias_Un_Sector.mp4`](reels/Reel_05_Piloto_14_Dias_Un_Sector.mp4): piloto sin riesgo de 14 días en 1 sector listo en 48 horas.

> [!NOTE]
> Los códigos QR que aparecen dentro de las piezas de redes son **ilustrativos** (patrón decorativo no escaneable). Para material impreso en mesas se usan los QR vectoriales reales generados desde `/qr.html` en el Onboarding de cada local.

---

## 2. Sistema gráfico aplicado

- **Proporción cromática 75 / 18 / 7:** fondos crema `#FAF7F2` y blancos dominantes, estructura tipográfica carbón `#1C1917` / `#57534E`, y acentos con función informativa (`#D9412B` bermellón, `#2F8A57` listo / Mostrador, `#D97706` Cocina, `#6D28D9` Barra). Las piezas oscuras (`C1 · 03`, `C2 · 01`, `C2 · 04`, `C3 · 03`, `P2`, `S3`, `S5`, portada de LinkedIn y anuncio de feed) usan `#1C1917` con superficies `#26221F`.
- **Logo:** [`logo.svg`](../branding/logo.svg) sobre fondos claros; sobre `#1C1917` se usa `src_grafica/assets/logo-on-dark.svg`, idéntico al oficial con el wordmark en crema `#FAF7F2`.
- **Tipografía:** Plus Jakarta Sans 500 a 800. Titulares de `68px a 142px` en lienzos `1080`, textos de apoyo de `22px` como mínimo para lectura inmediata en el celular sin hacer zoom.
- **Datos alineados al 100%:** todas las cifras y promesas coinciden exactamente con [`comercial/modelo_de_negocios.md`](../comercial/modelo_de_negocios.md) (planes `USD 35 / 65 / 110` por mes, packs de pulseras `USD 145 / 230` compatibles con los 3 planes y teléfono bloqueado en el bolsillo por BLE, puesta en marcha en **`48 h`**, piloto quirúrgico de **`14 días`** en 1 sector, redondeo limpio a **`$100`** y ROI de **`+USD 2.410/mes`** bruto / **`+USD 2.345/mes`** neto en el local tipo de 25 mesas).
- **Regla permanente de comunicación y piezas (prohibición de argumentos de conectividad):** jamás se marketinea ni se aclara el prescindir de la red inalámbrica del local ni el uso de datos móviles del teléfono (ni variantes sobre pedir claves de red) en ninguna categoría de marketing, QRs, posts, carruseles, historias, banners ni mensajes de ventas. Que funcione con la conexión móvil del cliente es solo un plus implícito; el foco comercial es siempre: **escaneo directo con la cámara sin apps ni registros, comanda separada sola a Cocina, Barra y Mostrador, salón sin celulares con Estación de Pase o Pulsera, cierre directo en 1 toque (`✔ Atendido` / `✔ Cobrar y cerrar` sin pasos intermedios) y 0% comisión**.

---

## 3. Calendario editorial y Meta Ads

El plan completo está en [`calendario_redes_30dias.md`](calendario_redes_30dias.md): 4 semanas x 5 publicaciones, **20 copys numerados en orden cronológico estricto (`Copy #01` a `Copy #20`)**, grilla de las **6 Historias verticales (`S1` a `S6`)**, uso de los **3 PDFs nativos en LinkedIn** y protocolo de cierre por WhatsApp en `< 15 minutos`:

| Semana | Eje | Lunes | Martes | Miércoles | Jueves | Sábado |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Dolor operativo | Spot (`#01`) | Carrusel 01 (`#02`) | Reel 04 (`#03`) | Reel 01 (`#04`) | Post 02 + S5 (`#05`) |
| **2** | Objeción de imagen | Post LI ROI (`#06`) | Carrusel 02 (`#07`) | Carrusel 03 (`#08`) | Reel 02 (`#09`) | Post 03 + S3 (`#10`) |
| **3** | Rentabilidad | Post 01 (`#11`) | Reel 03 (`#12`) | Carrusel 03 PDF (`#13`) | Carrusel 01 PDF (`#14`) | Post 04 (`#15`) |
| **4** | Conversión | Carrusel 02 PDF (`#16`) | Spot (`#17`) | Reel 05 (`#18`) | Reel 01 LI (`#19`) | S6 + ST + WA (`#20`) |

**Meta Ads (`USD 320/mes`) en una línea:** **1 campaña consolidada de Clic a WhatsApp (`(+54)1138436571`)** con **2 conjuntos**: (1) **Prospección Gastronómica Amplia** en CABA + Zona Norte (75%, `USD 240/mes`) usando los 5 Reels (`R1`..`R5`) y `meta_ad_story` como filtro creativo B2B, y (2) **Retargeting de Interacciones de IG y Video Views >= 50%** (25%, `USD 80/mes`) con `R5`, `story_06_piloto_14_dias.png`, `meta_ad_feed` y `post_01`.

---

## 4. Cómo editar y volver a exportar las piezas

Las plantillas viven en [`src_grafica/`](src_grafica/) y no requieren dependencias dentro del repositorio:

| Archivo | Función |
| :--- | :--- |
| [`styles.css`](src_grafica/styles.css) | Tokens de marca, tipografía, componentes y contenedor `.story-safe` (`260px` arriba / `315px` abajo) |
| [`pieces.js`](src_grafica/pieces.js) | Definición de las 33 piezas gráficas (`id`, medida, ruta de salida y HTML) |
| [`render.html`](src_grafica/render.html) | Dibuja una pieza individual: `render.html?p=st1` (incluye auditoría automática de desbordes) |
| [`gallery.html`](src_grafica/gallery.html) | Vista previa escalada de todo el pack gráfico |
| [`export.js`](src_grafica/export.js) | Exporta los 33 PNG al píxel exacto y los 3 PDFs multipágina (`1080x1350` x 5 pág.) con Chrome Headless |
| `assets/` | Fuentes Plus Jakarta Sans y logos oficiales |

**Ids disponibles en `export.js` (`33 PNG + 3 PDF`):**
- Carruseles PNG (`15`): `c1s1`..`c1s5`, `c2s1`..`c2s5`, `c3s1`..`c3s5`
- Carruseles PDF LinkedIn (`3`): `pdf1`, `pdf2`, `pdf3` (o el alias `pdfs` para los tres)
- Posts (`4`): `p1`..`p4`
- Historias verticales (`6`): `st1`..`st6`
- Banners (`8`): `web`, `d728`, `d300`, `lic`, `lip`, `mfeed`, `mstory`, `wa`

**Exportar (PowerShell), instalando `puppeteer-core` fuera del repositorio:**

```powershell
$work = "$env:TEMP\sl_mkt_w5"
New-Item -ItemType Directory -Force $work | Out-Null
npm --prefix $work init -y | Out-Null
npm --prefix $work install puppeteer-core
$env:PUPPETEER_DIR = $work
node marketing/src_grafica/export.js                  # exporta los 33 PNG + los 3 PDFs
node marketing/src_grafica/export.js p4 st1 pdfs      # exporta solo las piezas indicadas
Remove-Item -Recurse -Force $work                     # limpieza obligatoria
```

---

## 5. Control de calidad realizado

- **33 imágenes PNG** (3 carruseles x 5 slides + 4 posts + 6 historias verticales + 8 banners) y **3 documentos PDF nativos para LinkedIn** (`1080x1350` x 5 páginas exactas cada uno, sin márgenes blancos) verificados programática y visualmente: cero desbordes, cero solapamientos y respeto estricto de zonas seguras (`>= 250 px` arriba y `>= 300 px` abajo en `1080x1920`).
- **5 Reels MP4** (`1080x1920`, `60 fps`, `-14.0 LUFS`) preservados intactos en [`reels/`](reels/).
- Sin rayas largas (`U+2014`) en imágenes, PDFs, HTML, CSS, JS ni Markdown.
- Dominio canónico y contacto oficial en piezas: **`salelisto.com`** (`https://salelisto.com` y demo en vivo `https://salelisto.com/demo.html`), WhatsApp **`(+54)1138436571`** y casillas oficiales **`ventas@salelisto.com`**, **`simon@salelisto.com`**, **`valentin@salelisto.com`** y **`consultas@salelisto.com`**. Cero enlaces ni perfiles sociales inventados.

---

**Sitio oficial y contacto comercial:** [`https://salelisto.com`](https://salelisto.com) · Demo en vivo: [`https://salelisto.com/demo.html`](https://salelisto.com/demo.html) · WhatsApp `(+54)1138436571` · `ventas@salelisto.com` · `consultas@salelisto.com` · Dirección: Simón Martínez de Guereñu (`simon@salelisto.com`) · `valentin@salelisto.com`.
