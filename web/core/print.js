// Shared print helpers: emblem channel masks + tinting, emblem silhouettes, Ben-Day screens, the procedural badge.
const Print = (() => {
  // per-emblem alpha masks for the three ink channels (R = ink, G = accent, B = band), cached by emblem id
  const maskCache = new Map();
  function channelMasks(emblem) {
    if (maskCache.has(emblem.id)) return maskCache.get(emblem.id);
    if (emblem.cut) { maskCache.set(emblem.id, emblem.cut.masks); return emblem.cut.masks; }   // pre-cut (loadCut)
    const img = emblem.img, S = img.naturalWidth;
    // read back from a software canvas (a GPU one stalls), a pixel as one 32-bit word (little-endian: 0xAABBGGRR)
    const src = U.canvas(S, S), sg = src.getContext('2d', { willReadFrequently: true }); sg.drawImage(img, 0, 0);
    const d = new Uint32Array(sg.getImageData(0, 0, S, S).data.buffer);
    const out = [0, 1, 2].map(() => { const c = U.canvas(S, S), id = c.getContext('2d').createImageData(S, S); return { c, id, px: new Uint32Array(id.data.buffer) }; });
    const [R, G, B] = out.map(o => o.px), ON = 0xFF000000;
    for (let i = 0; i < d.length; i++) {
      const p = d[i];
      if ((p & 255) > 127) R[i] = ON; else if (((p >>> 8) & 255) > 127) G[i] = ON; else if (((p >>> 16) & 255) > 127) B[i] = ON;
    }
    const res = out.map(o => { o.c.getContext('2d').putImageData(o.id, 0, 0); return o.c; });
    maskCache.set(emblem.id, res);
    return res;
  }

  /** the mask filled with `color`. With `size` (the px it will be drawn at) the plate is made at that size, never above the
   *  mask's own: a stamp on the home is ~400 px, and a 1024 px plate per ink per stamp is what ran a phone out of memory. */
  function tinted(mask, color, size) {
    const w = size ? Math.max(1, Math.min(Math.ceil(size), mask.width)) : mask.width, h = size ? Math.max(1, Math.round(w * mask.height / mask.width)) : mask.height;
    const c = U.canvas(w, h), g = c.getContext('2d');
    g.drawImage(mask, 0, 0, w, h); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h);
    return c;
  }

  // filled outline of the emblem (everything not reachable from the border), grown by `grow` of its size: a die-cut sticker shape
  const silCache = new Map(), fillCache = new Map();
  function silhouette(emblem, grow = 0.03) {
    const key = emblem.id + ':' + grow;
    if (silCache.has(key)) return silCache.get(key);
    const pre = emblem.cut && emblem.cut.sil[grow];
    if (pre) { silCache.set(key, pre); return pre; }
    const N = 512, f = filled(emblem, N);
    // grow: stamp the fill around a circle, then re-threshold for a crisp edge
    const r = Math.max(1, Math.round(N * grow));
    const g2 = U.canvas(N, N), gg = g2.getContext('2d');
    for (let k = 0; k < 24; k++) { const t = k * Math.PI / 12; gg.drawImage(f, Math.cos(t) * r, Math.sin(t) * r); }
    gg.drawImage(f, 0, 0);
    const S = emblem.img.naturalWidth, out = U.canvas(S, S), og = out.getContext('2d');
    og.filter = `blur(${Math.max(1, S / N * 1.5)}px)`; og.drawImage(g2, 0, 0, S, S); og.filter = 'none';
    const od = og.getImageData(0, 0, S, S);
    for (let i = 3; i < od.data.length; i += 4) od.data[i] = U.clamp((od.data[i] - 110) * 6, 0, 255);
    og.putImageData(od, 0, 0);
    silCache.set(key, out);
    return out;
  }
  /** the emblem's solid shape at N px: everything the border can't reach (shared by every grow) */
  function filled(emblem, N) {
    if (fillCache.has(emblem.id)) return fillCache.get(emblem.id);
    const masks = channelMasks(emblem);
    const u = U.canvas(N, N), ug = u.getContext('2d');
    for (const m of masks) ug.drawImage(m, 0, 0, N, N);
    const a = ug.getImageData(0, 0, N, N).data;
    const solid = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) solid[i] = a[i * 4 + 3] > 60 ? 1 : 0;
    // flood the outside from the border
    const outside = new Uint8Array(N * N), stack = [];
    const push = i => { if (!outside[i] && !solid[i]) { outside[i] = 1; stack.push(i); } };
    for (let x = 0; x < N; x++) { push(x); push((N - 1) * N + x); }
    for (let y = 0; y < N; y++) { push(y * N); push(y * N + N - 1); }
    while (stack.length) {
      const i = stack.pop(), x = i % N, y = (i / N) | 0;
      if (x > 0) push(i - 1); if (x < N - 1) push(i + 1); if (y > 0) push(i - N); if (y < N - 1) push(i + N);
    }
    const f = U.canvas(N, N), fg = f.getContext('2d'), fd = fg.createImageData(N, N);
    for (let i = 0; i < N * N; i++) if (!outside[i]) fd.data[i * 4 + 3] = 255;
    fg.putImageData(fd, 0, 0);
    fillCache.set(emblem.id, f);
    return f;
  }

  /** the masks and outlines `python dailystamp.py masks` cut ahead of time (<prefix>.r/.g/.b/.s<grow>.png): with them on
   *  obj.cut, channelMasks and silhouette are lookups instead of seconds of pixel work. Resolves false if any is missing. */
  async function loadCut(obj, prefix, grows, v) {
    const names = ['r', 'g', 'b', ...grows.map(g => 's' + g)];
    try {
      // plain images, not decoded bitmaps: 24 emblems x 5 plates held decoded were 600 MB, enough for iOS to kill the tab.
      // An image is decoded when it's drawn, and the browser may drop that decode again when memory runs short.
      const imgs = await Promise.all(names.map(n => new Promise((ok, no) => {
        const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = `${prefix}.${n}.png?v=${encodeURIComponent(v)}`;
      })));
      obj.cut = { masks: imgs.slice(0, 3), sil: Object.fromEntries(grows.map((g, k) => [g, imgs[3 + k]])) };
      return true;
    } catch { return false; }
  }

  /** Ben-Day dot field inside a circle. `gradient` (0..1) grows the dots toward the upper-left like a lit sphere. */
  function dotDisc(ctx, cx, cy, R, color, cell, gradient = 0.7, angle = Math.PI / 4) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = color;
    const ca = Math.cos(angle), sa = Math.sin(angle), n = Math.ceil(R * 1.5 / cell);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const lx = i * cell, ly = j * cell;
      const x = cx + lx * ca - ly * sa, y = cy + lx * sa + ly * ca;
      const dx = (x - cx) / R, dy = (y - cy) / R;
      if (dx * dx + dy * dy > 1.1) continue;
      const t = U.clamp(0.5 + 0.5 * (-(dx + dy) * 0.7071), 0, 1);           // 1 at upper-left, 0 at lower-right
      const rr = cell * (0.30 + 0.42 * Math.pow(t, 1.3) * gradient + 0.28 * (1 - gradient));
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function fallbackEmblem(size, no, pal) {
    // a closed round seal: an accent band between two ink rings, perforation dots, the number. No rays: loose rays
    // melt into whichever ground shares their colour and double up with a sunburst ground or backer.
    const c = U.canvas(size, size), g = c.getContext('2d'), cx = size / 2, TAU = Math.PI * 2, R = size * 0.37, r = size * 0.23;
    g.fillStyle = pal.accent; g.beginPath(); g.arc(cx, cx, R, 0, TAU); g.arc(cx, cx, r, 0, TAU, true); g.fill();
    g.fillStyle = pal.ink;
    for (let i = 0; i < 36; i++) { const a = i * TAU / 36; g.beginPath(); g.arc(cx + Math.cos(a) * size * 0.3, cx + Math.sin(a) * size * 0.3, 9, 0, TAU); g.fill(); }
    g.lineWidth = 16; g.strokeStyle = pal.ink;
    for (const rr of [R, r]) { g.beginPath(); g.arc(cx, cx, rr, 0, TAU); g.stroke(); }
    U.drawCentered(g, cx, cx, String(no).padStart(2, '0'), U.font('caps', Math.round(size * 0.27)), pal.ink);
    return c;
  }

  // deterministic PRNG
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  return { channelMasks, loadCut, tinted, silhouette, dotDisc, fallbackEmblem, rng };
})();
