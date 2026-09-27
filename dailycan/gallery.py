"""Static gallery (site/index.html) and a Warhol-grid wall.png from the cans folder."""
from __future__ import annotations

import html
import json
import math
import os

from PIL import Image

from .palettes import BY_NAME
from .spec import CanSpec


def load_cans(cans_dir: str) -> list[tuple[str, CanSpec]]:
    items = []
    for name in sorted(os.listdir(cans_dir)):
        p = os.path.join(cans_dir, name, "meta.json")
        if os.path.exists(p) and os.path.exists(os.path.join(cans_dir, name, "can.png")):
            with open(p, encoding="utf-8") as f:
                items.append((name, CanSpec.from_json(f.read())))
    items.sort(key=lambda t: t[1].no)
    return items


def build_wall(cans_dir: str, out_png: str, cols: int | None = None, cell_w: int = 450) -> str | None:
    items = load_cans(cans_dir)
    if not items:
        return None
    if cols is None:
        # Warhol's wall is 4 wide; otherwise pick the width that leaves the fewest empty cells
        n = len(items)
        cols = min((3, 4, 5, 6), key=lambda c: ((-n) % c, abs(c - 4)))
    cell_h = int(cell_w * 4 / 3)
    rows = math.ceil(len(items) / cols)
    wall = Image.new("RGB", (cols * cell_w, rows * cell_h), (20, 20, 20))
    for i, (folder, _) in enumerate(items):
        im = Image.open(os.path.join(cans_dir, folder, "can.png")).convert("RGB").resize((cell_w, cell_h), Image.LANCZOS)
        wall.paste(im, ((i % cols) * cell_w, (i // cols) * cell_h))
    wall.save(out_png, optimize=True)
    return out_png


HTML = """<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>每日一罐 · Daily Can</title>
<style>
:root {{ --bg:#141414; --fg:#F3EEE3; --mute:#8a857a; --acc:#C8102E; --card:#1c1c1c; }}
@media (prefers-color-scheme: light) {{ :root:not([data-theme=dark]) {{ --bg:#F3EEE3; --fg:#141414; --mute:#6b6760; --card:#ffffff; }} }}
:root[data-theme=light] {{ --bg:#F3EEE3; --fg:#141414; --mute:#6b6760; --card:#ffffff; }}
:root[data-theme=dark]  {{ --bg:#141414; --fg:#F3EEE3; --mute:#8a857a; --card:#1c1c1c; }}
* {{ box-sizing:border-box; }}
html,body {{ margin:0; background:var(--bg); color:var(--fg); font-family:"DIN Next LT Pro","Bahnschrift","HarmonyOS Sans SC","Microsoft YaHei",system-ui,sans-serif; }}
header {{ padding:56px 16px 24px; max-width:1400px; margin:0 auto; display:flex; align-items:flex-end; justify-content:space-between; gap:24px; flex-wrap:wrap; }}
h1 {{ margin:0; font-size:clamp(44px,8vw,112px); line-height:.9; letter-spacing:-.02em; font-family:"方正粗黑宋简体","STHupo","Microsoft YaHei",serif; font-weight:900; }}
h1 small {{ display:block; font-family:inherit; font-size:.22em; letter-spacing:.32em; color:var(--acc); margin-top:14px; font-weight:700; }}
.meta {{ color:var(--mute); font-size:14px; letter-spacing:.18em; text-transform:uppercase; }}
.meta b {{ color:var(--fg); }}
nav {{ max-width:1400px; margin:0 auto; padding:0 16px 20px; display:flex; gap:10px; align-items:center; }}
button {{ background:transparent; color:var(--fg); border:2px solid var(--fg); padding:8px 14px; font:inherit; letter-spacing:.14em; text-transform:uppercase; font-size:12px; cursor:pointer; }}
button[aria-pressed=true] {{ background:var(--fg); color:var(--bg); }}
main {{ max-width:1400px; margin:0 auto; padding:0 16px 80px; }}
.grid {{ display:grid; gap:0; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); }}
.grid.wall {{ gap:0; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); }}
.grid.shelf {{ gap:28px; }}
figure {{ margin:0; position:relative; cursor:pointer; aspect-ratio:3/4; overflow:hidden; background:var(--card); }}
figure img {{ width:100%; height:100%; object-fit:cover; display:block; transition:transform .35s cubic-bezier(.2,.7,.2,1); }}
figure:hover img {{ transform:scale(1.04); }}
figcaption {{ position:absolute; left:0; right:0; bottom:0; padding:10px 12px; background:linear-gradient(transparent,rgba(0,0,0,.55)); color:#fff; font-size:13px; letter-spacing:.08em; opacity:0; transition:opacity .25s; display:flex; justify-content:space-between; }}
figure:hover figcaption {{ opacity:1; }}
.grid.wall figcaption {{ display:none; }}
dialog {{ border:0; padding:0; background:var(--bg); color:var(--fg); max-width:min(96vw,1100px); width:100%; }}
dialog::backdrop {{ background:rgba(0,0,0,.75); }}
.lb {{ display:grid; grid-template-columns:1fr 1fr; }}
.lb img {{ width:100%; display:block; }}
.lb .info {{ padding:28px; display:flex; flex-direction:column; gap:10px; }}
.lb .info h2 {{ margin:0; font-size:56px; font-family:"方正粗黑宋简体","STHupo","Microsoft YaHei",serif; line-height:1; }}
.lb .info p {{ margin:0; color:var(--mute); letter-spacing:.14em; text-transform:uppercase; font-size:12px; }}
.lb .info a {{ color:var(--acc); }}
@media (max-width:720px) {{ .lb {{ grid-template-columns:1fr; }} .lb .info h2 {{ font-size:40px; }} }}
footer {{ text-align:center; color:var(--mute); font-size:12px; letter-spacing:.2em; padding:24px; text-transform:uppercase; }}
</style>
</head>
<body>
<header>
  <h1>每日一罐<small>DAILY CAN · CONDENSED MOOD</small></h1>
  <div class="meta"><b>{count}</b> cans &nbsp;·&nbsp; {first} — {last}</div>
</header>
<nav>
  <button id="b-shelf" aria-pressed="true">Shelf</button>
  <button id="b-wall" aria-pressed="false">Wall</button>
  <button id="b-theme" aria-pressed="false">Theme</button>
</nav>
<main><div class="grid shelf" id="grid">
{figures}
</div></main>
<footer>32 cans make a wall · print label.png, wrap a real tin</footer>
<dialog id="dlg"><div class="lb"><img id="dimg" alt=""><div class="info"><h2 id="dph"></h2><p id="den"></p><p id="dmeta"></p><p id="dcon"></p><p><a id="dlabel" href="#">flat label →</a></p></div></div></dialog>
<script>
const grid=document.getElementById('grid');
const set=(mode)=>{{grid.className='grid '+mode;document.getElementById('b-shelf').setAttribute('aria-pressed',mode==='shelf');document.getElementById('b-wall').setAttribute('aria-pressed',mode==='wall');try{{localStorage.setItem('dc-mode',mode)}}catch(e){{}}}};
document.getElementById('b-shelf').onclick=()=>set('shelf');
document.getElementById('b-wall').onclick=()=>set('wall');
try{{const m=localStorage.getItem('dc-mode');if(m)set(m);}}catch(e){{}}
const root=document.documentElement;
document.getElementById('b-theme').onclick=()=>{{const cur=root.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');const nxt=cur==='dark'?'light':'dark';root.dataset.theme=nxt;try{{localStorage.setItem('dc-theme',nxt)}}catch(e){{}}}};
try{{const t=localStorage.getItem('dc-theme');if(t)root.dataset.theme=t;}}catch(e){{}}
const dlg=document.getElementById('dlg');
for(const f of document.querySelectorAll('figure')){{f.onclick=()=>{{const d=f.dataset;document.getElementById('dimg').src=d.can;document.getElementById('dph').textContent=d.phrase;document.getElementById('den').textContent=d.en;document.getElementById('dmeta').textContent='No. '+d.no+' · '+d.date+' · '+d.palette;document.getElementById('dcon').textContent=d.concept?('Emblem: '+d.concept):'';document.getElementById('dlabel').href=d.label;dlg.showModal();}};}}
dlg.onclick=(e)=>{{if(e.target===dlg)dlg.close();}};
</script>
</body>
</html>
"""


def build_site(cans_dir: str, site_dir: str) -> str:
    items = load_cans(cans_dir)
    os.makedirs(site_dir, exist_ok=True)
    figs = []
    manifest = []
    for folder, s in items:
        can = f"../cans/{folder}/can.png"
        label = f"../cans/{folder}/label.png"
        pal = BY_NAME.get(s.palette.lower())
        wall = pal.wall if pal else "#222"
        figs.append(
            f'<figure data-no="{s.no:03d}" data-date="{html.escape(s.date)}" data-phrase="{html.escape(s.phrase)}" '
            f'data-en="{html.escape(s.en)}" data-palette="{html.escape(s.palette)}" data-concept="{html.escape(s.emblem_prompt)}" '
            f'data-can="{can}" data-label="{label}" style="background:{wall}">'
            f'<img loading="lazy" src="{can}" alt="{html.escape(s.phrase)}">'
            f'<figcaption><span>No. {s.no:03d} · {html.escape(s.phrase)}</span><span>{html.escape(s.date)}</span></figcaption></figure>'
        )
        manifest.append({"folder": folder, **json.loads(s.to_json())})
    first = items[0][1].date if items else "—"
    last = items[-1][1].date if items else "—"
    page = HTML.format(count=len(items), first=first, last=last, figures="\n".join(figs))
    out = os.path.join(site_dir, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    with open(os.path.join(site_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return out
