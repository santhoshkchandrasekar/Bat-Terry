"""Fill deploy/site/ with the page as the hosted site serves it: index.html with host.js first, every file the page loads, and its images.

    cd deploy && python3 build.py

Nothing in app/ changes; host.js connects the page to its language model (OpenAI, through the site's function).
"""
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent / "app"
SITE = HERE / "site"
WEB = {".webp", ".jpg", ".jpeg", ".png", ".svg", ".woff2"}

if SITE.exists():
    shutil.rmtree(SITE)
SITE.mkdir()
html = (APP / "zoom" / "index.html").read_text()
import re
m = re.search(r'<script src="opening\.js(\?v=\d+)?"></script>', html)
assert m, "opening.js tag not found"
html = html.replace(m.group(0), '<script src="host.js"></script>\n' + m.group(0), 1)
# a standard document skeleton around the page (the page itself starts at its <title>)
html = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '</head><body>' + html + '</body></html>')
(SITE / "index.html").write_text(html)
shutil.copy2(HERE / "host.js", SITE / "host.js")

missing = []
for ref in sorted(set(re.findall(r'(?:src|href)="([^"#:?]+)(?:\?[^"]*)?"', html))):
    if ref == "host.js":
        continue
    for d in ["zoom", "live", "bat3d", "brand"]:
        if (APP / d / ref).is_file():
            (SITE / ref).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(APP / d / ref, SITE / ref)
            break
    else:
        missing.append(ref)
# scripts the page loads later, by name (the enlarged window and its layers)
for js in sorted(set(re.findall(r'"([a-z0-9_-]+\.(?:js|css))"', "".join(f.read_text() for f in SITE.glob("*.js"))))):
    if not (SITE / js).exists():
        src = next((APP / d / js for d in ["zoom", "live", "bat3d", "brand"] if (APP / d / js).is_file()), None)
        if src: shutil.copy2(src, SITE / js)
        else: missing.append(js)
shutil.copy2(APP / "live" / "data.json", SITE / "data.json")
for f in (APP / "zoom" / "assets").rglob("*"):
    if f.is_file() and f.suffix.lower() in WEB and "-src" not in f.stem and "green" not in f.stem:
        out = SITE / "assets" / f.relative_to(APP / "zoom" / "assets")
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, out)
assert not missing, missing
n = sum(1 for _ in SITE.rglob("*") if _.is_file())
mb = sum(f.stat().st_size for f in SITE.rglob("*") if f.is_file()) / 1e6
print(f"site/: {n} files, {mb:.1f} MB")
