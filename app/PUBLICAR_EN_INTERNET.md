# Cómo publicar SaleListo en Internet (Enlace HTTPS público)

SaleListo opera en producción 24/7 en [**https://salelisto.com**](https://salelisto.com/) sobre **Railway + Cloudflare SSL** (con redirección `301` desde `www.salelisto.com` hacia `https://salelisto.com` y casillas oficiales activas en Cloudflare: `simon@salelisto.com`, `valentin@salelisto.com`, `ventas@salelisto.com` y `consultas@salelisto.com`).

Rutas públicas y operativas en vivo:
- **Portada comercial:** `https://salelisto.com/` *(con `og-salelisto.png` `1200x630`, `robots.txt` y `sitemap.xml`)*
- **Demo interactiva multipantalla:** `https://salelisto.com/demo.html`
- **Hub operativo del local:** `https://salelisto.com/operacion.html`
- **Panel del encargado:** `https://salelisto.com/restaurante.html`
- **Estación de Mozos fija (Pase):** `https://salelisto.com/pase.html`
- **Comandera 3 estaciones (Cocina / Barra / Mostrador):** `https://salelisto.com/cocina.html`
- **Estudio de impresión QR A4:** `https://salelisto.com/qr.html`

Además, podés publicar tu propia instancia con enlace HTTPS público para que cualquier comensal escanee el QR corto de su mesa desde la cámara de su celular (sin descargar apps ni registrarse), con cero dependencias externas de Python (`pip`):

---

## Opción 1 · Despliegue Cloud HTTPS 24/7 con Dominio Propio (Railway + Cloudflare SSL / Render / Fly.io)

Arquitectura utilizada en producción para **`https://salelisto.com`**:
1. Subí este repositorio a **GitHub** y conectalo en **Railway.app** (o **Render.com** / **Fly.io**):
   - `Procfile` ejecuta `python app/server.py` escuchando automáticamente en `PORT`.
   - Montá un volumen persistente en `/var/data` y definí `DATA_DIR=/var/data`, `TZ=America/Argentina/Buenos_Aires` y `PUBLIC_URL=https://salelisto.com` (o tu dominio propio).
   - En Render, `render.yaml` configura automáticamente `rootDir: app`, disco persistente `1 GB` en `/var/data` y zona horaria Argentina.
2. En **Cloudflare DNS + SSL/TLS**:
   - Apuntá el dominio raíz (`salelisto.com`) al destino provisto por Railway con SSL/TLS activo y configurá una regla de redirección `301` de `www.salelisto.com` a `https://salelisto.com`.
   - En **Cloudflare Email Routing**, activá las casillas corporativas del dominio (`simon@salelisto.com`, `valentin@salelisto.com`, `ventas@salelisto.com`, `consultas@salelisto.com`).
3. Entrá a `/restaurante.html` (PIN inicial: `1234`), cambiá el PIN en **Caja y Ajustes**, desactivá el *Modo Demo* y abrí `/qr.html` para imprimir los códigos QR cortos (`/q/<token>`) definitivos de tus mesas.

---

## Opción 2 · Desde la PC de mostrador del local (Túnel HTTPS público integrado)

Ideal si corrés SaleListo en la computadora de caja sin contratar servidor en la nube ni abrir puertos en el router.

### A) Arranque rápido en 1 comando o 1 clic (pruebas y puesta en marcha)
- Por consola:
  ```bash
  python app/server.py --tunnel
  ```
  (o con `SALELISTO_TUNNEL=1`). Si todavía no tenés `cloudflared` en la PC, podés pasarlo con `--auto-install-tunnel` o iniciarlo en 1 clic desde **Panel del Encargado -> Caja y Ajustes** o desde **Estudio QR (`qr.html`)** (requiere sesión de encargado con PIN real).
- SaleListo levanta `cloudflared tunnel --url http://127.0.0.1:8123`, captura automáticamente la dirección segura HTTPS y actualiza los QRs cortos `/q/<token>` en tiempo real.
- Nota: el túnel rápido cambia de URL si reiniciás la PC. Usalo para probar el circuito completo antes de imprimir acrílicos definitivos.

### B) Túnel permanente con dominio fijo (para QRs impresos en acrílico)
Para que los QRs impresos en las mesas jamás cambien tras reiniciar la PC:
1. Creá un túnel gratuito en **Cloudflare Zero Trust -> Networks -> Tunnels** apuntando tu dominio propio (ej. `https://salelisto.com` o el dominio de tu local) hacia `http://127.0.0.1:8123`.
2. Iniciá SaleListo con las variables de entorno:
   - `CLOUDFLARE_TUNNEL_TOKEN=<tu_token>`
   - `PUBLIC_URL=https://salelisto.com` (o guardalo en **Panel -> Caja y Ajustes -> Dominio fijo público HTTPS**).
3. Verificá en `/qr.html` que el estado muestre **`Enlace público activo`** antes de mandar a imprenta.

---

## Precedencia automática de la URL codificada en los QRs

1. **Dominio fijo guardado** en **Panel -> Caja y Ajustes** (`restaurant.public_url`)
2. Variable de entorno **`PUBLIC_URL`**
3. **Túnel HTTPS público activo** (`cloudflared`)
4. Cabeceras **`X-Forwarded-Proto` / `X-Forwarded-Host`** (únicamente desde proxy confiable o entorno cloud)
5. Modo red local LAN (`http://<ip-local>:8123`)
