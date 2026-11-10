#!/usr/bin/env python3
import sys
from pathlib import Path
from PIL import Image
src, out, maxw = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3]) if len(sys.argv)>3 else 960
im = Image.open(src).convert("RGB")
if im.width > maxw:
    h = int(im.height * maxw / im.width)
    im = im.resize((maxw, h), Image.Resampling.LANCZOS)
out.parent.mkdir(parents=True, exist_ok=True)
im.save(out, "WEBP", quality=80, method=6)
print(out, out.stat().st_size, im.size)
