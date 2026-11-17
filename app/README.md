# SaleListo: Sistema Integral Restaurante, Mozos y Pedidos QR

Plataforma gastronómica lado restaurante y lado cliente lista para operar en la nube (4G/5G sin pedir Wi-Fi) y probar localmente sin dependencias externas.

## Cómo probarlo en tu computadora ahora mismo

Hacé doble clic en **`iniciar.bat`** o ejecutá:

```bash
python server.py
```

Abrí en tu navegador:
- **Portada general:** `http://localhost:8123/`
- **Demo circuito completo (Cliente + Mozo + Cocina/Barra + Admin):** `http://localhost:8123/demo.html`
- **Panel del Encargado:** `http://localhost:8123/restaurante.html` *(PIN inicial: `1234`)*
- **App Móvil del Mozo:** `http://localhost:8123/mozo.html`
- **Pantalla Cocina y Barra:** `http://localhost:8123/cocina.html`
- **QRs fijos imprimibles por bloque:** `http://localhost:8123/qr.html`

## Qué incluye esta versión

1. **Acceso 4G/5G sin Wi-Fi + QRs con token fijo por mesa**: Generador SVG de QRs propio (sin CDNs externos) y tokens secretos fijos por mesa (`cliente.html?t=...`) para impedir pedidos falsos entre mesas.
2. **Constructor del Salón por Bloques Pre-armados**: Plantillas rápidas (*Interior*, *Terraza*, *Exterior / Vereda*, *Barra*, *Sector 1/2*, *Patio*, *Salón VIP*) con grilla visual de mesas configurable.
3. **Gestión de Mozos en el Momento + Asignación Híbrida / Automática**:
   - Alta, baja y cambio de disponibilidad en vivo.
   - Pre-asignación de mozos por bloque o asignación automática balanceada por menor cantidad de mesas abiertas.
   - Si un mozo se elimina o sale de turno teniendo mesas abiertas, sus mesas se reasignan automáticamente a los mozos disponibles (priorizando su mismo sector) y se les notifica al instante.
4. **Ruteo Directo y Simultáneo a Cocina y Barra + App del Mozo**:
   - Cada categoría envía sus productos directo a **Cocina** o a **Barra** al mismo tiempo que se asigna el mozo.
   - Cuando Barra o Cocina marcan un pedido como *Listo*, suena y vibra el celular del mozo asignado a esa mesa para retirarlo y entregarlo.
5. **Menú Completo y Caja Real**:
   - ABM completo de categorías, platos con subida de fotos reales, ajuste porcentual masivo de precios (`+%`), anulación de pedidos equivocados, validación antes de cerrar mesas con comandas pendientes y arqueo de caja por medio de pago y propinas por mozo.

Para subirlo a internet y usarlo con celulares reales por 4G/5G sin Wi-Fi, mirá **`PUBLICAR_EN_INTERNET.md`**.
