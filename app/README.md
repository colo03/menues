# SaleListo: Sistema Integral Restaurante, Pase de Mozos, Pulseras y Pedidos QR

Plataforma gastronómica lado restaurante y lado cliente en producción 24/7 sobre [**https://salelisto.com**](https://salelisto.com/) (Railway + Cloudflare SSL, con redirección `301` desde `www.salelisto.com`) y lista para probar localmente con Python estándar, sin dependencias externas de `pip`.

## Entorno Oficial en Vivo (`https://salelisto.com`)

- **Portada Comercial B2B:** `https://salelisto.com/`
- **Demo circuito completo en vivo:** `https://salelisto.com/demo.html`
- **Acceso operativo del local:** `https://salelisto.com/operacion.html`
- **Panel del Encargado:** `https://salelisto.com/restaurante.html` *(demo aislada: `https://salelisto.com/restaurante.html?demo=1`)*
- **Estación de Mozos fija (sin celulares en el salón):** `https://salelisto.com/pase.html`
- **App Móvil del Mozo + Modo Pulsera (Xiaomi Band):** `https://salelisto.com/mozo.html`
- **Pantalla Cocina, Barra y Mostrador:** `https://salelisto.com/cocina.html`
- **QRs fijos imprimibles por bloque:** `https://salelisto.com/qr.html`

## Casillas Oficiales y Contacto

- **WhatsApp / Teléfono único:** `(+54)1138436571`
- **Casillas oficiales activas (`@salelisto.com` en Cloudflare):** `simon@salelisto.com`, `valentin@salelisto.com`, `ventas@salelisto.com` y `consultas@salelisto.com`

## Cómo probarlo en tu computadora ahora mismo

Hacé doble clic en **`iniciar.bat`** o ejecutá:

```bash
python server.py
```

Abrí en tu navegador:
- **Portada general:** `http://localhost:8123/`
- **Demo circuito completo en vivo:** `http://localhost:8123/demo.html`
- **Panel del Encargado:** `http://localhost:8123/restaurante.html` *(PIN inicial: `1234`)*
- **Estación de Mozos fija (sin celulares en el salón):** `http://localhost:8123/pase.html`
- **App Móvil del Mozo + Modo Pulsera (Xiaomi Band):** `http://localhost:8123/mozo.html`
- **Pantalla Cocina y Barra:** `http://localhost:8123/cocina.html`
- **QRs fijos imprimibles por bloque:** `http://localhost:8123/qr.html`

Para ejecutar el auto-test criptográfico del motor Web Push (vectores NIST AES-128-GCM, firma ECDSA P-256 `ES256` y cifrado/descifrado RFC 8291 `aes128gcm`):

```bash
python webpush.py
```

## Qué incluye esta versión

1. **QRs cortos con token fijo por mesa + Enlace HTTPS público**: Generador SVG de QRs propio (sin CDNs externos), rutas cortas `/q/<token>` y tokens secretos fijos por mesa (`cliente.html?t=...`) para impedir pedidos falsos entre mesas.
2. **Estación de Mozos Fija (`pase.html`) para operar sin celulares en el salón**:
   - Pensada para una tablet o monitor horizontal en el mostrador del pase o la barra, legible a 3 o 4 metros.
   - Columnas automáticas por mozo en turno mostrando retiros listos de Cocina y Barra, cuentas pedidas con medio de pago/propina/total exacto, llamados de mesa y carga ágil de pedidos en mostrador.
3. **Modo Pulsera Vibradora (Xiaomi Smart Band) vía PWA + Web Push Nativo sin dependencias**:
   - PWA instalable (`manifest.json` + Service Worker `/sw.js`) y motor `webpush.py` 100% Python stdlib (`RFC 8291 aes128gcm` + `VAPID RFC 8292` sobre NIST P-256, AES-128-GCM y HKDF-SHA256).
   - Funciona con la pantalla del teléfono apagada y bloqueada en el bolsillo: despierta al Service Worker por notificación nativa del sistema operativo y hace vibrar la Xiaomi Smart Band vinculada por Bluetooth en *Mi Fitness* con textos ultracompactos (`<= 26` / `<= 48` caracteres) y botón de prueba en 1 toque (`POST /api/push/test`).
   - Las claves VAPID del restaurante se generan y persisten automáticamente en `data/vapid_keys.json`, limpiando suscripciones vencidas (`HTTP 404` / `410`).
4. **Constructor del Salón por Bloques + Asignación Híbrida / Automática de Mozos**:
   - Plantillas rápidas (*Interior*, *Terraza*, *Exterior / Vereda*, *Barra*, *Sector 1/2*, *Patio*, *Salón VIP*), pre-asignación por bloque o balanceo automático por menor carga, y transferencia automática de mesas abiertas al salir de turno.
5. **Ruteo Directo y Simultáneo a Cocina y Barra + Caja Real**:
   - Separación automática de cada pedido entre **Cocina** y **Barra**, ABM completo de menú con compresión de fotos, ajuste porcentual masivo de precios (`+%`), control de pedidos pendientes antes de cerrar mesa y arqueo de ventas y propinas por medio de pago y por mozo.

Para subirlo a internet con enlace HTTPS público y Modo Pulsera Web Push, mirá **`PUBLICAR_EN_INTERNET.md`**.
