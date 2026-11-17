"""Genera la locucion por bloques (V1..V6) con Edge-TTS es-AR-ElenaNeural.
Salida: v2/audio/vo/V1.wav ... V6.wav (48 kHz mono) + vo_blocks.json con duraciones.
Para la version ElevenLabs ver gen_vo_elevenlabs.ps1 (mismos nombres de salida).
"""
import asyncio, json, os, shutil, subprocess, sys
import edge_tts

FF = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or __import__("imageio_ffmpeg").get_ffmpeg_exe()
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(V2, "audio", "vo")
VOICE = "es-AR-ElenaNeural"

BLOCKS = [
    ("V1", "¿Salón lleno y el Wi-Fi no da más? ¡Olvidate!", "+8%", "+2Hz"),
    ("V2", "Con SaleListo, tus clientes escanean el QR con 4G y piden al toque.", "+12%", "+0Hz"),
    ("V3", "La comanda se divide sola: platos a cocina, y tragos a la barra.", "+12%", "+0Hz"),
    ("V4", "Armás el salón por bloques, y asignás mozos en vivo.", "+10%", "+0Hz"),
    ("V5", "A cada mozo le vibra el celu apenas sale su pedido.", "+10%", "+0Hz"),
    ("V6", "Sumá SaleListo hoy, cero comisión. Escribinos por WhatsApp y probalo.", "+17%", "+1Hz"),
]


def dur(p):
    r = subprocess.run([FF, "-hide_banner", "-i", p], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if "Duration" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0


async def main():
    os.makedirs(OUT, exist_ok=True)
    info = {}
    for bid, text, rate, pitch in BLOCKS:
        mp3 = os.path.join(OUT, f"{bid}_raw.mp3")
        wav = os.path.join(OUT, f"{bid}.wav")
        await edge_tts.Communicate(text, VOICE, rate=rate, pitch=pitch).save(mp3)
        # recorta silencios de borde, 48k mono
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", mp3, "-af",
                        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,"
                        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,aresample=48000",
                        "-ac", "1", wav], check=True)
        d = dur(wav)
        info[bid] = {"text": text, "dur": round(d, 3)}
        print(f"{bid}: {d:.2f}s  {text}")
    json.dump(info, open(os.path.join(OUT, "vo_blocks.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


asyncio.run(main())

