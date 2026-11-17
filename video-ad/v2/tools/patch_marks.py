import os, re, sys
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(V2, "src", "ad_v2.html")
h = open(p, encoding="utf-8-sig").read()
R = [
 ("const on = t < 2.25; vis(g, on);", "const c2s = cutOf('C02').start; const on = t < c2s + 0.45; vis(g, on);"),
 ("const sweep = eIn(seg(t, 1.80, 2.12));", "const sweep = eIn(seg(t, c2s + 0.06, c2s + 0.38));"),
 ("const s = c.start; const lock = s + 0.36;", "const s = c.start; const lock = TL.marks.qr;"),
 ("const chp = spring(t - (lock + 0.08), 16, 7); tf(e.chip, `scale(${Math.max(0, chp).toFixed(3)})`); op(e.chip, t < lock + 0.08 ? 0 : 1);",
  "const g4 = Math.max(lock + 0.08, TL.marks.g4); const chp = spring(t - g4, 16, 7); tf(e.chip, `scale(${Math.max(0, chp).toFixed(3)})`); op(e.chip, t < g4 ? 0 : 1);"),
 ("const tp = 6.42; tapAnim(", "const tp = TL.marks.app; tapAnim("),
 ("const be = spring(t - (s + 0.05), 14, 7); const tp = s + 0.55;", "const be = spring(t - (s + 0.05), 14, 7); const tp = TL.marks.toque - 0.05;"),
 ("const ol = s + 0.68; // lanzamiento del orbe", "const ol = tp + 0.13; // lanzamiento del orbe"),
 ("s = c.start; const tp = 14.0;", "s = c.start; const tp = TL.marks.barra;"),
 ("const t2 = e.tables.T2; const snap = 15.95;", "const t2 = e.tables.T2; const snap = TL.marks.snap;"),
 ("const so = spring(t - 17.45, 16, 7), no = spring(t - 17.65, 16, 7);", "const SO = TL.marks.sofi, NO = TL.marks.nico; const so = spring(t - SO, 16, 7), no = spring(t - NO, 16, 7);"),
 ("opacity: t > 17.45 ? 1 : 0, transform: `scale(${Math.max(0, so)", "opacity: t > SO ? 1 : 0, transform: `scale(${Math.max(0, so)"),
 ("opacity: t > 17.65 ? 1 : 0, transform: `scale(${Math.max(0, no)", "opacity: t > NO ? 1 : 0, transform: `scale(${Math.max(0, no)"),
 ("const w = 17.85 + i * 0.04;", "const w = TL.marks.wave + i * 0.04;"),
 ("const nt = s + 0.12; const nk", "const nt = Math.max(s + 0.3, TL.marks.vibra - 0.12); const nk"),
 ("const st1 = 29.057, st2 = 29.593;", "const st1 = TL.marks.stab1, st2 = TL.marks.stab2;"),
 ("const lift = eInOut(seg(t, 26.30, 26.70));", "const lift = eInOut(seg(t, TL.marks.badge - 0.08, TL.marks.badge + 0.32));"),
 ("const b15 = 26.38;", "const b15 = TL.marks.badge;"),
 ("const c16 = 27.986;", "const c16 = TL.marks.contact;"),
 ("const pp = ((t - 28.0) % 0.9) / 0.9; const pon = t > 28.0;", "const pz = c16 + 0.5; const pp = ((t - pz) % 0.9) / 0.9; const pon = t > pz;"),
 ("(1 + 0.04 * seg(t, s, 30.2))", "(1 + 0.04 * seg(t, s, TL.total))"),
 ("Math.sin(2 * Math.PI * (t - 28.0) / 0.9)", "Math.sin(2 * Math.PI * (t - pz) / 0.9)"),
 ("const punch = t >= 1.2 && t < 24.6 ?", "const c14s = cuts.find(c => c.id === 'C14').start, c2s = cuts.find(c => c.id === 'C02').start;\n  const punch = t >= 1.2 && t < c14s - 0.15 ?"),
 ("const tension = 1 - seg(t, 1.6, 2.0);", "const tension = 1 - seg(t, c2s - 0.15, c2s + 0.25);"),
]
for a, b in R:
    n = h.count(a)
    if n != 1:
        print("MATCH COUNT", n, "for:", a[:70]); sys.exit(1)
    h = h.replace(a, b)
h = h.replace("t > 24.7 ? 1 - seg(t, 24.6, 24.9) : 1", "t > c14s - 0.07 ? 1 - seg(t, c14s - 0.17, c14s + 0.13) : 1")
h = h.replace("t > 24.7 ? 1 - 0.7 * seg(t, 24.6, 24.9) : 1", "t > c14s - 0.07 ? 1 - 0.7 * seg(t, c14s - 0.17, c14s + 0.13) : 1")
left = re.findall(r"\b(2[4-9]\.\d+|1[4-9]\.\d{2,})\b", h)
print("ok; numeros sospechosos restantes:", left)
open(p, "w", encoding="utf-8").write(h)
