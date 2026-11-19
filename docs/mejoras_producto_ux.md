# SaleListo · Mejoras de producto y UX (Oleadas 1 a 3)

Documento de trabajo del equipo de producto. Resume el diagnóstico operativo y de experiencia de uso realizado sobre la app, las mejoras implementadas en las Oleadas 1 y 3, la suite permanente de regresión E2E y las propuestas concretas de evolución.

---

## 1. Diagnóstico UX y operativo

Se recorrieron las seis pantallas del circuito (cliente QR, Estación de Mozos, Cocina/Barra, Panel del Encargado, App del Mozo y QRs) simulando un servicio de hora pico con pedidos cruzados de Cocina y Barra, llamados de mesa y cierres de cuenta.

### 1.1 Hallazgos por pantalla

| Pantalla | Hallazgo | Impacto real en el salón |
| --- | --- | --- |
| Carta QR (`cliente.html`) | Sin buscador: en cartas de 40 a 80 ítems el comensal scrollea categoría por categoría. | Más tiempo hasta el primer pedido, más llamados al mozo con "¿qué tienen sin gluten?". |
| Carta QR | Sin información dietaria (Sin TACC, veggie, vegano, picante). | Consulta obligada al mozo; riesgo de error con celíacos; pérdida de ventas en mesas mixtas. |
| Cocina/Barra (`cocina.html`) | Un único aviso de demora a los 12 min, chico y del mismo color que el resto del ticket. | En hora pico el cocinero no distingue lo "un poco atrasado" de lo "olvidado". |
| Estación de Mozos (`pase.html`) | La espera de retiros se medía desde que el plato quedó listo y no desde que la mesa pidió; umbrales distintos por tipo sin una lectura visual común. | El mozo no veía cuánto lleva esperando realmente la mesa; los platos se enfrían en el pase. |
| Panel del Encargado | El formulario de Configuración se re-dibujaba con cada evento en vivo (cada pedido o llamado). | Lo que el encargado estaba tipeando se borraba a mitad de la edición. |
| Panel del Encargado | Al recargar con sesión guardada y comandas abiertas, el panel caía a la pantalla de PIN (error de inicialización en el arranque). | El encargado perdía el panel justo en hora pico y tenía que volver a ingresar el PIN. |
| Panel del Encargado | El arqueo solo se veía en pantalla (día actual), sin forma de llevarlo al contador. | Re-tipeo manual en Excel al cierre, errores de carga. |
| Panel del Encargado | "Limpiar pedidos" no advertía que se pierde el historial de caja. | Pérdida del arqueo del día si se limpia antes de exportar. |
| Portada (`index.html`) | Mezclaba la portada comercial con el tablero operativo interno. | El dueño potencial veía enlaces técnicos; el equipo del local no tenía un punto de entrada propio. |
| Comercial | No existía un lugar para recibir y seguir las consultas que llegan desde la portada. | Consultas perdidas en el correo, sin estado ni seguimiento. |

### 1.2 Principios aplicados

1. **Legible a 3 o 4 metros**: todo indicador crítico de Cocina y Pase usa color + texto + número (nunca solo color, por accesibilidad y por pantallas lavadas por el sol).
2. **No interrumpir al que está operando**: los refrescos automáticos no deben robar foco, borrar texto ni re-dibujar lo que el usuario está tocando.
3. **Un dato, una fuente**: las etiquetas dietarias se cargan una vez en el Panel y se reflejan en la carta QR, la búsqueda y los filtros.
4. **Cero fricción para el comensal**: búsqueda tolerante a tildes y mayúsculas, filtros de un toque, estado vacío con salida clara.

---

## 2. Mejoras implementadas en esta iteración

### 2.1 Tablero operativo propio (`/operacion.html`)

- El tablero interno se trasladó desde la portada a `operacion.html`, con enlace limpio **`← Volver a la portada comercial`** hacia `/`.
- Accesos directos a `pase.html`, `cocina.html` (con atajos **Todo / Solo Cocina / Solo Barra**), `restaurante.html`, `mozo.html`, `qr.html` y `demo.html`.
- **Indicadores en vivo** (cuando el estado del personal está disponible: modo demo o sesión de encargado): mesas ocupadas, comandas en preparación y demoradas, retiros esperando en el pase, cobrado del día y consultas comerciales nuevas (con acceso directo a la bandeja).
- **Checklist de apertura de turno** de 2 minutos, guardado en el dispositivo y reiniciado cada día.
- **QR de acceso** para abrir el tablero en la tablet o TV del pase sin tipear la dirección (usa el link público configurado o la IP de la red local).
- El servidor imprime la nueva ruta al iniciar (`Tablero operativo: {base}/operacion.html`).

### 2.2 Carta QR: buscador instantáneo y etiquetas dietarias

- **Base de datos**: nueva columna `items.tags TEXT NOT NULL DEFAULT ''` con migración segura `ALTER TABLE` (mismo patrón que las migraciones previas). Al migrar una base existente se etiquetan solo los platos clásicos de la carta demo que conservan su nombre original; los platos propios del local quedan sin etiqueta y se editan desde el Panel. Etiquetas válidas: `sin_tacc`, `veggie`, `vegano`, `picante`, `sin_alcohol` (lista blanca; vegano implica veggie automáticamente).
- **Seed inicial** con etiquetas coherentes (ej. Edamame `sin_tacc,veggie,vegano`, Karaage y Ramen Tonkotsu `picante`, bebidas sin alcohol marcadas).
- **Cliente** (`cliente.html`, `cliente.js`, `cliente.css`):
  - Barra fija con **búsqueda instantánea** (`Buscar plato o bebida...`): ignora tildes y mayúsculas, busca en nombre, descripción, categoría y etiquetas, admite varias palabras. Fuente de 16 px para evitar el zoom automático de iPhone. `Esc` limpia.
  - **Chips de filtro rápido** combinables: `⭐ Populares`, `🌾 Sin TACC`, `🌱 Veggie`, `🌶️ Picante` (un chip solo aparece si hay ítems que lo cumplan).
  - Contador de resultados, categorías con cantidad de coincidencias, **estado vacío** con botón "Ver toda la carta".
  - **Pastillas visuales** por plato (en la tarjeta y en la ficha del plato): Sin TACC, Veggie, Vegano, Picante, Sin alcohol.
- **Panel** (`restaurante.*`): selector de etiquetas con chips-checkbox en el modal de producto y etiquetas visibles en el listado del menú.

### 2.3 Semáforo SLA de demora (Cocina/Barra, Pase y Panel)

| Estado | Comandas (desde que la mesa pidió) | Llamados y cuentas en el Pase | Lectura |
| --- | --- | --- | --- |
| 🟢 Verde | menos de 8 min | menos de 3 min | `En tiempo · X min` |
| 🟠 Ámbar | 8 a 14 min | 3 a 5 min | `Atención · X min` + contorno ámbar |
| 🔴 Coral | 15 min o más | 6 min o más | `Demorado · X min` + contorno coral, fondo destacado y pulso suave |

- **Cocina/Barra**: franja de semáforo en cada comanda, resumen 🟢/🟠/🔴 en la barra superior y **refresco liviano cada 15 s** que solo actualiza los semáforos (no re-dibuja el tablero ni interrumpe un toque). Cuando una comanda cruza los 15 min suena una campana corta y aparece un aviso una única vez (las que ya estaban demoradas al abrir la pantalla no disparan una ráfaga).
- **Estación de Mozos**: la espera del retiro se mide ahora desde el pedido de la mesa (con "listo hace X min" como dato secundario), umbral más corto para llamados y cuentas porque la mesa espera a una persona, contador `🔴 N demorados` en el encabezado y refresco cada 15 s.
- **Panel del Encargado**: chip de semáforo en cada comanda abierta y borde coral en las demoradas.
- Se respeta `prefers-reduced-motion` (sin pulso para quien lo tenga desactivado).

### 2.4 Exportación contable CSV (`GET /api/export/sessions.csv`)

- Requiere token de encargado (cabecera `X-Auth-Token` o `?token=`) o modo demo activo.
- **UTF-8 con BOM** (`\ufeff`) para que Excel en Windows abra tildes y eñes correctamente, y **separador punto y coma**, que es el separador de listas de Excel con configuración regional Argentina (con coma, Excel es-AR mete todo en una sola columna).
- Columnas: Fecha apertura, Hora apertura, Fecha cierre, Hora cierre, Mesa, Bloque, Mozo, Medio de pago, Subtotal, % Propina, Monto propina, Total, ID sesión. Montos enteros en pesos.
- Filtro opcional por fechas `?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`.
- Protección contra inyección de fórmulas (celdas que empiezan con `=`, `+`, `-`, `@`).
- En el Panel: botones **`📥 Descargar Arqueo CSV`** (histórico completo) y **`📅 CSV de hoy`** en la cabecera de Caja, más un recuadro de arqueo dentro del resumen. La confirmación de "Limpiar pedidos" ahora recomienda exportar antes.
- El resumen de caja suma **propinas por mozo** y la hora de cierre en el historial.

### 2.5 Bandeja de consultas comerciales (Leads)

- **`POST /api/leads`** (público, sin token): valida nombre o restaurante y contacto, recorta largos máximos seguros, limpia caracteres de control, guarda en la tabla `leads`, dispara la actualización en vivo y responde `{ "ok": true, "lead": {...} }`. Anti-spam liviano: máximo 6 envíos por IP cada 10 minutos (respuesta `429` con mensaje claro).
- **`GET /api/leads`** (encargado o modo demo) y acción **`lead.status`** con estados `nuevo`, `contactado`, `piloto`, `descartado`. Los últimos 50 leads viajan como `leads` dentro del estado del personal.
- "Restaurar demo de fábrica" **no borra** las consultas comerciales.
- **Panel → 📨 Consultas**: contador de nuevas en el menú lateral, aviso sonoro y toast al llegar una consulta, filtros (Activas, Nuevas, Contactadas, En piloto, Descartadas, Todas), tarjeta con zona, cantidad de mesas, plan de interés y mensaje, botones **💬 Responder por WhatsApp** (normaliza celulares argentinos a `549...` y precarga un saludo) y **✉️ Responder por correo**, copiar contacto, cambio de estado en un toque y descarte reversible. Al responder, una consulta nueva pasa sola a "Contactado".
- Enlace profundo `restaurante.html#consultas` (también `#caja`, `#menu`, `#mozos`, `#salon`, `#comandas`).

### 2.6 Multimedia de la portada (`/media/...`)

- Servido con `Cache-Control: public, max-age=86400`, `ETag`, `Last-Modified` y respuesta `304` cuando corresponde.
- Soporte completo de **`Range` / `206 Partial Content`** (`Accept-Ranges: bytes`, rangos con sufijo, `416` si el rango es inválido) y envío por bloques, para que el video `.mp4` arranque y se pueda adelantar sin descargarlo entero.
- Protección contra path traversal (`/media/../server.py` devuelve `404`).

### 2.7 Correcciones de UX en el Panel

- **Bug crítico corregido**: al recargar el Panel en pleno servicio con la sesión guardada (o al abrir `?demo=1`) y con comandas abiertas, el arranque fallaba por una constante usada antes de inicializarse (`NEXT_FLOW`) y el encargado caía a la pantalla de PIN. Ahora el arranque se ejecuta cuando todo el módulo está listo.
- El formulario de Configuración **ya no se borra** mientras se edita: muestra "Cambios sin guardar" y un botón "Descartar cambios"; el resumen de caja sigue actualizándose en vivo.

### 2.8 Estudio de Impresión Profesional QR (`/qr.html` · Oleada 3)

- Evolución de la hoja básica de QRs a un estudio interactivo pensado tanto para imprimir en el local (`Ctrl+P` / Guardar como PDF A4) como para enviar artes finales a una gráfica láser UV:
  - **Tres formatos físicos calibrados en milímetros para hoja A4**:
    1. **Tent-Card Acrílico 10×15 cm** con selector `4 por A4` (compacto) o `2 por A4` (tamaño real de portamenú vertical).
    2. **Sticker de Mesa 8×8 cm** (6 vinilos cuadrados exactos de `80×80 mm` por carilla A4 con activación automática de guías de corte punteadas).
    3. **Tarjeta Compacta** (9 piezas por A4 para barra o posavasos).
  - **Dos estilos oficiales de marca (Propuesta 01)**: **Crema Cálido (`#FAF7F2`)** editorial luminoso y **Carbón Premium (`#1C1917`)** ideal para bares nocturnos, con curvas vectoriales nativas de `logo.svg`, marco blanco de alto contraste alrededor del QR y píldora `4G · Sin pedir Wi-Fi`.
  - **Filtro en vivo por bloque/sector** (ej. imprimir únicamente las 4 mesas de *Terraza* para un piloto de 14 días), **leyenda al pie editable en tiempo real** con presets rápidos y cálculo automático de cantidad de hojas A4.
  - **Descarga vectorial `.svg` individual por mesa** (`⬇ Descargar .svg`): genera al vuelo un archivo `.svg` autónomo en milímetros reales (`100×150 mm`, `80×80 mm` o `62×88 mm`), sin dependencias externas y con logo en curvas, listo para abrir en Illustrator o CorelDRAW.

### 2.9 Simulador de Hora Pico en 1 Clic (`/demo.html` · Oleada 3)

- Incorporación en la barra superior de **`⚡ Simular Hora Pico`** junto a **`↺ Limpiar turno demo`**, más una franja narradora paso a paso (`1 · Pedido mixto QR` -> `2 · Cocina + Barra listos` -> `3 · Llamado en salón` -> `4 · Cuenta Tarjeta + 10%`).
- En menos de 4 segundos ejecuta transacciones reales sobre la API y las transmite por SSE sin recargar iframes: pedido mixto en Terraza que se separa entre Cocina y Barra, comandas que pasan a `listo` encendiendo las columnas del Pase y las alertas del mozo, llamado de atención en otra mesa y solicitud de cuenta con `Tarjeta + 10% propina` lista para cobrar en un solo viaje.
- Escalado proporcional de viewports en escritorio para que los dos celulares rendericen a ancho móvil real (`~390 px`) sin solapamientos y el panel derecho muestre las **3 columnas horizontales completas** de la Estación de Mozos y de Cocina en pantallas `1440×900`.

### 2.10 Suite permanente de pruebas E2E sin dependencias (`app/tests_e2e.py` · Oleada 3)

- Script autónomo ejecutable con `python app/tests_e2e.py` (100% biblioteca estándar de Python) que aísla `DATA_DIR` en un `TemporaryDirectory` antes de importar el servidor (nunca toca `app/data/` ni deja `app/__pycache__`), levanta `ThreadingHTTPServer` en un puerto efímero (`0`) y valida 7 bloques críticos:
  1. Vectores criptográficos NIST AES-128-GCM, ECDH/ES256 P-256, firma VAPID JWT y round-trip RFC 8291 (`webpush.self_test()`) + endpoint `/api/push/vapid-public-key`.
  2. Tokens QR válidos vs rechazo de tokens falsos, bloqueo de `?mesa=` cuando `demoMode=False` y **anti-spoofing de precios** (ignora precios adulterados enviados por el cliente y cobra siempre el valor de SQLite).
  3. Separación automática de un pedido mixto en 2 órdenes simultáneas (`cocina` + `barra`) bajo un mismo `batchId` conservando notas.
  4. Balanceo de carga entre mozos en sectores pre-asignados/automáticos y **reasignación automática** de sesiones y llamados abiertos cuando un mozo pasa a `available=False`.
  5. Cálculo exacto de subtotal + propina, bloqueo de cierre con pedidos pendientes, KPIs de caja y descarga de `GET /api/export/sessions.csv` con BOM UTF-8 (`EF BB BF`) y separador `;`.
  6. Alta pública, validaciones `400`, permisos `401` fuera de modo demo, cambio de estado `lead.status` y limitador antispam `429` de `POST /api/leads`.
  7. Streaming `HTTP 206 Partial Content`, `ETag`/`304`, rangos por sufijo, `416` y bloqueo de path traversal (`404`) sobre `/media/hero-salon-loop.mp4`.

---

## 3. Verificación realizada

- `node --check` sin errores en `cliente.js`, `cocina.js`, `pase.js` y `restaurante.js`; `python -c "import db, server"` sin errores y `webpush.py` intacto.
- Prueba E2E con servidor y `DATA_DIR` temporales: leads (validaciones, alta, listado, cambio de estado, permisos con y sin modo demo, límite por IP), etiquetas (lista blanca, conservación al editar sin enviar `tags`), CSV (BOM, separador, columnas, `401` sin token), multimedia (`206`, sufijo, `416`, `HEAD`, caché, traversal).
- Migración probada con una base creada por la versión anterior de `db.py`: agrega `tags` y `leads`, etiqueta solo los clásicos y no vuelve a etiquetar al reabrir.
- Recorrido visual en Chrome headless (escritorio y celular 390 px) de todas las pantallas modificadas, sin errores de JavaScript.

---

## 4. Propuestas de evolución

### 4.1 Corto plazo (1 a 2 semanas)

1. **SLA configurable por local y por estación** (ej. Barra 5/10 min, Cocina 12/20 min) desde Caja y Ajustes, y por categoría (un asado no tiene el mismo tiempo que una gaseosa).
2. **Ordenar las tarjetas del Pase por urgencia** (coral primero) dentro de cada columna de mozo.
3. **Alérgenos completos** (frutos secos, mariscos, lácteos, huevo) con aviso destacado en la comanda de Cocina cuando el plato lleva una nota de alergia.
4. **Notificación de lead nuevo por Web Push** al celular del dueño, reutilizando la infraestructura de la pulsera.
5. **Separar los datos comerciales del estado del salón**: hoy los leads viajan en el estado del personal (incluye pantallas de Cocina y mozos); conviene un canal solo para el rol encargado.

### 4.2 Mediano plazo (1 a 2 meses)

1. **Reporte de tiempos reales**: tiempo medio de preparación por plato y por estación, y porcentaje de comandas en verde por turno, exportable junto al arqueo.
2. **Cierre de caja formal (Z)** con efectivo contado vs. sistema, diferencias y firma del encargado.
3. **Modificadores de plato** (punto de la carne, guarnición, sin cebolla) estructurados en vez de texto libre, para que Cocina los lea siempre igual.
4. **Carta multi-idioma** (español / inglés / portugués) para zonas turísticas, con detección por idioma del teléfono.
5. **Fotos optimizadas automáticamente** en WebP y tamaños responsivos para carga instantánea en 4G.

### 4.3 Largo plazo

1. **Integración con facturación electrónica ARCA** y con POS / medios de pago QR para cerrar la mesa sin pasar por la caja.
2. **CRM liviano de leads**: recordatorios de seguimiento, notas por consulta y embudo de conversión a piloto.
3. **Pronóstico de demanda** por franja horaria para sugerir cuántos mozos poner en turno.
4. **Modo offline-first** de la comandera con cola local y re-sincronización si se corta internet en la cocina.
