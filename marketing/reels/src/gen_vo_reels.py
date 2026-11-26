"""Locuciones continuas de los 5 Reels (ElevenLabs CLI, eleven_v4, voz es-AR "Gabi").
Salida por reel en marketing/reels/src/vo/: rNN.mp3 (toma original) + rNN_words.json (palabras con t0/t1 en segundos).
Uso: python gen_vo_reels.py [r01 r02 r03 r04 r05]   (sin argumentos genera todos; pasar claves puntuales para no gastar cuota)
"""
import base64, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, "vo")
VOICE = "8jv0VaaN6d7mWZAeGj79"   # Gabi - Friendly, Publicity & Casual (es-AR)
MODEL = "eleven_v4"
STAB = "0.4"

TEXTS = {
    "r01": ("¿Mozos mirando el celular frente al cliente? En tu salón, jamás. "
            "Con SaleListo, cada mozo tiene su columna en la estación fija del pase. "
            "Y cuando sale el plato, le vibra la pulsera. "
            "Tecnología invisible, cero comisión. Escribinos y probalo."),
    "r02": ("¿Cuántas segundas pintas perdés un viernes porque nadie ve al mozo en la terraza? "
            "Con SaleListo, escanean el QR directo con la cámara, sin bajar apps, y piden otra ronda. "
            "Va directo a la barra, se prende la luz verde, y sale a la mesa. "
            "Más consumo, sin correr. Escribinos."),
    "r03": ("En tu propio salón, la ganancia tiene que ser cien por ciento tuya. "
            "Con SaleListo pagás cero comisión por pedido. "
            "¿Subieron los costos? Tocás un botón y actualizás toda la carta al instante, "
            "sin reimprimir un solo QR. Escribinos y probalo."),
    "r04": ("¿Perdés quince minutos por mesa solo para cobrar, cuando tenés gente esperando afuera? "
            "Con SaleListo, el cliente pide la cuenta en el QR, eligiendo tarjeta y propina. "
            "Tu mozo ve el monto exacto y resuelve todo en un solo viaje. "
            "Más rotación, cero comisión. Escribinos y probalo."),
    "r05": ("No hace falta cambiar todo tu restaurante de golpe. "
            "Probá SaleListo catorce días solo en tu vereda, patio o terraza. "
            "En cuarenta y ocho horas cargamos tu carta, activamos los QR fijos, "
            "y medís cuántas rondas más vendés. Cero comisión. Pedí tu piloto por WhatsApp."),
    "r06": ("Un mozo convencional pasa más de la mitad del turno anotando pedidos y cobrando. "
            "Con SaleListo, tus clientes piden directo del QR y tus mozos solo llevan platos y atienden. "
            "Así cada mozo rinde por dos, atendiendo más mesas en hora pico. "
            "Cero comisión. Escribinos."),
    "r07": ("Invertís fortunas en cocina y local, y una reseña de una estrella en Google te espanta mesas por esperar veinte minutos. "
            "Con SaleListo, cada mesa pide y cierra por QR al segundo. "
            "Tu cocina brilla, tu puntaje sube y la caja factura más. "
            "Cero comisión. Escribinos."),
    "r08": ("Una mesa de ocho amigos suele frenar todo tu salón entre pedidos y cuentas separadas. "
            "Con SaleListo, cada persona escanea el QR sin bajar apps, "
            "filtra sus platos y suma al mismo pedido. "
            "Al cerrar, dividen la cuenta en segundos. "
            "Más ticket, cero comisión. Escribinos."),
}


def words_from_alignment(al):
    chars, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    words, cur, t0, last = [], "", None, None
    for c, a, b in zip(chars, st, en):
        if c.strip() == "":
            if cur:
                words.append({"w": cur, "t0": round(t0, 3), "t1": round(last, 3)})
                cur = ""
            continue
        if not cur:
            t0 = a
        cur += c
        last = b
    if cur:
        words.append({"w": cur, "t0": round(t0, 3), "t1": round(last, 3)})
    return words


def gen(key):
    text = TEXTS[key]
    cmd = ["elevenlabs", "text-to-speech", "convert_with_timestamps", "--voice-id", VOICE, "--model-id", MODEL,
           "--text", text, "--language-code", "es", "--output-format", "mp3_44100_128",
           "--voice-settings.stability", STAB, "--voice-settings.similarity-boost", "0.8", "--format", "json"]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", shell=True)
    if r.returncode != 0 or "audio_base64" not in r.stdout:
        print("ERROR", key, r.returncode, r.stdout[:800], r.stderr[:800])
        sys.exit(1)
    j = json.loads(r.stdout)
    open(os.path.join(VO, f"{key}.mp3"), "wb").write(base64.b64decode(j["audio_base64"]))
    words = words_from_alignment(j.get("normalized_alignment") or j["alignment"])
    json.dump({"voice": VOICE, "model": MODEL, "text": text, "words": words},
              open(os.path.join(VO, f"{key}_words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    gaps = [(words[i]["w"], round(words[i + 1]["t0"] - words[i]["t1"], 2)) for i in range(len(words) - 1)
            if words[i + 1]["t0"] - words[i]["t1"] > 0.25]
    print(f"OK {key}: {len(text)} caracteres, {len(words)} palabras, voz {words[0]['t0']:.2f}-{words[-1]['t1']:.2f}s, pausas {gaps}")


if __name__ == "__main__":
    os.makedirs(VO, exist_ok=True)
    for k in (sys.argv[1:] or list(TEXTS)):
        gen(k)
