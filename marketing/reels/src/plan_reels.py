"""Plan de los 5 Reels: escenas ancladas a la locucion, marcas de animacion, acentos SFX, musica y extraccion de B-roll.
- Lee vo/rNN_words.json (toma continua ElevenLabs) y aplica ATEMPO + VO_OFFSET.
- Escribe <WORK>/rNN/timeline.json y extrae frames con gradacion calida uniforme en <WORK>/rNN/frames_src/<escena>/.
WORK = $SL_REELS_WORK o %TEMP%/sl_reels_work (nunca dentro del repositorio).
Uso: python plan_reels.py [r01 r02 r03 r04 r05] [--no-extract]
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
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
BROLL = os.path.join(ROOT, "video-ad", "v2", "broll")
WORK = os.environ.get("SL_REELS_WORK") or os.path.join(os.environ.get("TEMP", "/tmp"), "sl_reels_work")

ATEMPO = 1.05       # leve aceleracion de la toma (mantiene tono)
VO_OFFSET = 0.15    # la voz entra en 0.15 s
FPS, SRC_FPS, PRE, POST = 60, 30, 0.40, 0.40
XFADE, XFADE_END = 0.48, 0.55
# Musica: "Gimme that Groove!" (Mixkit Stock Music Free License), 112 BPM, remate real al final del tema
BEAT = 60 / 112.0
G0 = 1.20 - 2 * BEAT
END_IN = 87.05 - 2 * BEAT
MUSIC = "video-ad/v2/audio/music/gimme_that_groove_872.mp3"

GRADE = ("eq=contrast=1.03:saturation=0.98:brightness=0.0:gamma=1.0,"
         "colorbalance=rs=0.03:gs=0.008:bs=-0.035:rm=0.025:gm=0.0:bm=-0.025:rh=0.015:bh=-0.015")

# Escenas: id, ancla (palabra, ocurrencia, corrimiento de palabras) o None, B-roll, in-point, foco X, velocidad
# Titulares: (texto con |clave|, ancla de entrada o None). Marcas: nombre -> (palabra, ocurrencia, delta s).
REELS = {
    "r01": {
        "music_in": 0.93,
        "kicker": "Tecnología |invisible|",
        "veil": {"A2": 0.56},
        "scenes": [
            ("A1", None, "phone_bar_321.mp4", 0.6, 0.60, 1.0),
            ("A2", ("con", 1, 0), "kitchen_plating_13261.mp4", 2.0, 0.42, 1.0),
            ("A3", ("y", 1, 0), "waiter_pizza_44003.mp4", 0.3, 0.50, 1.0),
            ("END", ("tecnología", 1, 0), "resto_customers_4385.mp4", 1.0, 0.50, 1.0),
        ],
        "titles": [
            ("¿Mozos con |celular?|", None),
            ("En tu salón, |jamás|", ("en", 1, -0.12)),
            ("Estación |del pase|", "A2"),
            ("Sale el plato, |vibra|", "A3"),
        ],
        "marks": {
            "cliente": ("cliente", 1, 0), "jamas": ("jamás", 1, -0.05), "salon": ("salón", 1, 0),
            "columna": ("columna", 1, -0.05), "estacion": ("estación", 1, 0), "fija": ("fija", 1, 0), "pase": ("pase", 1, 0),
            "sale": ("sale", 1, -0.05), "plato": ("plato", 1, 0), "vibra": ("vibra", 1, -0.05), "pulsera": ("pulsera", 1, 0.15),
            "badge": ("cero", 1, -0.04), "contact": ("escribinos", 1, -0.05),
        },
        "sfx": [("pop", "jamas", 0.30, -14), ("pop", "columna", 0.0, -17), ("ding", "sale", 0.0, -13),
                ("vibrate", "vibra", -0.05, -10), ("success", "badge", 0.0, -14)],
    },
    "r02": {
        "music_in": 0.93 + 32 * BEAT,
        "scenes": [
            ("B1", None, "waiter_help_22314.mp4", 0.2, 0.55, 1.0),
            ("B2", ("con", 1, 0), "phone_hands_4915.mp4", 1.0, 0.45, 1.0),
            ("B3", ("va", 1, 0), "bar_beer_tap_8709.mp4", 4.0, 0.30, 1.0),
            ("B4", ("más", 1, 0), "friends_cafe_43248.mp4", 0.5, 0.40, 1.0),
            ("END", ("escribinos", 1, 0), "bar_beer_tap_8710.mp4", 2.0, 0.40, 1.0),
        ],
        "titles": [
            ("¿Y la |segunda| pinta?", None),
            ("Escaneo |directo|", "B2"),
            ("Directo a |Barra|", "B3"),
            ("Más |consumo|", "B4"),
        ],
        "marks": {
            "nadie": ("nadie", 1, 0), "mozo": ("mozo", 1, 0), "terraza": ("terraza", 1, 0),
            "qr": ("qr", 1, -0.05), "camara": ("cámara", 1, -0.05), "apps": ("apps", 1, -0.10), "piden": ("piden", 1, -0.05), "ronda": ("ronda", 1, 0.05),
            "va": ("va", 1, 0), "barra": ("barra", 1, 0), "verde": ("verde", 1, -0.10), "mesa": ("sale", 1, -0.05),
            "mas": ("más", 1, 0), "correr": ("correr", 1, 0),
            "contact": ("escribinos", 1, 0),
        },
        "sfx": [("scan", "qr", -0.02, -14), ("pop", "camara", 0.0, -17), ("pop", "ronda", 0.05, -15),
                ("pop", "barra", 0.05, -17), ("ding", "verde", 0.0, -13), ("pop", "mas", 0.25, -18), ("success", "badge", 0.0, -14)],
    },
    "r03": {
        "music_in": 0.93 + 16 * BEAT,
        "veil": {"C1": 0.52},
        "scenes": [
            ("C1", None, "resto_customers_4385.mp4", 2.0, 0.72, 1.0),
            ("C2", ("con", 1, 0), "bar_serve_43962.mp4", 0.2, 0.50, 1.0),
            ("C3", ("subieron", 1, 0), "kitchen_wok_47555.mp4", 3.0, 0.50, 1.0),
            ("C4", ("sin", 1, 0), "phone_woman_43270.mp4", 0.5, 0.50, 1.0),
            ("END", ("escribinos", 1, 0), "waiter_drinks_43984.mp4", 1.0, 0.50, 1.0),
        ],
        "titles": [
            ("Ganancia |100%| tuya", None),
            ("|0%| comisión", "C2"),
            ("Precios |al día|", "C3"),
            ("Sin |reimprimir|", "C4"),
        ],
        "marks": {
            "ganancia": ("ganancia", 1, 0), "cien": ("cien", 1, 0), "tuya": ("tuya", 1, 0),
            "cero": ("cero", 1, -0.05), "pedido": ("pedido", 1, 0),
            "costos": ("costos", 1, 0), "boton": ("botón", 1, -0.05), "actualizas": ("actualizás", 1, 0), "instante": ("instante", 1, 0),
            "reimprimir": ("reimprimir", 1, 0), "qr": ("qr", 1, -0.05),
            "contact": ("escribinos", 1, 0),
        },
        "sfx": [("pop", "tuya", 0.0, -15), ("pop", "cero", 0.10, -14), ("pop", "boton", 0.05, -14),
                ("pop", "actualizas", 0.15, -20), ("pop", "actualizas", 0.35, -20), ("pop", "actualizas", 0.55, -20),
                ("pop", "reimprimir", 0.40, -16), ("ding", "qr", 0.10, -14), ("success", "badge", 0.0, -14)],
    },
    "r04": {
        "music_in": 0.93 + 8 * BEAT,
        "atempo": 1.07,
        "tail_pad": 0.80,
        "kicker": "Más |rotación|",
        "veil": {"D1": 0.50},
        "scenes": [
            ("D1", None, "bar_busy_4043.mp4", 1.5, 0.50, 0.5),
            ("D2", ("con", 1, 0), "phone_hands_4915.mp4", 1.6, 0.50, 1.0),
            ("D3", ("tu", 1, 0), "friends_cafe_43248.mp4", 1.0, 0.45, 1.0),
            ("END", ("más", 1, 0), "resto_customers_4385.mp4", 1.5, 0.55, 1.0),
        ],
        "titles": [
            ("Cobrar: |4 viajes|", None),
            ("Pide en |QR|", "D2"),
            ("|1 solo| viaje", "D3"),
        ],
        "marks": {
            "quince": ("quince", 1, 0), "cobrar": ("cobrar", 1, 0), "esperando": ("esperando", 1, -0.05),
            "cuenta": ("cuenta", 1, 0), "qr": ("qr", 1, -0.05), "tarjeta": ("tarjeta", 1, -0.05), "propina": ("propina", 1, -0.05),
            "monto": ("monto", 1, 0), "resuelve": ("resuelve", 1, -0.10), "viaje": ("viaje", 1, -0.10),
            "badge": ("cero", 1, -0.04), "contact": ("escribinos", 1, -0.05),
        },
        "sfx": [("pop", "quince", 0.10, -17), ("pop", "esperando", 0.05, -16),
                ("scan", "qr", -0.02, -14), ("pop", "tarjeta", 0.05, -15), ("pop", "propina", 0.05, -15),
                ("pop", "resuelve", 0.10, -16), ("ding", "viaje", 0.0, -13), ("success", "badge", 0.0, -14)],
    },
    "r05": {
        "music_in": 0.93 + 24 * BEAT,
        "atempo": 1.05,
        "tail_pad": 1.30,
        "kicker": "Piloto |sin riesgo|",
        "veil": {"P1": 0.48},
        "scenes": [
            ("P1", None, "waiter_drinks_43984.mp4", 0.8, 0.50, 1.0),
            ("P2", ("cuarenta", 1, -1), "bar_serve_43962.mp4", 0.2, 0.50, 1.0),
            ("P3", ("medís", 1, -1), "bar_beer_tap_8709.mp4", 3.5, 0.35, 1.0),
            ("END", ("cero", 1, 0), "friends_cafe_43248.mp4", 1.0, 0.50, 1.0),
        ],
        "titles": [
            ("Sin cambiar |todo|", None),
            ("1 solo |sector|", ("probá", 1, -0.08)),
            ("Listo en |48 h|", "P2"),
            ("Piloto |14 días|", "P3"),
        ],
        "marks": {
            "proba": ("probá", 1, 0), "catorce": ("catorce", 1, 0), "vereda": ("vereda", 1, -0.05), "terraza": ("terraza", 1, -0.05),
            "horas": ("horas", 1, -0.10), "carta": ("carta", 1, -0.05), "activamos": ("activamos", 1, 0), "qr": ("qr", 1, 0),
            "medis": ("medís", 1, 0), "rondas": ("rondas", 1, 0), "vendes": ("vendés", 1, 0),
            "badge": ("cero", 1, -0.04), "contact": ("pedí", 1, -0.05),
        },
        "sfx": [("pop", "vereda", 0.05, -16), ("ding", "terraza", 0.05, -14),
                ("pop", "horas", 0.0, -15), ("scan", "qr", 0.0, -14),
                ("pop", "rondas", 0.0, -16), ("success", "badge", 0.0, -14)],
    },
    "r06": {
        "music_in": 0.93 + 4 * BEAT,
        "atempo": 1.05,
        "tail_pad": 1.25,
        "kicker": "Mismo equipo, |más mesas|",
        "veil": {"R1": 0.50, "R2": 0.50, "R3": 0.50},
        "scenes": [
            ("R1", None, "bar_busy_4043.mp4", 1.5, 0.50, 0.7),
            ("R2", ("con", 1, 0), "waiter_pizza_44003.mp4", 0.4, 0.50, 1.0),
            ("R3", ("así", 1, 0), "resto_customers_4385.mp4", 1.0, 0.52, 1.0),
            ("END", ("cero", 1, 0), "waiter_drinks_43984.mp4", 1.0, 0.50, 1.0),
        ],
        "titles": [
            ("Mozo |convencional|", None),
            ("QR toma |el pedido|", "R2"),
            ("1 mozo rinde |por 2|", "R3"),
        ],
        "marks": {
            "mitad": ("mitad", 1, 0), "anotando": ("anotando", 1, -0.05), "cobrando": ("cobrando", 1, -0.05),
            "qr": ("qr", 1, -0.05), "platos": ("platos", 1, -0.05), "atienden": ("atienden", 1, -0.05),
            "rinde": ("rinde", 1, -0.05), "dos": ("dos", 1, -0.05), "mesas": ("mesas", 1, -0.05), "pico": ("pico", 1, -0.05),
            "badge": ("cero", 1, -0.04), "contact": ("escribinos", 1, -0.05),
        },
        "sfx": [("pop", "anotando", 0.0, -16), ("pop", "cobrando", 0.0, -16),
                ("scan", "qr", -0.02, -14), ("pop", "platos", 0.0, -15),
                ("ding", "dos", 0.0, -13), ("pop", "mesas", 0.0, -15), ("pop", "pico", 0.0, -15),
                ("success", "badge", 0.0, -14)],
    },
    "r07": {
        "music_in": 0.93 + 12 * BEAT,
        "atempo": 1.05,
        "tail_pad": 1.25,
        "kicker": "Más puntaje, |más caja|",
        "veil": {"E1": 0.52, "E2": 0.48, "E3": 0.50},
        "scenes": [
            ("E1", None, "waiter_help_22314.mp4", 0.4, 0.50, 0.85),
            ("E2", ("con", 1, 0), "phone_hands_4915.mp4", 1.0, 0.50, 1.0),
            ("E3", ("tu", 1, 0), "resto_customers_4385.mp4", 1.2, 0.50, 1.0),
            ("END", ("cero", 1, 0), "friends_cafe_43248.mp4", 0.8, 0.50, 1.0),
        ],
        "titles": [
            ("¿1 estrella te |espanta mesas?|", None),
            ("Piden y cierran |al segundo|", "E2"),
            ("Puntaje arriba, |más caja|", "E3"),
        ],
        "marks": {
            "fortunas": ("fortunas", 1, 0), "estrella": ("estrella", 1, -0.05), "espanta": ("espanta", 1, -0.05), "veinte": ("veinte", 1, -0.05),
            "pide": ("pide", 1, -0.05), "cierra": ("cierra", 1, -0.05), "qr": ("qr", 1, -0.05), "segundo": ("segundo", 1, -0.05),
            "brilla": ("brilla", 1, -0.05), "puntaje": ("puntaje", 1, -0.05), "sube": ("sube", 1, -0.05), "caja": ("caja", 1, -0.05), "factura": ("factura", 1, -0.05),
            "badge": ("cero", 1, -0.04), "contact": ("escribinos", 1, -0.05),
        },
        "sfx": [("pop", "estrella", 0.0, -16), ("pop", "veinte", 0.0, -16),
                ("scan", "qr", -0.02, -14), ("ding", "segundo", 0.0, -14),
                ("pop", "puntaje", 0.0, -16), ("ding", "sube", 0.0, -13), ("pop", "factura", 0.0, -15),
                ("success", "badge", 0.0, -14)],
    },
    "r08": {
        "music_in": 0.93 + 20 * BEAT,
        "atempo": 1.05,
        "tail_pad": 1.25,
        "kicker": "Más ticket, |menos espera|",
        "veil": {"G1": 0.50, "G2": 0.48, "G3": 0.50},
        "scenes": [
            ("G1", None, "friends_cafe_43248.mp4", 0.4, 0.48, 1.0),
            ("G2", ("con", 1, 0), "phone_hands_4915.mp4", 0.8, 0.50, 1.0),
            ("G3", ("al", 2, 0), "phone_woman_43270.mp4", 0.6, 0.50, 1.0),
            ("END", ("más", 1, 0), "bar_beer_tap_8710.mp4", 1.8, 0.45, 1.0),
        ],
        "titles": [
            ("¿Mesa de 8, |salón trabado?|", None),
            ("Todos piden |al mismo QR|", "G2"),
            ("Cuenta dividida |en segundos|", "G3"),
        ],
        "marks": {
            "ocho": ("ocho", 1, 0), "frenar": ("frenar", 1, -0.05), "cuentas": ("cuentas", 1, -0.05),
            "qr": ("qr", 1, -0.05), "apps": ("apps", 1, -0.05), "filtra": ("filtra", 1, -0.05), "suma": ("suma", 1, -0.05),
            "cerrar": ("cerrar", 1, 0), "dividen": ("dividen", 1, -0.05), "segundos": ("segundos", 1, -0.05),
            "badge": ("cero", 1, -0.04), "contact": ("escribinos", 1, -0.05),
        },
        "sfx": [("pop", "frenar", 0.0, -16), ("scan", "qr", -0.02, -14), ("pop", "filtra", 0.0, -16),
                ("pop", "suma", 0.0, -15), ("pop", "dividen", 0.0, -15), ("ding", "segundos", 0.0, -13),
                ("success", "badge", 0.0, -14)],
    },
}


def norm(w):
    return re.sub(r"[^\wáéíóúñü]", "", w.lower())


def probe(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r", (\d{3,5})x(\d{3,5})", r.stderr)
    d = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)), int(m.group(2)), int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3))


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
    t0, loop, need = max(0.0, t_in), [], dur * speed
    if t0 + need > sdur - 0.05:
        if need < sdur - 0.05:
            t0 = max(0.0, sdur - 0.05 - need)
        else:
            loop, t0 = ["-stream_loop", "-1"], 0.0
    vf = f"crop={cw}:{ch}:{cx}:{cy},scale={W}:{H}:flags=lanczos,{GRADE},"
    vf += f"setpts={1 / speed:.4f}*PTS,framerate=fps={SRC_FPS}" if speed < 1 else f"fps={SRC_FPS}"
    subprocess.run([FF, "-y", "-loglevel", "error"] + loop + ["-ss", f"{t0:.3f}", "-i", os.path.join(BROLL, src),
                    "-t", f"{dur:.3f}", "-vf", vf, "-q:v", "2", os.path.join(out_dir, "f_%04d.jpg")], check=True)
    return len(os.listdir(out_dir))


def plan(key, do_extract=True):
    cfg = REELS[key]
    atempo = cfg.get("atempo", ATEMPO)
    tail_pad = cfg.get("tail_pad", 1.8)
    vw = json.load(open(os.path.join(HERE, "vo", f"{key}_words.json"), encoding="utf-8"))
    words = [{"w": w["w"], "n": norm(w["w"]), "t0": VO_OFFSET + w["t0"] / atempo, "t1": VO_OFFSET + w["t1"] / atempo} for w in vw["words"]]
    vo_end = words[-1]["t1"]

    def find(word, occ=1, shift=0):
        k = 0
        for i, w in enumerate(words):
            if w["n"] == word:
                k += 1
                if k == occ:
                    return words[i + shift]
        raise SystemExit(f"{key}: ancla no encontrada: {word}")

    starts = [0.0 if a is None else round(find(*a)["t0"] - 0.05, 3) for _, a, *_ in cfg["scenes"]]
    # musica: remate real del tema despues de la ultima palabra (cierre legible)
    music_in = cfg["music_in"]
    k = math.ceil((vo_end + tail_pad - 2 * BEAT - G0) / BEAT)
    splice = G0 + k * BEAT
    total = round(splice + 2.20, 3)
    scenes = []
    for i, (sid, anc, src, t_in, focus, speed) in enumerate(cfg["scenes"]):
        end = total if i == len(cfg["scenes"]) - 1 else starts[i + 1]
        scenes.append({"id": sid, "start": starts[i], "end": round(end, 3), "src": src, "in": t_in, "focus": focus, "speed": speed,
                       "xfade": XFADE_END if sid == "END" else XFADE, "closing": sid == "END", "veil": cfg.get("veil", {}).get(sid, 0.46)})
    S = {s["id"]: s for s in scenes}
    # titulares: cada uno vive hasta que entra el siguiente (o hasta el inicio de su escena siguiente)
    tstarts = []
    for text, anc in cfg["titles"]:
        if anc is None:
            tstarts.append(0.0)
        elif isinstance(anc, str):
            tstarts.append(S[anc]["start"])
        else:
            tstarts.append(round(find(anc[0], anc[1])["t0"] + anc[2], 3))
    end_start = S["END"]["start"]
    titles = []
    for i, (text, _) in enumerate(cfg["titles"]):
        tend = tstarts[i + 1] if i + 1 < len(tstarts) else end_start
        titles.append({"text": text, "start": tstarts[i], "end": round(tend, 3), "first": i == 0})
    M = {n: round(find(w, o)["t0"] + d, 3) for n, (w, o, d) in cfg["marks"].items()}
    logo = round(end_start + XFADE_END / 2 + 0.08, 3)
    M["logo"] = logo
    M["badge"] = round(max(M.get("badge", logo + 0.40), logo + 0.40), 3)
    M["contact"] = round(max(M["contact"], M["badge"] + 0.35), 3)
    sfx = [{"name": n, "t": round(M[m] + d, 3), "db": g} for n, m, d, g in cfg["sfx"]]
    regions = []
    for w in words:
        if regions and w["t0"] - regions[-1][1] < 0.35:
            regions[-1][1] = w["t1"]
        else:
            regions.append([w["t0"], w["t1"]])
    out = os.path.join(WORK, key)
    fr = os.path.join(out, "frames_src")
    os.makedirs(out, exist_ok=True)
    timeline = {
        "reel": key, "kicker": cfg.get("kicker", ""), "fps": FPS, "srcFps": SRC_FPS, "total": total, "pre": PRE, "frames": int(round(total * FPS)),
        "frameBase": "file:///" + fr.replace("\\", "/"),
        "scenes": scenes, "titles": titles, "marks": M,
        "vo": {"file": f"marketing/reels/src/vo/{key}.mp3", "start": VO_OFFSET, "atempo": atempo,
               "regions": [[round(a, 3), round(b, 3)] for a, b in regions], "voice": vw["voice"], "model": vw["model"]},
        "sfx": sfx,
        "music": {"file": MUSIC, "in": round(music_in, 4), "splice": round(splice, 4), "end_in": round(END_IN, 4)},
    }
    json.dump(timeline, open(os.path.join(out, "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"[{key}] voz fin {vo_end:.2f}s | total {total:.2f}s ({timeline['frames']} frames)")
    for s in scenes:
        print(f"  {s['id']:4s} {s['start']:6.2f}-{s['end']:6.2f} ({s['end'] - s['start']:.2f}s) {s['src']}")
    for ti in titles:
        print(f"  titulo {ti['start']:6.2f}-{ti['end']:6.2f} '{ti['text']}'")
    print("  marks:", M)
    if not do_extract:
        return
    jobs = [(os.path.join(fr, s["id"]), s["src"], s["in"], (s["end"] - s["start"]) + PRE + POST, s["focus"], 1080, 1920, s["speed"]) for s in scenes]
    with ThreadPoolExecutor(5) as ex:
        for j, n in zip(jobs, ex.map(lambda a: extract(*a), jobs)):
            print(f"  extract {os.path.basename(j[0])}: {n} frames")


if __name__ == "__main__":
    keys = [a for a in sys.argv[1:] if not a.startswith("--")] or list(REELS)
    for k in keys:
        plan(k, "--no-extract" not in sys.argv)
