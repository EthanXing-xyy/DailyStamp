// 版式: nine front compositions, each a different pop idiom. A layout draws into two plates inside the printed field:
// P = colour plate (all spot inks, painter's order), K = key plate (black line work), which the press prints slightly
// out of register. Coordinates are stamp base units (1200 x 1500); the field is inset 52 from the perforated edge.
// Each returns {pm} = where the postmark lands.
const Layouts = (() => {
  const F = { x0: 52, y0: 52, x1: 1148, y1: 1448 };
  const TAU = Math.PI * 2;

  // ---------- glyph masks (white on transparent, trimmed to the ink)
  function trim(c) {
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return U.canvas(1, 1);
    const o = U.canvas(x1 - x0 + 1, y1 - y0 + 1); o.getContext('2d').drawImage(c, -x0, -y0);
    return o;
  }
  function glyphs(text, role, size, trk = 0) {
    const probe = U.canvas(8, 8).getContext('2d'); probe.font = U.font(role, size);
    const chars = [...text], ws = chars.map(ch => probe.measureText(ch).width);
    const pad = Math.ceil(size * 0.4), w = ws.reduce((a, b) => a + b, 0) + trk * (chars.length - 1);
    const c = U.canvas(Math.ceil(w + pad * 2), Math.ceil(size * 1.6 + pad * 2)), g = c.getContext('2d');
    g.font = U.font(role, size); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    let x = pad; chars.forEach((ch, i) => { g.fillText(ch, x, pad + size * 1.15); x += ws[i] + trk; });
    return trim(c);
  }
  const roleOf = t => U.hasCjk(t) ? 'phrase_cjk' : 'phrase_latin';
  function fit(text, maxW, maxH, trkK = 0.03) {
    const role = roleOf(text), ref = 100, m = glyphs(text, role, ref, ref * trkK);
    const size = Math.max(4, Math.floor(ref * Math.min(maxW / m.width, maxH / m.height)));
    return glyphs(text, role, size, size * trkK);
  }
  /** the word set vertically: CJK stacked top-to-bottom, latin turned 90° */
  function fitVertical(text, maxW, maxH) {
    if (!U.hasCjk(text)) {
      const m = fit(text, maxH, maxW), c = U.canvas(m.height, m.width), g = c.getContext('2d');
      g.translate(0, m.width); g.rotate(-Math.PI / 2); g.drawImage(m, 0, 0); return c;
    }
    const chars = [...text], ref = 100, refs = chars.map(ch => glyphs(ch, 'phrase_cjk', ref));
    const gap = ref * 0.1, th = refs.reduce((a, m) => a + m.height, 0) + gap * (chars.length - 1), tw = Math.max(...refs.map(m => m.width));
    const k = Math.min(maxW / tw, maxH / th), size = Math.floor(ref * k), ms = chars.map(ch => glyphs(ch, 'phrase_cjk', size));
    const W = Math.max(...ms.map(m => m.width)), H = ms.reduce((a, m) => a + m.height, 0) + gap * k * (chars.length - 1);
    const c = U.canvas(W, Math.ceil(H)), g = c.getContext('2d');
    let y = 0; for (const m of ms) { g.drawImage(m, (W - m.width) / 2, y); y += m.height + gap * k; }
    return c;
  }
  /** outline ring of a mask, r px wide */
  function ring(mask, r) {
    const p = Math.ceil(r) + 2, c = U.canvas(mask.width + 2 * p, mask.height + 2 * p), g = c.getContext('2d');
    for (const k of [1, 0.66, 0.33]) for (let i = 0; i < 16; i++) { const a = i * TAU / 16; g.drawImage(mask, p + Math.cos(a) * r * k, p + Math.sin(a) * r * k); }
    g.globalCompositeOperation = 'destination-out'; g.drawImage(mask, p, p);
    c.pad = p; return c;
  }

  /** pop type: solid block extrusion + fill on the colour plate, outline on the key plate. (cx, cy) = centre, base units */
  function popText(L, mask, cx, cy, o = {}) {
    const { TP: P, TK: K, s } = L, w = mask.width, h = mask.height;
    const at = (g, img, dx, dy, pad = 0) => { g.save(); g.translate(cx * s, cy * s); if (o.rot) g.rotate(o.rot); g.drawImage(img, -w / 2 - pad + dx, -h / 2 - pad + dy); g.restore(); };
    if (o.shadow && o.depth) {
      const sh = Print.tinted(mask, o.shadow), d = o.depth * s, n = Math.max(1, Math.ceil(d / Math.max(1, 0.8 * s))), dir = o.dir ?? Math.PI / 4;
      for (let i = n; i >= 1; i--) at(P, sh, Math.cos(dir) * d * i / n, Math.sin(dir) * d * i / n);
    }
    at(P, Print.tinted(mask, o.fill), 0, 0);
    if (o.fills && o.boxes) o.boxes.forEach((b, i) => {
      const t = Print.tinted(mask, o.fills[i]);
      P.save(); P.translate(cx * s, cy * s); if (o.rot) P.rotate(o.rot); P.drawImage(t, b.x, b.y, b.w, b.h, -w / 2 + b.x, -h / 2 + b.y, b.w, b.h); P.restore();
    });
    if (o.outline) { const r = ring(mask, (o.ow || 5) * s); at(K, Print.tinted(r, o.outline), 0, 0, r.pad); }
  }
  const fitWord = (L, maxW, maxH) => fit(L.word, maxW * L.s, maxH * L.s, U.hasCjk(L.word) ? 0.04 : 0.01);

  // ---------- emblem: m = {outline, sil, band, acc, ink} colours; o = {rot, inkShift:[dx,dy]}
  function emblemAt(L, cx, cy, size, m, o = {}) {
    const { P, K, TP, TK, s, emblem } = L, S = size * s;
    if (L.embBoxes) L.embBoxes.push({ x0: cx - size * 0.4, y0: cy - size * 0.4, x1: cx + size * 0.4, y1: cy + size * 0.4 });   // the postmark stays off it
    const put = (g, img, dx = 0, dy = 0) => { g.save(); g.translate(cx * s + dx, cy * s + dy); if (o.rot) g.rotate(o.rot); g.drawImage(img, -S / 2, -S / 2, S, S); g.restore(); };
    if (emblem && emblem.img) {
      const [mi, ma, mb] = Print.channelMasks(emblem);
      const tint = (mask, col) => Print.tinted(mask, col, S);
      if (m.outline) put(P, tint(Print.silhouette(emblem, 0.05), m.outline));
      if (m.sil) put(P, tint(Print.silhouette(emblem, 0.028), m.sil));
      if (m.band) put(P, tint(mb, m.band));
      if (m.acc) put(P, tint(ma, m.acc));
      const [dx, dy] = o.inkShift || [0, 0];
      put(K, tint(mi, m.ink), dx * s, dy * s);
    } else {
      P.save(); P.translate(cx * s, cy * s);
      // sticker edge like the real emblems: ink outline, a paper rim, then the seal
      if (m.outline) { P.fillStyle = m.outline; P.beginPath(); P.arc(0, 0, S * 0.405, 0, TAU); P.fill(); }
      P.fillStyle = m.sil || L.paper; P.beginPath(); P.arc(0, 0, S * 0.393, 0, TAU); P.fill(); P.restore();
      put(P, Print.fallbackEmblem(1024, L.spec.no, { accent: m.band || m.acc, ink: m.ink }));
    }
  }
  /** the emblem blown up as a Ben-Day halftone (Lichtenstein) */
  function halftoneMask(g, mask, x, y, size, color, cell, rk) {
    const n = Math.max(2, Math.ceil(size / cell)), sm = U.canvas(n, n), sg = sm.getContext('2d');
    sg.drawImage(mask, 0, 0, n, n);
    const d = sg.getImageData(0, 0, n, n).data;
    g.fillStyle = color;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (d[(j * n + i) * 4 + 3] < 110) continue;
      g.beginPath(); g.arc(x + (i + 0.5 + (j % 2) * 0.5) * cell, y + (j + 0.5) * cell, cell * rk, 0, TAU); g.fill();
    }
  }

  // ---------- small type
  const X = (L, v) => v * L.s;
  function box(L, g, x0, y0, x1, y1, color) { g.fillStyle = color; g.fillRect(x0 * L.s, y0 * L.s, (x1 - x0) * L.s, (y1 - y0) * L.s); }
  function frame(L, g, x0, y0, x1, y1, color, lw) { g.strokeStyle = color; g.lineWidth = lw * L.s; g.strokeRect(x0 * L.s, y0 * L.s, (x1 - x0) * L.s, (y1 - y0) * L.s); }
  function circ(L, g, cx, cy, r) { g.beginPath(); g.arc(cx * L.s, cy * L.s, r * L.s, 0, TAU); }
  function pill(L, g, x0, y0, x1, y1) { const s = L.s, r = (y1 - y0) / 2; g.beginPath(); g.roundRect(x0 * s, y0 * s, (x1 - x0) * s, (y1 - y0) * s, r * s); }
  const no3 = L => String(L.spec.no).padStart(3, '0');
  const year = L => (L.spec.date || '2026').slice(0, 4);

  /** the solar term (节气) of the issue date in place of a denomination: its icon with the name set small beneath.
   *  (x, y, size, align) keep the old denomination's meaning: `size` is the cap size and y its baseline, and the block
   *  grows up from there so it never reaches the small print under it; align 'mid' centres it on (x, y) instead,
   *  for a container. Outlines print in `color` on g, fills in one spot ink on the
   *  colour plate that differs from `color` and, when known, from the container `bg`. */
  function season(L, g, x, y, size, color, align = 'right', maxW = 1e9, bg = null) {
    const s = L.s, t = Terms.of(L.spec.date), cy = align === 'mid' ? y : y - size * 0.36;
    if (!t.icon) {   // icon not drawn yet: just the name
      const fs = Math.min(size * 0.9, maxW / 2.1), w = fs * 2.1;
      const cx = align === 'right' ? x - w / 2 : align === 'left' ? x + w / 2 : x;
      U.drawTracked(g, cx * s, cy * s, t.name, U.font('cjk_small', Math.round(fs * s)), color, fs * 0.1 * s, 'center');
      return;
    }
    const k = Math.min(1, maxW / size);
    const ih = size * k, ls = size * 0.27 * k, gap = size * 0.03 * k, H = ih + gap + ls;
    const cx = align === 'right' ? x - ih / 2 : align === 'left' ? x + ih / 2 : x, top = align === 'mid' ? y - H / 2 : y + size * 0.1 - H;
    const [R, G, B] = Print.channelMasks(t.icon);
    const cands = L.c.filter(c => c !== color && c !== bg).map(c => [c, Math.min(U.contrast(c, color), bg ? U.contrast(c, bg) * 1.4 : 9)]).sort((a, b) => b[1] - a[1]);
    const spot = cands.length && cands[0][1] >= 1.5 ? cands[0][0] : L.paper;
    for (const m of [G, B]) L.TP.drawImage(Print.tinted(m, spot, ih * s), (cx - ih / 2) * s, top * s, ih * s, ih * s);
    g.drawImage(Print.tinted(R, color, ih * s), (cx - ih / 2) * s, top * s, ih * s, ih * s);
    U.drawTracked(g, cx * s, (top + ih + gap + ls / 2) * s, t.name, U.font('cjk_small', Math.round(ls * s)), color, ls * 0.35 * s, 'center');
  }
  /** an irregular holder for the solar term, never a plain box or disc: cutout = a Matisse paper cut-out with an
   *  offset key shadow; scallop = a bottle-cap rosette whose key outline prints a little out of register; burst = a
   *  comic explosion; torn = a scrap of coloured paper torn by hand, its white fibre edge showing. The shape stays
   *  inside the w×h box centred on (cx, cy) (layout units); the fill prints on the type colour plate, lines on the keys. */
  function holder(L, cx, cy, w, h, style, fill, rnd) {
    const { s, ink, paper, TP, TK, K } = L, rx = w / 2, ry = h / 2, r = Math.min(rx, ry);
    const ring = (n, f) => Array.from({ length: n }, (_, i) => { const a = i / n * TAU, k = f(a, i); return [(cx + Math.cos(a) * rx * k) * s, (cy + Math.sin(a) * ry * k) * s]; });
    const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx * s, y + dy * s]);
    const paint = (g, pts, color) => { g.fillStyle = color; Pattern.poly(g, pts); g.fill(); };
    if (style === 'cutout') {
      const hs = [2, 3, 4, 5].map(k => [k, 0.02 + rnd() * 0.05, rnd() * TAU]);
      const raw = a => hs.reduce((t, [k, amp, ph]) => t + amp * Math.cos(k * a + ph), 0);
      const vs = Array.from({ length: 180 }, (_, i) => raw(i / 180 * TAU)), mn = Math.min(...vs), mx = Math.max(...vs);
      const pts = ring(180, (a, i) => 0.92 * (0.8 + 0.2 * (vs[i] - mn) / (mx - mn || 1)));
      const d = r * 0.07 * (rnd() < 0.5 ? 1 : -1);
      paint(K, shift(pts, Math.abs(d), d * 0.9), ink);
      paint(TP, pts, fill);
    } else if (style === 'scallop') {
      const m = 10 + Math.floor(rnd() * 5), ph = rnd() * TAU;
      const pts = ring(360, a => 0.84 + 0.1 * Math.pow(Math.abs(Math.cos((a * m + ph) / 2)), 0.55));
      const a = rnd() * TAU, off = r * 0.05;
      paint(TP, pts, fill);
      TK.strokeStyle = ink; TK.lineWidth = 6 * s; TK.lineJoin = 'round'; Pattern.poly(TK, shift(pts, Math.cos(a) * off, Math.sin(a) * off)); TK.stroke();
    } else if (style === 'burst') {
      const n = 11 + Math.floor(rnd() * 4), pts = [], rot = rnd() * TAU;
      for (let i = 0; i < n * 2; i++) {
        const a = rot + (i + (rnd() - 0.5) * 0.45) * Math.PI / n, k = i % 2 ? 0.7 + rnd() * 0.08 : 0.88 + rnd() * 0.1;
        pts.push([(cx + Math.cos(a) * rx * k) * s, (cy + Math.sin(a) * ry * k) * s]);
      }
      paint(TP, pts, fill);
      TK.strokeStyle = ink; TK.lineWidth = 6 * s; TK.lineJoin = 'miter'; Pattern.poly(TK, pts); TK.stroke();
    } else {   // torn: jagged along every edge, the white core showing unevenly where the colour layer tore short
      const rot = (rnd() - 0.5) * 0.14, hx = rx * 0.9 - 4, hy = ry * 0.9 - 4, per = 4 * (hx + hy), step = 7;
      let wob = 0, rim = 4;
      const outer = [], inner = [];
      for (let t = 0; t < per; t += step) {
        let px, py, nx, ny;   // point on the rectangle and its outward normal
        if (t < 2 * hx) { px = -hx + t; py = -hy; nx = 0; ny = -1; }
        else if (t < 2 * hx + 2 * hy) { px = hx; py = -hy + t - 2 * hx; nx = 1; ny = 0; }
        else if (t < 4 * hx + 2 * hy) { px = hx - (t - 2 * hx - 2 * hy); py = hy; nx = 0; ny = 1; }
        else { px = -hx; py = hy - (t - 4 * hx - 2 * hy); nx = -1; ny = 0; }
        wob = wob * 0.8 + (rnd() - 0.5) * 5; rim = Math.max(1.5, Math.min(11, rim + (rnd() - 0.5) * 4));
        const j = (rnd() - 0.5) * 5, o = wob + j, c = Math.cos(rot), sn = Math.sin(rot);
        const P = k => { const x = px + nx * k, y = py + ny * k; return [(cx + x * c - y * sn) * s, (cy + x * sn + y * c) * s]; };
        outer.push(P(o)); inner.push(P(o - rim - (rnd() < 0.15 ? rnd() * 6 : 0)));
      }
      paint(K, outer.map(([x, y]) => [x + 5 * s, y + 6 * s]), ink);
      paint(TP, outer, paper);
      paint(TP, inner, fill);
    }
  }
  /** an irregular label for the issuer line, never a box or pill: balloon = a wobbly comic speech balloon with a tail;
   *  tape = a strip of tape stuck on askew, its ends pinked; swipe = one rough brush stroke that runs dry in bristle
   *  streaks; torn = a torn paper scrap (as holder). Stays inside the w×h box on (cx, cy); returns the frame to set the
   *  type in: its centre offset (dx, dy) and rotation. */
  function label(L, cx, cy, w, h, style, fill, rnd) {
    const { s, ink, TP, TK } = L, paint = pts => { TP.fillStyle = fill; Pattern.poly(TP, pts); TP.fill(); };
    const at = rot => { const c = Math.cos(rot), sn = Math.sin(rot); return (x, y) => [(cx + x * c - y * sn) * s, (cy + x * sn + y * c) * s]; };
    if (style === 'balloon') {
      const rx = w / 2 - 6, ry = h * 0.38, oy = -h * 0.11, side = rnd() < 0.5 ? -1 : 1, aT = Math.PI / 2 - side * 0.55, ph = rnd() * TAU, P = at(0);
      const pts = [];
      let tail = false;
      for (let i = 0; i < 240; i++) {
        const a = i / 240 * TAU, d = Math.abs(Math.atan2(Math.sin(a - aT), Math.cos(a - aT)));
        if (d < 0.2) { if (!tail) { pts.push(P(side * rx * 0.72, h / 2 - 4)); tail = true; } continue; }
        const k = 1 + 0.03 * Math.sin(3 * a + ph) + 0.015 * Math.sin(7 * a + ph * 2);
        pts.push(P(Math.cos(a) * rx * k * 0.97, oy + Math.sin(a) * ry * k * 0.97));
      }
      paint(pts);
      TK.strokeStyle = ink; TK.lineWidth = 5 * s; TK.lineJoin = 'round'; Pattern.poly(TK, pts); TK.stroke();
      return { dx: 0, dy: oy, rot: 0 };
    }
    if (style === 'tape') {
      const rot = (rnd() < 0.5 ? -1 : 1) * (0.05 + rnd() * 0.04), hx = w / 2 - 8, hy = Math.min(h * 0.42, h / 2 - Math.abs(Math.sin(rot)) * hx - 4), P = at(rot);
      const teeth = Math.max(4, Math.round(hy / 7)), top = [], bot = [], end = sgn => Array.from({ length: teeth * 2 + 1 }, (_, i) =>
        P(sgn * (hx - (i % 2 ? 9 : 0)), sgn * (-hy + i * hy / teeth)));
      for (let x = -hx; x <= hx; x += 12) { top.push(P(x, -hy + (rnd() - 0.5) * 1.6)); bot.unshift(P(x, hy + (rnd() - 0.5) * 1.6)); }
      paint([...top, ...end(1), ...bot, ...end(-1)]);
      return { dx: 0, dy: 0, rot };
    }
    if (style === 'swipe') {
      const rot = (rnd() - 0.5) * 0.1, tl = w * 0.2, hx = w / 2 - 6, x1 = hx - tl, bow = (rnd() - 0.5) * 10, P = at(rot);
      const hy = Math.min(h * 0.44, h / 2 - Math.abs(Math.sin(rot)) * hx - 4), bend = x => bow * (1 - (x / hx) ** 2);
      let wa = 0, wb = 0;
      const top = [], bot = [];
      for (let x = -hx + hy * 0.5; x <= x1; x += 8) {
        wa = wa * 0.7 + (rnd() - 0.5) * 3; wb = wb * 0.7 + (rnd() - 0.5) * 3;
        top.push(P(x, -hy + wa + bend(x))); bot.unshift(P(x, hy + wb + bend(x)));
      }
      const head = Array.from({ length: 12 }, (_, i) => { const a = Math.PI / 2 + i / 11 * Math.PI; return P(-hx + hy * 0.5 + Math.cos(a) * hy * 0.5 + (rnd() - 0.5) * 3, Math.sin(a) * hy + bend(-hx)); });
      paint([...top, ...bot, ...head]);
      // the brush runs dry: bristle streaks of different lengths, each tapering to a point
      const n = 10, sw = 2 * hy / n;
      for (let i = 0; i < n; i++) {
        const y0 = -hy + i * sw + bend(x1), y1 = y0 + sw - 1.5, m = (y0 + y1) / 2, len = tl * (0.25 + rnd() * 0.75), dy = (rnd() - 0.5) * 3;
        paint([P(x1 - 4, y0), P(x1 + len * 0.55, y0 + sw * 0.1 + dy * 0.5), P(x1 + len * 0.85, m - sw * 0.2 + dy), P(x1 + len, m + dy), P(x1 + len * 0.85, m + sw * 0.2 + dy), P(x1 + len * 0.55, y1 - sw * 0.1 + dy * 0.5), P(x1 - 4, y1)]);
      }
      return { dx: -tl / 2, dy: bow * 0.5, rot };
    }
    holder(L, cx, cy, w, h, 'torn', fill, rnd);
    return { dx: 0, dy: 0, rot: 0 };
  }
  /** draw fn(g) in the frame label() returned: the origin at the label's type centre, turned with it */
  function inLabel(L, g, cx, cy, f, fn) {
    g.save(); g.translate((cx + f.dx) * L.s, (cy + f.dy) * L.s); g.rotate(f.rot); fn(g); g.restore();
  }
  function issuer(L, g, x, y, color, align = 'left', k = 1) {
    const s = L.s;
    U.drawMixed(g, x * s, y * s, '每日邮政', 'caps', 'cjk_small', Math.round(34 * k * s), color, 4 * k * s, 1, align);
    U.drawTracked(g, x * s, (y + 34 * k) * s, 'DAILY POST', U.font('caps_med', Math.round(17 * k * s)), color, 6 * k * s, align);
  }
  function small(L, g, x, y, color, align = 'left', size = 19) {
    U.drawMixed(g, x * L.s, y * L.s, `${year(L)} · NO.${no3(L)} · 每日一枚 第一辑`, 'caps_med', 'cjk_small_med', Math.round(size * L.s), color, 2 * L.s, 0.95, align);
  }
  function enLine(L, g, x, y, color, align = 'left', size = 26, maxW = 900) {
    const t = (L.spec.en || '').toUpperCase(); if (!t) return;
    let sz = size; const probe = U.canvas(8, 8).getContext('2d');
    while (sz > 12 && U.measure(probe, t, U.font('caps', sz), sz * 0.4).w > maxW) sz--;
    U.drawTracked(g, x * L.s, y * L.s, t, U.font('caps', Math.round(sz * L.s)), color, sz * 0.4 * L.s, align);
  }
  const other = (L, ...not) => L.c.filter(c => !not.includes(c));
  /** a colour for a holder at box: from the palette, not paper-pale, not a colour of the ground under it,
   *  and among those the one that best carries key-ink type */
  function holderCol(L, bx, not = []) {
    const bg = under(L, bx), cs = L.c.filter(c => U.contrast(c, L.paper) >= 1.3 && !not.includes(c)), pool = cs.length ? cs : L.c;
    const score = c => (worst(c, bg) >= 1.4 ? 10 : 0) + U.contrast(c, L.ink);
    return [...pool].sort((a, b) => score(b) - score(a))[0];
  }
  /** key ink or paper, whichever reads better on bg */
  const txt = (L, bg) => U.contrast(L.ink, bg) >= U.contrast(L.paper, bg) ? L.ink : L.paper;

  // =====================================================================================================
  // 0. 生成 — a new composition every time. Randomness decides; design rules constrain:
  //    · a 25-unit grid inside a safe margin, positions snap
  //    · one hero, one second: emblem and word never share a size class and sit on opposite sides / diagonals
  //    · 60-30-10 colour: one ground, one structure colour, accents; the word clashes in hue with what is under it
  //    · type is sacred: it prints on the top plates, info items never collide with the word, the emblem core,
  //      each other or the postmark, and textures step around the type's real outline (never a rectangle)
  const snap = v => Math.round(v / 25) * 25;
  const hit = (a, b, pad = 0) => a.x0 < b.x1 + pad && a.x1 + pad > b.x0 && a.y0 < b.y1 + pad && a.y1 + pad > b.y0;
  const inside = (a, G) => a.x0 >= G.x0 - 1 && a.y0 >= G.y0 - 1 && a.x1 <= G.x1 + 1 && a.y1 <= G.y1 + 1;
  const rectC = (cx, cy, w, h) => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });

  /** the word as one mask with per-glyph boxes, laid in a row or a column (px) */
  function wordMasks(text, maxW, maxH, vertical) {
    const cjk = U.hasCjk(text), chars = [...text];
    if (vertical && !cjk) {
      const m = fit(text, maxH, maxW, 0.01), c = U.canvas(m.height, m.width), g = c.getContext('2d');
      g.translate(0, m.width); g.rotate(-Math.PI / 2); g.drawImage(m, 0, 0); return { mask: c, boxes: null };
    }
    const gapK = cjk ? 0.07 : 0.035;
    const build = size => {
      const ms = chars.map(ch => ch.trim() ? glyphs(ch, U.hasCjk(ch) ? 'phrase_cjk' : 'phrase_latin', size) : null);
      const gap = size * gapK, sp = size * 0.3;
      const along = m => m ? (vertical ? m.height : m.width) : sp, across = m => m ? (vertical ? m.width : m.height) : 0;
      const Lh = ms.reduce((a, m) => a + along(m), 0) + gap * (ms.length - 1), T = Math.max(1, ...ms.map(across));
      return { ms, gap, along, W: vertical ? T : Lh, H: vertical ? Lh : T };
    };
    const r = build(100), k = Math.min(maxW / r.W, maxH / r.H), b = build(Math.max(6, Math.floor(100 * k)));
    const c = U.canvas(Math.ceil(b.W), Math.ceil(b.H)), g = c.getContext('2d'), boxes = [];
    let t = 0;
    for (const m of b.ms) {
      if (m) {
        const x = vertical ? (b.W - m.width) / 2 : t, y = vertical ? t : (cjk ? (b.H - m.height) / 2 : b.H - m.height);
        g.drawImage(m, x, y); boxes.push({ x, y, w: m.width, h: m.height });
      }
      t += b.along(m) + b.gap;
    }
    return { mask: c, boxes };
  }
  /** colours actually printed under a box on the art plates, sampled on a grid */
  function under(L, bx) {
    const s = L.s, x = Math.max(0, Math.floor(bx.x0 * s)), y = Math.max(0, Math.floor(bx.y0 * s));
    const w = Math.max(1, Math.min(L.P.canvas.width - x, Math.ceil((bx.x1 - bx.x0) * s))), h = Math.max(1, Math.min(L.P.canvas.height - y, Math.ceil((bx.y1 - bx.y0) * s)));
    const dp = L.P.getImageData(x, y, w, h).data, dk = L.K.getImageData(x, y, w, h).data, out = new Set();
    for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) {
      const px = Math.floor((i + 0.5) / 8 * w), py = Math.floor((j + 0.5) / 6 * h), o = (py * w + px) * 4;
      if (dk[o + 3] > 128) out.add(U.rgbToHex([dk[o], dk[o + 1], dk[o + 2]]));
      else if (dp[o + 3] > 128) out.add(U.rgbToHex([dp[o], dp[o + 1], dp[o + 2]]));
    }
    return out.size ? [...out] : [L.paper];
  }
  /** squared RGB distance between a hex colour and pixel o of an ImageData array */
  const cdist = (hex, d, o) => { const [r, g, b] = U.hexToRgb(hex); return (r - d[o]) ** 2 + (g - d[o + 1]) ** 2 + (b - d[o + 2]) ** 2; };
  const worst = (c, bgs) => Math.min(...bgs.map(b => U.contrast(c, b)));
  /** palette inks that are not (close to) any of the given colours */
  const away = (L, cols) => L.c.filter(x => cols.every(b => U.contrast(x, b) > 1.12));

  /** distance (base units) from any point of the stamp to the nearest inked pixel of the given plates, on a 5-unit grid */
  function typeField(L, plates) {
    const q = 5, W = Math.ceil(L.P.canvas.width / L.s / q), H = Math.ceil(L.P.canvas.height / L.s / q);
    const g = U.canvas(W, H).getContext('2d');
    for (const p of plates) g.drawImage(p.canvas, 0, 0, W, H);
    const a = g.getImageData(0, 0, W, H).data, D = new Float32Array(W * H), r2 = Math.SQRT2;
    for (let i = 0; i < W * H; i++) D[i] = a[i * 4 + 3] > 20 ? 0 : 1e6;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // two-pass chamfer
      const i = y * W + x; let d = D[i];
      if (x) d = Math.min(d, D[i - 1] + 1);
      if (y) { d = Math.min(d, D[i - W] + 1); if (x) d = Math.min(d, D[i - W - 1] + r2); if (x < W - 1) d = Math.min(d, D[i - W + 1] + r2); }
      D[i] = d;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; let d = D[i];
      if (x < W - 1) d = Math.min(d, D[i + 1] + 1);
      if (y < H - 1) { d = Math.min(d, D[i + W] + 1); if (x < W - 1) d = Math.min(d, D[i + W + 1] + r2); if (x) d = Math.min(d, D[i + W - 1] + r2); }
      D[i] = d;
    }
    return (x, y) => D[U.clamp(Math.floor(y / q), 0, H - 1) * W + U.clamp(Math.floor(x / q), 0, W - 1)] * q;
  }

  function gen(L) {
    const { P, K, TP, TK, s, ink, paper } = L;
    const R = Print.rng((L.seed >>> 0) || 1);
    const rr = (a, b) => a + (b - a) * R(), pick = a => a[Math.floor(R() * a.length)], chance = p => R() < p;
    const wpick = arr => { let x = R() * arr.reduce((a, v) => a + v[1], 0); for (const v of arr) if ((x -= v[1]) <= 0) return v[0]; return arr[0][0]; };
    const c = L.c.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    const [A, B, C, D] = c;
    const G = { x0: 100, y0: 100, x1: 1100, y1: 1400 }, GW = G.x1 - G.x0, GH = G.y1 - G.y0;
    const cjk = U.hasCjk(L.word), n = [...L.word].length;
    const probe = U.canvas(8, 8).getContext('2d');
    const others = cols => { const a = away(L, cols); return a.length ? a : L.c.filter(x => !cols.includes(x)); };

    // ---------- 1. plan: hero placement + info items, retried until every rule holds
    let plan = null;
    for (let attempt = 0; attempt < 16 && !plan; attempt++) plan = makePlan(false);
    if (!plan) plan = makePlan(true);

    function makePlan(safe) {
      const arch = safe ? 'stack' : wpick([['stack', 3], ['side', cjk && n <= 5 ? 2.2 : 0.4], ['diag', 2.2], ['hero', 1.4]]);
      const E = {}, Wd = { rot: 0, vertical: false };
      if (arch === 'stack') {
        const eTop = safe || chance(0.62), r = pick([0.5, 0.55, 0.6, 0.64]);
        const eH = GH * r, wH = GH - eH - 20, ez = eTop ? G.y0 : G.y1 - eH, wz = eTop ? G.y1 - wH : G.y0;
        E.size = Math.min(GW, eH) * rr(0.86, 1.04);
        const ea = pick(['l', 'c', 'r', 'c']);
        E.cx = ea === 'l' ? G.x0 + E.size / 2 - rr(0, 70) : ea === 'r' ? G.x1 - E.size / 2 + rr(0, 70) : 600 + rr(-40, 40);
        E.cy = ez + eH / 2;
        Wd.align = ea === 'l' ? pick(['r', 'c']) : ea === 'r' ? pick(['l', 'c']) : pick(['l', 'c', 'r']);
        Wd.maxW = GW * pick([0.62, 0.74, 0.86, 1]); Wd.maxH = Math.min(wH * 0.62, pick([230, 280, 330]));
        Wd.cy = wz + wH * (eTop ? pick([0.4, 0.5]) : pick([0.5, 0.6]));
      } else if (arch === 'side') {
        const wLeft = chance(0.5), colW = pick([230, 260, 300]);
        Wd.vertical = true; Wd.maxW = colW; Wd.maxH = GH * pick([0.58, 0.7, 0.82]);
        Wd.cx = wLeft ? G.x0 + colW / 2 : G.x1 - colW / 2; Wd.valign = pick(['t', 'c', 'b']);
        const ex0 = wLeft ? G.x0 + colW + 40 : G.x0, ex1 = wLeft ? G.x1 : G.x1 - colW - 40;
        E.size = (ex1 - ex0) * rr(0.9, 1.08); E.cx = (ex0 + ex1) / 2 + (wLeft ? 1 : -1) * rr(0, 50);
        E.cy = G.y0 + GH * (Wd.valign === 't' ? rr(0.55, 0.64) : Wd.valign === 'b' ? rr(0.34, 0.44) : pick([0.36, 0.64]));
      } else if (arch === 'diag') {
        const left = chance(0.5), top = chance(0.5);
        E.size = rr(560, 720);
        E.cx = left ? G.x0 + E.size / 2 - rr(0, 60) : G.x1 - E.size / 2 + rr(0, 60);
        E.cy = top ? G.y0 + E.size / 2 + rr(40, 120) : G.y1 - E.size / 2 - rr(40, 120);
        Wd.align = left ? 'r' : 'l'; Wd.maxW = GW * pick([0.7, 0.85]); Wd.maxH = pick([240, 290, 340]);
        Wd.cy = top ? G.y1 - Wd.maxH / 2 - rr(60, 160) : G.y0 + Wd.maxH / 2 + rr(160, 260);
      } else {
        E.size = rr(860, 1080); E.cx = 600 + rr(-70, 70); E.cy = G.y0 + GH * rr(0.4, 0.5);
        Wd.align = pick(['l', 'c', 'r']); Wd.maxW = GW * pick([0.8, 0.95]); Wd.maxH = pick([220, 260, 300]);
        Wd.cy = chance(0.7) ? G.y1 - Wd.maxH / 2 - rr(70, 130) : G.y0 + Wd.maxH / 2 + rr(90, 140);
        Wd.rot = pick([0, -0.05, 0.05]);
      }
      E.rot = pick([0, 0, rr(-0.12, 0.12)]);
      E.core = rectC(E.cx, E.cy, E.size * 0.6, E.size * 0.6);

      // word: style, mask, box
      Wd.style = Wd.vertical ? wpick([['pop', 3], ['multi', 2]]) : wpick([['pop', 3], ['multi', 2], ['label', 1]]);
      if (Wd.style === 'label') Wd.maxH = Math.min(Wd.maxH, 210);
      const wm = wordMasks(L.word, Wd.maxW * s, Wd.maxH * s, Wd.vertical);
      Wd.mask = wm.mask; Wd.boxes = wm.boxes; Wd.w = wm.mask.width / s; Wd.h = wm.mask.height / s;
      if (!Wd.vertical) Wd.cx = Wd.align === 'l' ? G.x0 + Wd.w / 2 : Wd.align === 'r' ? G.x1 - Wd.w / 2 : 600;
      else Wd.cy = Wd.valign === 't' ? G.y0 + Wd.h / 2 + 90 : Wd.valign === 'b' ? G.y1 - Wd.h / 2 - 60 : 750;
      Wd.cx = snap(Wd.cx); Wd.cy = snap(Wd.cy);
      const pad = Wd.style === 'label' ? 44 : 16;
      Wd.box = rectC(Wd.cx, Wd.cy, Wd.w + pad * 2 + Math.abs(Wd.rot) * Wd.h * 4, Wd.h + pad * 2 + Math.abs(Wd.rot) * Wd.w);
      if (!inside(Wd.box, { x0: 60, y0: 60, x1: 1140, y1: 1440 })) return null;
      if (arch !== 'hero' && hit(Wd.box, E.core, 10)) return null;

      // info items: each is a box that must find a free slot
      const items = [], taken = [Wd.box, E.core], full = rectC(E.cx, E.cy, E.size * 0.9, E.size * 0.9);
      // first look for a slot clear of the whole emblem; only if none, allow grazing its edge (never its core)
      const place = (item, cands) => {
        for (const strict of [true, false]) for (const [cx, cy] of cands) {
          const b = rectC(cx, cy, item.w, item.h);
          if (!inside(b, G) || taken.some(t => hit(b, t, 18)) || (strict && hit(b, full, 8))) continue;
          item.box = b; item.cx = cx; item.cy = cy; taken.push(b); items.push(item); return true;
        }
        return false;
      };
      const corners = it => {
        const l = G.x0 + it.w / 2, r = G.x1 - it.w / 2, t = G.y0 + it.h / 2, b = G.y1 - it.h / 2, cx = 600;
        const cs = [[l, t], [r, t], [l, b], [r, b], [cx, t], [cx, b], [l, 750], [r, 750], [l, 425], [r, 425], [l, 1075], [r, 1075]];
        for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; }
        return cs;
      };
      const dStyle = pick(['cutout', 'scallop', 'burst', 'torn', 'bare']), dSize = rr(210, 245);
      const denomIt = { kind: 'denom', style: dStyle, w: dStyle === 'bare' ? 190 : dStyle === 'torn' ? dSize * 0.86 : dSize, h: dStyle === 'bare' ? 190 : dSize };
      const iStyle = pick(['balloon', 'tape', 'swipe', 'torn', 'bare']);
      const issuerIt = { kind: 'issuer', style: iStyle, ...{ balloon: { w: 300, h: 150 }, tape: { w: 300, h: 120 }, swipe: { w: 320, h: 116 }, torn: { w: 290, h: 124 }, bare: { w: 250, h: 84 } }[iStyle] };
      const smallT = `${year(L)} · NO.${no3(L)} · 每日一枚 第一辑`;
      const smallIt = { kind: 'small', w: U.measure(probe, smallT, U.font('caps_med', 19), 2).w + 40, h: 40 };
      const enT = (L.spec.en || '').toUpperCase(), enSize = pick([22, 26, 30]);
      const enIt = enT ? { kind: 'en', size: enSize, w: Math.min(U.measure(probe, enT, U.font('caps', enSize), enSize * 0.4).w + 30, 700), h: enSize + 22 } : null;
      // the denomination prefers the top edge (stamp convention)
      if (!place(denomIt, corners(denomIt).sort((a, b) => a[1] - b[1] + (R() - 0.5) * 300))) return null;
      if (!place(issuerIt, corners(issuerIt))) return null;
      if (enIt) {
        const nx = Wd.vertical ? Wd.cx : Wd.align === 'l' ? Wd.box.x0 + enIt.w / 2 : Wd.align === 'r' ? Wd.box.x1 - enIt.w / 2 : Wd.cx;
        const near = [[nx, Wd.box.y1 + enIt.h / 2 + 4], [nx, Wd.box.y0 - enIt.h / 2 - 4]];
        if (!place(enIt, [...near, ...corners(enIt)])) return null;
      }
      if (!place(smallIt, corners(smallIt))) return null;
      // postmark: a free spot for the circle and its wavy tail
      let pm = null;
      for (let k = 0; k < 60 && !pm; k++) {
        const r = 112, x = rr(G.x0 + r, G.x1 - r), y = rr(G.y0 + r, G.y1 - r);
        if (![...taken, full].some(t => hit({ x0: x - r * 1.3, y0: y - r * 1.25, x1: x + r * 3.5, y1: y + r * 1.25 }, t, 10))) pm = { x, y, r, rot: rr(-0.35, 0.2) };
      }
      return { arch, E, Wd, items, pm, taken };
    }

    // ---------- 2. ground (art plate)
    const { E, Wd, items } = plan;
    // what backs the emblem is decided first: ground edges must not graze it
    // A backer either stays clear of the stamp edge or bleeds off it decisively, never "just touching" it (slivers).
    // Rays are cut to a big circle and are meant to bleed; a square would leave wedges, so it becomes a disc.
    let backer = wpick([['none', 1], ['disc', 2], ['dotdisc', 1.4], ['rays', 1.1], ['rings', 1], ['burst', 1], ['square', 0.9]]), br = E.size * 0.52;
    const ext = { rings: 1.15, burst: 1.18, square: 1.27, disc: 1, dotdisc: 1 }, room = Math.min(E.cx - F.x0, F.x1 - E.cx, E.cy - F.y0, F.y1 - E.cy) - 40;
    if (backer === 'square' && br * ext.square > room) backer = 'disc';
    if (ext[backer] && br * ext[backer] > room && br * ext[backer] < room + 160) br = Math.max(room / ext[backer], E.size * 0.3);
    // a backer squeezed smaller than the emblem would only poke out as stray tips and corners, so it goes
    if (ext[backer] && br * ext[backer] < E.size * 0.6) backer = 'none';
    const Rb = Math.max(E.size * 0.5, backer === 'rays' ? E.size * 0.9 : backer === 'none' ? 0 : br * ext[backer]);
    // ground edges are full lines [x0, y0, x1, y1]; a candidate is refused when a line runs through any type,
    // runs within a hair of the stamp border, or nearly touches the emblem's backer (the "almost tangent" wobble)
    const typeBoxes = [Wd.box, ...items.map(i => i.box)];
    const lineOk = ([x0, y0, x1, y1]) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(len / 10);
      for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        if (typeBoxes.some(t => x > t.x0 - 24 && x < t.x1 + 24 && y > t.y0 - 24 && y < t.y1 + 24)) return false;
      }
      const d = Math.abs((x1 - x0) * (y0 - E.cy) - (x0 - E.cx) * (y1 - y0)) / len;
      if (backer !== 'none' && backer !== 'rays' && Math.abs(d - Rb) < 36) return false;
      const near = v => v > 0 && v < 90;
      return !(x0 === x1 && (near(x0 - F.x0) || near(F.x1 - x0))) && !(y0 === y1 && (near(y0 - F.y0) || near(F.y1 - y0)));
    };
    // circles get the same care as lines: clear of type, never nearly tangent to the backer, never kissing a stamp edge
    const circleOk = (cx, cy, r) => {
      for (let i = 0; i < 240; i++) {
        const x = cx + r * Math.cos(i * TAU / 240), y = cy + r * Math.sin(i * TAU / 240);
        if (x > F.x0 && x < F.x1 && y > F.y0 && y < F.y1 && typeBoxes.some(t => x > t.x0 - 24 && x < t.x1 + 24 && y > t.y0 - 24 && y < t.y1 + 24)) return false;
      }
      const d = Math.hypot(cx - E.cx, cy - E.cy);
      if (backer !== 'none' && backer !== 'rays' && (Math.abs(d - r - Rb) < 36 || Math.abs(d - Math.abs(r - Rb)) < 36)) return false;
      return ![cx - F.x0, F.x1 - cx, cy - F.y0, F.y1 - cy].some(v => Math.abs(v - r) < 80);
    };
    /** positions along an axis where a full-width cut clears every rule */
    const freeCuts = horiz => { const out = [];
      for (let v = (horiz ? F.y0 : F.x0) + 150; v <= (horiz ? F.y1 : F.x1) - 150; v += 25) if (lineOk(horiz ? [F.x0, v, F.x1, v] : [v, F.y0, v, F.y1])) out.push(v);
      return out; };
    // Ground. Three rules from the books, on top of the pop vocabulary:
    //  · Arnheim (Art and Visual Perception) / Kandinsky (Point and Line to Plane): the horizontal is the cold, flat,
    //    resting line; the oblique carries the tension. So no ground is ever cut by a horizontal: edges are clear
    //    diagonals (never a timid near-level slant), wedges, cut-out curves, circles, rays, or upright bands.
    //  · Itten's contrast of extension (after Goethe): a light colour carries more weight per area, so the brightest
    //    ground colour must not also own the most area.
    //  · No single colour owns the stamp: the biggest keeps at most half the field, the next at least an eighth.
    const occR = Math.max(Rb, E.size * 0.42);
    const shares = col => {
      const n = new Map(); let tot = 0;
      for (let y = F.y0 + 10; y < F.y1; y += 20) for (let x = F.x0 + 10; x < F.x1; x += 20) {
        tot++; if (Math.hypot(x - E.cx, y - E.cy) < occR) continue;
        const k = col(x, y); n.set(k, (n.get(k) || 0) + 1);
      }
      return [...n.entries()].map(([c, v]) => [c, v / tot]).sort((a, b) => b[1] - a[1]);
    };
    // free-form edges (polylines) get the care straight cuts get: clear of type, never nearly tangent to the backer
    const pathOk = pts => {
      if (pts.some(([x, y]) => x > F.x0 && x < F.x1 && y > F.y0 && y < F.y1 && typeBoxes.some(t => x > t.x0 - 24 && x < t.x1 + 24 && y > t.y0 - 24 && y < t.y1 + 24))) return false;
      if (backer === 'none' || backer === 'rays') return true;
      return Math.abs(Math.min(...pts.map(([x, y]) => Math.hypot(x - E.cx, y - E.cy))) - Rb) >= 36;
    };
    const seg = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10); return Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
    const inPoly = (pts, x, y) => { let r = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r; } return r; };
    const fillPoly = (pts, c) => { P.fillStyle = c; Pattern.poly(P, pts.map(([x, y]) => [x * s, y * s])); P.fill(); };
    /** a ground made of polygons painted over A, last one on top */
    const polys = layers => ({ cols: [A, ...new Set(layers.map(l => l[1]))],
      col: (x, y) => { for (let i = layers.length - 1; i >= 0; i--) if (inPoly(layers[i][0], x, y)) return layers[i][1]; return A; },
      draw: () => { box(L, P, F.x0, F.y0, F.x1, F.y1, A); for (const [pts, c] of layers) fillPoly(pts, c); } });
    const X0 = F.x0 - 30, X1 = F.x1 + 30, Y0 = F.y0 - 30, Y1 = F.y1 + 30;
    const groundCand = style => {
      if (style === 'diag') {
        // a decisive oblique, at least ~20° off the level (or off the upright)
        if (chance(0.5)) {
          const ym = rr(560, 940), dy = pick([-1, 1]) * rr(420, 900), y1 = ym - dy / 2, y2 = ym + dy / 2;
          if (!pathOk(seg(F.x0, y1, F.x1, y2))) return null;
          return polys([[[[X0, y1], [X1, y2], [X1, Y1], [X0, Y1]], B]]);
        }
        const xm = rr(450, 750), dx = pick([-1, 1]) * rr(380, 700), x1 = xm - dx / 2, x2 = xm + dx / 2;
        if (!pathOk(seg(x1, F.y0, x2, F.y1))) return null;
        return polys([[[[x1, Y0], [x2, Y1], [X1, Y1], [X1, Y0]], B]]);
      }
      if (style === 'wedge') {
        // El Lissitzky's red wedge: a triangle driven in from one edge; sometimes a second one answers from the opposite side
        const wedge = (edge, c) => {
          const w = rr(620, 1150), t = rr(0.2, 0.8), reach = rr(0.7, 1.05), off = rr(-0.35, 0.35);
          const horizE = edge === 't' || edge === 'b', len = horizE ? F.x1 - F.x0 : F.y1 - F.y0, deep = horizE ? F.y1 - F.y0 : F.x1 - F.x0;
          const b0 = (horizE ? F.x0 : F.y0) + t * len - w / 2, b1 = b0 + w, ap = (b0 + b1) / 2 + off * len, d = reach * deep;
          const pts = edge === 't' ? [[b0, Y0], [b1, Y0], [ap, F.y0 + d]] : edge === 'b' ? [[b0, Y1], [b1, Y1], [ap, F.y1 - d]]
            : edge === 'l' ? [[X0, b0], [X0, b1], [F.x0 + d, ap]] : [[X1, b0], [X1, b1], [F.x1 - d, ap]];
          return pathOk([...seg(...pts[0], ...pts[2]), ...seg(...pts[1], ...pts[2])]) ? [pts, c] : null;
        };
        const e1 = pick(['t', 'b', 'l', 'r']), w1 = wedge(e1, B);
        if (!w1) return null;
        if (chance(0.7)) { const w2 = wedge({ t: 'b', b: 't', l: 'r', r: 'l' }[e1], D); if (w2) return polys([w1, w2]); }
        return polys([w1]);
      }
      if (style === 'wave') {
        // Matisse's cut-outs / Memphis: a hand-cut curve running on the oblique, sometimes a second one in a third colour
        const ym = rr(600, 950), dv = pick([-1, 1]) * rr(300, 700), y1 = ym - dv / 2, y2 = ym + dv / 2, amp = rr(40, 80), nw = rr(1.2, 2.6), ph = R() * TAU;
        const curve = dy => Array.from({ length: 61 }, (_, i) => { const u = i / 60, x = X0 + (X1 - X0) * u; return [x, y1 + (y2 - y1) * u + dy + Math.sin(u * nw * TAU + ph) * amp]; });
        const c1 = curve(0);
        if (!pathOk(c1)) return null;
        const layers = [[[...c1, [X1, Y1], [X0, Y1]], B]];
        if (chance(0.45)) { const c2 = curve(rr(230, 360)); if (pathOk(c2)) layers.push([[...c2, [X1, Y1], [X0, Y1]], D]); }
        return polys(layers);
      }
      if (style === 'bands') {
        // Ellsworth Kelly's Spectrum panels: upright bands only, three colours cycling
        const fc = freeCuts(false).sort(() => R() - 0.5), want = 2 + Math.floor(rr(0, 3)), cuts = [];
        for (const v of fc) if (cuts.length < want && [F.x0, F.x1, ...cuts].every(c => Math.abs(c - v) >= 170)) cuts.push(v);
        if (cuts.length < 2) return null;
        cuts.sort((a, b) => a - b);
        const cyc = [A, B, D], idx = v => cuts.filter(c => v >= c).length;
        return { cols: cyc, col: x => cyc[idx(x) % 3],
          draw: () => { const e = [F.x0, ...cuts, F.x1]; for (let i = 0; i < e.length - 1; i++) box(L, P, e[i], F.y0, e[i + 1], F.y1, cyc[i % 3]); } };
      }
      if (style === 'sun') {
        // a big disc bleeding off an edge or corner; with 2–3 rings it becomes a target
        const side = () => pick([rr(-250, 150), rr(250, 950), rr(1050, 1450)]);
        const cx = F.x0 + side() * (F.x1 - F.x0) / 1200, cy = F.y0 + side() * (F.y1 - F.y0) / 1200;
        const nr = wpick([[1, 3], [2, 1.2], [3, 0.8]]), r0 = rr(420, 820), step = rr(130, 190), radii = [];
        for (let i = 0; i < nr && r0 - i * step > 140; i++) radii.push(r0 - i * step);
        if (!radii.every(r => circleOk(cx, cy, r))) return null;
        const ringC = pick([[B, D], [B, A], [D, B]]), colAt = d => { let c0 = A; radii.forEach((r, i) => { if (d <= r) c0 = ringC[i % 2]; }); return c0; };
        return { cols: [...new Set([A, ...radii.map((_, i) => ringC[i % 2])])], col: (x, y) => colAt(Math.hypot(x - cx, y - cy)),
          draw: () => { box(L, P, F.x0, F.y0, F.x1, F.y1, A); radii.forEach((r, i) => { P.fillStyle = ringC[i % 2]; P.beginPath(); P.arc(cx * s, cy * s, r * s, 0, TAU); P.fill(); }); } };
      }
      // rays: the comic sunburst, from the emblem or from beyond a corner
      const atE = chance(0.6), cx = atE ? E.cx : pick([F.x0 - 100, F.x1 + 100]), cy = atE ? E.cy : pick([F.y0 - 100, F.y1 + 100]);
      const nw = pick([16, 20, 24, 28, 32]), rot = R() * TAU, w = TAU / nw;
      return { cols: [A, B], col: (x, y) => (Math.floor((((Math.atan2(y - cy, x - cx) - rot) % TAU + TAU) % TAU) / w) % 2 ? A : B),
        draw: () => { box(L, P, F.x0, F.y0, F.x1, F.y1, A); P.save(); P.beginPath(); P.rect(F.x0 * s, F.y0 * s, (F.x1 - F.x0) * s, (F.y1 - F.y0) * s); P.clip();
          Pattern.rays(P, cx * s, cy * s, nw, B, 2200 * s, rot); P.restore(); } };
    };
    const itten = sh => sh.length < 2 || sh[0][1] - sh[1][1] < 0.08 || U.lum(sh[0][0]) <= U.lum(sh[1][0]) + 0.12;
    const gw = [['diag', 1.6], ['wedge', 1.4], ['wave', 1.2], ['sun', 1.4], ['bands', 0.8], ['rays', backer === 'rays' ? 0 : 1]];
    let ground = null, best = null, pool = gw.filter(w => w[1] > 0);
    while (pool.length && !ground) {
      const style = wpick(pool); pool = pool.filter(w => w[0] !== style);
      for (let k = 0; k < 40 && !ground; k++) {
        const g = groundCand(style);
        if (!g) continue;
        g.style = style; const sh = shares(g.col), it = itten(sh); g.score = (sh[0] ? sh[0][1] : 1) + (it ? 0 : 0.2);
        if (sh[0] && sh[0][1] <= 0.5 && (sh[1] ? sh[1][1] : 0) >= 0.12 && it) ground = g;
        else if (!best || g.score < best.score) best = g;
      }
    }
    ground = ground || best || groundCand(backer === 'rays' ? 'bands' : 'rays') || { style: 'flat', cols: [A], draw: () => box(L, P, F.x0, F.y0, F.x1, F.y1, A) };
    ground.draw();
    const groundPx = P.getImageData(0, 0, P.canvas.width, P.canvas.height);   // the bare ground, full resolution
    const gstyle = ground.style, grounds = ground.cols;
    // a coarse snapshot of the bare ground, so later pieces can ask "which colour field am I on?"
    const gq = 10, gW = Math.ceil(P.canvas.width / s / gq), gH = Math.ceil(P.canvas.height / s / gq), gc = U.canvas(gW, gH).getContext('2d');
    gc.imageSmoothingEnabled = false; gc.drawImage(P.canvas, 0, 0, gW, gH);
    const gd = gc.getImageData(0, 0, gW, gH).data;
    const groundAt = (x, y) => { const o = (U.clamp(Math.floor(y / gq), 0, gH - 1) * gW + U.clamp(Math.floor(x / gq), 0, gW - 1)) * 4;
      return grounds.slice().sort((a, b) => cdist(a, gd, o) - cdist(b, gd, o))[0]; };
    /** the ground colours under a disc (centre + rim) */
    const groundsIn = (cx, cy, r) => new Set([[0, 0], ...Array.from({ length: 16 }, (_, i) => [Math.cos(i * TAU / 16), Math.sin(i * TAU / 16)])]
      .map(([u, v]) => groundAt(U.clamp(cx + u * r, F.x0, F.x1 - 1), U.clamp(cy + v * r, F.y0, F.y1 - 1))));

    // texture. Nothing is cut with a rectangle: the type is set once on scratch plates to learn its exact shape,
    // then every dot / cell / stripe run is drawn whole or dropped — screens fade out around the type like a
    // halftone ramp, polka dots and checker cells step aside.
    // the backer clashes with the field it sits on and never repeats any field it overlaps (it would melt into it)
    const under0 = groundsIn(E.cx, E.cy, Rb * 0.95), bcands = [C, D, B, A].filter(x => !under0.has(x));
    const bc = Colors.clash(groundAt(E.cx, E.cy), bcands.length ? bcands : [C, D, B]), tseed = Math.floor(R() * 2147483647) + 1;
    // Rays that run across colour blocks change colour at every block edge, and never take any ground colour, so no
    // ray ever melts into the block it crosses or the one next to it. With two free inks each block gets its own.
    const free = [bc, ...L.c.filter(x => x !== bc)].filter(x => !grounds.includes(x));
    const rayCol = new Map(grounds.map((gc, i) => [gc, free.length ? free[i % free.length] : Colors.clash(gc, L.c.filter(x => x !== gc))]));
    /** paint a mask's shape onto g, each pixel in the colour assigned to the ground block beneath it */
    function byField(g, mask) {
      const W = g.canvas.width, H = g.canvas.height, mc = mask.getContext('2d'), md = mc.getImageData(0, 0, W, H), d = md.data, gp = groundPx.data;
      const gs = grounds.map(x => U.hexToRgb(x)), outs = grounds.map(x => U.hexToRgb(rayCol.get(x)));
      for (let i = 0; i < W * H; i++) {
        const o = i * 4; if (!d[o + 3]) continue;
        let bi = 0, bd = 1e9;
        for (let k = 0; k < gs.length; k++) { const q = (gs[k][0] - gp[o]) ** 2 + (gs[k][1] - gp[o + 1]) ** 2 + (gs[k][2] - gp[o + 2]) ** 2; if (q < bd) { bd = q; bi = k; } }
        d[o] = outs[bi][0]; d[o + 1] = outs[bi][1]; d[o + 2] = outs[bi][2];
      }
      mc.putImageData(md, 0, 0); g.drawImage(mask, 0, 0);
    }
    const second = others([bc, ...under0])[0] || others([bc, A])[0] || D;
    const aseed = Math.floor(R() * 2147483647) + 1, plate = () => U.canvas(TP.canvas.width, TP.canvas.height).getContext('2d');
    const scratch = { ...L, TP: plate(), TK: plate(), P: plate(), K: plate() };
    setType({ ...scratch, P, K }, Print.rng(tseed));   // type colours still look at the real ground
    setArt(scratch, Print.rng(aseed), true);
    if (plan.pm) { scratch.K.fillStyle = ink; scratch.K.beginPath(); scratch.K.arc(plan.pm.x * s, plan.pm.y * s, plan.pm.r * 1.05 * s, 0, TAU); scratch.K.fill(); }
    // one field for everything a texture must step around: the type, the emblem, and whatever backs it
    const dist = typeField(L, [scratch.TP, scratch.TK, scratch.P, scratch.K]);
    // a busy ground (sunburst, bands, target) needs less on top; a flat fallback always gets a full Ben-Day screen
    const busy = gstyle === 'rays' || gstyle === 'bands' || grounds.length > 2;
    let tex = wpick([['none', busy ? 3 : 1], ['dots', 2.4], ['polka', 1], ['grid', 0.8], ['checker', busy ? 0 : 0.4]]);
    // the screen prints in a spot ink the ground lacks, never the key: black dots and stripes read as dirt, not pop
    const tcs = [C, D].filter(x => !grounds.includes(x)), tvis = tcs.filter(x => worst(x, grounds) >= 1.15);
    // stripes are out (a striped stamp reads as wallpaper); a checker only ever fills a corner,
    // and a partial screen runs as an upright band, never a level one
    const texC = pick(tvis.length ? tvis : tcs);
    // a texture is an accent in one corner (a screen that dies out, Lichtenstein's gradient), never a full-cover field:
    // a stamp papered edge to edge in dots or lines reads as wallpaper. Its footprint stays under about a fifth of the stamp.
    let rx0 = F.x0, ry0 = F.y0, rx1 = F.x1, ry1 = F.y1;
    const w = snap(rr(340, 500)), h = snap(rr(340, 500)), left = chance(0.5), top = chance(0.5);
    if (left) rx1 = F.x0 + w; else rx0 = F.x1 - w;
    if (top) ry1 = F.y0 + h; else ry0 = F.y1 - h;
    const kx = left ? F.x0 : F.x1, ky = top ? F.y0 : F.y1, reach = Math.min(w, h) * 1.05;
    // distance to the region's inner edges (edges on the stamp border bleed off and don't count)
    const box_ = (x, y) => Math.min(rx0 > F.x0 ? x - rx0 : 1e9, rx1 < F.x1 ? rx1 - x : 1e9, ry0 > F.y0 ? y - ry0 : 1e9, ry1 < F.y1 ? ry1 - y : 1e9);
    // screens fade out radially from the stamp corner; whole-element textures (polka, checker) keep to the quarter disc
    const edge = tex === 'dots' || tex === 'grid' ? box_ : (x, y) => Math.min(box_(x, y), reach * 0.8 - Math.hypot(x - kx, y - ky));
    const RX = [rx0 * s, ry0 * s, (rx1 - rx0) * s, (ry1 - ry0) * s];
    const ok = (px, py, r) => { const x = px / s, y = py / s, rb = r / s; return dist(x, y) >= rb + 16 && edge(x, y) >= rb; };
    const halo = rr(60, 110);
    const fade = (px, py) => {
      const x = px / s, y = py / s;
      return Math.min(U.clamp((dist(x, y) - 14) / halo, 0, 1), U.clamp(1.15 - Math.hypot(x - kx, y - ky) / reach, 0, 1));
    };
    const ccell = rr(40, 70), cox = rx0 > F.x0 ? rx0 : rx1, coy = ry0 > F.y0 ? ry0 : ry1;
    if (tex === 'checker') {
      // lone squares scattered around the type read as a glitch, so the board must be whole
      for (let y = coy + Math.floor((ry0 - coy) / ccell) * ccell; y < ry1 && tex === 'checker'; y += ccell)
        for (let x = cox + Math.floor((rx0 - cox) / ccell) * ccell; x < rx1; x += ccell)
          if (!ok((x + ccell / 2) * s, (y + ccell / 2) * s, ccell * 0.72 * s)) { tex = 'dots'; break; }
    }
    if (tex === 'dots') { const cell = rr(22, 34); Pattern.dotsSoft(P, ...RX, texC, cell * s, cell * 0.36 * s, Math.PI / 4, fade); }
    else if (tex === 'grid') Pattern.dotsSoft(P, ...RX, texC, 30 * s, 5 * s, 0, fade);
    else if (tex === 'polka') Pattern.polkaSoft(P, ...RX, texC, R, 14, 12 * s, 46 * s, ok);
    else if (tex === 'checker') Pattern.checkerSoft(P, ...RX, ccell * s, texC, cox * s, coy * s, ok);

    // ---------- 3. the emblem and what backs it. Like the type it runs twice on its own random stream: once on scratch
    // plates to shape the texture (rays count as their whole circle), then for real over the texture.
    setArt(L, Print.rng(aseed), false);
    function setArt(LL, T, probe) {
      const P_ = LL.P, rr_ = (a, b) => a + (b - a) * T(), pick_ = a => a[Math.floor(T() * a.length)], chance_ = p => T() < p;
      if (backer === 'rays' && probe) { T(); T(); P_.fillStyle = ink; P_.beginPath(); P_.arc(E.cx * s, E.cy * s, E.size * 0.9 * s, 0, TAU); P_.fill(); }
      else if (backer === 'rays') {
        const m = U.canvas(P_.canvas.width, P_.canvas.height), mg = m.getContext('2d');
        mg.beginPath(); mg.arc(E.cx * s, E.cy * s, E.size * 0.9 * s, 0, TAU); mg.clip(); Pattern.rays(mg, E.cx * s, E.cy * s, pick_([24, 32, 40]), '#000', 1600 * s, T());
        byField(P_, m);
      }
      else if (backer === 'rings') Pattern.rings(P_, E.cx * s, E.cy * s, rr_(34, 60) * s, [bc, second], br * 1.15 * s);
      else if (backer === 'burst') { const pts = Pattern.burstPts(E.cx * s, E.cy * s, br * 0.82 * s, br * 1.18 * s, 12, T); P_.fillStyle = bc; Pattern.poly(P_, pts); P_.fill(); P_.strokeStyle = ink; P_.lineWidth = 8 * s; P_.lineJoin = 'miter'; P_.stroke(); }
      else if (backer === 'square') { P_.save(); P_.translate(E.cx * s, E.cy * s); P_.rotate(rr_(-0.2, 0.2)); P_.fillStyle = bc; P_.fillRect(-br * 0.9 * s, -br * 0.9 * s, br * 1.8 * s, br * 1.8 * s); P_.strokeStyle = ink; P_.lineWidth = 7 * s; P_.strokeRect(-br * 0.9 * s, -br * 0.9 * s, br * 1.8 * s, br * 1.8 * s); P_.restore(); }
      else if (backer !== 'none') {
        P_.fillStyle = bc; P_.beginPath(); P_.arc(E.cx * s, E.cy * s, br * s, 0, TAU); P_.fill();
        if (backer === 'dotdisc') Print.dotDisc(P_, E.cx * s, E.cy * s, br * s, second, rr_(16, 24) * s, 0.9);
        P_.strokeStyle = ink; P_.lineWidth = 8 * s; P_.beginPath(); P_.arc(E.cx * s, E.cy * s, br * s, 0, TAU); P_.stroke();
      }
      const sticker = backer === 'none' || chance_(0.7), eo = L.c.filter(x => x !== bc);
      // without the white sticker edge the emblem body must clash with its backer, and its inks with the body
      const sil = sticker ? paper : Colors.clash(bc, eo.filter(x => U.contrast(x, bc) >= 1.5).concat([paper])), rest = L.c.filter(x => x !== sil && x !== bc);
      emblemAt(LL, E.cx, E.cy, E.size, sticker ? { outline: ink, sil: paper, band: eo[0], acc: eo[1], ink }
        : { outline: ink, sil, band: rest[0] || bc, acc: rest[1] || paper, ink }, { rot: E.rot });
    }

    // motifs in the leftover space: never under type, the emblem or its backer, or where the postmark lands; each sits
    // wholly inside one colour field (well clear of any ground edge) and takes a colour that field does not have
    const motifs = [], nm = Math.floor(rr(0, 4.5)), blocked = [...plan.taken, ...(plan.pm ? [rectC(plan.pm.x + plan.pm.r, plan.pm.y, plan.pm.r * 4.2, plan.pm.r * 2)] : [])];
    const oneField = (b, pad) => {
      const g0 = groundAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++)
        if (groundAt(U.clamp(b.x0 - pad + (b.x1 - b.x0 + 2 * pad) * i / 4, F.x0, F.x1 - 1), U.clamp(b.y0 - pad + (b.y1 - b.y0 + 2 * pad) * j / 4, F.y0, F.y1 - 1)) !== g0) return null;
      return g0;
    };
    for (let k = 0, tries = 0; k < nm && tries < 120; tries++) {
      const sz = rr(70, 150), x = rr(F.x0 + 60, F.x1 - 60), y = rr(F.y0 + 60, F.y1 - 60), b = rectC(x, y, sz, sz);
      if (blocked.some(t => hit(b, t, 16)) || Math.hypot(x - E.cx, y - E.cy) < Rb + sz * 0.72 + 16) continue;
      const field = oneField(b, 30), cols = field ? [C, D, B, A].filter(x => x !== field && U.contrast(x, field) >= 1.3) : [];
      if (!cols.length) continue;
      blocked.push(b); motifs.push(b); k++;
      const kind = pick(['squiggle', 'zigzag', 'triangle', 'sparkle', 'ring', 'dots']), col = pick(cols);
      if (kind === 'squiggle') Pattern.squiggle(P, (x - sz / 2) * s, y * s, sz * s, sz * 0.14 * s, 2.5, rr(-0.5, 0.5), 11 * s, col);
      else if (kind === 'zigzag') Pattern.zigzag(P, (x - sz / 2) * s, y * s, sz * s, sz * 0.12 * s, 4, rr(-0.5, 0.5), 10 * s, col);
      else if (kind === 'triangle') Pattern.triangle(P, x * s, y * s, sz * 0.45 * s, R() * TAU, col);
      else if (kind === 'sparkle') Pattern.sparkle(P, x * s, y * s, sz * 0.5 * s, col);
      else if (kind === 'ring') { P.strokeStyle = col; P.lineWidth = 11 * s; P.beginPath(); P.arc(x * s, y * s, sz * 0.32 * s, 0, TAU); P.stroke(); }
      else Pattern.grid(P, (x - sz / 2) * s, (y - sz / 2) * s, sz * s, sz * s, 24 * s, 5 * s, col);
    }

    // ---------- 4. type (top plates); colours are chosen against what was actually printed underneath.
    // Runs twice with the same random stream: once on scratch plates (to shape the texture), once for real.
    setType(L, Print.rng(tseed));
    function setType(L, T) {
      const { TP, TK } = L, rr = (a, b) => a + (b - a) * T(), pick = a => a[Math.floor(T() * a.length)], chance = p => T() < p;
      const bgW = under(L, Wd.box), rot = Wd.rot;
      if (Wd.style === 'label') {
        const b = Wd.box, w = b.x1 - b.x0, h = b.y1 - b.y0;
        for (const [g, fn] of [[TP, g => { g.fillStyle = paper; g.fillRect(-w / 2 * s, -h / 2 * s, w * s, h * s); }],
          [TK, g => { g.strokeStyle = ink; g.lineWidth = 6 * s; g.strokeRect(-w / 2 * s, -h / 2 * s, w * s, h * s); g.lineWidth = 2 * s; g.strokeRect((-w / 2 + 14) * s, (-h / 2 + 14) * s, (w - 28) * s, (h - 28) * s); }]]) {
          g.save(); g.translate(Wd.cx * s, Wd.cy * s); g.rotate(rot); fn(g); g.restore();
        }
        popText(L, Wd.mask, Wd.cx, Wd.cy, { fill: ink, shadow: Colors.readable(paper, c, 1.8), depth: rr(4, 7), rot });
      } else {
        const pool = others(bgW), fc0 = pool.concat([paper]), fr = fc0.filter(x => worst(x, bgW) >= 1.8);
        const f = Colors.clash(bgW[0], fr.length ? fr : fc0.sort((a, b) => worst(b, bgW) - worst(a, bgW)).slice(0, 1));
        const fills = Wd.style === 'multi' && Wd.boxes ? Wd.boxes.map((_, i) => pool[i % pool.length]) : null;
        popText(L, Wd.mask, Wd.cx, Wd.cy, { fill: f, fills, boxes: Wd.boxes, shadow: chance(0.7) ? ink : pool.find(x => x !== f) || ink, depth: rr(7, 15),
          dir: pick([Math.PI / 4, Math.PI * 0.75]), outline: ink, ow: rr(4, 7), rot });
      }

      for (const it of items) {
        const b = it.box, bg = under(L, b), plain = worst(ink, bg) >= 4.5 ? ink : worst(paper, bg) >= 4.5 ? paper : null, pool = others(bg);
        if (it.kind === 'denom') {
          let fc = plain, bgc = bg[0];
          if (it.style !== 'bare' || !plain) {
            // the holder takes a palette colour the ground under it lacks: never paper, never a lone white box
            const pale = x => U.contrast(x, paper) < 1.3, cols = (pool.some(x => !pale(x)) ? pool.filter(x => !pale(x)) : pool).sort((a, b) => worst(b, bg) - worst(a, bg)), bcol = bgc = pick(cols.slice(0, 2));
            holder(L, it.cx, it.cy, it.w, it.h, it.style === 'bare' ? 'cutout' : it.style, bcol, T); fc = txt(L, bcol);
          }
          const size = it.style === 'bare' && plain ? 150 : it.style === 'burst' ? it.w * 0.44 : it.style === 'torn' ? it.h * 0.5 : it.w * 0.5;
          season(L, fc === ink ? TK : TP, it.cx, it.cy, size, fc, 'mid', it.w * 0.66, bgc);
        } else if (it.kind === 'issuer') {
          let fc = plain, f = { dx: 0, dy: 0, rot: 0 };
          if (it.style !== 'bare' || !plain) {
            const pale = x => U.contrast(x, paper) < 1.3, cols = (pool.some(x => !pale(x)) ? pool.filter(x => !pale(x)) : pool).sort((a, b) => worst(b, bg) - worst(a, bg)), bcol = pick(cols.slice(0, 2));
            f = label(L, it.cx, it.cy, it.w, it.h, it.style === 'bare' ? 'swipe' : it.style, bcol, T); fc = txt(L, bcol);
          }
          inLabel(L, fc === ink ? TK : TP, it.cx, it.cy, f, g => issuer(L, g, 0, -16, fc, 'center'));
        } else if (it.kind === 'small' || it.kind === 'en') {
          let fc = plain;
          if (!fc) { const bcol = pick([ink, paper]); TP.fillStyle = bcol; pill(L, TP, b.x0, b.y0, b.x1, b.y1); TP.fill(); fc = txt(L, bcol); }
          const g = fc === ink ? TK : TP;
          if (it.kind === 'small') small(L, g, it.cx, it.cy, fc, 'center', 19);
          else enLine(L, g, it.cx, it.cy, fc, 'center', it.size, it.w - 30);
        }
      }
    }
    return { pm: plan.pm || { x: 600, y: 750, r: 112, rot: -0.2 }, avoid: motifs };
  }

  // =====================================================================================================
  // 1. 放射 — sunburst, halftone sphere, the word as a comic title over the rays
  function rays(L) {
    const { P, K, TP, TK, s, c: [A, B, C, D], ink, paper } = L;
    box(L, P, F.x0, F.y0, F.x1, F.y1, A);
    Pattern.rays(P, X(L, 590), X(L, 640), 36, B, X(L, 1500), L.rnd() * 0.3);
    P.fillStyle = C; circ(L, P, 580, 650, 330); P.fill();
    Print.dotDisc(P, X(L, 580), X(L, 650), X(L, 330), D, X(L, 20), 0.95);
    K.strokeStyle = ink; K.lineWidth = X(L, 10); circ(L, K, 580, 650, 330); K.stroke();
    emblemAt(L, 580, 660, 520, { outline: ink, sil: paper, band: A, acc: B, ink });
    // info on a bounded label (no strip across the stamp), the word straight on the rays as a comic title
    box(L, TP, 88, 1322, 720, 1426, paper); frame(L, TK, 88, 1322, 720, 1426, ink, 5);
    enLine(L, TK, 116, 1364, ink, 'left', 24, 580); small(L, TK, 116, 1404, ink, 'left', 18);
    popText(L, fitWord(L, 960, 210), 600, 1165, { fill: Colors.readableOn([A, B], [paper, C, D], 2.2), shadow: ink, depth: 12, outline: ink, ow: 6, rot: -0.06 });
    // issuer in a speech balloon + a burst for the solar term
    const ih = holderCol(L, rectC(240, 160, 300, 150)), ic = txt(L, ih), fr = label(L, 240, 160, 300, 150, 'balloon', ih, L.rnd);
    inLabel(L, ic === ink ? TK : TP, 240, 160, fr, g => issuer(L, g, 0, -16, ic, 'center'));
    holder(L, 985, 235, 310, 310, 'burst', D, L.rnd);
    season(L, TK, 985, 235, 150, txt(L, D), 'mid', 190, D);
    return { pm: { x: 960, y: 1000, r: 124, rot: -0.22 } };
  }

  // 2. 四联 — Warhol's Marilyn grid: the emblem four times, every panel a different colourway
  function quad(L) {
    const { P, K, TP, TK, s, c, ink, paper } = L, yB = 1100, xm = 600, ym = (F.y0 + yB) / 2;
    const cells = [[F.x0, F.y0, xm, ym], [xm, F.y0, F.x1, ym], [F.x0, ym, xm, yB], [xm, ym, F.x1, yB]];
    cells.forEach(([x0, y0, x1, y1], i) => {
      const bg = c[i], band = c[(i + 1) % 4], sil = c[(i + 2) % 4], acc = c[(i + 3) % 4];
      box(L, P, x0, y0, x1, y1, bg);
      if (i === 1 || i === 2) { const cx = i === 1 ? x1 : x0, cy = i === 1 ? y0 : y1, d = 240;
        Pattern.dots(P, X(L, Math.min(cx, cx + (i === 1 ? -d : d))), X(L, Math.min(cy, cy + (i === 1 ? d : -d))), X(L, d), X(L, d), band, X(L, 22), X(L, 7.5), Math.PI / 4,
          { x0: X(L, cx), y0: X(L, cy), x1: X(L, cx + (i === 1 ? -d : d) * 0.62), y1: X(L, cy + (i === 1 ? d : -d) * 0.62), from: 1, to: 0 }); }
      for (const g of [P, K]) { g.save(); g.beginPath(); g.rect(X(L, x0), X(L, y0), X(L, x1 - x0), X(L, y1 - y0)); g.clip(); }
      emblemAt(L, (x0 + x1) / 2 + (L.rnd() - 0.5) * 18, (y0 + y1) / 2 + 10 + (L.rnd() - 0.5) * 18, 470, { sil, band, acc, ink },
        { inkShift: [(L.rnd() - 0.5) * 14, (L.rnd() - 0.5) * 14] });
      P.restore(); K.restore();
    });
    box(L, TP, F.x0, yB, F.x1, F.y1, paper);
    const wm = fitWord(L, 600, 190);
    popText(L, wm, 110 + wm.width / s / 2, 1215, { fill: ink, shadow: Colors.clash(ink, c.filter(v => U.contrast(v, paper) >= 1.5)), depth: 7 });
    enLine(L, TK, 110, 1352, ink, 'left', 24, 600); small(L, TK, 110, 1404, ink, 'left');
    issuer(L, TK, 1090, 1146, ink, 'right', 0.8);
    season(L, TP, 1090, 1398, 112, Colors.readable(paper, [c[1], c[0], c[2], c[3], ink], 2.6), 'right', 200, paper);
    return { pm: { x: 800, y: 1020, r: 118, rot: -0.3 } };
  }

  // 3. 漫画 — Lichtenstein: Ben-Day ground, an explosion, a speech bubble, caption boxes
  function comic(L) {
    const { P, K, TP, TK, s, c: [A, B, C, D], ink, paper } = L;
    box(L, P, F.x0, F.y0, F.x1, F.y1, A);
    Pattern.dots(P, X(L, 600), X(L, 900), X(L, F.x1 - 600), X(L, F.y1 - 900), B, X(L, 30), X(L, 9.5), Math.PI / 4,
      { x0: X(L, F.x1), y0: X(L, F.y1), x1: X(L, 760), y1: X(L, 1090), from: 1, to: 0 });
    const pts = Pattern.burstPts(X(L, 600), X(L, 690), X(L, 350), X(L, 520), 13, L.rnd);
    P.fillStyle = C; Pattern.poly(P, pts); P.fill();
    P.strokeStyle = ink; P.lineWidth = X(L, 9); P.lineJoin = 'miter'; Pattern.poly(P, pts); P.stroke();
    P.fillStyle = D; Pattern.poly(P, Pattern.burstPts(X(L, 600), X(L, 690), X(L, 250), X(L, 345), 11, L.rnd)); P.fill();
    emblemAt(L, 280, 1180, 420, { outline: ink, sil: paper, band: A, acc: B, ink }, { rot: -0.14 });
    const wf = Colors.readable(D, [B, A, paper, C], 2.4);
    popText(L, fitWord(L, 540, 290), 600, 672, { fill: wf, shadow: ink, depth: 14, dir: Math.PI * 0.3, outline: ink, ow: 6, rot: -0.08 });
    enLine(L, TK, 600, 862, txt(L, D), 'center', 26, 400);
    // speech bubble
    TP.fillStyle = paper; Pattern.bubble(TP, X(L, 86), X(L, 92), X(L, 690), X(L, 318), X(L, 230), X(L, 430)); TP.fill();
    TK.strokeStyle = ink; TK.lineWidth = X(L, 6); TK.lineJoin = 'round'; Pattern.bubble(TK, X(L, 86), X(L, 92), X(L, 690), X(L, 318), X(L, 230), X(L, 430)); TK.stroke();
    const said = (L.spec.slogan || 'HAVE A NICE DAY!').toUpperCase(), words = said.split(/\s+/);
    let lines = [said];
    if (said.length > 12 && words.length > 1) {
      let best = 1, diff = 1e9;
      for (let k = 1; k < words.length; k++) { const d = Math.abs(words.slice(0, k).join(' ').length - words.slice(k).join(' ').length); if (d < diff) { diff = d; best = k; } }
      lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    const probe = U.canvas(8, 8).getContext('2d'); let sz = 58;
    while (sz > 16 && Math.max(...lines.map(t => U.measure(probe, t, U.font('caps', sz), 2).w)) > 400) sz--;
    lines.forEach((t, i) => U.drawTracked(TK, X(L, 388), X(L, 205 + (i - (lines.length - 1) / 2) * sz * 1.08), t, U.font('caps', Math.round(sz * s)), ink, 2 * s, 'center'));
    // caption on a strip of tape, top right
    const ch = holderCol(L, rectC(932, 166, 344, 140)), cc = txt(L, ch), fr = label(L, 932, 166, 344, 140, 'tape', ch, L.rnd);
    inLabel(L, cc === ink ? TK : TP, 932, 166, fr, g => {
      U.drawMixed(g, X(L, -138), X(L, -22), '每日邮政', 'caps', 'cjk_small', Math.round(36 * s), cc, 4 * s, 1, 'left');
      U.drawTracked(g, X(L, -136), X(L, 28), `DAILY POST · NO.${no3(L)}`, U.font('caps_med', Math.round(19 * s)), cc, 4 * s, 'left');
    });
    // denomination box, bottom right
    const dh = holderCol(L, rectC(952, 1288, 316, 250)), dt = txt(L, dh);
    holder(L, 952, 1288, 316, 250, 'torn', dh, L.rnd);
    season(L, dt === ink ? TK : TP, 952, 1262, 120, dt, 'mid', 260, dh);
    U.drawMixed(dt === ink ? TK : TP, X(L, 952), X(L, 1368), `${year(L)} · 每日一枚`, 'caps_med', 'cjk_small_med', Math.round(19 * s), dt, 2 * s, 0.95, 'center');
    return { pm: { x: 930, y: 1030, r: 116, rot: -0.2 } };
  }

  // 4. 方中方 — Albers, Homage to the Square: four nested squares let the palette fight on its own
  function albers(L) {
    const { P, K, TP, TK, s, c, ink, paper } = L, u = 109.6, x0 = F.x0, y0 = 352;
    box(L, P, F.x0, F.y0, F.x1, y0, paper);
    [[0, 0, 10], [1, 1.5, 8], [2, 3, 6], [3, 4.5, 4]].forEach(([dx, dy, n], i) => {
      box(L, P, x0 + dx * u, y0 + dy * u, x0 + (dx + n) * u, y0 + (dy + n) * u, c[i]);
      if (i === 0) Pattern.dots(P, X(L, x0), X(L, y0 + 6 * u), X(L, 4 * u), X(L, 4 * u), c[1], X(L, 24), X(L, 8.5), Math.PI / 4,
        { x0: X(L, x0), y0: X(L, y0 + 10 * u), x1: X(L, x0 + 2.4 * u), y1: X(L, y0 + 7.6 * u), from: 1, to: 0 });
    });
    emblemAt(L, x0 + 5 * u, y0 + 6.5 * u, 480, { outline: ink, sil: paper, band: c[0], acc: c[1], ink }, { rot: 0.06 });
    const wm = fitWord(L, 600, 185);
    popText(L, wm, 110 + wm.width / s / 2, 200, { fill: ink, shadow: Colors.readable(paper, c, 1.8), depth: 6 });
    enLine(L, TK, 110, 324, ink, 'left', 22, 440);
    U.drawMixed(TK, X(L, 1090), X(L, 112), '每日邮政 · DAILY POST', 'caps_med', 'cjk_small', Math.round(20 * s), ink, 3 * s, 1, 'right');
    season(L, TP, 1090, 280, 130, Colors.readable(paper, [c[1], c[0], c[2], c[3], ink], 2.6), 'right', 200, paper);
    small(L, TK, 1090, 324, ink, 'right', 17);
    return { pm: { x: 960, y: 470, r: 118, rot: -0.25 } };
  }

  // 5. 巨字 — Robert Indiana / Ikko Tanaka: the word is the picture, one glyph per colour block.
  // The blocks run to the stamp's foot and the stamp's small print sits on them (no ink bar across the bottom).
  function bigtype(L) {
    const { P, K, TP, TK, s, c, ink, paper } = L;
    const chars = [...L.word].slice(0, 12), n = chars.length;
    const cols = n <= 2 ? n : n <= 6 ? 2 : 3,   // never one glyph per full-width row: that stacks level stripes
      rows = Math.ceil(n / cols), bot = 1290, cw = (F.x1 - F.x0) / cols, ch = (bot - F.y0) / rows;
    for (let i = 0; i < rows * cols; i++) {
      const r = Math.floor(i / cols), x0 = F.x0 + (i % cols) * cw, y0 = F.y0 + r * ch, h = r === rows - 1 ? F.y1 - y0 : ch, bg = c[i % 4];
      box(L, P, x0, y0, x0 + cw, y0 + h, bg);
      const d = Math.min(cw, h, 420) * 0.6;
      Pattern.dots(P, X(L, x0), X(L, y0), X(L, d), X(L, d), c[(i + 1) % 4], X(L, 20), X(L, 7.5), Math.PI / 4,
        { x0: X(L, x0), y0: X(L, y0), x1: X(L, x0 + d * 0.55), y1: X(L, y0 + d * 0.55), from: 1, to: 0 });
      if (i >= n) continue;
      const fillC = Colors.clash(bg, other(L, bg));
      const m = fit(chars[i], X(L, cw * 0.8), X(L, ch * 0.8), 0);
      popText(L, m, x0 + cw / 2 - (cols === 1 ? 70 : 0), y0 + ch / 2, { fill: fillC, shadow: ink, depth: 12, outline: ink, ow: 4, rot: i === 1 ? 0.14 : 0 });
    }
    const emb = { outline: ink, sil: paper, band: c[0], acc: c[2], ink };
    if (rows * cols > n) {
      const i = n, x0 = F.x0 + (i % cols) * cw, y0 = F.y0 + Math.floor(i / cols) * ch;
      emblemAt(L, x0 + cw / 2, y0 + ch / 2, Math.min(cw, ch) * 0.8, emb, { rot: 0.1 });
    } else if (rows === 1 && cols > 1) {
      // a single row leaves tall cells: the emblem takes the free space under the glyphs, on the seam
      const gb = F.y0 + ch / 2 + Math.min(cw, ch) * 0.42, size = Math.min((bot - gb) * 0.95, cw * 0.9);
      emblemAt(L, F.x0 + cw, (gb + bot) / 2, size, emb, { rot: 0.12 });
    } else emblemAt(L, cols === 1 ? 935 : F.x0 + cw * (cols - 1), F.y0 + ch * (rows === 1 ? 0.78 : 1), 320, emb, { rot: 0.16 });
    // small print on the foot of the first and last columns, each in whatever reads on its own block
    const cL = c[((rows - 1) * cols) % 4], cR = c[(rows * cols - 1) % 4], tL = txt(L, cL);
    const g = t => (t === ink ? TK : TP);
    issuer(L, g(tL), 110, 1318, tL, 'left', 0.72);
    enLine(L, g(tL), 110, 1380, tL, 'left', 20, cw - 90);
    small(L, g(tL), 110, 1420, tL, 'left', 16);
    const dc = Colors.readable(cR, [...other(L, cR), paper, ink], 3);
    season(L, g(dc), 1090, 1412, 118, dc, 'right', 200, cR);
    return { pm: { x: 300, y: 1250, r: 112, rot: -0.2 } };
  }

  // 6. 孟菲斯 — Sottsass: stripes, a quarter disc, squiggles and confetti around an arched window
  function memphis(L) {
    const { P, K, TP, TK, s, c: [A, B, C, D], ink, paper } = L;
    box(L, P, F.x0, F.y0, F.x1, F.y1, A);
    Pattern.stripes(P, X(L, 640), X(L, F.y0), X(L, F.x1 - 640), X(L, 430), B, X(L, 30), X(L, 30));
    P.fillStyle = C; circ(L, P, F.x0, F.y1, 520); P.fill();
    Pattern.grid(P, X(L, 930), X(L, 560), X(L, 200), X(L, 300), X(L, 28), X(L, 5.5), D);
    Pattern.squiggle(P, X(L, 90), X(L, 430), X(L, 190), X(L, 20), 2.5, -0.25, X(L, 12), B);
    K.strokeStyle = ink; K.lineWidth = X(L, 10); circ(L, K, 180, 610, 44); K.stroke();
    Pattern.triangle(P, X(L, 185), X(L, 820), X(L, 70), 0.5, D);
    Pattern.zigzag(P, X(L, 930), X(L, 935), X(L, 170), X(L, 18), 4, 0.25, X(L, 11), B);
    Pattern.sparkle(P, X(L, 1060), X(L, 1010), X(L, 44), C);
    // arched window
    const arch = g => { g.beginPath(); g.moveTo(X(L, 300), X(L, 1010)); g.lineTo(X(L, 300), X(L, 630)); g.arc(X(L, 600), X(L, 630), X(L, 300), Math.PI, 0); g.lineTo(X(L, 900), X(L, 1010)); g.closePath(); };
    P.fillStyle = paper; arch(P); P.fill();
    P.save(); arch(P); P.clip();
    Pattern.dots(P, X(L, 300), X(L, 330), X(L, 600), X(L, 680), D, X(L, 22), X(L, 8.5), Math.PI / 4, { x0: 0, y0: X(L, 1010), x1: 0, y1: X(L, 640), from: 1, to: 0 });
    P.restore();
    K.lineWidth = X(L, 9); arch(K); K.stroke();
    emblemAt(L, 600, 700, 520, { sil: paper, band: B, acc: C, ink });
    const wf = Colors.clash(A, [B, D, paper]);
    popText(L, fitWord(L, 860, 180), 600, 1135, { fill: wf, shadow: ink, depth: 10, outline: ink, ow: 5 });
    enLine(L, TK, 600, 1282, Colors.readableOn([A, C], [ink, paper]), 'center', 26, 700);
    TP.fillStyle = paper; pill(L, TP, 300, 1350, 900, 1414); TP.fill();
    TK.lineWidth = X(L, 5); pill(L, TK, 300, 1350, 900, 1414); TK.stroke();
    small(L, TK, 600, 1383, ink, 'center', 18);
    issuer(L, TK, 110, 140, txt(L, A), 'left');
    holder(L, 985, 290, 250, 250, 'scallop', D, L.rnd);
    season(L, TK, 985, 290, 138, txt(L, D), 'mid', 170, D);
    return { pm: { x: 980, y: 1180, r: 116, rot: -0.3 } };
  }

  // 7. 圆点 — Kusama: an obsessive polka-dot ground, a giant sticker, the word on a price label
  function kusama(L) {
    const { P, K, TP, TK, s, c: [A, B, C, D], ink, paper } = L;
    box(L, P, F.x0, F.y0, F.x1, F.y1, A);
    const avoid = [[76, 90, 404, 224], [850, 90, 1120, 360], [160, 1060, 1040, 1345], [52, 1372, 1148, 1448]].map(r => r.map(v => X(L, v)));
    Pattern.polka(P, X(L, F.x0), X(L, F.y0), X(L, F.x1 - F.x0), X(L, F.y1 - F.y0), B, L.rnd, 16, X(L, 40), X(L, 110), avoid);
    emblemAt(L, 600, 640, 700, { outline: ink, sil: paper, band: C, acc: D, ink }, { rot: -0.05 });
    const rot = -0.035;
    for (const [g, fn] of [[TP, g => { g.fillStyle = paper; g.fillRect(X(L, -430), X(L, -128), X(L, 860), X(L, 256)); }],
      [TK, g => { g.strokeStyle = ink; g.lineWidth = X(L, 6); g.strokeRect(X(L, -430), X(L, -128), X(L, 860), X(L, 256)); g.lineWidth = X(L, 2); g.strokeRect(X(L, -414), X(L, -112), X(L, 828), X(L, 224)); }]]) {
      g.save(); g.translate(X(L, 600), X(L, 1200)); g.rotate(rot); fn(g); g.restore();
    }
    popText(L, fitWord(L, 720, 145), 600, 1180, { fill: ink, shadow: Colors.readable(paper, [C, B, D, A], 1.8), depth: 5, rot });
    TK.save(); TK.translate(X(L, 600), X(L, 1200)); TK.rotate(rot);
    if (L.spec.en) enLine(L, TK, 0, 88, ink, 'center', 22, 700);
    TK.restore();
    const ih = holderCol(L, rectC(240, 157, 300, 120)), ic = txt(L, ih), fr = label(L, 240, 157, 300, 120, 'tape', ih, L.rnd);
    inLabel(L, ic === ink ? TK : TP, 240, 157, fr, g => issuer(L, g, 0, -16, ic, 'center'));
    holder(L, 985, 225, 272, 272, 'cutout', D, L.rnd);
    season(L, TK, 985, 225, 150, txt(L, D), 'mid', 184, D);
    small(L, TK, 600, 1410, txt(L, A), 'center', 19);
    return { pm: { x: 270, y: 990, r: 116, rot: 0.2 } };
  }

  // 8. 斜切 — Ikko Tanaka geometry: a diagonal split, an eclipsed disc, the word set vertically
  function split(L) {
    const { P, K, TP, TK, s, c: [A, B, C, D], ink, paper } = L;
    box(L, P, F.x0, F.y0, F.x1, F.y1, A);
    P.fillStyle = B; Pattern.poly(P, [[52, 980], [1148, 540], [1148, 1448], [52, 1448]].map(([x, y]) => [X(L, x), X(L, y)])); P.fill();
    P.fillStyle = C; circ(L, P, 690, 700, 320); P.fill();
    P.save(); circ(L, P, 690, 700, 320); P.clip(); P.fillStyle = D; circ(L, P, 810, 800, 330); P.fill();
    Pattern.stripes(P, X(L, 370), X(L, 380), X(L, 640), X(L, 640), C, X(L, 6), X(L, 16), Math.PI / 2); P.restore();
    K.strokeStyle = ink; K.lineWidth = X(L, 8); circ(L, K, 690, 700, 320); K.stroke();
    emblemAt(L, 700, 705, 540, { outline: ink, sil: paper, band: A, acc: B, ink }, { rot: 0.05 });
    const vm = fitVertical(L.word, X(L, 270), X(L, 860));
    popText(L, vm, 215, 870, { fill: Colors.readableOn([A, B], [paper, C, D, ink], 2.2), shadow: ink, depth: 10, outline: ink, ow: 5 });
    issuer(L, TK, 110, 140, txt(L, A), 'left');
    holder(L, 990, 215, 246, 246, L.rnd() < 0.5 ? 'cutout' : 'scallop', D, L.rnd);
    season(L, TK, 990, 215, 135, txt(L, D), 'mid', 164, D);
    enLine(L, TK, 1090, 1130, txt(L, B), 'right', 26, 560);
    small(L, TK, 1090, 1290, txt(L, B), 'right', 18);
    return { pm: { x: 560, y: 1160, r: 114, rot: -0.2 } };
  }

  // 9. 网点 — the emblem blown up and printed as a Ben-Day halftone, Lichtenstein's close-up
  function halftone(L) {
    const { P, K, TP, TK, s, c: [A, B, C, D], ink, paper, emblem } = L;
    box(L, P, F.x0, F.y0, F.x1, F.y1, A);
    const size = 1260, ex = 720 - size / 2, ey = 640 - size / 2, S = X(L, size);
    if (emblem && emblem.img) {
      const [mi, ma, mb] = Print.channelMasks(emblem);
      halftoneMask(P, Print.silhouette(emblem, 0.028), X(L, ex), X(L, ey), S, B, X(L, 26), 0.42);
      P.drawImage(Print.tinted(mb, C, S), X(L, ex), X(L, ey), S, S);
      P.drawImage(Print.tinted(ma, paper, S), X(L, ex), X(L, ey), S, S);
      const acc = U.canvas(Math.ceil(S), Math.ceil(S)); halftoneMask(acc.getContext('2d'), ma, 0, 0, S, D, X(L, 16), 0.46);
      const ag = acc.getContext('2d'); ag.globalCompositeOperation = 'destination-in'; ag.drawImage(ma, 0, 0, S, S);
      P.drawImage(acc, X(L, ex), X(L, ey));
      K.drawImage(Print.tinted(mi, ink, S), X(L, ex), X(L, ey), S, S);
    } else {
      const fb = Print.fallbackEmblem(1024, L.spec.no, { accent: C, ink });
      halftoneMask(P, fb, X(L, ex), X(L, ey), S, B, X(L, 26), 0.42);
      K.drawImage(fb, X(L, ex + size * 0.2), X(L, ey + size * 0.2), S * 0.6, S * 0.6);
    }
    const wm = fitWord(L, 760, 225);
    popText(L, wm, 110 + wm.width / s / 2, 1240, { fill: Colors.readable(A, [paper, C, D, B], 2.4), shadow: ink, depth: 12, outline: ink, ow: 6, rot: -0.05 });
    // issuer and caption in one brush swipe
    const ch = holderCol(L, rectC(344, 162, 512, 140)), cc = txt(L, ch), fr = label(L, 344, 162, 512, 140, 'swipe', ch, L.rnd);
    inLabel(L, cc === ink ? TK : TP, 344, 162, fr, g => {
      U.drawMixed(g, 0, X(L, -22), '每日邮政 · DAILY POST', 'caps', 'cjk_small', Math.round(24 * s), cc, 3 * s, 1, 'center');
      if (L.spec.en) enLine(L, g, 0, 32, cc, 'center', 20, 320);
      else U.drawTracked(g, 0, X(L, 32), 'MEANWHILE, TODAY…', U.font('caps', Math.round(22 * s)), cc, 8 * s, 'center');
    });
    const dh = holderCol(L, rectC(984, 177, 256, 186), [ch]), dt = txt(L, dh);
    holder(L, 984, 177, 256, 186, 'torn', dh, L.rnd);
    season(L, dt === ink ? TK : TP, 984, 177, 124, dt, 'mid', 216, dh);
    const sw = U.measure(U.canvas(8, 8).getContext('2d'), `${year(L)} · NO.${no3(L)} · 每日一枚 第一辑`, U.font('caps_med', 18), 2).w;
    TP.fillStyle = ink; pill(L, TP, 88, 1380, 112 + sw + 26, 1430); TP.fill();
    small(L, TP, 112, 1412, paper, 'left', 18);
    return { pm: { x: 950, y: 1140, r: 116, rot: -0.2 } };
  }

  const LIST = [
    ['gen', '生成', gen], ['rays', '放射', rays], ['quad', '四联', quad], ['comic', '漫画', comic], ['albers', '方中方', albers], ['bigtype', '巨字', bigtype],
    ['memphis', '孟菲斯', memphis], ['kusama', '圆点', kusama], ['split', '斜切', split], ['halftone', '网点', halftone],
  ];
  const BY = Object.fromEntries(LIST.map(([k, , fn]) => [k, fn]));
  const NAMES = LIST.map(([k, cn]) => ({ key: k, cn }));
  /** default is the generative layout; 'auto' picks a template by word + number */
  function pick(name, spec) {
    if (name && BY[name]) return name;
    if (name !== 'auto') return 'gen';
    const h = [...(spec.phrase || '')].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
    return LIST[1 + (h + (spec.no || 1)) % (LIST.length - 1)][0];
  }
  const draw = (name, L) => BY[name](L);

  return { F, NAMES, pick, draw };
})();
