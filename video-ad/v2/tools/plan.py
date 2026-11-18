"""Plan maestro del spot v5 (diagramas vectoriales simples, max. 5 palabras por pantalla).
- Lee la toma continua v5 (v2/audio/vo/vo_fast.wav + vo_words.json, ATEMPO 1.07, entrada 0.12 s).
- 6 escenas respiradas (E01..E06) ancladas al inicio de la frase de la locucion (sin snap a beat, sin cortes rapidos).
- Calcula las marcas de la unica accion de cada escena (E05: estacion del pase + pulsera) y los acentos SFX suaves.
- Ajusta la musica (empalme al remate real del tema) al largo de la voz.
- Extrae frames del B-roll por escena (grading calido uniforme) a build/frames_src/.
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
XFADE = 0.48        # crossfade editorial entre fondos
XFADE_END = 0.55    # crossfade hacia el cierre institucional

# id, ancla (palabra, ocurrencia, desplazamiento), archivo, in-point, foco X, titular (|palabra clave|), pildora
SCENES = [
    ("E01", None,                "bar_busy_4043.mp4",         1.5, 0.50, "Menos |corridas|",               ""),
    ("E02", ("con", 1, 0),       "phone_hands_4915.mp4",      2.0, 0.50, "Escaneá con |4G|",               ""),
    ("E03", ("pide", 1, -1),     "kitchen_plating_13261.mp4", 4.5, 0.50, "Se divide |sola|",               ""),
    ("E04", ("salón", 1, -2),    "resto_customers_4385.mp4",  2.5, 0.66, "Salón |parejo|",                 ""),
    ("E05", ("sin", 2, 0),       "waiter_drinks_43984.mp4",   1.2, 0.50, "Sin |celulares|",                ""),
    ("E06", ("vida", 1, -1),     "friends_cafe_43248.mp4",    1.0, 0.52, "",                              ""),
]


def norm(w):
    return re.sub(r"[^\wáéíóúñü]", "", w.lower())


def probe(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r", (\d{3,5})x(\d{3,5})", r.stderr)
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)), int(m.group(2)), int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3))


# gradacion calida uniforme para todas las escenas (misma piel, mismos negros)
GRADE = ("eq=contrast=1.03:saturation=0.98:brightness=0.0:gamma=1.0,"
         "colorbalance=rs=0.03:gs=0.008:bs=-0.035:rm=0.025:gm=0.0:bm=-0.025:rh=0.015:bh=-0.015")


# E01 (bar_busy_4043) es un timelapse muy agitado: se reproduce a media velocidad con fundido entre cuadros para calmarlo
SPEED = {"E01": 0.5}


def extract(out_dir, src, t_in, dur, focus, W, H, speed=1.0):
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
    need = dur * speed
    if t0 + need > sdur - 0.05:
        if need < sdur - 0.05:
            t0 = max(0.0, sdur - 0.05 - need)
        else:
            loop = ["-stream_loop", "-1"]
            t0 = 0.0
    vf = f"crop={cw}:{ch}:{cx}:{cy},scale={W}:{H}:flags=lanczos,{GRADE},"
    vf += f"setpts={1 / speed:.4f}*PTS,framerate=fps={SRC_FPS}" if speed < 1 else f"fps={SRC_FPS}"
    subprocess.run([FF, "-y", "-loglevel", "error"] + loop + ["-ss", f"{t0:.3f}", "-i", os.path.join(BROLL, src),
                    "-t", f"{dur:.3f}", "-vf", vf, "-q:v", "2", os.path.join(out_dir, "f_%04d.jpg")], check=True)
    return len(os.listdir(out_dir))


def main():
    os.makedirs(BUILD, exist_ok=True)
    vw = json.load(open(os.path.join(VO_DIR, "vo_words.json"), encoding="utf-8"))
    fast = os.path.join(VO_DIR, "vo_fast.wav")
    if not os.path.exists(fast):
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", os.path.join(VO_DIR, "vo_full.wav"), "-af", f"atempo={ATEMPO}", "-ar", "48000", fast], check=True)
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

    starts = []
    for sid, anc, *_ in SCENES:
        starts.append(0.0 if anc is None else round(find(*anc)["t0"] - 0.05, 3))
    # musica: empalme al remate real
    k = math.ceil((vo_end + 0.28 - 2 * BEAT - G0) / BEAT)
    splice = beat(k)
    stab1, stab2 = splice + 2 * BEAT, splice + 3 * BEAT
    total = round(splice + 2.20, 3)
    scenes = []
    for i, (sid, anc, src, t_in, focus, title, pill) in enumerate(SCENES):
        end = total if i == len(SCENES) - 1 else starts[i + 1]
        scenes.append({"id": sid, "start": starts[i], "end": round(end, 3), "src": src, "in": t_in, "focus": focus,
                       "title": title, "pill": pill, "xfade": XFADE_END if sid == "E06" else XFADE})
    S = {s["id"]: s for s in scenes}
    e6 = S["E06"]["start"]
    logo = e6 + XFADE_END / 2 + 0.08   # el logo entra recien cuando el lienzo de E05 ya se fue (sin cuadro fantasma)
    M = {
        "e1_in": 0.18,                                   # entrada de la Tarjeta Maestra
        "e1_ok": find("bajales")["t0"],                  # filas a verde + pildora "Salon en orden"
        "qr": find("qr")["t0"],                          # barra de escaneo
        "g4": find("4g")["t0"],                          # pildora 4G
        "e2_food": find("qr")["t0"] + 1.0,               # QR -> hamburguesa + copa
        "e2_tap": find("carta")["t0"] + 0.25,            # tap sobre el boton Pedir
        "e3_lines": find("comanda")["t0"] - 0.30,        # se dibujan las 2 curvas
        "e3_go": find("separa")["t0"] - 0.15,            # hamburguesa y copa viajan a Cocina y Barra
        "split": find("separa")["t0"],                   # division Cocina / Barra
        "tags": find("bloques")["t0"],                   # mozos asignados a cada bloque
        "even": find("equipo")["t0"],                    # barra "Carga pareja en vivo"
        "pase": find("estación")["t0"],                  # 3 columnas de la estacion del pase se encienden
        "vibra": find("vibra")["t0"],                    # ondas de vibracion de la pulsera
        "salir": find("salir")["t0"],                    # tilde verde en la capsula
        "simpl": find("simplificales")["t0"],            # entra la placa final
        "logo": logo,
        "badge": max(find("cero", 1)["t0"] - 0.04, logo + 0.40),
        "contact": find("escribinos")["t0"] - 0.05,
        "stab1": stab1, "stab2": stab2,
    }
    M = {k2: round(v, 3) for k2, v in M.items()}
    SFX = [  # 5 acentos organicos y suaves (sin glitch, impact, riser ni whoosh)
        ("pop", M["e1_ok"], -16),
        ("scan", M["qr"] - 0.02, -14),
        ("pop", M["split"], -15),
        ("vibrate", M["vibra"] - 0.05, -10), ("ding", M["salir"], -13),
        ("success", M["badge"], -14),
    ]
    regions = []
    for w in words:
        if regions and w["t0"] - regions[-1][1] < 0.35:
            regions[-1][1] = w["t1"]
        else:
            regions.append([w["t0"], w["t1"]])
    timeline = {
        "fps": FPS, "srcFps": SRC_FPS, "total": total, "pre": PRE,
        "frames": int(round(total * FPS)), "scenes": scenes, "marks": M,
        "vo_full": {"file": "audio/vo/vo_fast.wav", "start": VO_OFFSET, "regions": [[round(a, 3), round(b, 3)] for a, b in regions],
                    "voice": vw["voice"], "model": vw["model"], "atempo": ATEMPO},
        "sfx": [{"name": n, "t": round(t, 3), "db": g} for n, t, g in SFX],
        "music": {"file": "audio/music/gimme_that_groove_872.mp3", "in": MUSIC_IN, "splice_ad": round(splice, 4), "end_in": END_IN},
    }
    json.dump(timeline, open(os.path.join(BUILD, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"voz: fin {vo_end:.2f}s | total {total:.2f}s ({timeline['frames']} frames) | remate {stab1:.2f}/{stab2:.2f}")
    for s in scenes:
        print(f"{s['id']} {s['start']:6.2f}-{s['end']:6.2f} ({s['end']-s['start']:.2f}s) {s['src']:26s} '{s['title']}'")
    print("marks:", M)
    if "--no-extract" in sys.argv:
        return
    jobs = [(os.path.join(FR, s["id"]), s["src"], s["in"], (s["end"] - s["start"]) + PRE + POST, s["focus"], 1080, 1920, SPEED.get(s["id"], 1.0)) for s in scenes]
    with ThreadPoolExecutor(6) as ex:
        for j, n in zip(jobs, ex.map(lambda a: extract(*a), jobs)):
            print(f"extract {os.path.basename(j[0])}: {n} frames")


if __name__ == "__main__":
    main()
