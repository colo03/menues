"""Locucion continua del Video Demo Conceptual 16:9 de SaleListo (ElevenLabs CLI, eleven_v4, voz es-AR Gabi).
Salida en marketing/demo-video/vo/: demo_web.mp3 + demo_web_words.json
"""
import base64, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
VO = os.path.join(HERE, "vo")
VOICE = "8jv0VaaN6d7mWZAeGj79"   # Gabi - Friendly, Publicity & Casual (es-AR)
MODEL = "eleven_v4"
STAB = "0.42"

TEXT = (
    "Así funciona SaleListo en tu restaurante. "
    "El cliente escanea el QR de su mesa y pide desde la carta digital, sin bajar aplicaciones. "
    "Al instante, los platos entran a cocina y las bebidas a barra, sin errores ni demoras. "
    "Cuando el pedido sale, aparece ordenado por mozo en la estación fija del pase, listo para retirar sin demoras. "
    "Y al terminar, el cliente pide la cuenta en el QR eligiendo cómo pagar, y tu mozo resuelve todo en un solo viaje. "
    "SaleListo. Solicitá tu cotización personalizada."
)


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


def main():
    os.makedirs(VO, exist_ok=True)
    cmd = [
        "elevenlabs", "text-to-speech", "convert_with_timestamps",
        "--voice-id", VOICE, "--model-id", MODEL,
        "--text", TEXT, "--language-code", "es", "--output-format", "mp3_44100_128",
        "--voice-settings.stability", STAB, "--voice-settings.similarity-boost", "0.8",
        "--format", "json",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", shell=True)
    if r.returncode != 0 or "audio_base64" not in r.stdout:
        print("ERROR demo_web:", r.returncode, r.stdout[:800], r.stderr[:800])
        sys.exit(1)
    j = json.loads(r.stdout)
    open(os.path.join(VO, "demo_web.mp3"), "wb").write(base64.b64decode(j["audio_base64"]))
    words = words_from_alignment(j.get("normalized_alignment") or j["alignment"])
    json.dump(
        {"voice": VOICE, "model": MODEL, "text": TEXT, "words": words},
        open(os.path.join(VO, "demo_web_words.json"), "w", encoding="utf-8"),
        ensure_ascii=False, indent=1,
    )
    print(f"OK demo_web: {len(TEXT)} chars, {len(words)} words, voz {words[0]['t0']:.2f}-{words[-1]['t1']:.2f}s")


if __name__ == "__main__":
    main()
