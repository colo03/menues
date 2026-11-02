# Pedio: prototipo de pedidos desde la mesa

El cliente escanea el QR de su mesa, pide desde su celular, llama al mozo y pide la cuenta.
El restaurante ve y gestiona todo en tiempo real desde un panel.

## Cómo arrancarlo

Necesitás Python 3 (no hay que instalar nada más). Hacé doble clic en **`iniciar.bat`** o corré:

```bash
python server.py
```

La consola muestra las direcciones para usar, por ejemplo:

```
Panel del restaurante:  http://192.168.0.15:8123/restaurante.html
QR para las mesas:      http://192.168.0.15:8123/qr.html
```

### Usarlo con celulares reales

1. La computadora y los celulares tienen que estar en **la misma red Wi-Fi**.
2. La primera vez, Windows pregunta si permitir que Python use la red: aceptá para **redes privadas**.
3. Abrí `qr.html` (o en el panel: **Mesas → QR de las mesas**), imprimí o mostrá un QR en pantalla y escanealo con el celular.

> Si el celular no carga, revisá que la red no sea de "invitados" (muchas bloquean la comunicación entre dispositivos) y que el firewall permita Python.

## Páginas

| Página | Qué muestra |
|---|---|
| `/` | Portada con el concepto y accesos |
| `/demo.html` | **Para presentar sin celular**: celular y panel lado a lado |
| `/cliente.html?mesa=4` | Vista del cliente (una URL por mesa) |
| `/restaurante.html` | Panel del restaurante |
| `/qr.html` | QR imprimibles de todas las mesas |

## Guion sugerido para la demo

1. Abrí el panel en la compu (o en un proyector) y escaneá el QR de una mesa con tu celular. Si no hay celular a mano, usá `demo.html`.
2. Desde el celular agregá un Ramen con la aclaración "sin cebolla" y una bebida → **Enviar a cocina**. En el panel aparece el pedido con sonido.
3. Pasalo a **En cocina** y después a **Listo**: el celular avisa "¡Tu pedido está listo!".
4. En el celular tocá **Mozo**: aparece en "Solicitudes" → **Voy en camino**.
5. En el panel, en **Menú**, marcá un plato como agotado: el celular se actualiza al instante.
6. En el celular tocá **Cuenta**, elegí propina y medio de pago. En el panel → **Ver cuenta y cerrar** → **Cobrar y cerrar mesa**.
7. Para volver a empezar: **↺ Reiniciar datos** en el panel.

## Cómo está armado

- `server.py`: servidor en Python, solo con la biblioteca estándar.
  - Sirve los archivos de `public/`.
  - `POST /api/action` recibe las acciones (crear pedido, avanzar estado, llamar al mozo, pedir la cuenta, cerrar mesa, editar el menú…). Las valida y calcula precios y totales del lado del servidor: no confía en lo que manda el celular.
  - `GET /api/events` avisa cada cambio a todos los dispositivos conectados (Server-Sent Events).
  - Guarda el estado en `data/state.json`, así que sobrevive a un reinicio.
- `public/`: el front. `js/store.js` es la conexión con el servidor; `cliente.js` y `restaurante.js` son las dos vistas.

## Limitaciones del prototipo

- No hay login: cualquiera en la red puede abrir el panel del restaurante.
- No hay pagos reales; "pedir la cuenta" avisa al mozo.
- Funciona dentro de una red local. Para usarlo por internet hay que publicarlo en un hosting con HTTPS.
- Los QR se generan con una librería que se descarga de internet: la primera vez la compu necesita conexión.
