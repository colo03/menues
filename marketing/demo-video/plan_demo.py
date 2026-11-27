"""Plan del Video Demo Conceptual 16:9 (1920x1080 @ 60 fps):
- Lee vo/demo_web_words.json y calcula tiempos de las 4 etapas + cierre de marca.
- Extrae B-roll en 1920x1080 con gradacion calida en %TEMP%/sl_demo_work/frames_src/<escena>/.
"""
import json, math, os, re, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor


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
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
BROLL = os.path.join(ROOT, "video-ad", "v2", "broll")
WORK = os.environ.get("SL_DEMO_WORK") or os.path.join(os.environ.get("TEMP", "/tmp"), "sl_demo_work")

W, H = 1920, 1080
ATEMPO = 1.05
VO_OFFSET = 0.20
FPS, SRC_FPS, PRE, POST = 60, 30, 0.45, 0.45
XFADE, XFADE_END = 0.50, 0.55
BEAT = 60 / 112.0
G0 = 1.20 - 2 * BEAT
END_IN = 87.05 - 2 * BEAT
MUSIC = "video-ad/v2/audio/music/gimme_that_groove_872.mp3"
MUSIC_IN = 0.93

GRADE = (
    "eq=contrast=1.03:saturation=0.96:brightness=-0.02:gamma=1.0,"
    "colorbalance=rs=0.03:gs=0.008:bs=-0.035:rm=0.025:gm=0.0:bm=-0.025:rh=0.015:bh=-0.015"
)

SCENES_CFG = [
    ("D1", None, "phone_hands_4915.mp4", 0.5, 0.50, 0.85, 0.58),
    ("D2", ("al", 1, 0), "kitchen_plating_13261.mp4", 0.6, 0.50, 0.90, 0.60),
    ("D3", ("cuando", 1, 0), "waiter_pizza_44003.mp4", 0.3, 0.50, 0.85, 0.60),
    ("D4", ("terminar", 1, -2), "resto_customers_4385.mp4", 0.8, 0.50, 0.85, 0.58),
    ("END", ("solicitá", 1, -1), "friends_cafe_43248.mp4", 0.6, 0.50, 0.90, 0.45),
]

MARKS_CFG = {
    "restaurante": ("restaurante", 1, 0),
    "escanea": ("escanea", 1, -0.05),
    "qr1": ("qr", 1, -0.05),
    "pide1": ("pide", 1, -0.05),
    "carta": ("carta", 1, -0.05),
    "apps": ("aplicaciones", 1, -0.05),
    "instante": ("instante", 1, -0.05),
    "platos": ("platos", 1, -0.05),
    "cocina": ("cocina", 1, -0.05),
    "bebidas": ("bebidas", 1, -0.05),
    "barra": ("barra", 1, -0.05),
    "errores": ("errores", 1, -0.05),
    "sale": ("sale", 1, -0.05),
    "mozo1": ("mozo", 1, -0.05),
    "pase": ("pase", 1, -0.05),
    "retirar": ("retirar", 1, -0.05),
    "terminar": ("terminar", 1, -0.05),
    "cuenta": ("cuenta", 1, -0.05),
    "qr2": ("qr", 2, -0.05),
    "pagar": ("pagar", 1, -0.05),
    "viaje": ("viaje", 1, -0.05),
    "cotizacion": ("cotización", 1, -0.05),
    "personalizada": ("personalizada", 1, 0.0),
}

SFX_CFG = [
    ("scan", "qr1", -0.02, -14),
    ("pop", "pide1", 0.0, -16),
    ("pop", "cocina", 0.0, -16),
    ("pop", "barra", 0.0, -16),
    ("ding", "sale", 0.0, -13),
    ("pop", "pase", 0.0, -16),
    ("scan", "qr2", -0.02, -14),
    ("pop", "pagar", 0.0, -16),
    ("ding", "viaje", 0.0, -13),
    ("success", "cotizacion", 0.0, -14),
]


def norm(w):
    return re.sub(r"[^\wáéíóúñü]", "", w.lower())


def probe(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r", (\d{3,5})x(\d{3,5})", r.stderr)
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)), int(m.group(2)), int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3))


def extract(out_dir, src, t_in, dur, focus, speed=1.0):
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    sw, sh, sdur = probe(os.path.join(BROLL, src))
    target_ar = W / H
    if sw / sh > target_ar:
        cw, ch = int(round(sh * target_ar / 2) * 2), sh
    else:
        cw, ch = sw, int(round(sw / target_ar / 2) * 2)
    cx = int(min(max(focus * sw - cw / 2, 0), sw - cw))
    cy = int((sh - ch) / 2)
    t0, loop, need = max(0.0, t_in), [], dur * speed
    if t0 + need > sdur - 0.05:
        if need < sdur - 0.05:
            t0 = max(0.0, sdur - 0.05 - need)
        else:
            loop, t0 = ["-stream_loop", "-1"], 0.0
    vf = f"crop={cw}:{ch}:{cx}:{cy},scale={W}:{H}:flags=lanczos,{GRADE},"
    vf += f"setpts={1 / speed:.4f}*PTS,framerate=fps={SRC_FPS}" if speed < 1 else f"fps={SRC_FPS}"
    subprocess.run(
        [FF, "-y", "-loglevel", "error"] + loop + ["-ss", f"{t0:.3f}", "-i", os.path.join(BROLL, src),
         "-t", f"{dur:.3f}", "-vf", vf, "-q:v", "2", os.path.join(out_dir, "f_%04d.jpg")],
        check=True,
    )
    return len(os.listdir(out_dir))


def main(do_extract=True):
    vw = json.load(open(os.path.join(HERE, "vo", "demo_web_words.json"), encoding="utf-8"))
    words = [
        {"w": w["w"], "n": norm(w["w"]), "t0": VO_OFFSET + w["t0"] / ATEMPO, "t1": VO_OFFSET + w["t1"] / ATEMPO}
        for w in vw["words"]
    ]
    vo_end = words[-1]["t1"]

    def find(word, occ=1, shift=0):
        k = 0
        for i, w in enumerate(words):
            if w["n"] == word:
                k += 1
                if k == occ:
                    return words[i + shift]
        raise SystemExit(f"ancla no encontrada: {word} (occ={occ}) en {[x['n'] for x in words]}")

    starts = [0.0 if a is None else round(find(*a)["t0"] - 0.06, 3) for _, a, *_ in SCENES_CFG]
    k = math.ceil((vo_end + 1.40 - 2 * BEAT - G0) / BEAT)
    splice = G0 + k * BEAT
    total = round(splice + 2.20, 3)

    scenes = []
    for i, (sid, anc, src, t_in, focus, speed, veil) in enumerate(SCENES_CFG):
        end = total if i == len(SCENES_CFG) - 1 else starts[i + 1]
        scenes.append({
            "id": sid, "start": starts[i], "end": round(end, 3),
            "src": src, "in": t_in, "focus": focus, "speed": speed,
            "xfade": XFADE_END if sid == "END" else XFADE,
            "closing": sid == "END", "veil": veil,
        })

    M = {n: round(find(w, o)["t0"] + d, 3) for n, (w, o, d) in MARKS_CFG.items()}
    end_start = scenes[-1]["start"]
    M["logo"] = round(end_start + 0.15, 3)
    M["cta"] = round(max(M["cotizacion"], M["logo"] + 0.45), 3)

    sfx = [{"name": n, "t": round(M[m] + d, 3), "db": g} for n, m, d, g in SFX_CFG]
    regions = []
    for w in words:
        if regions and w["t0"] - regions[-1][1] < 0.35:
            regions[-1][1] = w["t1"]
        else:
            regions.append([w["t0"], w["t1"]])

    fr = os.path.join(WORK, "frames_src")
    os.makedirs(WORK, exist_ok=True)
    timeline = {
        "width": W, "height": H, "fps": FPS, "srcFps": SRC_FPS,
        "total": total, "pre": PRE, "frames": int(round(total * FPS)),
        "frameBase": "file:///" + fr.replace("\\", "/"),
        "scenes": scenes, "marks": M,
        "vo": {
            "file": "marketing/demo-video/vo/demo_web.mp3",
            "start": VO_OFFSET, "atempo": ATEMPO,
            "regions": [[round(a, 3), round(b, 3)] for a, b in regions],
        },
        "sfx": sfx,
        "music": {"file": MUSIC, "in": round(MUSIC_IN, 4), "splice": round(splice, 4), "end_in": round(END_IN, 4)},
    }
    json.dump(timeline, open(os.path.join(WORK, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[demo_web] voz fin {vo_end:.2f}s | total {total:.2f}s ({timeline['frames']} frames)")
    for s in scenes:
        print(f"  {s['id']:4s} {s['start']:6.2f}-{s['end']:6.2f} ({s['end'] - s['start']:.2f}s) {s['src']}")
    print("  marks:", M)
    if not do_extract:
        return
    jobs = [(os.path.join(fr, s["id"]), s["src"], s["in"], (s["end"] - s["start"]) + PRE + POST, s["focus"], s["speed"]) for s in scenes]
    with ThreadPoolExecutor(5) as ex:
        for j, n in zip(jobs, ex.map(lambda a: extract(*a), jobs)):
            print(f"  extract {os.path.basename(j[0])}: {n} frames")


if __name__ == "__main__":
    main("--no-extract" not in sys.argv)
