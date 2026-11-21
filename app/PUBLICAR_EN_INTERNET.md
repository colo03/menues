# Cómo publicar SaleListo en Internet (para usar con 4G/5G sin Wi-Fi)

SaleListo permite que cualquier comensal escanee el QR de su mesa con los datos móviles **4G/5G** de su celular (sin pedir la clave del Wi-Fi del local) de dos formas, con cero dependencias externas de Python (`pip`):

---

## Opción 1 · Desde la PC de mostrador del local (Túnel HTTPS Cloudflare integrado)

Ideal si corrés SaleListo en la computadora de caja sin contratar servidor ni abrir puertos en el router.

### A) Arranque rápido 4G/5G en 1 comando o 1 clic (pruebas y puesta en marcha)
- Por consola:
  ```bash
  python app/server.py --tunnel
  ```
  (o con `SALELISTO_TUNNEL=1`). Si todavía no tenés `cloudflared` en la PC, podés pasarlo con `--auto-install-tunnel` o iniciarlo en 1 clic desde **Panel del Encargado -> Caja y Ajustes** o desde **Estudio QR (`qr.html`)** (requiere sesión de encargado con PIN real).
- SaleListo levanta `cloudflared tunnel --url http://127.0.0.1:8123`, captura automáticamente la dirección segura `https://<subdominio>.trycloudflare.com` y actualiza los QRs cortos `/q/<token>` en tiempo real.
- Nota: el túnel rápido cambia de URL si reiniciás la PC. Usalo para probar el circuito completo en 4G/5G antes de imprimir acrílicos definitivos.

### B) Túnel permanente con dominio fijo (para QRs impresos en acrílico)
Para que los QRs impresos en las mesas jamás cambien tras reiniciar la PC:
1. Creá un túnel gratuito en **Cloudflare Zero Trust -> Networks -> Tunnels** apuntando tu subdominio (ej. `https://tu-local.trycloudflare.com` o tu dominio propio) hacia `http://127.0.0.1:8123`.
2. Iniciá SaleListo con las variables de entorno:
   - `CLOUDFLARE_TUNNEL_TOKEN=<tu_token>`
   - `PUBLIC_URL=https://tu-dominio-fijo` (o guardalo en **Panel -> Caja y Ajustes -> Dominio fijo público HTTPS**).
3. Verificá en `/qr.html` que el badge muestre **`4G/5G Activo · Escaneo sin Wi-Fi`** antes de mandar a imprenta.

---

## Opción 2 · Despliegue Cloud HTTPS gestionado (Render / Fly.io / Railway / VPS)

1. Creá una cuenta en **Render.com**, **Fly.io** o **Railway.app**.
2. Subí este repositorio completo (o la carpeta `app`) a GitHub.
3. En Render tocá **New -> Blueprint** (o **New -> Web Service**), conectá el repositorio y dale a **Deploy**:
   - `render.yaml` configura automáticamente `rootDir: app`, disco persistente en `/var/data` (`DATA_DIR=/var/data`) y `TZ=America/Argentina/Buenos_Aires`.
   - `Procfile` ejecuta `python app/server.py` escuchando en `PORT`.
4. Entrá a `/restaurante.html` (PIN inicial: `1234`), cambiá el PIN en **Caja y Ajustes**, desactivá el *Modo Demo* y abrí `/qr.html` para imprimir los códigos QR cortos (`/q/<token>`) definitivos de tus mesas.

---

## Precedencia automática de la URL codificada en los QRs

1. **Dominio fijo guardado** en **Panel -> Caja y Ajustes** (`restaurant.public_url`)
2. Variable de entorno **`PUBLIC_URL`**
3. **Túnel HTTPS activo** (`cloudflared`)
4. Cabeceras **`X-Forwarded-Proto` / `X-Forwarded-Host`** (únicamente desde proxy confiable o entorno cloud)
5. Red local LAN (`http://<ip-local>:8123`, solo Wi-Fi)
