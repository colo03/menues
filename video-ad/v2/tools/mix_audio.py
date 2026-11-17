"""Mezcla final de audio del spot v2.
- Musica: "Gimme that Groove!" (Mixkit, licencia libre) recortada al largo del spot con remate final real del tema.
- Locucion: bloques V1..V6 (Edge-TTS o ElevenLabs, mismos nombres en v2/audio/vo/).
- SFX: ElevenLabs (v2/audio/sfx/*.mp3) + sintetizados aqui (impact, glitch, snap, riser, shimmer, split).
- Ducking por envolvente: musica -14 dB bajo la voz, -6 dB en respiros, plena en intro y remate.
Salida: v2/audio/mix_v2.wav (48 kHz estereo, -14 LUFS, TP -1.5 dBTP)
"""
import json, os, shutil, subprocess, re
import numpy as np
from scipy.signal import butter, sosfilt


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
SR = 48000
TL = json.load(open(os.path.join(V2, "build", "timeline.json"), encoding="utf-8"))
TOTAL = TL["total"]
N = int(TOTAL * SR)
rng = np.random.default_rng(3)


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
        sig = sig[-i:]
        i = 0
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * db(gain_db)


def lufs(x):
    # integrated loudness via ffmpeg ebur128
    tmp = os.path.join(V2, "audio", "_tmp_lufs.wav")
    write_wav(tmp, x)
    r = subprocess.run([FF, "-hide_banner", "-i", tmp, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    os.remove(tmp)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1])


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x * 32767).astype("<i2")
    import wave
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- SFX sintetizados
def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def stereo(m, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([m * l * 1.414, m * r * 1.414], 1)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def synth():
    out = {}
    t = lambda d: np.arange(int(d * SR)) / SR
    # impacto grave de apertura
    tt = t(0.9); f = 38 + 50 * np.exp(-tt / 0.07)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(tt), 0.28)
    click = bp(rng.standard_normal(len(tt)), 1500, 6000) * env_exp(len(tt), 0.006) * 0.5
    out["impact_low"] = stereo(np.tanh(1.6 * (boom + click)) * 0.9)
    # glitch digital de red caida
    tt = t(0.32); g = np.zeros(len(tt))
    for k in range(9):
        a = int(rng.uniform(0, 0.26) * SR); L = int(rng.uniform(0.012, 0.04) * SR); fr = rng.choice([180, 340, 720, 1450, 2900])
        seg = np.sign(np.sin(2 * np.pi * fr * np.arange(L) / SR)) * rng.uniform(0.3, 0.7)
        g[a:a + L] += seg[:len(g) - a]
    g = np.round(g * 6) / 6  # bitcrush
    thud = np.sin(2 * np.pi * 70 * tt) * env_exp(len(tt), 0.08)
    out["glitch"] = np.stack([g * 0.55 + thud * 0.7, np.roll(g, 90) * 0.55 + thud * 0.7], 1)
    # snap magnetico
    tt = t(0.18)
    sn = bp(rng.standard_normal(len(tt)), 2000, 9000) * env_exp(len(tt), 0.004) + np.sin(2 * np.pi * 1250 * tt) * env_exp(len(tt), 0.03) * 0.6 + np.sin(2 * np.pi * 180 * tt) * env_exp(len(tt), 0.025) * 0.6
    out["snap"] = stereo(sn * 0.8)
    # riser (ruido filtrado ascendente)
    d = 1.4; tt = t(d); nz = rng.standard_normal(len(tt)); y = np.zeros(len(tt)); blk = 2048
    for s in range(0, len(tt), blk):
        p = s / len(tt); lo = 200 + 4000 * p ** 2; y[s:s + blk] = bp(nz[s:s + blk + 512], lo, lo * 1.8)[:len(y[s:s + blk])]
    y *= (tt / d) ** 2.2 * (1 - np.exp(-(d - tt) / 0.02))
    out["riser_up"] = np.stack([y, np.roll(y, 240)], 1) * 0.9
    # acorde calido de marca + golpe
    tt = t(2.2); ch = np.zeros(len(tt))
    for fr, a in ((261.63, 1), (329.63, 0.8), (392.0, 0.75), (523.25, 0.5), (659.25, 0.3)):
        ch += a * (np.sin(2 * np.pi * fr * tt) + 0.3 * np.sin(2 * np.pi * 2 * fr * tt))
    ch *= (1 - np.exp(-tt / 0.01)) * env_exp(len(tt), 0.7) * 0.18
    f = 45 + 60 * np.exp(-tt / 0.05); boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(tt), 0.35) * 0.8
    out["impact_logo"] = np.stack([ch + boom, np.roll(ch, 120) + boom], 1)
    # shimmer cristalino
    tt = t(1.1); sh = np.zeros(len(tt))
    for k, fr in enumerate((2093, 2637, 3136, 4186)):
        a = int(k * 0.06 * SR); L = len(tt) - a
        sh[a:] += np.sin(2 * np.pi * fr * np.arange(L) / SR) * env_exp(L, 0.25) * 0.25
    sh += bp(rng.standard_normal(len(tt)), 6000, 14000) * env_exp(len(tt), 0.15) * 0.05
    out["shimmer"] = np.stack([sh, np.roll(sh, 300)], 1)
    # whoosh de division estereo + dos clicks tonales
    d = 0.8; tt = t(d); nz = rng.standard_normal(len(tt)); y = np.zeros(len(tt))
    for s in range(0, len(tt), blk):
        p = s / len(tt); c = 500 + 3500 * np.sin(np.pi * p); y[s:s + blk] = bp(nz[s:s + blk + 512], c * 0.6, c * 1.4)[:len(y[s:s + blk])]
    y *= np.sin(np.pi * np.clip(tt / 0.45, 0, 1)) ** 2
    pan = np.linspace(-0.9, 0.9, len(tt))
    st = np.stack([y * np.cos((pan + 1) * np.pi / 4), y * np.sin((pan + 1) * np.pi / 4)], 1) * 1.2
    for tc, fr, pn in ((0.40, 880, -0.6), (0.48, 1320, 0.6)):
        a = int(tc * SR); L = int(0.12 * SR)
        cl = np.sin(2 * np.pi * fr * np.arange(L) / SR) * env_exp(L, 0.03) * 0.5
        st[a:a + L] += stereo(cl, pn)[:len(st) - a]
    out["split"] = st
    return out


def main():
    sfx_dir = os.path.join(V2, "audio", "sfx")
    S = synth()
    for k in ("whoosh1", "whoosh2", "scan", "pop", "ding", "vibrate", "success"):
        S[k] = load(os.path.join(sfx_dir, f"{k}.mp3"))
    # normaliza cada SFX a pico -1 dBFS (las ganancias del timeline mandan)
    for k in S:
        S[k] = S[k] / (np.abs(S[k]).max() + 1e-9) * db(-1)

    # ---------------- musica
    m = TL["music"]
    mus = load(os.path.join(V2, m["file"]))
    a0 = int(m["in"] * SR)
    splice = m["splice_ad"]
    body = mus[a0:a0 + int(splice * SR) + int(0.06 * SR)]
    tail = mus[int(m["end_in"] * SR):]
    xf = int(0.06 * SR)
    music = np.zeros((N, 2), np.float32)
    nb = min(len(body), N)
    music[:nb] = body[:nb]
    i0 = int(splice * SR)
    ramp = np.linspace(0, 1, xf)[:, None]
    seg_t = tail[:N - i0]
    music[i0:i0 + xf] = music[i0:i0 + xf] * (1 - ramp) + seg_t[:xf] * ramp
    music[i0 + xf:i0 + len(seg_t)] = seg_t[xf:]
    # fade final suave
    fo = int(0.25 * SR); music[-fo:] *= np.linspace(1, 0, fo)[:, None]
    music *= db(-15 - lufs(music))  # musica a -15 LUFS antes de la envolvente

    # ---------------- locucion
    vo = np.zeros((N, 2), np.float32)
    regions = []
    af = ("highpass=f=85,equalizer=f=220:t=q:w=1.2:g=-1.5,equalizer=f=3200:t=q:w=1.0:g=2.5,equalizer=f=9000:t=q:w=1.2:g=1.5,"
          "acompressor=threshold=-21dB:ratio=3:attack=4:release=90:makeup=3")
    if "vo_full" in TL:  # toma continua (ElevenLabs)
        v = TL["vo_full"]
        af_c = ("highpass=f=80,equalizer=f=250:t=q:w=1.2:g=-1,equalizer=f=3500:t=q:w=1.0:g=1.5,"
                "acompressor=threshold=-20dB:ratio=2.5:attack=5:release=120:makeup=2")
        x = load(os.path.join(V2, v["file"]), ch=1, af=af_c)[:, 0]
        x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * db(-19)
        place(vo, stereo(x, 0.0) * 0.7071, v["start"])
        regions = [tuple(r) for r in v["regions"]]
    else:
        for k, v in TL["vo"].items():
            x = load(os.path.join(V2, "audio", "vo", f"{k}.wav"), ch=1, af=af)[:, 0]
            x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * db(-19)
            place(vo, stereo(x, 0.0) * 0.7071, v["start"])
            regions.append((v["start"], v["start"] + len(x) / SR))
    vo *= db(-16 - lufs(vo))

    # ---------------- envolvente de ducking (dB)
    tt = np.arange(N) / SR
    env = np.full(N, -6.0)                      # respiros entre frases
    env[tt < 0.10] = 0.0                        # golpe de intro
    end_v6 = max(r[1] for r in regions)
    for s, e in regions:
        att, rel = 0.10, 0.28
        k = np.clip((tt - (s - att)) / att, 0, 1) * np.clip(((e + rel) - tt) / rel, 0, 1)
        env = np.minimum(env, -6.0 - 8.0 * np.clip(k * 1.0, 0, 1))  # -14 dB bajo voz
    up = np.clip((tt - (end_v6 + 0.05)) / 0.25, 0, 1)
    env = env * (1 - up) + (-1.0) * up          # remate final casi pleno
    music_d = music * db(env)[:, None]

    # ---------------- SFX
    fx = np.zeros((N, 2), np.float32)
    for s in TL["sfx"]:
        place(fx, S[s["name"]], s["t"], s["db"])
    fx *= db(-3)

    mix = music_d + vo + fx
    pre = os.path.join(V2, "audio", "mix_v2_pre.wav")
    write_wav(pre, mix * 0.5)
    # loudnorm 2 pasadas (lineal) a -14 LUFS / -1.5 dBTP
    r = subprocess.run([FF, "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    j = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    outp = os.path.join(V2, "audio", "mix_v2.wav")
    lnf = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
           f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000")
    subprocess.run([FF, "-y", "-loglevel", "error", "-i", pre, "-af", lnf, "-ar", "48000", "-c:a", "pcm_s16le", outp], check=True)
    r = subprocess.run([FF, "-hide_banner", "-i", outp, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    summ = r.stderr[r.stderr.rindex("Summary:"):]
    print("VO regions:", [(round(a, 2), round(b, 2)) for a, b in regions])
    print(summ)
    # stems para QA
    write_wav(os.path.join(V2, "audio", "stem_music_ducked.wav"), music_d * 0.5)
    write_wav(os.path.join(V2, "audio", "stem_vo.wav"), vo * 0.5)


if __name__ == "__main__":
    main()
