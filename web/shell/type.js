// 首页的印字: every word on the home is printed on the kraft: the ink not quite solid (missed specks, thin patches: the
// ink plate, kraft/ink.png), its edges a little rough, the paper's colour in it. Each word is drawn once into a little
// bitmap, under the loading screen; the page then only moves bitmaps. (As live CSS, a filter, a mask and a blend on
// the text, all of it was worked out again for every frame the page drew: too much for a phone.)
const Type = (() => {
  const INK = [27, 15, 8];                                  // #241a13 printed on the kraft: multiplied by the paper's colour
  // the title's face and the small type's: the line's height (of the size), the ink plate's tile (px), how far the
  // edge is pushed about (px) and how fine (turns per px), how much ink the press gave it
  const KINDS = {
    title: { family: '"DS Phrase", serif', line: 1.1, tile: 220, rough: 1.8, grain: 0.85, seed: 7, ink: 1 },
    small: { family: '"DS CapsMed", "DS CjkMed", sans-serif', line: 1.2, tile: 150, rough: 0.6, grain: 1.6, seed: 11, ink: 0.9 },
  };
  const FIELD = 256;                                        // px after which the edge's roughness repeats
  let plateIm = null, loading = null, pen = null;
  const plates = new Map(), fields = new Map(), made = new Map();
  const ratio = () => Math.min(3, Math.max(1, devicePixelRatio || 1));
  const mod = (a, n) => ((a % n) + n) % n;

  /** the ink plate (v: the kraft's version, so the browser keeps it) */
  function load(v) {
    if (!loading) loading = new Promise(yes => {
      const im = new Image();
      im.onload = () => { plateIm = im; yes(true); }; im.onerror = () => yes(false);
      im.src = '/kraft/ink.png' + (v ? '?v=' + v : '');
    });
    return loading;
  }
  /** the faces a text needs (the Chinese ones come as subsets) */
  const fonts = (kind, size, text) => Promise.all(KINDS[kind].family.split(',').map(f => document.fonts.load(`${size}px ${f.trim()}`, text).catch(() => {})));

  function sheet(w, h) {
    if (!pen) pen = document.createElement('canvas');
    pen.width = w; pen.height = h;
    return pen.getContext('2d', { willReadFrequently: true });
  }
  /** the ink plate's tile at the screen's px: how much ink took, 0..255 (no plate: all of it) */
  function plate(K, r) {
    const T = Math.round(K.tile * r);
    if (!plates.has(T)) {
      const a = new Uint8Array(T * T).fill(255);
      if (plateIm) {
        const g = sheet(T, T); g.imageSmoothingQuality = 'high'; g.drawImage(plateIm, 0, 0, T, T);
        const px = g.getImageData(0, 0, T, T).data;
        for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3];
      }
      plates.set(T, { T, a });
    }
    return plates.get(T);
  }
  /** how far the ink is pushed about at every px (x and y), a square that repeats: two octaves of gradient noise, as
   *  the filter this took over from had (feTurbulence into feDisplacementMap) */
  function field(K, r) {
    const key = K.seed + '@' + r;
    if (fields.has(key)) return fields.get(key);
    const N = FIELD, rnd = Print.rng(K.seed * 7919 + 13), ease = t => t * t * t * (t * (t * 6 - 15) + 10);
    const channel = () => {
      const out = new Float32Array(N * N);
      for (let o = 0; o < 2; o++) {
        const c = Math.max(2, Math.round(N * K.grain / r)) << o, g = new Float32Array(c * c * 2);
        for (let i = 0; i < c * c; i++) { const a = rnd() * 2 * Math.PI; g[i * 2] = Math.cos(a); g[i * 2 + 1] = Math.sin(a); }
        const dot = (ix, iy, dx, dy) => { const j = (iy * c + ix) * 2; return g[j] * dx + g[j + 1] * dy; };
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const fx = x * c / N, fy = y * c / N, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
          const x1 = (x0 + 1) % c, y1 = (y0 + 1) % c, u = ease(tx), v = ease(ty);
          const p = dot(x0, y0, tx, ty), q = dot(x0, y1, tx, ty - 1);
          const top = p + (dot(x1, y0, tx - 1, ty) - p) * u, bot = q + (dot(x1, y1, tx - 1, ty - 1) - q) * u;
          out[y * N + x] += (top + (bot - top) * v) / (1 << o);
        }
      }
      return out;
    };
    const f = { dx: channel(), dy: channel() }, s = K.rough * r / 2;
    for (let i = 0; i < N * N; i++) { f.dx[i] *= s; f.dy[i] *= s; }
    fields.set(key, f);
    return f;
  }

  /** a line laid out: what goes where ([{ ch, x, a }], px of the page) and its width. track: the letters' spacing (of
   *  the size); marks: a ◦ either side, a little fainter (the kicker's) */
  function lay(text, K, size, track, marks) {
    const r = ratio(), g = sheet(1, 1), items = [];
    g.font = `${size * r}px ${K.family}`;
    let x = 0;
    const put = (ch, a) => { items.push({ ch, x, a }); x += g.measureText(ch).width / r + track * size; };
    const mark = () => { x += size; put('◦', 0.7); x += size; };
    if (marks) mark();
    for (const ch of text) put(ch, 1);
    if (marks) mark();
    return { items, width: x };
  }
  /** prints what was laid out: { W, H (the bitmap), a (its ink, 0..255), w, h, pad (px of the page: it lies pad
   *  outside its line all round) }. ox, oy: where the line lies on the plate. w and h are whole px, so a word set on a
   *  whole px stays on whole screen px (see home.js: centre) */
  function print({ items, width }, K, size, ox, oy) {
    const r = ratio(), pad = Math.ceil(K.rough) + 2, line = K.line * size;
    const w = Math.ceil(width + 2 * pad), h = Math.ceil(line + 2 * pad), W = Math.round(w * r), H = Math.round(h * r), g = sheet(W, H);
    g.font = `${size * r}px ${K.family}`; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
    const m = g.measureText('国'), up = m.fontBoundingBoxAscent || size * r * 0.88, down = m.fontBoundingBoxDescent || size * r * 0.12;
    const base = pad * r + (line * r - up - down) / 2 + up;
    for (const it of items) { g.globalAlpha = it.a; g.fillText(it.ch, (pad + it.x) * r, base); }
    const src = g.getImageData(0, 0, W, H).data, F = field(K, r), P = plate(K, r), a = new Uint8Array(W * H), N = FIELD, T = P.T;
    const sx0 = Math.round((ox - pad) * r), sy0 = Math.round((oy - pad) * r), row = W * 4;
    for (let y = 0; y < H; y++) {
      const fy = mod(y + sy0, N) * N, py = mod(y + sy0, T) * T;
      for (let x = 0; x < W; x++) {
        const fi = fy + mod(x + sx0, N), sx = x + F.dx[fi], sy = y + F.dy[fi];
        if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) continue;
        const x0 = sx | 0, y0 = sy | 0, i = y0 * row + x0 * 4 + 3, tx = sx - x0, ty = sy - y0;
        const top = src[i] + (src[i + 4] - src[i]) * tx, bot = src[i + row] + (src[i + row + 4] - src[i + row]) * tx;
        const v = top + (bot - top) * ty;
        if (v >= 0.5) a[y * W + x] = v * P.a[py + mod(x + sx0, T)] / 255 * K.ink + 0.5;
      }
    }
    return { W, H, a, pad, w, h };
  }
  const keep = (key, make) => {
    if (!made.has(key)) { try { made.set(key, make()); } catch { made.set(key, null); } }
    return made.get(key);
  };

  /** a line of the small type or of the title's face, printed (kept: asked again, it is there). mid: the middle of
   *  the box it is centred in (for where it lies on the plate). null if it can't be printed */
  function word(text, kind, size, { track = 0, marks = false, mid = null } = {}) {
    const K = KINDS[kind];
    return keep([kind, size, ratio(), track, marks, text].join('|'), () => {
      const L = lay(text, K, size, track, marks);
      return print(L, K, size, mid == null ? 0 : mid - L.width / 2, 0);
    });
  }
  /** the title a letter at a time (they rise one by one): a bitmap each, or null */
  function letters(text, size, { track = 0, mid = null } = {}) {
    const K = KINDS.title;
    return keep(['letters', size, ratio(), track, text].join('|'), () => {
      const L = lay(text, K, size, track, false), ox = mid == null ? 0 : mid - L.width / 2;
      return L.items.map((it, i) => print({ items: [{ ch: it.ch, x: 0, a: 1 }], width: (i + 1 < L.items.length ? L.items[i + 1].x : L.width) - it.x }, K, size, ox + it.x, 0));
    });
  }

  /** a bitmap onto the page: a canvas as big as its line and pad more all round (its margins take that back) */
  function show(m) {
    const c = document.createElement('canvas');
    c.width = m.W; c.height = m.H;
    const im = new ImageData(m.W, m.H), p = im.data;
    for (let i = 0, j = 0; i < m.a.length; i++, j += 4) if (m.a[i]) { p[j] = INK[0]; p[j + 1] = INK[1]; p[j + 2] = INK[2]; p[j + 3] = m.a[i]; }
    c.getContext('2d').putImageData(im, 0, 0);
    Object.assign(c.style, { width: m.w + 'px', height: m.h + 'px', margin: -m.pad + 'px' });
    c.setAttribute('aria-hidden', 'true');
    return c;
  }
  /** a canvas taken off the page gives its memory back at once */
  const drop = c => { if (c && c.width) c.width = c.height = 0; };
  /** what printing needs goes when the printing is done (the bitmaps stay; more printing brings it back) */
  function rest() { plates.clear(); fields.clear(); if (pen) { pen.width = pen.height = 0; pen = null; } }
  /** the bitmaps go (the type's size changed) */
  const forget = () => made.clear();

  return { INK, load, fonts, word, letters, show, drop, rest, forget, ratio };
})();
