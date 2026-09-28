// 首页的旧邮票: the home's stamps look handled for years (yellowed, faded, crumpled, folded, stained, skinned; a corner
// lifted, an edge curled…). Twelve kits drawn ahead (dailystamp/agekit.py, kraft/kits/) are dealt to the stamps like
// cards, a new deal every visit, so neighbours never age alike; the pixel work is web/shell/age-core.js, in a worker.
// Only the home ages its stamps: the pages keep them as printed.
const Age = (() => {
  const BASE = '/kraft/kits/';
  let meta = null, metaIn = null, deck = [], worker = null, seq = 0;
  const waiting = new Map();
  let chain = Promise.resolve();                            // one stamp at a time: the worker keeps one kit's maps
  const ok = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';

  /** the kits' index, and this visit's deal of them (seed: the home's deal) */
  function load(seed) {
    if (!metaIn) metaIn = fetch(BASE + 'index.json', { cache: 'no-cache' }).then(r => r.json()).then(m => {
      meta = m;
      const rnd = Print.rng(seed + 4099), d = m.kits.map(k => k.i);
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      deck = d;
      return m;
    }).catch(() => null);
    return metaIn;
  }
  /** the kit the i-th stamp of the carousel takes */
  const kitOf = i => deck.length ? deck[i % deck.length] : null;
  const hasBack = kit => !!(meta && meta.kits.find(k => k.i === kit) || {}).back;

  function startWorker() {
    if (worker || !ok) return worker;
    try { worker = new Worker('/shell/age-core.js'); } catch { return null; }
    worker.onmessage = e => { const p = waiting.get(e.data.id); if (p) { waiting.delete(e.data.id); e.data.error ? p.no(new Error(e.data.error)) : p.yes(e.data); } };
    worker.onerror = () => { for (const p of waiting.values()) p.no(new Error('age worker')); waiting.clear(); worker = null; };
    return worker;
  }

  // ---- the same work on the page, where there is no worker that can draw: a few rows a task
  let heldHere = null;
  const img = url => new Promise((yes, no) => { const im = new Image(); im.onload = () => yes(im); im.onerror = no; im.src = url; });
  const pixelsOf = (src, w = src.width, h = src.height) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    return g.getImageData(0, 0, w, h);
  };
  async function here(kit, src, s) {
    const key = kit + '@' + s;
    if (!heldHere || heldHere.key !== key) {
      heldHere = null;
      const names = ['uv', 'a', 'k'].concat(hasBack(kit) ? ['b'] : []);
      const ims = await Promise.all(names.map(n => img(`${BASE}${kit}.${n}.webp?v=${meta.v}`)));
      const W = Math.round((meta.box[2] - meta.box[0]) * s), H = Math.round((meta.box[3] - meta.box[1]) * s), imgs = {};
      names.forEach((n, i) => { imgs[n] = n === 'uv' ? pixelsOf(ims[i]) : pixelsOf(ims[i], W, H); });
      heldHere = { key, kit: AgeCore.prepare(meta, imgs, s) };
    }
    const K = heldHere.kit, px = pixelsOf(src), out = new Uint8ClampedArray(K.W * K.H * 4);
    for (let y = 0; y < K.H; y += 48) {
      AgeCore.rows(meta, K, px.data, px.width, px.height, out, y, Math.min(K.H, y + 48));
      await new Promise(r => setTimeout(r, 0));             // let the page breathe
    }
    return { w: K.W, h: K.H, buf: out.buffer };
  }

  /** ages the printed stamp src (a canvas) with the given kit: the aged picture (the stamp and a little desk round it,
   *  for its lifted parts) into `into`, its shadow on the desk into `shadow` (a small canvas: the part of the kit's
   *  shadow map that holds any shadow); resolves with where each lies, as shares of the stamp's width and height
   *  ({ picture: [left, top, width, height], shadow: […], origin: the stamp's middle as shares of the shadow's canvas,
   *  which the shadow turns and grows about }), or null if it couldn't be done (the stamp then stays as printed) */
  function apply(src, kit, into, shadow) {
    const job = chain.then(async () => {
      if (!meta || kit == null || !src.width) return null;
      const s = src.width / meta.w;
      let got;
      try {
        const w = startWorker();
        if (w) {
          const bm = await createImageBitmap(src), id = ++seq;
          got = await new Promise((yes, no) => { waiting.set(id, { yes, no }); w.postMessage({ id, meta, base: BASE, kit, back: hasBack(kit), stamp: bm, s }, [bm]); });
        } else got = await here(kit, src, s);
      } catch {
        try { got = await here(kit, src, s); } catch { return null; }   // the worker failed: do it here
      }
      into.width = got.w; into.height = got.h;
      into.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(got.buf), got.w, got.h), 0, 0);
      const [x0, y0, x1, y1] = meta.box, p = meta.pad, w = meta.w, h = meta.h;
      let sb = [0, 0, w + 2 * p, h + 2 * p];                 // where the shadow's canvas lies on the padded sheet
      if (shadow) {
        const sh = await img(`${BASE}${kit}.s.webp?v=${meta.v}`), b = meta.sbox || [0, 0, sh.naturalWidth, sh.naturalHeight];
        const kx = (w + 2 * p) / sh.naturalWidth, ky = (h + 2 * p) / sh.naturalHeight;
        sb = [b[0] * kx, b[1] * ky, b[2] * kx, b[3] * ky];
        shadow.width = Math.max(1, Math.round((b[2] - b[0]) * s / 2)); shadow.height = Math.max(1, Math.round((b[3] - b[1]) * s / 2));
        const g = shadow.getContext('2d'); g.clearRect(0, 0, shadow.width, shadow.height);
        g.drawImage(sh, b[0], b[1], b[2] - b[0], b[3] - b[1], 0, 0, shadow.width, shadow.height);
      }
      return { picture: [(x0 - p) / w, (y0 - p) / h, (x1 - x0) / w, (y1 - y0) / h],
        shadow: [(sb[0] - p) / w, (sb[1] - p) / h, (sb[2] - sb[0]) / w, (sb[3] - sb[1]) / h],
        origin: [(p + w / 2 - sb[0]) / (sb[2] - sb[0]), (p + h / 2 - sb[1]) / (sb[3] - sb[1])] };
    });
    chain = job.catch(() => null);
    return job;
  }
  /** the worker and the kit it holds go once the home is aged (a page's stamp coming home starts it again) */
  function rest() { if (worker) { worker.terminate(); worker = null; } heldHere = null; }
  return { load, kitOf, apply, rest };
})();
