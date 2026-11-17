import sys, os, glob
from PIL import Image, ImageDraw
src = sys.argv[1]; out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
fps = 60
files = sorted(glob.glob(os.path.join(src, "*.jpg")))
tw, th = 360, 640
per = cols * 2
for s in range(0, len(files), per):
    chunk = files[s:s + per]
    sheet = Image.new("RGB", (tw * cols, th * 2), "black")
    for i, f in enumerate(chunk):
        im = Image.open(f).resize((tw, th), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        n = int(os.path.basename(f)[2:7])
        d.rectangle([0, 0, 150, 30], fill="black"); d.text((6, 6), f"{n} t={n/fps:.2f}", fill="yellow")
        sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    sheet.save(f"{out}_{s // per:02d}.jpg", quality=88)
print("ok")
