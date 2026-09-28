// 首页的桌面: crumpled kraft wrapping paper, and on it a few little gouache pictures (dailystamp/kraft.py, kraft/). One of
// two sets is picked per visit: M4 乡间邮局 or M1-B 邮差. Things of the air go in the upper corners, things on the ground
// in a row along the foot, all only where the stamps never pass (the home hands over where they pass: its zone), as big
// as that room allows and dropped where there is none. It is all painted once into one canvas, when the home is laid
// out (a resize paints it again), never while the wheel turns: gouache on kraft, the paper's relief showing through.
const Desk = (() => {
  const BASE = '/kraft/';
  const DESIGN = { phone: [390, 844], desk: [1440, 900] };   // the screens the sets were arranged on
  let index = null, name = null, set = null, sprites = new Map(), papers = new Map(), loading = null;

  const img = src => new Promise((yes, no) => { const im = new Image(); im.onload = () => yes(im); im.onerror = no; im.src = src; });
  /** the visit's set (seed: the home's deal) and its pictures; the paper for the screen's shape comes with draw() */
  function load(seed) {
    if (loading) return loading;
    loading = (async () => {
      index = await fetch(BASE + 'index.json', { cache: 'no-cache' }).then(r => r.json());
      const keys = Object.keys(index.sets).sort(), rnd = Print.rng(seed + 6151);
      name = keys[Math.floor(rnd() * keys.length)]; set = index.sets[name];
      const names = new Set();
      for (const scr of Object.values(set)) { scr.sky.forEach(t => names.add(t[0])); scr.rows.flat().forEach(n => names.add(n)); }
      await Promise.all([...names].map(async n => { const s = index.sprites[n]; sprites.set(n, { ...s, im: await img(`${BASE}${s.file}?v=${index.v}`) }); }));
    })().catch(() => { set = null; });
    return loading;
  }
  function paper(suf) {
    if (!papers.has(suf)) papers.set(suf, img(`${BASE}${index.paper[suf].file}?v=${index.v}`).catch(() => null));
    return papers.get(suf);
  }

  /** is any of the zone taken in the box (screen px)? */
  const taken = (zone, x0, y0, x1, y1) => {
    const c = zone.cell, gx0 = Math.max(0, Math.floor(x0 / c)), gx1 = Math.min(zone.gw - 1, Math.floor(x1 / c));
    const gy0 = Math.max(0, Math.floor(y0 / c)), gy1 = Math.min(zone.gh - 1, Math.floor(y1 / c));
    for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) if (zone.occ[y * zone.gw + x]) return true;
    return false;
  };

  /** where the pictures go on a W x H screen: [{ name, x, y, w, h, rot }] (x, y: the top left, before turning) */
  function arrange(W, H, zone) {
    const wide = W > H, scr = set[wide ? 'desk' : 'phone'], [DW, DH] = DESIGN[wide ? 'desk' : 'phone'];
    const k = Math.min(1.8, Math.max(0.75, Math.min(W / DW, H / DH)));   // a bigger screen, bigger pictures (at most)
    const out = [];
    // the ground: one scale for every row, as big as the room above the foot allows (halving)
    const base = wide ? H - 12 : H - 48;
    const spans = wide ? [[60, W / 2 - 114], [W / 2 + 114, W - 60]] : [[22, W - 22]];
    const rowsAt = f => {
      const put = [];
      for (const [r, names] of scr.rows.entries()) {
        const [x0, x1] = spans[r] || []; if (x0 == null) continue;
        const part = names.map(n => sprites.get(n)).filter(Boolean);
        const ws = part.map(p => p.w * f), free = (x1 - x0) - ws.reduce((a, b) => a + b, 0);
        if (free < 12 * (part.length - 1) || free < 0) return null;
        const gap = part.length < 2 ? 0 : scr.justify ? free / (part.length - 1) : Math.min(scr.gap * k, free / (part.length - 1));
        let x = x0 + (scr.justify && part.length > 1 ? 0 : (free - gap * (part.length - 1)) / 2);
        part.forEach((p, i) => { put.push({ name: p.file, sp: p, x, y: base - p.h * f, w: ws[i], h: p.h * f, rot: 0 }); x += ws[i] + gap; });
      }
      return put;
    };
    const hits = put => !put || put.some(t => t.sp.top.some((top, c) => {
      if (top >= 1) return false;
      const cx0 = t.x + t.w * c / t.sp.top.length, cx1 = t.x + t.w * (c + 1) / t.sp.top.length;
      return taken(zone, cx0, t.y + top * t.h, cx1, base - 1);
    }));
    const ref = sprites.get(scr.ref);
    if (ref) {
      let lo = 50 / ref.h, hi = scr.tall * k / ref.h;
      if (hits(rowsAt(hi))) {
        if (hits(rowsAt(lo))) lo = 0;                        // no room even small: no ground
        else for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; hits(rowsAt(m)) ? hi = m : lo = m; }
      } else lo = hi;
      if (lo) out.push(...rowsAt(lo));
    }
    // the air: each in its box near its edge, smaller until it is clear; dropped if it has to shrink by half
    for (const [name, cx0, cy0, bw, bh, rot] of scr.sky) {
      const p = sprites.get(name); if (!p) continue;
      const cx = cx0 < DW / 2 ? cx0 * k : W - (DW - cx0) * k, cy = cy0 * k;
      let f = Math.min(bw / p.w, bh / p.h) * k; const f0 = f;
      const rad = Math.abs(rot) * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
      for (; f > f0 * 0.5; f *= 0.94) {
        const w = p.w * f, h = p.h * f, ew = w * cs + h * sn, eh = w * sn + h * cs;
        if (!taken(zone, cx - ew / 2 - 8, cy - eh / 2 - 8, cx + ew / 2 + 8, cy + eh / 2 + 8)) { out.push({ sp: p, x: cx - w / 2, y: cy - h / 2, w, h, rot }); break; }
      }
    }
    return out;
  }

  /** paints the desk into cv for a W x H screen (zone: where the stamps and the type are, from the home's layout) */
  let turn = 0;
  async function draw(cv, W, H, zone) {
    const my = ++turn;
    if (!set) return;
    const suf = W > H ? 'd' : 'p', pap = await paper(suf);
    if (my !== turn || !pap) return;                       // a later layout took over
    const r = Math.min(2, devicePixelRatio || 1), cw = Math.round(W * r), ch = Math.round(H * r);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const g = cv.getContext('2d', { willReadFrequently: true });
    const k = Math.max(cw / pap.naturalWidth, ch / pap.naturalHeight);
    g.imageSmoothingQuality = 'high';
    g.drawImage(pap, (cw - pap.naturalWidth * k) / 2, (ch - pap.naturalHeight * k) / 2, pap.naturalWidth * k, pap.naturalHeight * k);
    const mean = index.paper[suf].lum, tmp = document.createElement('canvas'), tg = tmp.getContext('2d', { willReadFrequently: true });
    for (const t of arrange(W, H, zone)) {
      // the thing drawn alone (turned in its box), then laid on the paper px by px: opaque gouache, the paper's
      // relief showing through a little
      const rad = t.rot * Math.PI / 180, ew = t.w * Math.abs(Math.cos(rad)) + t.h * Math.abs(Math.sin(rad)), eh = t.w * Math.abs(Math.sin(rad)) + t.h * Math.abs(Math.cos(rad));
      const x0 = Math.max(0, Math.floor((t.x + t.w / 2 - ew / 2) * r)), y0 = Math.max(0, Math.floor((t.y + t.h / 2 - eh / 2) * r));
      const x1 = Math.min(cw, Math.ceil((t.x + t.w / 2 + ew / 2) * r)), y1 = Math.min(ch, Math.ceil((t.y + t.h / 2 + eh / 2) * r));
      const bw = x1 - x0, bh = y1 - y0; if (bw <= 0 || bh <= 0) continue;
      tmp.width = bw; tmp.height = bh; tg.imageSmoothingQuality = 'high';
      tg.setTransform(1, 0, 0, 1, (t.x + t.w / 2) * r - x0, (t.y + t.h / 2) * r - y0); tg.rotate(rad);
      tg.drawImage(t.sp.im, -t.w * r / 2, -t.h * r / 2, t.w * r, t.h * r); tg.setTransform(1, 0, 0, 1, 0, 0);
      const art = tg.getImageData(0, 0, bw, bh).data, bg = g.getImageData(x0, y0, bw, bh), p = bg.data;
      for (let i = 0; i < p.length; i += 4) {
        const a = art[i + 3] / 255 * 0.96; if (!a) continue;
        const tex = Math.min(1.12, Math.max(0.82, (p[i] + p[i + 1] + p[i + 2]) / 3 / mean));
        p[i] = p[i] * (1 - a) + art[i] * tex * a; p[i + 1] = p[i + 1] * (1 - a) + art[i + 1] * tex * a; p[i + 2] = p[i + 2] * (1 - a) + art[i + 2] * tex * a;
      }
      g.putImageData(bg, x0, y0);
    }
    tmp.width = tmp.height = 0;
    cv.classList.add('on');
  }
  return { load, draw, get set() { return name; } };
})();
