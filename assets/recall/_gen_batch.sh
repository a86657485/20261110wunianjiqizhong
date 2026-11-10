#!/usr/bin/env bash
set -euo pipefail
ROOT=/workspace/g5-midterm
ROUTE=${1:-codex-cli}
shift || true
IDS=${*:-M01 M02 M03 M04 M05 M06 M07 M08 M09 M10 M11 M12 M13 M14 M15 M16 M17 M18 M19 M20 M21 M22 M23 M24 C01 C02 C03 C04 C05}
for id in $IDS; do
  out="$ROOT/assets/recall/${id}.webp"
  if [[ -f "$out" ]]; then echo "skip $id"; continue; fi
  rundir="$ROOT/assets/recall/_runs/$id"
  mkdir -p "$rundir"
  echo "== $id =="
  python3 /home/box/agent-data/workflows/generate2dmedia/scripts/route_media.py image     --route "$ROUTE"     --prompt-file "$ROOT/assets/recall/_prompts/${id}.txt"     --size 1280x720     --out-dir "$rundir" | tee "$rundir/route.jsonl"
  src=$(find "$rundir" -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' \) ! -name 'route.jsonl' | head -1 || true)
  if [[ -z "${src:-}" ]]; then echo "FAIL $id no artifact"; continue; fi
  python3 - "$src" "$out" <<'PY2'
import sys
from PIL import Image
from pathlib import Path
src, out = Path(sys.argv[1]), Path(sys.argv[2])
im = Image.open(src).convert("RGB")
maxw = 960
if im.width > maxw:
    h = int(im.height * maxw / im.width)
    im = im.resize((maxw, h), Image.Resampling.LANCZOS)
im.save(out, "WEBP", quality=80, method=6)
print("wrote", out, out.stat().st_size, im.size)
PY2
done
