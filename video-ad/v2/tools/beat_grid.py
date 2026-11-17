import os, shutil, subprocess, numpy as np, sys
FF = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or __import__("imageio_ffmpeg").get_ffmpeg_exe()
SR = 22050
p = sys.argv[1]
raw = subprocess.run([FF, "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
hop = 128
win = 1024
n = (len(x) - win) // hop
w = np.hanning(win)
spec = np.abs(np.fft.rfft(np.stack([x[i*hop:i*hop+win]*w for i in range(n)]), axis=1))
logs = np.log1p(spec * 10)
flux = np.maximum(0, np.diff(logs, axis=0)).sum(1)
flux = np.concatenate([[0], flux])
flux = (flux - np.convolve(flux, np.ones(32)/32, "same")).clip(0)
fps = SR / hop
best = None
for bpm in np.arange(85, 140, 0.05):
    period = fps * 60 / bpm
    # comb score over phases
    idx = np.arange(0, n - 1, period)
    for ph in np.linspace(0, period, 24, endpoint=False):
        ii = (idx + ph).astype(int)
        ii = ii[ii < n]
        s = flux[ii].mean()
        if best is None or s > best[0]:
            best = (s, bpm, ph / fps)
s, bpm, ph = best
print(f"BPM={bpm:.2f} beat_phase={ph:.3f}s beat={60/bpm:.4f}s total={len(x)/SR:.2f}s")
# energy per beat bar (4 beats) to locate sections
bar = 4 * 60 / bpm
t = ph
rows = []
while t + bar < len(x) / SR:
    a, b = int(t * SR), int((t + bar) * SR)
    rows.append((t, 20 * np.log10(np.sqrt((x[a:b] ** 2).mean()) + 1e-9)))
    t += bar
print(" ".join(f"{r[0]:.1f}:{r[1]:.0f}" for r in rows))
