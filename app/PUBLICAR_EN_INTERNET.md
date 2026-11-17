# Cómo publicar SaleListo en Internet (para usar con 4G/5G sin Wi-Fi)

Esta aplicación ya está 100% preparada para funcionar en internet sin modificar ni una línea de código:

1. Creá una cuenta gratuita en **Render.com** o **Railway.app**.
2. Subí este repositorio completo (o directamente la carpeta `app`) a tu cuenta de GitHub.
3. En Render tocá **New -> Blueprint** (o **New -> Web Service**), conectá el repositorio y dale a **Deploy**:
   - Si conectás la raíz del repositorio, `render.yaml` configura automáticamente `rootDir: app` y `Procfile` ejecuta `python app/server.py`.
   - Si conectás solo la carpeta `app`, ejecuta directamente `python server.py`.
4. La plataforma te entregará un enlace seguro con `https://` (por ejemplo, `https://<tu-servicio>.onrender.com`).
5. Entrá a `/restaurante.html` (PIN inicial: `1234`), cambiá tu PIN por uno propio en **Caja y Ajustes**, desactivá el *Modo Demo* y abrí `/qr.html` para imprimir los códigos QR definitivos de tus mesas.

Desde ese momento, cualquier cliente escanea el QR con los datos móviles 4G/5G de su celular (sin pedir Wi-Fi), y los mozos llevan abierto `/mozo.html` en sus propios teléfonos.
