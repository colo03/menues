# Marketing · SaleListo

Pack de comunicación para redes sociales, pauta y canales comerciales de **SaleListo**: carruseles, posts, banners multicanal, Reels y calendario editorial de 30 días. Todas las piezas respetan el [Sistema de Marca](../branding/sistema_de_marca.md) (identidad *Pase Limpio*, tokens de [`tokens.css`](../branding/tokens.css), tipografía única **Plus Jakarta Sans** y datos de contacto oficiales).

---

## 1. Contenido de la carpeta

```text
marketing/
├── README.md                      Este documento
├── calendario_redes_30dias.md     Plan editorial (20 publicaciones, 20 copys y Meta Ads)
├── posts/                         3 carruseles (15 slides) y 4 posts 1080x1350
│   ├── carrusel_01_viajes_muertos/slide_01.png ... slide_05.png
│   ├── carrusel_02_cero_celulares/slide_01.png ... slide_05.png
│   ├── carrusel_03_cocina_y_barra/slide_01.png ... slide_05.png
│   ├── post_01_cero_comision_roi.png
│   ├── post_02_division_cocina_barra.png
│   ├── post_03_qr_4g_patios_veredas.png
│   └── post_04_precios_anti_inflacion.png
├── banners/                       8 banners multicanal al píxel exacto
├── src_grafica/                   Plantillas editables HTML/CSS/JS y exportador PNG
├── reels/                         5 Reels verticales 1080x1920 60 fps (R01 a R05)
└── guiones_reels.md               Guiones de los 5 Reels + 5 guiones de rodaje real
```

> **Activo comercial complementario para cierre por WhatsApp:** [`comercial/SaleListo_Dossier_Comercial.pdf`](../comercial/SaleListo_Dossier_Comercial.pdf) (`2 páginas A4`, `~137 KB`, generado desde [`comercial/brochure_b2b.html`](../comercial/brochure_b2b.html)).

### 1.1. Carruseles (`1080x1350`, 5 slides cada uno)

| Carrusel | Slides | Mensaje |
| :--- | :--- | :--- |
| [`carrusel_01_viajes_muertos`](posts/carrusel_01_viajes_muertos/) | `01` Portada: *"Cobrar una mesa hoy lleva 4 viajes. Con SaleListo lleva 1."* · `02` Los 4 viajes que queman al mozo · `03` La mesa pide la cuenta desde el QR con medio de pago y propina (fondo `#1C1917`) · `04` Impacto: **+18 a 25 min** recuperados por mesa · `05` Planes con **0% comisión** y contacto | Dolor operativo del cobro y tiempo muerto en hora pico |
| [`carrusel_02_cero_celulares`](posts/carrusel_02_cero_celulares/) | `01` Portada sobre `#1C1917`: *"Un salón ágil sin mozos mirando el celular."* · `02` La objeción real de imagen · `03` **Plan Base con Estación de Mozos fija** en el pase · `04` **Kit Pulsera Vibradora Xiaomi Band** con hasta 14 días de batería (fondo `#1C1917`) · `05` CTA Piloto sin riesgo de 14 días en 1 sector | Objeción de estética del salón |
| [`carrusel_03_cocina_y_barra`](posts/carrusel_03_cocina_y_barra/) | `01` Portada: *"Eliminá las comandas perdidas entre Salón, Cocina y Barra."* · `02` El costo del papel manchado y las cantadas (1,5% a 3% en mermas) · `03` Separación en **0 segundos** a Cocina (`#D97706`) y Barra (`#6D28D9`) con aclaraciones (*Sin TACC*, *poco hielo*) · `04` **Semáforo SLA** (*En tiempo*, *Atención*, *Demorado*) + baja de agotados en 1 clic · `05` CTA Piloto de 14 días en 1 sector | Ruteo Cocina/Barra, SLA y control de mermas |

Todas las slides llevan numeración `01/05`, barra de progreso y el indicador `Deslizá →` (la última reemplaza el indicador por *"Guardalo y compartilo con tu encargado"*).

### 1.2. Posts individuales (`1080x1350`)

| Archivo | Tema | Fondo |
| :--- | :--- | :--- |
| [`post_01_cero_comision_roi.png`](posts/post_01_cero_comision_roi.png) | 0% comisión frente al 18% a 30% + IVA de las apps de delivery y ROI estimado 37x | Crema `#FAF7F2` |
| [`post_02_division_cocina_barra.png`](posts/post_02_division_cocina_barra.png) | Un pedido que se bifurca en Cocina (`#D97706`) y Barra (`#6D28D9`) | Carbón `#1C1917` |
| [`post_03_qr_4g_patios_veredas.png`](posts/post_03_qr_4g_patios_veredas.png) | QR fijo en acrílico con badge **4G sin Wi-Fi** para veredas, patios y terrazas | Crema `#FAF7F2` |
| [`post_04_precios_anti_inflacion.png`](posts/post_04_precios_anti_inflacion.png) | Ajuste masivo de precios +8% sin reimprimir QR | Crema `#FAF7F2` |

### 1.3. Banners multicanal

| Archivo | Medida | Uso |
| :--- | :---: | :--- |
| [`banner_web_1920x600.png`](banners/banner_web_1920x600.png) | `1920x600` | Cabecera de landing, presentaciones y firma de propuestas |
| [`banner_display_728x90.png`](banners/banner_display_728x90.png) | `728x90` | Display horizontal (leaderboard) |
| [`banner_display_300x250.png`](banners/banner_display_300x250.png) | `300x250` | Display rectángulo mediano |
| [`linkedin_portada_1584x396.png`](banners/linkedin_portada_1584x396.png) | `1584x396` | Portada de perfil o página de LinkedIn (contenido desplazado a la derecha para no quedar bajo la foto de perfil) |
| [`linkedin_post_1200x627.png`](banners/linkedin_post_1200x627.png) | `1200x627` | Post o anuncio de LinkedIn con el caso ROI 37x |
| [`meta_ad_feed_1080x1080.png`](banners/meta_ad_feed_1080x1080.png) | `1080x1080` | Anuncio Meta en feed: *"Mozos sin celular. Salón sin caos."* |
| [`meta_ad_story_1080x1920.png`](banners/meta_ad_story_1080x1920.png) | `1080x1920` | Historias y Reels: Piloto sin riesgo por 14 días (zona segura: 260 px arriba y 300 px abajo libres) |
| [`whatsapp_catalogo_1080x1080.png`](banners/whatsapp_catalogo_1080x1080.png) | `1080x1080` | Catálogo de WhatsApp Business y Estados con los 3 planes |

### 1.4. Reels verticales (`1080x1920`, `60 fps`, locución rioplatense)

Documentados en [`guiones_reels.md`](guiones_reels.md) e integrados en el calendario de 30 días:
1. [`reels/Reel_01_Sin_Celulares_En_Salon.mp4`](reels/Reel_01_Sin_Celulares_En_Salon.mp4): estética del salón (Estación de Pase + Pulsera vibradora).
2. [`reels/Reel_02_Segundas_Rondas_Terraza.mp4`](reels/Reel_02_Segundas_Rondas_Terraza.mp4): segundas rondas en patios, veredas y terrazas con 4G.
3. [`reels/Reel_03_Cero_Comision_Precios_Al_Dia.mp4`](reels/Reel_03_Cero_Comision_Precios_Al_Dia.mp4): 0% comisión y ajuste masivo de precios sin reimprimir QR.
4. [`reels/Reel_04_Cobrar_En_Un_Viaje.mp4`](reels/Reel_04_Cobrar_En_Un_Viaje.mp4): cierre de cuenta con pago y propina elegidos en 1 solo viaje.
5. [`reels/Reel_05_Piloto_14_Dias_Un_Sector.mp4`](reels/Reel_05_Piloto_14_Dias_Un_Sector.mp4): piloto sin riesgo de 14 días en 1 sector listo en 48 horas.

> [!NOTE]
> Los códigos QR que aparecen dentro de las piezas son **ilustrativos** (patrón decorativo no escaneable). Para material impreso en mesas se usan los QR vectoriales reales que entrega el Onboarding de cada local.

---

## 2. Sistema gráfico aplicado

- **Proporción cromática 75 / 18 / 7:** fondos crema `#FAF7F2` y blancos dominantes, estructura tipográfica carbón `#1C1917` / `#57534E`, y acentos con función informativa (`#D9412B` bermellón, `#2F8A57` listo, `#D97706` Cocina, `#6D28D9` Barra). Las piezas oscuras premium (`C1 · 03`, `C2 · 01`, `C2 · 04`, `P2`, portada de LinkedIn y anuncio de feed) usan `#1C1917` con superficies `#26221F`.
- **Logo:** [`logo.svg`](../branding/logo.svg) sobre fondos claros; sobre `#1C1917` se usa `src_grafica/assets/logo-on-dark.svg`, idéntico al oficial con el wordmark en crema `#FAF7F2` (misma geometría que [`logo-dark.svg`](../branding/logo-dark.svg) sin su placa, ya que el fondo ya es carbón).
- **Tipografía:** Plus Jakarta Sans 500 a 800. Titulares de `72px a 142px` en lienzos `1080`, textos de apoyo de `24px` como mínimo para que se lean en el celular sin hacer zoom.
- **Componentes:** tarjetas blancas `radius 24px` con borde `1px #E6DFD3` y sombra cálida, píldoras `999px`, Estación de Pase en columnas por mozo, teléfono con pantalla *Pedir la cuenta*, silueta minimalista de Xiaomi Smart Band con ondas de vibración, badges `0% comisión` y `4G sin Wi-Fi`.
- **Datos:** todas las cifras salen de [`comercial/modelo_de_negocios.md`](../comercial/modelo_de_negocios.md) (planes USD 35 / 65 / 110 por mes, packs de pulseras USD 145 / 230, ahorro de 18 a 25 min por mesa, ROI estimado 37x en el restaurante tipo de 25 mesas).

---

## 3. Calendario editorial y copys

El plan completo está en [`calendario_redes_30dias.md`](calendario_redes_30dias.md): 4 semanas x 5 publicaciones, **20 copys listos para copiar y pegar** (Instagram, LinkedIn, TikTok, Historias y Estados de WhatsApp), envío del Dossier PDF en el primer contacto y la estructura de campañas Meta Ads para CABA y GBA. Resumen:

| Semana | Eje | Lunes | Martes | Miércoles | Jueves | Sábado |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Dolor operativo | Spot (IG + TikTok) | Carrusel 01 (IG) | Reel 04 (IG + TikTok) | Reel 01 (IG + TikTok) | Post 02 (IG) |
| **2** | Objeción de imagen | Post LinkedIn ROI | Carrusel 02 (IG) | Carrusel 03 (IG) | Reel 02 (IG + TikTok) | Post 03 (IG + Historias) |
| **3** | Rentabilidad | Post 01 (IG + LinkedIn) | Reel 03 (IG + TikTok) | Carrusel 03 PDF (LinkedIn) | Carrusel 01 PDF (LinkedIn) | Post 04 (IG) |
| **4** | Conversión | Carrusel 02 PDF (LinkedIn) | Spot (TikTok) | Reel 05 (IG + TikTok + LI) | Reel 01 (LinkedIn) | Historia piloto + catálogo WA |

**Meta Ads en una línea:** 3 campañas (Descubrimiento con video 30%, Conversación a WhatsApp 50%, Formulario de Piloto 20%), radios hiperlocales en Palermo, Chacarita, Villa Crespo, Colegiales, Belgrano, San Telmo, Vicente López, Olivos y San Isidro, segmentación por dueños y encargados gastronómicos, y franjas horarias de martes a jueves 10:00 a 12:30 y 16:00 a 19:00.

---

## 4. Cómo editar y volver a exportar las piezas

Las plantillas viven en [`src_grafica/`](src_grafica/) y no requieren dependencias dentro del repositorio:

| Archivo | Función |
| :--- | :--- |
| [`styles.css`](src_grafica/styles.css) | Tokens de marca, tipografía y componentes base |
| [`pieces.js`](src_grafica/pieces.js) | Definición de cada pieza (`id`, medida, ruta de salida y HTML) |
| [`render.html`](src_grafica/render.html) | Dibuja una pieza: `render.html?p=c1s1` (incluye auditoría de desbordes) |
| [`gallery.html`](src_grafica/gallery.html) | Vista previa escalada de todo el pack |
| [`export.js`](src_grafica/export.js) | Exporta todas las piezas a PNG con Chrome Headless al píxel exacto |
| `assets/` | Fuentes Plus Jakarta Sans y logos oficiales |

**Ids de piezas (27 PNG):** `c1s1` a `c1s5`, `c2s1` a `c2s5`, `c3s1` a `c3s5`, `p1` a `p4`, `web`, `d728`, `d300`, `lic`, `lip`, `mfeed`, `mstory`, `wa`.

**Exportar (PowerShell), instalando `puppeteer-core` fuera del repositorio:**

```powershell
$work = "$env:TEMP\sl_grafica_work"
New-Item -ItemType Directory -Force $work | Out-Null
npm --prefix $work init -y | Out-Null
npm --prefix $work install puppeteer-core
$env:PUPPETEER_DIR = $work
node marketing/src_grafica/export.js            # todo el pack
node marketing/src_grafica/export.js c1s3 p2    # solo algunas piezas
Remove-Item -Recurse -Force $work               # limpieza
```

El exportador usa Chrome o Edge instalados (o la ruta indicada en `CHROME_PATH`), espera a que carguen las fuentes, guarda cada PNG con `deviceScaleFactor 1` en su medida exacta y avisa si algún elemento queda fuera del lienzo.

---

## 5. Control de calidad realizado

- Las **27 imágenes PNG** (3 carruseles x 5 slides + 4 posts + 8 banners) y el **Dossier Ejecutivo A4 de 2 páginas** ([`SaleListo_Dossier_Comercial.pdf`](../comercial/SaleListo_Dossier_Comercial.pdf)) se exportaron en su medida exacta y se revisaron visualmente una por una: sin textos pisados, desbordados ni cortados en los bordes.
- Contraste verificado del logo claro sobre crema y del wordmark crema sobre `#1C1917`.
- Sin rayas largas (U+2014) en imágenes, HTML, CSS, JS ni Markdown.
- Contacto único en todas las piezas: WhatsApp **`(+54)1138436571`** y correo comercial **`ventas@salelisto.com`**. Sin URLs, dominios web ni perfiles sociales inventados.

---

**Contacto comercial:** WhatsApp `(+54)1138436571` · `ventas@salelisto.com` · Autor del proyecto: Simón Martínez de Guereñu (`simonguerenu@gmail.com`).
