# SaleListo · Mejoras de producto, seguridad y UX (Oleadas 1 a 4 · EGM)

Documento de trabajo del equipo de producto e ingeniería. Resume el diagnóstico operativo y de experiencia de uso realizado sobre el ecosistema, las mejoras implementadas desde la Oleada 1 hasta la resolución integral **Elephant-Goldfish Model (EGM · Oleada 4)** (ver [`goldfish_review_report.md`](./goldfish_review_report.md)), la suite permanente de regresión E2E y la hoja de ruta evolutiva.

---

## 1. Diagnóstico UX y operativo

Se recorrieron todas las pantallas del circuito (Landing B2B, Hub Operativo, Carta QR, Estación de Mozos, Comandera 3 Estaciones, Panel del Encargado, PWA del Mozo, Estudio QR y Demo Multipantalla) simulando un servicio real de viernes/sábado en hora pico en Buenos Aires.

### 1.1 Hallazgos principales resueltos en Oleadas 1 a 4

| Pantalla / Área | Hallazgo detectado | Resolución aplicada |
| --- | --- | --- |
| Carta QR (`cliente.html`) | Sin buscador ni filtros dietarios; fricción grupal al dividir la cuenta o pagar en efectivo con cambio grande; SSE re-renderizaba el modal abierto. | Buscador instantáneo sin tildes, filtros `Sin TACC`/`Veggie`/`Picante`, **Calculadora "Vaquita" (`÷ N`)**, **declaración de efectivo con cálculo de vuelto**, botón **`🔄 Repetir`** ronda y preservación total del modal ante SSE. |
| Estación de Mozos (`pase.html`) | Pasos intermedios innecesarios en llamados y cuentas; antes se ocultaba el detalle de pago antes de cerrar; `setInterval` cada 15 s destruía el DOM; en salones grandes sobraban columnas vacías. | **Confirmación directa en 1 único botón** (`✔ Atendido` en llamados y `✔ Cobrar y cerrar` en cuentas, sin pasos intermedios), tarjeta **`💳 CUENTA PEDIDA`** con medio de pago, propina, *Vaquita* y vuelto exacto visibles hasta cerrar sesión, `tickSla()` in-place, **filtro por bloque (`?bloque=`)**, compactación automática con `>= 4` mozos y *Screen Wake Lock*. |
| Comandera KDS (`cocina.html`) | Solo soportaba 2 estaciones (`Cocina`/`Barra`); el cocinero no podía pausar un plato agotado (*86*) desde su pantalla; usaba `window.prompt()` para PIN. | Incorporación de la **3.ª estación real `🍣 Mostrador`** (Sushi / Parrilla / Pastelería), **cajón rápido `🚫 Agotados (86)`** habilitado para rol `kitchen`, botones `>= 44 px`, modal propio de PIN, silencio real de audio y *Screen Wake Lock*. |
| Panel (`restaurante.html`) | En modo demo público se exponían leads reales; editar mozo con PIN vacío borraba su PIN; ajuste masivo por inflación no tenía vista previa ni deshacer; borrar una mesa eliminaba su arqueo histórico. | Rol aislado **`demo_admin`** con leads ficticios en memoria (`DEMO-L1`/`L2`), preservación de PIN de mozo, **Vista Previa Antes/Después + `↩ Deshacer`** en ajuste por inflación, y **baja lógica contable (`archived = 1`)** que protege el arqueo CSV. |
| Landing Comercial (`index.html`) | Enlaces al Panel chocaban con pantalla de PIN; `window.open` de WhatsApp tras `fetch` podía bloquearse en móviles; calculadora ROI no sincronizaba moneda ni permitía compartir enlace personalizado. | Enlaces directos a `restaurante.html?demo=1`, física exacta BLE (celular bloqueado en bolsillo vs. locker en Pase), CTA directo `<a href="https://wa.me/541138436571...">`, deep-links `?mesas=&ticket=&turnos=#roi` con botón copiar y transparencia *Próximamente* en funciones de Fase 2. |
| Servidor y Turno Nocturno | Reiniciar el servidor reiniciaba `db.version` y sesiones; a medianoche (`00:00` o `21:00 ART` en cloud UTC) se cortaba el arqueo en pleno despacho nocturno. | `state_ver` monotónica, `server_secret.key` y `staff_sessions` persistidos en SQLite, disco `/var/data` en Render y **corte de turno gastronómico a las `06:00 AM ART` (`UTC-3`)**. |

### 1.2 Principios de diseño aplicados

1. **Legible a 3 o 4 metros sin tocar pantallas**: todo indicador crítico combina color + etiqueta textual + minutos (`🟢 En tiempo`, `🟠 Atención`, `🔴 Demorado`), manteniendo la pantalla encendida con *Wake Lock*.
2. **Jamás interrumpir al que está operando**: ni `cliente.js`, ni `pase.js`, ni `cocina.js`, ni `restaurante.js` destruyen selecciones o formularios abiertos cuando ingresa un evento SSE.
3. **Transparencia comercial y pro-equipo**: propina no solicitada en `0%` por defecto (nunca pre-cargada sin elección del comensal), cero funciones prometidas que no estén activas y narrativa enfocada en aliviar al plantel de salón.

---

## 2. Resumen de módulos y mejoras activas

### 2.1 Hub Operativo en vivo (`/operacion.html`) y Demo Hora Pico (`/demo.html`)
- `operacion.html` conectado por **SSE en tiempo real** para actualizar mesas ocupadas, comandas demoradas, retiros en pase y recaudación del turno vigente (`06:00 AM ART`) sin recargar la página, junto a checklist diario y QR para TV/tablet.
- `demo.html` incorpora **`⚡ Simular Hora Pico`** en 1 clic (4 pasos reales sobre SSE) y **`↺ Limpiar turno demo`** ejecutando `data.clear_open_turn` (limpia únicamente sesiones abiertas sin destruir el historial cerrado del turno).

### 2.2 Carta QR con Buscador, Etiquetas Dietarias, "Vaquita", Vuelto y Repetir Ronda
- **Etiquetas dietarias (`items.tags`)**: `sin_tacc`, `veggie`, `vegano`, `picante` y `sin_alcohol` con búsqueda instantánea tolerante a tildes (`16 px` sin auto-zoom en iOS) y chips combinables.
- **Cierre grupal sin fricción**:
  - **Calculadora "Vaquita"**: divide el total con propina entre `N` comensales en vivo dentro del modal *Pedir la cuenta*.
  - **Efectivo con vuelto exacto**: chips rápidos (`Importe justo`, `$20.000`, `$50.000` o monto libre) que informan `cashAmount` y muestran `changeAmount` tanto en el Pase como en la pulsera del camarero.
  - **Repetir ronda (`🔄 Repetir`)** en 1 toque desde *Mis pedidos* y campo corto de detalle en `💬 Otro` al llamar al mozo.

### 2.3 Tres Estaciones Reales (`Cocina`, `Barra`, `Mostrador`), Agotados 86 y Pase por Bloques
- Ruteo paralelo hacia **`Cocina`**, **`Barra`** y **`Mostrador`** (sushi, parrilla exterior o vitrina dulce), configurable por categoría o por ítem individual (`stationOverride`).
- Cajón rápido **`🚫 Agotados`** en `cocina.html` para pausar o reactivar platos agotados en 1 toque sin depender del encargado.
- En `pase.html`, `mozo.html` y `restaurante.html`: filtro instantáneo por sector (`?bloque=...`), compactación automática de columnas sin pendientes cuando operan 4 o más mozos, y **confirmación directa en 1 único toque** (`✔ Atendido` en llamados y `✔ Cobrar y cerrar` en cuentas con todo el detalle de pago, propina, *Vaquita* y vuelto visible hasta el cierre efectivo de la mesa, sin estados intermedios).

### 2.4 PWA Instalable, Íconos Raster y Física Bluetooth BLE
- Íconos raster oficiales `icon-180.png`, `icon-192.png` e `icon-512.png` generados desde Propuesta 01 `mark.svg` y enlazados en `manifest.json`, `mozo.html` y `cliente.html`.
- Navegación con `?waiter=` preservada en `sw.js`, validación de rotación de `applicationServerKey` VAPID, control global de silencio sonoro (`toggleSoundMute()`) y textos ultracompactos para Xiaomi Smart Band con el celular bloqueado en el bolsillo del mozo.

### 2.5 Exportación Contable CSV (`06:00 AM ART`), Baja Lógica y Aislamiento de Leads
- `GET /api/export/sessions.csv` en **UTF-8 con BOM** y separador `;`, corte operativo gastronómico a las `06:00 AM ART`, sanitización contra inyección de fórmulas y preservación íntegra de sesiones históricas mediante baja lógica (`archived = 1`, `closed_table_code`, `closed_block_name`).
- Aislamiento total de PII comercial: los visitantes en modo demostración (`demo_admin`) interactúan con 2 consultas ficticias en memoria sin acceso alguno a la tabla real `leads` de SQLite.

### 2.6 Estudio de Impresión Profesional QR (`/qr.html`) hasta Versión 10
- Formatos A4 calibrados en milímetros (`Tent-Card 10x15 cm`, `Sticker 8x8 cm` con guías de corte, `Tarjeta Compacta`), estilos **Crema Cálido** y **Carbón Premium**, descarga vectorial `.svg` individual, soporte QR hasta Versión 10 (`271` bytes) y protección por PIN cuando `demoMode = False`.

### 2.7 Suite Permanente de Pruebas E2E (`app/tests_e2e.py`)
- Ejecutable con `python -B app/tests_e2e.py` en biblioteca estándar pura sobre directorio temporal aislado, cubriendo vectores criptográficos Web Push RFC 8291/8292, bloqueo Anti-SSRF, protección `/api/qrs` en producción, aislamiento `demo_admin` de leads, preservación de PIN de mozos, integridad contable tras borrar mesas con historial, versión monotónica, corte horario `06:00 ART`, ruteo a 3 estaciones (`mostrador`), *Vaquita* + vuelto exacto, `item.toggle` por cocina, `/api/health` y streaming `HTTP 206`.

---

## 3. Hoja de Ruta Evolutiva (Roadmap Fase 2 y Fase 3)

### 3.1 Roadmap Fase 2 (Próximamente)
1. **Cobro QR integrado en mesa** (Mercado Pago, MODO y QR interoperable), incluyendo modo opcional de prepago habilitable solo para el bloque *Vereda* en horario nocturno.
2. **Listas horarias automáticas** (*Menú Ejecutivo* de mediodía y *Happy Hour* vespertino por días y franjas).
3. **Sincronización multisede** de catálogo y precios para cadenas y franquicias gastronómicas.
4. **SLA configurable por estación** (umbrales diferenciados entre Barra rápida, Mostrador y Cocina elaborada).

### 3.2 Roadmap Fase 3 (Mediano y Largo Plazo)
1. **Módulo de Ingeniería de Menú y tiempos reales**: tiempo medio de preparación por plato/estación y matriz de platos Estrella vs. Clavo exportable en CSV.
2. **Conectores directos opcionales con facturación electrónica ARCA (ex AFIP)** y sistemas POS de terceros.
3. **Carta multi-idioma automática** (español / inglés / portugués) para corredores turísticos.
4. **Fila virtual con QR en recepción** y beneficios automáticos para levantar ocupación de lunes a miércoles.
