import subprocess, os, shutil, re, glob, sys
FF = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg") or __import__("imageio_ffmpeg").get_ffmpeg_exe()
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(V2, "broll")
OUT = os.path.join(V2, "broll_check")
os.makedirs(OUT, exist_ok=True)

def probe(p):
    r = subprocess.run([FF, "-hide_banner", "-i", p], capture_output=True, text=True)
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    d = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)) if dur else 0
    v = re.search(r"Video: (\w+).*?, (\d{3,5})x(\d{3,5}).*?([\d.]+) fps", r.stderr)
    return d, v.groups() if v else None

files = sorted(glob.glob(os.path.join(D, "*.mp4")))
thumbs = []
for f in files:
    n = os.path.splitext(os.path.basename(f))[0]
    d, v = probe(f)
    print(f"{n}: {d:.1f}s {v}")
    for k, frac in enumerate((0.25, 0.65)):
        t = os.path.join(OUT, f"{n}_{k}.jpg")
        subprocess.run([FF, "-y", "-loglevel", "error", "-ss", f"{d*frac:.2f}", "-i", f, "-frames:v", "1",
                        "-vf", "scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2,drawtext=text='" + n + "':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6:fontfile='C\\:/Windows/Fonts/arial.ttf'",
                        t])
        thumbs.append(t)

# contact sheets of 12 thumbs (6 clips x 2) each: 2 cols x 6 rows... use 4 cols x 4 rows
per = 16
for s in range(0, len(thumbs), per):
    chunk = thumbs[s:s+per]
    lst = os.path.join(OUT, f"list_{s}.txt")
    args = [FF, "-y", "-loglevel", "error"]
    for t in chunk:
        args += ["-i", t]
    n = len(chunk)
    cols = 4
    rows = (n + cols - 1) // cols
    layout = "|".join(f"{(i%cols)*480}_{(i//cols)*270}" for i in range(n))
    args += ["-filter_complex", "".join(f"[{i}:v]" for i in range(n)) + f"xstack=inputs={n}:layout={layout}:fill=black", os.path.join(OUT, f"sheet_{s//per}.jpg")]
    subprocess.run(args)
print("sheets done")
