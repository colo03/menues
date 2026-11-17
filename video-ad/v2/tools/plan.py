"""Plan maestro del spot v2 (locucion continua ElevenLabs).
- Lee la toma continua (v2/audio/vo/vo_full.wav + vo_words.json), la acelera levemente (ATEMPO) sin cambiar tono.
- Ubica cada corte en el inicio de la palabra ancla de la locucion (y lo acerca al beat si cae a <0.09 s).
- Calcula marcas de animacion (QR, 4G, tap, Listo, snap, mozos, vibracion, badge, contacto) y SFX relativos a la voz.
- Ajusta la musica (empalme al remate real) al largo de la voz.
- Extrae frames del B-roll por corte (grading calido) a build/frames_src/.
Uso: python plan.py [--no-extract]
"""
import json, os, shutil, subprocess, sys, re, math
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
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(V2)
BROLL = os.path.join(V2, "broll")
BUILD = os.path.join(V2, "build")
FR = os.path.join(BUILD, "frames_src")
VO_DIR = os.path.join(V2, "audio", "vo")

ATEMPO = 1.07       # leve aceleracion de la toma continua (mantiene tono)
VO_OFFSET = 0.12    # la voz entra en 0.12 s

# --- Musica: "Gimme that Groove!" (Mixkit, Michael Ramir C., Mixkit Stock Music Free License), 112 BPM
BEAT = 60 / 112.0
MUSIC_IN = 0.93
G0 = 1.20 - 2 * BEAT
END_IN = 87.05 - 2 * BEAT      # 2 beats antes del primer golpe final del tema
def beat(k):
    return G0 + k * BEAT

FPS, SRC_FPS, PRE, POST = 60, 30, 0.40, 0.40

# cut_id, ancla (palabra, ocurrencia, desplazamiento de palabras), archivo, in-point, foco X, titulo, transicion
CUTS = [  # orden de aparicion (los ids mantienen los componentes de ad_v2.html)
    ("C01", None,                   "bar_busy_4043.mp4",        1.5, 0.50, "¿Mozos a mil?",       None),
    ("C02", ("bajales", 1, 0),      "phone_bar_321.mp4",        0.8, 0.61, "Basta de correr",     "whipL"),
    ("C03", ("cliente", 1, -1),     "phone_hands_4915.mp4",     2.0, 0.50, "Escanean con 4G",     "zoom"),
    ("C04", ("sin", 1, 0),          "friends_cafe_43248.mp4",   0.6, 0.56, "Sin esperar carta",   "whipU"),
    ("C05", ("pide", 1, -1),        "phone_woman_43270.mp4",    0.8, 0.50, "Piden sin apuro",     "whipL"),
    ("C06", ("comanda", 1, -1),     "SPLIT",                    0.0, 0.50, "Cocina y Barra",      "split"),
    ("C07", ("entre", 1, 0),        "kitchen_plating_13261.mp4",5.0, 0.50, "Cero papel",          "zoom"),
    ("C09", ("salón", 1, -2),       "resto_customers_4385.mp4", 2.5, 0.56, "Bloques por mozo",    "zoomOut"),
    ("C10", ("equilibrando", 1, 0), "waiter_help_22314.mp4",    2.5, 0.42, "Equipo en equilibrio","whipL"),
    ("C08", ("cero", 1, 0),         "bar_beer_tap_8709.mp4",    3.0, 0.50, "Cero viajes en vano", "whipR"),
    ("C11", ("celu", 1, -1),        "waiter_pizza_44003.mp4",   0.8, 0.40, "Vibra cuando sale",   "whipU"),
    ("C12", ("cuando", 1, 0),       "bar_serve_43962.mp4",      0.6, 0.42, "Va sobre seguro",     "zoom"),
    ("C13", ("simplificales", 1, 0),"waiter_drinks_43984.mp4",  1.5, 0.50, "Mozos sin estrés",    "whipL"),
    ("C14", ("restaurante", 1, -2), "bar_busy_4043.mp4",        7.0, 0.50, "",                    "veil"),
]
SPLIT = {"top": ("kitchen_wok_47555.mp4", 3.0, 0.50), "bot": ("bar_beer_tap_8710.mp4", 1.5, 0.42)}


def norm(w):
    return re.sub(r"[^\wáéíóúñü]", "", w.lower())


def probe(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r", (\d{3,5})x(\d{3,5})", r.stderr)
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)), int(m.group(2)), int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3))


GRADE = ("eq=contrast=1.06:saturation=1.12:brightness=0.005:gamma=0.98,"
         "colorbalance=rs=0.035:gs=0.01:bs=-0.04:rm=0.03:gm=0.0:bm=-0.03:rh=0.02:bh=-0.02")


def extract(out_dir, src, t_in, dur, focus, W, H):
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
    t0 = max(0.0, t_in)
    loop = []
    if t0 + dur > sdur - 0.05:
        if dur < sdur - 0.05:
            t0 = max(0.0, sdur - 0.05 - dur)
        else:  # clip mas corto que el plano: se repite
            loop = ["-stream_loop", "-1"]
            t0 = 0.0
    vf = f"fps={SRC_FPS},crop={cw}:{ch}:{cx}:{cy},scale={W}:{H}:flags=lanczos,{GRADE},unsharp=5:5:0.35:5:5:0.0"
    subprocess.run([FF, "-y", "-loglevel", "error"] + loop + ["-ss", f"{t0:.3f}", "-i", os.path.join(BROLL, src),
                    "-t", f"{dur:.3f}", "-vf", vf, "-q:v", "2", os.path.join(out_dir, "f_%04d.jpg")], check=True)
    return len(os.listdir(out_dir))


def main():
    os.makedirs(BUILD, exist_ok=True)
    # ---------------- voz continua acelerada (si ya existe, no tocarla)
    vw = json.load(open(os.path.join(VO_DIR, "vo_words.json"), encoding="utf-8"))
    fast = os.path.join(VO_DIR, "vo_fast.wav")
    loc_mp3 = os.path.join(ROOT, "locucion_argentina.mp3")
    if not os.path.exists(fast):
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", os.path.join(VO_DIR, "vo_full.wav"), "-af", f"atempo={ATEMPO}", "-ar", "48000", fast], check=True)
    if not os.path.exists(loc_mp3):
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", fast, "-c:a", "libmp3lame", "-b:a", "192k", loc_mp3], check=True)
    words = [{"w": w["w"], "n": norm(w["w"]), "t0": VO_OFFSET + w["t0"] / ATEMPO, "t1": VO_OFFSET + w["t1"] / ATEMPO} for w in vw["words"]]
    vo_end = words[-1]["t1"]

    def find(word, occ=1, shift=0, after=0.0):
        k = 0
        for i, w in enumerate(words):
            if w["n"] == word and w["t0"] >= after:
                k += 1
                if k == occ:
                    return words[i + shift]
        raise SystemExit(f"ancla no encontrada: {word}")

    beats = [beat(k) for k in range(0, 80)]
    def snap(t):
        b = min(beats, key=lambda x: abs(x - t))
        return b if abs(b - t) < 0.09 else t

    starts, last = [], 0.0
    for cid, anc, *_ in CUTS:
        if anc is None:
            starts.append(0.0); continue
        w = find(anc[0], anc[1], anc[2], after=last)
        st = snap(w["t0"] - 0.06)
        starts.append(round(st, 4)); last = w["t0"] - 0.01
    # ---------------- musica: empalme al remate
    k = math.ceil((vo_end + 0.28 - 2 * BEAT - G0) / BEAT)
    splice = beat(k)
    stab1, stab2 = splice + 2 * BEAT, splice + 3 * BEAT
    total = round(splice + 2.20, 3)
    cuts = []
    for i, (cid, anc, src, t_in, focus, title, trans) in enumerate(CUTS):
        end = total if i == len(CUTS) - 1 else starts[i + 1]
        cuts.append({"id": cid, "start": starts[i], "end": round(end, 4), "src": src, "in": t_in, "focus": focus, "title": title, "trans": trans})
    cs = {c["id"]: c for c in cuts}
    M = {
        "qr": max(cs["C03"]["start"] + 0.32, find("qr")["t0"] - 0.05),
        "g4": find("4g")["t0"],
        "app": min(find("carta")["t0"], cs["C04"]["end"] - 0.45),
        "toque": find("tranquilo")["t0"],
        "barra": min(find("vano")["t0"], cs["C08"]["end"] - 0.5),
        "snap": min(find("bloques")["t0"] + 0.1, cs["C09"]["end"] - 0.15),
        "sofi": find("equilibrando")["t0"], "nico": find("equipo")["t0"], "wave": find("vivo")["t0"],
        "vibra": find("vibra")["t0"],
        "badge": find("cero", 2)["t0"] - 0.08,
        "contact": find("escribinos")["t0"] - 0.05,
        "stab1": stab1, "stab2": stab2,
    }
    M["snap"] = max(M["snap"], cs["C09"]["start"] + 0.75)
    M = {k2: round(v, 3) for k2, v in M.items()}
    SFX = [
        ("impact_low", 0.00, -8), ("glitch", 1.18, -10),
        ("whoosh2", cs["C02"]["start"] - 0.16, -12),
        ("scan", M["qr"] - 0.02, -10),
        ("pop", cs["C04"]["start"] + 0.40, -12), ("pop", M["app"], -12),
        ("whoosh1", M["toque"] + 0.10, -13),
        ("split", cs["C06"]["start"] - 0.05, -11),
        ("whoosh2", cs["C07"]["start"] - 0.16, -15),
        ("ding", M["barra"] + 0.04, -9),
        ("snap", M["snap"], -11),
        ("pop", M["sofi"], -14), ("pop", M["nico"], -14),
        ("vibrate", M["vibra"] - 0.12, -6),
        ("success", cs["C12"]["start"] + 0.72, -10),
        ("riser_up", cs["C14"]["start"] - 1.40, -15),
        ("impact_logo", cs["C14"]["start"], -8),
        ("shimmer", M["badge"] + 0.05, -13),
        ("pop", M["contact"] + 0.25, -13),
    ]
    regions = []
    for w in words:
        if regions and w["t0"] - regions[-1][1] < 0.35:
            regions[-1][1] = w["t1"]
        else:
            regions.append([w["t0"], w["t1"]])
    timeline = {
        "fps": FPS, "srcFps": SRC_FPS, "total": total, "beat": BEAT, "g0": G0, "pre": PRE,
        "frames": int(round(total * FPS)), "cuts": cuts,
        "split": {k2: {"src": v[0], "in": v[1], "focus": v[2]} for k2, v in SPLIT.items()},
        "marks": M,
        "vo_full": {"file": "audio/vo/vo_fast.wav", "start": VO_OFFSET, "regions": [[round(a, 3), round(b, 3)] for a, b in regions],
                    "voice": vw["voice"], "model": vw["model"], "atempo": ATEMPO},
        "sfx": [{"name": n, "t": round(t, 3), "db": g} for n, t, g in SFX],
        "music": {"file": "audio/music/gimme_that_groove_872.mp3", "in": MUSIC_IN, "splice_ad": round(splice, 4), "end_in": END_IN},
    }
    json.dump(timeline, open(os.path.join(BUILD, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"voz: fin {vo_end:.2f}s | total {total:.2f}s | remate {stab1:.2f}/{stab2:.2f}")
    for c in cuts:
        print(f"{c['id']} {c['start']:6.2f}-{c['end']:6.2f} ({c['end']-c['start']:.2f}s) {c['src']:26s} '{c['title']}' {c['trans']}")
    print("marks:", M)
    print("regiones voz:", timeline["vo_full"]["regions"])
    if "--no-extract" in sys.argv:
        return
    jobs = []
    for c in cuts:
        dur = (c["end"] - c["start"]) + PRE + POST
        if c["src"] == "SPLIT":
            for k2 in ("top", "bot"):
                s = SPLIT[k2]; jobs.append((os.path.join(FR, f"C06_{k2}"), s[0], s[1], dur, s[2], 1080, 960))
        else:
            jobs.append((os.path.join(FR, c["id"]), c["src"], c["in"], dur, c["focus"], 1080, 1920))
    with ThreadPoolExecutor(6) as ex:
        for j, n in zip(jobs, ex.map(lambda a: extract(*a), jobs)):
            print(f"extract {os.path.basename(j[0])}: {n} frames")


if __name__ == "__main__":
    main()
