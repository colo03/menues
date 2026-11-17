import os, re
P = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.dirname(P)
g = open(os.path.join(P, "gen_vo_continuous.py"), encoding="utf-8-sig").read()
g = re.sub(r'TEXT = \(.*?\)\n', 'TEXT = ("¿Tus mozos corren a mil queriendo estar en todos lados? Bajales esa exigencia. "\n        "Con SaleListo, el cliente escanea el QR con 4G, sin esperar carta ni wifi, y pide tranquilo. "\n        "La comanda se separa sola entre cocina y barra, y el salón reparte bloques equilibrando al equipo en vivo. "\n        "Cero viajes en vano: el celu les vibra recién cuando está listo para llevar. "\n        "Simplificales la vida a ellos y al restaurante, con cero comisión. Escribinos por WhatsApp, y probalo.")\n', g, flags=re.S)
g = g.replace('prueba_voz_viva.mp3', 'locucion_argentina.mp3')
open(os.path.join(P, "gen_vo_continuous.py"), "w", encoding="utf-8").write(g)

p = open(P + r"\plan.py", encoding="utf-8-sig").read()
start = p.index("CUTS = [")
end = p.index("]\n", start) + 2
p = p[:start] + '''CUTS = [  # orden de aparicion (los ids mantienen los componentes de ad_v2.html)
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
''' + p[end:]
rep = [
 ('"g4": find("cuatro")["t0"]', '"g4": find("4g")["t0"]'),
 ('"app": min(find("app")["t0"]', '"app": min(find("carta")["t0"]'),
 ('"toque": find("toque")["t0"]', '"toque": find("tranquilo")["t0"]'),
 ('"barra": min(find("barra")["t0"]', '"barra": min(find("vano")["t0"]'),
 ('"sofi": find("cada")["t0"], "nico": find("mozo")["t0"]', '"sofi": find("equilibrando")["t0"], "nico": find("equipo")["t0"]'),
 ('"badge": find("cero")["t0"] - 0.08', '"badge": find("cero", 2)["t0"] - 0.08'),
 ('os.path.join(ROOT, "prueba_voz_viva.mp3")', 'os.path.join(ROOT, "locucion_argentina.mp3")'),
]
for a, b in rep:
    assert p.count(a) == 1, a
    p = p.replace(a, b)
open(P + r"\plan.py", "w", encoding="utf-8").write(p)

h_path = os.path.join(V2, "src", "ad_v2.html")
h = open(h_path, encoding="utf-8-sig").read()
rep = [
 ("C07: { pos: 270, hl: 2 }", "C07: { pos: 270, hl: 1 }"),
 ("C10: { pos: 300, hl: 0 }", "C10: { pos: 300, hl: 2 }"),
 ("C12: { pos: 300, hl: 1 }", "C12: { pos: 300, hl: 2 }"),
 ("C13: { pos: 300, hl: 0 }", "C13: { pos: 300, hl: 2 }"),
 # C01: mozo a tope con 4 reclamos caoticos (reemplaza el icono Wi-Fi)
 ("  // ---- C02: isotipo con resorte", """  wc.disc.firstChild.style.display = 'none'; wc.disc.insertAdjacentHTML('beforeend', '<span class="emo" style="font-size:170px">🏃</span>'); wc.clock.style.display = 'none';
  wc.reqs = [['🙋', 'Mesa 4 · ¡Carta!', 70, 560], ['🔑', '¿Clave Wi-Fi?', 590, 600], ['🍸', '¿Y mi trago?', 60, 1210], ['🧾', '¡La cuenta!', 600, 1250]].map(r => css(el('div', 'chip', gw, `<span class="emo" style="font-size:48px">${r[0]}</span><span>${r[1]}</span>`), { left: r[2] + 'px', top: r[3] + 'px', background: '#fff', color: '#1f1b16', fontSize: '42px', border: '4px solid #d9412b', boxShadow: '0 18px 44px rgba(0,0,0,0.45)' }));
  // ---- C02: isotipo con resorte"""),
 ("      // reloj\n", """      w.reqs.forEach((r, i) => { const t0 = 0.15 + i * 0.22; const k = spring(t - t0, 17, 7); const sh = t > t0 ? Math.sin((t + i) * 38) * 5 : 0;
        tf(r, `translate(${(sh + (i % 2 ? 1 : -1) * sweep * 1100).toFixed(1)}px, ${(-sweep * 200).toFixed(1)}px) scale(${Math.max(0, k).toFixed(3)}) rotate(${(sh * 0.6).toFixed(2)}deg)`); op(r, t > t0 ? 1 : 0); });
      // reloj
"""),
]
for a, b in rep:
    assert h.count(a) == 1, a
    h = h.replace(a, b)
open(h_path, "w", encoding="utf-8").write(h)
print("patch ok")
