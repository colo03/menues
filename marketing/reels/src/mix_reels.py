"""Mezcla de audio de cada Reel (diseño sonoro sobrio, igual criterio que el spot).
- Musica: "Gimme that Groove!" (Mixkit Stock Music Free License) desde un in-point distinto por reel,
  empalmada al remate real del tema (stab final) y con fundido corto.
- Locucion: toma continua ElevenLabs (vo/rNN.mp3) con atempo, EQ suave y compresion leve.
- Ducking por envolvente suave: musica -13.5 dB bajo la voz, -6 dB en respiros, -5 dB en el remate.
- SFX: acentos organicos del spot (video-ad/v2/audio/sfx/*.mp3) en las marcas del timeline.
- Loudnorm lineal en 2 pasadas: -14 LUFS integrados, techo -1.5 dBTP (cumple <= -1.2 dBTP).
Salida: <WORK>/rNN/mix.wav (48 kHz estereo)
Uso: python mix_reels.py [r01 r02 r03]
"""
import json, os, re, shutil, subprocess, sys, wave
import numpy as np


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
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SFX_DIR = os.path.join(ROOT, "video-ad", "v2", "audio", "sfx")
WORK = os.environ.get("SL_REELS_WORK") or os.path.join(os.environ.get("TEMP", "/tmp"), "sl_reels_work")
SR = 48000


def load(path, ch=2, af=None):
    cmd = [FF, "-v", "error", "-i", path]
    if af:
        cmd += ["-af", af]
    cmd += ["-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"]
    x = np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32)
    return x.reshape(-1, ch).copy()


def db(g):
    return 10 ** (g / 20)


def place(buf, sig, t, gain_db=0.0):
    i = int(round(t * SR))
    if i >= len(buf):
        return
    if i < 0:
        sig, i = sig[-i:], 0
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * db(gain_db)


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def lufs(x, tmpdir):
    tmp = os.path.join(tmpdir, "_tmp_lufs.wav")
    write_wav(tmp, x)
    r = subprocess.run([FF, "-hide_banner", "-i", tmp, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    os.remove(tmp)
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)[-1])


def mix(key):
    d = os.path.join(WORK, key)
    TL = json.load(open(os.path.join(d, "timeline.json"), encoding="utf-8"))
    N = int(TL["total"] * SR)
    # ---------------- musica: cuerpo desde el in-point + remate real del tema
    m = TL["music"]
    mus = load(os.path.join(ROOT, m["file"]))
    a0, splice = int(m["in"] * SR), m["splice"]
    body = mus[a0:a0 + int(splice * SR) + int(0.06 * SR)]
    tail = mus[int(m["end_in"] * SR):]
    music = np.zeros((N, 2), np.float32)
    nb = min(len(body), N)
    music[:nb] = body[:nb]
    i0, xf = int(splice * SR), int(0.06 * SR)
    seg = tail[:N - i0]
    ramp = np.linspace(0, 1, xf)[:, None]
    music[i0:i0 + xf] = music[i0:i0 + xf] * (1 - ramp) + seg[:xf] * ramp
    music[i0 + xf:i0 + len(seg)] = seg[xf:]
    fi = int(0.12 * SR); music[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(0.25 * SR); music[-fo:] *= np.linspace(1, 0, fo)[:, None]
    music *= db(-15 - lufs(music, d))
    # ---------------- locucion
    v = TL["vo"]
    af = (f"atempo={v['atempo']},highpass=f=80,equalizer=f=250:t=q:w=1.2:g=-1,equalizer=f=3500:t=q:w=1.0:g=1.5,"
          "acompressor=threshold=-20dB:ratio=2.5:attack=5:release=120:makeup=2")
    x = load(os.path.join(ROOT, v["file"]), ch=1, af=af)[:, 0]
    vo = np.zeros((N, 2), np.float32)
    place(vo, np.stack([x, x], 1), v["start"])
    vo *= db(-16 - lufs(vo, d))
    regions = [tuple(r) for r in v["regions"]]
    # ---------------- ducking suave
    tt = np.arange(N) / SR
    env = np.full(N, -6.0)
    for s, e in regions:
        att, rel = 0.18, 0.40
        k = np.clip((tt - (s - att)) / att, 0, 1) * np.clip(((e + rel) - tt) / rel, 0, 1)
        env = np.minimum(env, -6.0 - 7.5 * k)
    end_v = max(r[1] for r in regions)
    up = np.clip((tt - (end_v + 0.04)) / 0.60, 0, 1)
    env = env * (1 - up) + (-5.0) * up
    music_d = music * db(env)[:, None]
    # ---------------- SFX
    S = {}
    for s in TL["sfx"]:
        if s["name"] not in S:
            y = load(os.path.join(SFX_DIR, f"{s['name']}.mp3"))
            S[s["name"]] = y / (np.abs(y).max() + 1e-9) * db(-1)
    fx = np.zeros((N, 2), np.float32)
    for s in TL["sfx"]:
        place(fx, S[s["name"]], s["t"], s["db"])
    fx *= db(-3)
    pre = os.path.join(d, "mix_pre.wav")
    write_wav(pre, (music_d + vo + fx) * 0.5)
    r = subprocess.run([FF, "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    j = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    outp = os.path.join(d, "mix.wav")
    lnf = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
           f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", pre, "-af", lnf, "-ar", "48000", "-c:a", "pcm_s16le", outp], check=True)
    os.remove(pre)
    r = subprocess.run([FF, "-hide_banner", "-i", outp, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    summ = r.stderr[r.stderr.rindex("Summary:"):]
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", summ)[-1]
    P = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", summ)[-1]
    print(f"[{key}] mix.wav  I={I} LUFS  TruePeak={P} dBTP  ({TL['total']:.2f}s)")


if __name__ == "__main__":
    for k in (sys.argv[1:] or ["r01", "r02", "r03"]):
        mix(k)
