import subprocess, numpy as np, glob, os, shutil, sys
FF = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or __import__("imageio_ffmpeg").get_ffmpeg_exe()
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 11025

def load(p):
    raw = subprocess.run([FF, "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def analyze(p):
    x = load(p)
    hop = 256
    n = len(x) // hop
    frames = x[:n * hop].reshape(n, hop)
    # spectral-flux-ish onset via energy diff of rectified high-passed signal
    e = np.log1p(100 * np.sqrt((frames ** 2).mean(1)))
    onset = np.maximum(0, np.diff(e, prepend=e[0]))
    onset -= onset.mean()
    fps = SR / hop
    ac = np.correlate(onset, onset, "full")[len(onset) - 1:]
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 70)
    lag = lo + np.argmax(ac[lo:hi])
    bpm = 60 * fps / lag
    # loudness per 2s
    seg = int(2 * SR)
    rms = [20 * np.log10(np.sqrt((x[i:i + seg] ** 2).mean()) + 1e-9) for i in range(0, len(x) - seg, seg)]
    return bpm, rms

for p in sorted(glob.glob(sys.argv[1] if len(sys.argv) > 1 else os.path.join(V2, "audio", "music_candidates", "*.mp3"))):
    bpm, rms = analyze(p)
    print(os.path.basename(p), f"bpm~{bpm:.1f}", " ".join(f"{r:.0f}" for r in rms[:30]))
