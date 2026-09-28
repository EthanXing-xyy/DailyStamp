// The aged stamps' pixel work (web/shell/age.js; the kits: dailystamp/agekit.py). A kit says, for every px of the aged
// picture, which px of the printed stamp is seen there (uv), the paper's colour and light there (a), what is left of the
// ink, how much of the face shows and where the gummed back is (k), and what the back looks like (b). Here a kit is
// laid over one printed stamp:
//   ink = 1 - colour / paper, a little grey and faded, times what is left of it
//   colour = a x (1 - ink) + b,  alpha = max(the stamp's own outline x k.face, k.back)
// It runs in a worker (so a phone's main thread never waits for it); where a worker can't draw (no OffscreenCanvas)
// the page runs the same code itself, a few rows at a time. Loaded both ways: as a worker, and as a plain script.
const AgeCore = (() => {
  const U12 = 4095;
  /** the kit's maps as the picture is to be drawn (s: the printed stamp's width / the kit's stamp width): uv stays at
   *  the kit's size (decoded to px, sampled smoothly), the rest is drawn at the picture's size */
  function prepare(meta, imgs, s) {
    const K = imgs.uv, kw = K.width, kh = K.height, uv = K.data, n = kw * kh;
    const U = new Float32Array(n), V = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const r = uv[j], g = uv[j + 1], b = uv[j + 2];
      U[i] = ((r << 4) | (g >> 4)) / 4 - meta.pad;
      V[i] = (((g & 15) << 8) | b) / 4 - meta.pad;
    }
    return { kw, kh, U, V, W: imgs.a.width, H: imgs.a.height, a: imgs.a.data, k: imgs.k.data, b: imgs.b ? imgs.b.data : null, s };
  }

  /** rows y0..y1 of the picture (out: RGBA, straight alpha) from the stamp (px: RGBA straight, sw x sh) */
  function rows(meta, kit, px, sw, sh, out, y0, y1) {
    const { kw, kh, U, V, W, a, k, b, s } = kit;
    const P0 = meta.p0, pr = P0[0] / 255, pg = P0[1] / 255, pb = P0[2] / 255;
    const AM = meta.a / 255, MM = meta.m / 255, BM = meta.b / 255, GREY = meta.grey, KEEP = 1 - meta.fade;
    const inv = 1 / s, maxX = kw - 1.001, maxY = kh - 1.001;
    for (let y = y0; y < y1; y++) {
      let ky = (y + 0.5) * inv - 0.5; ky = ky < 0 ? 0 : ky > maxY ? maxY : ky;
      const y0i = ky | 0, fy = ky - y0i, r0 = y0i * kw, r1 = r0 + kw;
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const face = k[o + 1] / 255, back = k[o + 2] / 255;
        if (face === 0 && back === 0) { out[o + 3] = 0; continue; }
        // where on the stamp: the kit's uv, smoothly between its px
        let kx = (x + 0.5) * inv - 0.5; kx = kx < 0 ? 0 : kx > maxX ? maxX : kx;
        const x0i = kx | 0, fx = kx - x0i;
        const i00 = r0 + x0i, i10 = i00 + 1, i01 = r1 + x0i, i11 = i01 + 1;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        const u = (U[i00] * w00 + U[i10] * w10 + U[i01] * w01 + U[i11] * w11) * s - 0.5;
        const v = (V[i00] * w00 + V[i10] * w10 + V[i01] * w01 + V[i11] * w11) * s - 0.5;
        // the stamp there (straight alpha, weighed by alpha so the paper round it doesn't bleed in)
        let cr = 0, cg = 0, cb = 0, ca = 0;
        const sx = Math.floor(u), sy = Math.floor(v), gx = u - sx, gy = v - sy;
        if (sx >= -1 && sy >= -1 && sx < sw && sy < sh) {
          for (let t = 0; t < 4; t++) {
            const xx = sx + (t & 1), yy = sy + (t >> 1);
            if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
            const w = ((t & 1) ? gx : 1 - gx) * ((t >> 1) ? gy : 1 - gy), q = (yy * sw + xx) * 4, al = px[q + 3] * w;
            cr += px[q] * al; cg += px[q + 1] * al; cb += px[q + 2] * al; ca += al;
          }
        }
        const a0 = ca / 255;
        let ir = 0, ig = 0, ib = 0;
        if (a0 > 0.02) {
          const d = 1 / (ca * 255);
          ir = 1 - Math.min(1, cr * d / pr); ig = 1 - Math.min(1, cg * d / pg); ib = 1 - Math.min(1, cb * d / pb);
          const m = (ir + ig + ib) / 3, left = k[o] * MM * KEEP;
          ir = (ir + (m - ir) * GREY) * left; ig = (ig + (m - ig) * GREY) * left; ib = (ib + (m - ib) * GREY) * left;
        }
        let R = a[o] * AM * (1 - ir), G = a[o + 1] * AM * (1 - ig), B = a[o + 2] * AM * (1 - ib);
        if (b) { R += b[o] * BM; G += b[o + 1] * BM; B += b[o + 2] * BM; }
        const al = Math.max(a0 * face, back);
        out[o] = R * 255; out[o + 1] = G * 255; out[o + 2] = B * 255; out[o + 3] = al * 255;   // (clamped by the array)
      }
    }
  }
  return { prepare, rows };
})();

// ---- as a worker: jobs come in one at a time; the last kit's maps are kept (the page sends a kit's stamps together)
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  let held = null;                                          // { key, imgs }
  const decode = async url => {
    const blob = await fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.blob(); });
    const bm = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    return bm;
  };
  const pixels = (bm, w = bm.width, h = bm.height) => {
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high'; g.drawImage(bm, 0, 0, w, h);
    return g.getImageData(0, 0, w, h);
  };
  self.onmessage = async e => {
    const { id, meta, base, kit, back, stamp, s } = e.data;
    try {
      const key = kit + '@' + s;
      if (!held || held.key !== key) {
        held = null;                                        // (the old maps go before the new ones come)
        const names = ['uv', 'a', 'k'].concat(back ? ['b'] : []);
        const bms = await Promise.all(names.map(n => decode(`${base}${kit}.${n}.webp?v=${meta.v}`)));
        const W = Math.round((meta.box[2] - meta.box[0]) * s), H = Math.round((meta.box[3] - meta.box[1]) * s), imgs = {};
        names.forEach((n, i) => { imgs[n] = n === 'uv' ? pixels(bms[i]) : pixels(bms[i], W, H); bms[i].close(); });
        held = { key, kit: AgeCore.prepare(meta, imgs, s) };
      }
      const K = held.kit, src = pixels(stamp); stamp.close();
      const out = new Uint8ClampedArray(K.W * K.H * 4);
      AgeCore.rows(meta, K, src.data, src.width, src.height, out, 0, K.H);
      self.postMessage({ id, w: K.W, h: K.H, buf: out.buffer }, [out.buffer]);
    } catch (err) {
      self.postMessage({ id, error: String(err && err.message || err) });
    }
  };
}
