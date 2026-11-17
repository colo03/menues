"""Locucion continua (una sola toma) con ElevenLabs + alineacion por palabra.
Salida: v2/audio/vo/vo_full.wav (48k mono, bordes recortados), vo_words.json (palabras con t0/t1 relativos al wav),
        y copia limpia en video-ad/prueba_voz_viva.mp3
Uso: python gen_vo_continuous.py [voice_id] [model_id] [stability]
"""
import base64, json, os, shutil, subprocess, sys, re


def _find_ffmpeg():
    if os.environ.get("FFMPEG_BIN"):
        return os.environ["FFMPEG_BIN"]
    w = shutil.which("ffmpeg")
    if w:
        return w
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


FF = _find_ffmpeg()
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(V2)
VO = os.path.join(V2, "audio", "vo")
VOICE = sys.argv[1] if len(sys.argv) > 1 else "8jv0VaaN6d7mWZAeGj79"   # Gabi - Friendly, Publicity & Casual (es-AR)
MODEL = sys.argv[2] if len(sys.argv) > 2 else "eleven_v4"
STAB = sys.argv[3] if len(sys.argv) > 3 else "0.4"

TEXT = ("¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia. "
        "Con SaleListo, el cliente escanea el QR con 4G, sin esperar carta ni wifi, y pide tranquilo. "
        "La comanda se separa sola entre cocina y barra, y el salón reparte bloques equilibrando al equipo en vivo. "
        "Cero viajes en vano: el celu les vibra recién cuando está listo para llevar. "
        "Simplificales la vida a ellos y al restaurante, con cero comisión. Escribinos por WhatsApp, y probalo.")


def main():
    os.makedirs(VO, exist_ok=True)
    cmd = ["elevenlabs", "text-to-speech", "convert_with_timestamps", "--voice-id", VOICE, "--model-id", MODEL,
           "--text", TEXT, "--language-code", "es", "--output-format", "mp3_44100_128",
           "--voice-settings.stability", STAB, "--voice-settings.similarity-boost", "0.8", "--format", "json"]
    if MODEL != "eleven_v4":
        cmd += ["--voice-settings.style", "0.55", "--voice-settings.use-speaker-boost", "true", "--voice-settings.speed", "1.04"]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", shell=True)
    if r.returncode != 0 or "audio_base64" not in r.stdout:
        print("ERROR", r.returncode, r.stdout[:1500], r.stderr[:1500]); sys.exit(1)
    j = json.loads(r.stdout)
    raw = os.path.join(VO, "vo_full_raw.mp3")
    open(raw, "wb").write(base64.b64decode(j["audio_base64"]))
    al = j.get("normalized_alignment") or j["alignment"]
    chars, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    # palabras
    words, cur, t0 = [], "", None
    for c, a, b in zip(chars, st, en):
        if c.strip() == "" :
            if cur: words.append({"w": cur, "t0": t0, "t1": last}); cur = ""
            continue
        if not cur: t0 = a
        cur += c; last = b
    if cur: words.append({"w": cur, "t0": t0, "t1": last})
    # recorte de silencio inicial: medimos donde arranca la voz
    lead = words[0]["t0"]
    trim0 = max(0.0, lead - 0.03)
    wav = os.path.join(VO, "vo_full.wav")
    subprocess.run([FF, "-y", "-loglevel", "error", "-ss", f"{trim0:.3f}", "-i", raw, "-af",
                    "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse,aresample=48000",
                    "-ac", "1", wav], check=True)
    for w in words:
        w["t0"] = round(w["t0"] - trim0, 3); w["t1"] = round(w["t1"] - trim0, 3)
    json.dump({"voice": VOICE, "model": MODEL, "text": TEXT, "words": words}, open(os.path.join(VO, "vo_words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k",
                    os.path.join(ROOT, "locucion_argentina.mp3")], check=True)
    gaps = [(words[i]["w"], round(words[i + 1]["t0"] - words[i]["t1"], 2)) for i in range(len(words) - 1) if words[i + 1]["t0"] - words[i]["t1"] > 0.18]
    print(f"OK voz={VOICE} modelo={MODEL} palabras={len(words)} duracion={words[-1]['t1']:.2f}s")
    print("pausas >0.18s:", gaps)


if __name__ == "__main__":
    main()
