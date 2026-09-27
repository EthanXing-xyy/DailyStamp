// 每日一枚: one perforated stamp per day. Front = Kenya Hara emptiness (white paper, blind-embossed word) with a single
// pop element (a Ben-Day disc with the silkscreened emblem). Back = a deadpan drug-leaflet. Base units: 1200 x 1500.
const Stamp = (() => {
  const BW = 1200, BH = 1500;
  const PAPER = '#F6F3EB';
  const HOLE_R = 13, PITCH = 46;
  const BOX = { x0: 110, y0: 108, x1: 1090, y1: 1392 };   // printable area inside the perforated margin

  // ---------- colours
  // The palette colours the stamp itself (four clashing spot inks + a key ink); only the perforated margin stays white
  // and the desk never changes. The back prints in the palette's strongest ink on paper.
  const DESK = '#D9D5CC';
  function inks(pal) {
    const byC = pal.c.slice().sort((a, b) => U.contrast(b, PAPER) - U.contrast(a, PAPER));
    const spot = U.contrast(byC[0], PAPER) >= 2.2 ? (pal.c.find(c => U.contrast(c, PAPER) >= 3) || byC[0]) : pal.ink;
    return { spot, ink: pal.ink, paper: PAPER, c: pal.c };
  }

  // ---------- paper + perforation
  function perforate(g, w, h, s, seed) {
    const rnd = Print.rng(seed);
    g.save(); g.globalCompositeOperation = 'destination-out';
    const holes = (len, fn) => { const n = Math.max(2, Math.round(len / (PITCH * s))), step = len / n; for (let i = 0; i <= n; i++) fn(i * step); };
    const hole = (x, y) => {
      g.beginPath(); g.arc(x, y, HOLE_R * s * (0.96 + rnd() * 0.08), 0, Math.PI * 2); g.fill();
      // torn fibres: a few specks on the rim
      for (let k = 0; k < 3; k++) { const a = rnd() * Math.PI * 2, rr = HOLE_R * s * (0.98 + rnd() * 0.06); g.beginPath(); g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, (0.5 + rnd() * 0.8) * s, 0, Math.PI * 2); g.fill(); }
    };
    holes(w, x => { hole(x, 0); hole(x, h); });
    holes(h, y => { hole(0, y); hole(w, y); });
    g.restore();
  }

  function paper(w, h, s, seed) {
    const c = U.canvas(w, h), g = c.getContext('2d');
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    // uncoated fibres
    const rnd = Print.rng(seed + 7);
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = rnd() * w, y = rnd() * h, a = rnd() * Math.PI, l = (6 + rnd() * 22) * s;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(120,105,80,0.05)' : 'rgba(255,255,255,0.35)';
      g.lineWidth = (0.6 + rnd()) * s;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 6 * s, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return c;
  }

  // ---------- emboss: raise (or, from the back, sink) a mask into the paper, lit from the upper-left
  function emboss(target, mask, x0, y0, s, strength = 1, invert = false) {
    const w = mask.width, h = mask.height, pad = Math.ceil(10 * s);
    const hc = U.canvas(w + pad * 2, h + pad * 2), hg = hc.getContext('2d');
    hg.filter = `blur(${1.3 * s}px)`; hg.drawImage(mask, pad, pad); hg.filter = 'none';
    const H = hg.getImageData(0, 0, hc.width, hc.height).data;
    const tg = target.getContext('2d');
    const X = Math.round(x0 - pad), Y = Math.round(y0 - pad), W = hc.width, Hh = hc.height;
    const img = tg.getImageData(X, Y, W, Hh), d = img.data;
    const k = Math.max(1, Math.round(1.1 * s)), sign = invert ? -1 : 1;
    const at = (x, y) => H[((y < 0 ? 0 : y >= Hh ? Hh - 1 : y) * W + (x < 0 ? 0 : x >= W ? W - 1 : x)) * 4 + 3];
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const gx = at(x + k, y) - at(x - k, y), gy = at(x, y + k) - at(x, y - k);
      if (gx === 0 && gy === 0) continue;
      let t = sign * (gx * 0.62 + gy * 0.78) / 255 * 0.9 * strength;          // + = facing the light
      t = t > 1 ? 1 : t < -1 ? -1 : t;
      const i = (y * W + x) * 4;
      if (t > 0) { d[i] += (255 - d[i]) * t * 0.85; d[i + 1] += (255 - d[i + 1]) * t * 0.85; d[i + 2] += (252 - d[i + 2]) * t * 0.85; }
      else { const m = 1 + t * 0.40; d[i] *= m; d[i + 1] *= m; d[i + 2] *= m * 0.995; }
    }
    tg.putImageData(img, X, Y);
  }

  function textMask(text, role, size, tracking) {
    const probe = U.canvas(8, 8).getContext('2d');
    const m = U.measure(probe, text, U.font(role, size), tracking);
    const w = Math.ceil(m.w + 8), h = Math.ceil(m.h + 8);
    const c = U.canvas(w, h), g = c.getContext('2d');
    g.font = U.font(role, size); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    let x = 4; for (const ch of text) { g.fillText(ch, x, 4 + m.asc); x += g.measureText(ch).width + tracking; }
    return c;
  }

  // ---------- postmark
  function postmark(g, cx, cy, R, s, spec, rot, seed, light = false) {
    const PM = light ? '#F4EEDF' : '#26262b';
    const w = Math.ceil(R * 4.6), h = Math.ceil(R * 2.4);
    const c = U.canvas(w, h), p = c.getContext('2d'), ox = R * 1.2, oy = h / 2;
    p.strokeStyle = p.fillStyle = PM;
    p.lineWidth = 6 * s; p.beginPath(); p.arc(ox, oy, R, 0, Math.PI * 2); p.stroke();
    p.lineWidth = 2.5 * s; p.beginPath(); p.arc(ox, oy, R * 0.70, 0, Math.PI * 2); p.stroke();
    // arc text
    const arcText = (text, radius, start, span, size, flip) => {
      p.font = U.font(U.hasCjk(text) ? 'cjk_small' : 'caps', size); p.textAlign = 'center'; p.textBaseline = 'middle';
      const chars = [...text], step = span / Math.max(1, chars.length - 1);
      chars.forEach((ch, i) => {
        const a = start + i * step * (flip ? -1 : 1);
        p.save(); p.translate(ox + Math.cos(a) * radius, oy + Math.sin(a) * radius); p.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2));
        p.font = U.font(U.hasCjk(ch) ? 'cjk_small' : 'caps', size); p.fillText(ch, 0, 0); p.restore();
      });
    };
    arcText('每日邮政 · DAILY POST', R * 0.85, -Math.PI * 0.86, Math.PI * 0.72, 24 * s, false);
    arcText(`NO. ${String(spec.no).padStart(3, '0')}`, R * 0.85, Math.PI * 0.64, Math.PI * 0.28, 22 * s, true);
    const [yy, mm, dd] = (spec.date || '').split('-');
    U.drawCentered(p, ox, oy - R * 0.2, yy || '', U.font('caps', Math.round(30 * s)), PM);
    U.drawCentered(p, ox, oy + R * 0.12, `${mm || ''}.${dd || ''}`, U.font('caps', Math.round(44 * s)), PM);
    p.lineWidth = 2.5 * s; for (const yv of [-0.42, 0.40]) { p.beginPath(); p.moveTo(ox - R * 0.5, oy + R * yv); p.lineTo(ox + R * 0.5, oy + R * yv); p.stroke(); }
    // cancellation waves
    p.lineWidth = 5 * s;
    for (let i = 0; i < 5; i++) {
      const y0 = oy + (i - 2) * R * 0.36;
      p.beginPath();
      for (let x = ox + R * 1.12; x < w - 4; x += 3) p.lineTo(x, y0 + Math.sin((x - ox) / (R * 0.22)) * R * 0.09);
      p.stroke();
    }
    // uneven stamp-pad ink: knock out speckles and a soft pressure falloff
    const rnd = Print.rng(seed);
    p.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 1600; i++) { p.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.6})`; p.beginPath(); p.arc(rnd() * w, rnd() * h, (0.6 + rnd() * 2.2) * s, 0, Math.PI * 2); p.fill(); }
    const fade = p.createLinearGradient(0, 0, w, h * 0.4);
    fade.addColorStop(0, 'rgba(0,0,0,0.05)'); fade.addColorStop(0.55, 'rgba(0,0,0,0.25)'); fade.addColorStop(1, 'rgba(0,0,0,0.7)');
    p.fillStyle = fade; p.fillRect(0, 0, w, h);
    g.save(); g.globalAlpha = light ? 0.9 : 0.82; g.globalCompositeOperation = light ? 'source-over' : 'multiply';
    g.translate(cx, cy); g.rotate(rot); g.drawImage(c, -ox, -oy); g.restore();
  }

  /** Where the postmark goes. It is dark ink, so it must land on light print: every candidate spot is scored by how
   *  much of its circle and wavy tail would sit on dark colour (where it vanishes), on type, off the stamp, or on what the
   *  layout asked it to stay off (the emblem). The layout's own spot wins unless it is worse. Always returns a spot. */
  function postmarkSpot(art, typePlates, hint, avoid, s) {
    const q = 10, W = Math.ceil(BW / q), H = Math.ceil(BH / q), F = Layouts.F;
    const a = U.canvas(W, H).getContext('2d', { willReadFrequently: true }); a.drawImage(art, 0, 0, W, H);
    const t = U.canvas(W, H).getContext('2d', { willReadFrequently: true }); for (const p of typePlates) t.drawImage(p, 0, 0, W, H);
    const da = a.getImageData(0, 0, W, H).data, dt = t.getImageData(0, 0, W, H).data;
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const dark = new Uint8Array(W * H), pale = new Uint8Array(W * H), typ = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const lum = 0.2126 * lin(da[i * 4]) + 0.7152 * lin(da[i * 4 + 1]) + 0.0722 * lin(da[i * 4 + 2]);
      dark[i] = lum < 0.14 ? 1 : 0;   // below ~2.7:1 against the pad ink the mark disappears
      pale[i] = lum > 0.3 ? 1 : 0;    // and where a light cancellation would vanish
      typ[i] = dt[i * 4 + 3] > 40 ? 1 : 0;
    }
    // type gets a 30-unit keep-out: a cancellation grazing a glyph or a hairline caption still spoils it
    for (let k = 0; k < 3; k++) { const t0 = typ.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!t0[i] && (t0[i - 1] || t0[i + 1] || t0[i - W] || t0[i + W])) typ[i] = 1; } }
    // the sample points of the circle and its tail, turned once per (r, rot): u·cos, v·sin, u·sin, v·cos
    const pts = new Map();
    const pattern = (r, rot) => {
      const key = r + '|' + rot;
      if (!pts.has(key)) {
        const cs = Math.cos(rot), sn = Math.sin(rot), o = [];
        const add = (u, v) => o.push(u * cs, v * sn, u * sn, v * cs);
        for (let v = -r; v <= r; v += 12) for (let u = -r; u <= r; u += 12) if (u * u + v * v <= r * r) add(u, v);
        for (let v = -r * 0.8; v <= r * 0.8; v += 16) for (let u = r * 1.15; u <= r * 3.3; u += 16) add(u, v);
        pts.set(key, Float64Array.from(o));
      }
      return pts.get(key);
    };
    const X0 = F.x0 + 10, X1 = F.x1 - 10, Y0 = F.y0 + 10, Y1 = F.y1 - 10;
    // mean badness over the points; a spot that can no longer get under `limit` stops early (the bad only grows)
    const score = (x, y, r, rot, light, limit = Infinity) => {
      const o = pattern(r, rot), n = o.length / 4, m = light ? pale : dark;
      let bad = 0;
      for (let k = 0; k < o.length; k += 4) {
        const px = x + o[k] - o[k + 1], py = y + o[k + 2] + o[k + 3];
        if (px < X0 || px > X1 || py < Y0 || py > Y1) bad += 3;
        else {
          const i = Math.floor(py / q) * W + Math.floor(px / q);
          let av = 0;
          for (const b of avoid) if (px > b.x0 && px < b.x1 && py > b.y0 && py < b.y1) { av = 1.5; break; }
          bad += m[i] * 2.5 + typ[i] * 4 + av;
        }
        if (bad / n >= limit) return Infinity;
      }
      return bad / n;
    };
    const r = hint ? hint.r : 114, rot = hint ? hint.rot : -0.22;
    // black pad ink is the real thing; a pale cancellation is only for stamps with no light print left to land on
    let best = hint ? { ...hint, sc: score(hint.x, hint.y, r, rot, false) - 0.03 } : null;
    for (const light of [false, true])
      for (let y = F.y0 + r; y <= F.y1 - r; y += 25) for (let x = F.x0 + r; x <= F.x1 - r * 3; x += 25)
        for (const ro of [rot, -rot * 0.5]) {
          const sc = score(x, y, r, ro, light, best ? best.sc - (light ? 0.35 : 0) + 1e-9 : Infinity) + (light ? 0.35 : 0);
          if (!best || sc < best.sc) best = { x, y, r, rot: ro, sc, light };
        }
    return best;
  }

  // grain, the light falloff and the perforations: what turns a printed canvas into a stamp on paper
  function finishSheet(c, s, seed, opts = {}) {
    const g = c.getContext('2d'), W = c.width, H = c.height;
    if (opts.grain !== false) U.grain(g, W, H, 0.22, 5);
    lightFall(g, W, H);
    if (!opts.noPerf) perforate(g, W, H, s, seed);
    return c;
  }
  /** an unprinted stamp (paper, perforations): needs no fonts or artwork, so it can sit on the desk while they load */
  function blank(s = 1, seed = 1, opts = {}) {
    return finishSheet(paper(Math.round(BW * s), Math.round(BH * s), s, seed), s, seed, opts);
  }

  // ---------- front
  /** spec: {phrase, en, no, date, slogan}; opts: {layout, seed, shift, misregister, grain, scale, noPerf} */
  function renderFront(spec, pal, emblem, opts = {}) {
    const s = opts.scale || 1, W = Math.round(BW * s), H = Math.round(BH * s);
    const seed = (spec.no || 1) * 31 + [...(spec.phrase || '')].reduce((a, c) => a + c.charCodeAt(0), 0);
    const out = paper(W, H, s, seed), g = out.getContext('2d');
    // four plates: artwork colour + key, then type colour + key on top, so nothing ever covers the type
    const Pc = U.canvas(W, H), Kc = U.canvas(W, H), P = Pc.getContext('2d'), K = Kc.getContext('2d');
    const TPc = U.canvas(W, H), TKc = U.canvas(W, H), TP = TPc.getContext('2d'), TK = TKc.getContext('2d');
    const F = Layouts.F, name = Layouts.pick(opts.layout, spec);
    const word = (U.hasCjk(spec.phrase || '') ? spec.phrase : (spec.phrase || '').toUpperCase()) || '…';
    const L = { embBoxes: [], P, K, TP, TK, s, c: Colors.roles(pal, opts.shift || 0), ink: pal.ink, paper: PAPER, spec, emblem, rnd: Print.rng(seed), word, seed: (opts.seed ?? seed) + (spec.no || 1) * 7919 };
    for (const x of [P, K, TP, TK]) { x.save(); x.beginPath(); x.rect(F.x0 * s, F.y0 * s, (F.x1 - F.x0) * s, (F.y1 - F.y0) * s); x.clip(); }
    const res = Layouts.draw(name, L) || {};
    for (const x of [P, K, TP, TK]) x.restore();

    // press: artwork (colour, ink mottle, key out of register), the postmark, then the type plates on top
    const mis = opts.misregister !== false;
    g.save(); if (mis) g.filter = `blur(${0.35 * s}px)`; g.globalAlpha = 0.97; g.drawImage(Pc, mis ? 1.5 * s : 0, mis ? -1 * s : 0); g.restore();
    mottle(g, F, s, seed);
    // opts.stages: keep a finished copy of the sheet after each press, for the landing page's printing animation
    const finish = c => finishSheet(c, s, seed, opts);
    const snap = () => { const c = U.canvas(W, H); c.getContext('2d').drawImage(out, 0, 0); return finish(c); };
    const stages = opts.stages ? { art: snap() } : null;
    g.save(); if (mis) g.filter = `blur(${0.4 * s}px)`; g.drawImage(Kc, mis ? 3 * s : 0, mis ? 2.5 * s : 0); g.restore();
    if (stages) stages.key = snap();
    // every stamp is cancelled: the postmark is not optional, it just moves to wherever it stays legible
    const pm = postmarkSpot(out, [TPc, TKc], res.pm, [...L.embBoxes, ...(res.avoid || [])], s);
    postmark(g, pm.x * s, pm.y * s, pm.r * s, s, spec, pm.rot, seed, pm.light);
    if (stages) {
      stages.pmLayer = U.canvas(W, H);
      postmark(stages.pmLayer.getContext('2d'), pm.x * s, pm.y * s, pm.r * s, s, spec, pm.rot, seed, pm.light);
      stages.pmAt = { x: pm.x * s, y: pm.y * s, blend: pm.light ? 'source-over' : 'multiply' };
    }
    g.save(); if (mis) g.filter = `blur(${0.35 * s}px)`; g.drawImage(TPc, mis ? -1 * s : 0, mis ? 1 * s : 0); g.drawImage(TKc, mis ? 2 * s : 0, mis ? 2 * s : 0); g.restore();
    finish(out);
    if (stages) { stages.blank = blank(s, seed, opts); stages.final = out; out.stages = stages; }
    out.embossMask = null; out.layout = name;
    return out;
  }

  // uneven screen-print ink: soft light / dark blotches over the printed field
  function mottle(g, F, s, seed) {
    const rnd = Print.rng(seed + 11), w = (F.x1 - F.x0) * s, h = (F.y1 - F.y0) * s;
    g.save(); g.beginPath(); g.rect(F.x0 * s, F.y0 * s, w, h); g.clip();
    for (let i = 0; i < 26; i++) {
      const x = F.x0 * s + rnd() * w, y = F.y0 * s + rnd() * h, r = (120 + rnd() * 260) * s, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.restore();
  }

  // a very soft lighting falloff across the sheet, so it reads as photographed paper
  function lightFall(g, W, H) {
    const lg = g.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, 'rgba(255,255,255,0.06)'); lg.addColorStop(1, 'rgba(0,0,0,0.045)');
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = lg; g.fillRect(0, 0, W, H); g.restore();
  }

  // ---------- back: the leaflet
  function wrap(ctx, text, maxW) {
    const lines = []; let line = '';
    for (const ch of text) {
      const t = line + ch;
      if (ctx.measureText(t).width > maxW && line) {
        if ('，。；：、！？）」』,.;:!?)'.includes(ch)) { lines.push(t); line = ''; continue; }   // no punctuation at line start
        lines.push(line); line = ch;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function ean13(digits12) {
    const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    const G = L.map(p => [...p].map(b => b === '0' ? '1' : '0').reverse().join(''));
    const Rr = L.map(p => [...p].map(b => b === '0' ? '1' : '0').join(''));
    const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
    const d = digits12.split('').map(Number);
    const sum = d.reduce((a, v, i) => a + v * (i % 2 ? 3 : 1), 0), check = (10 - sum % 10) % 10;
    d.push(check);
    let bits = '101';
    for (let i = 1; i <= 6; i++) bits += (PAR[d[0]][i - 1] === 'L' ? L : G)[d[i]];
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += Rr[d[i]];
    bits += '101';
    return { bits, text: d.join('') };
  }

  function renderBack(spec, pal, leaflet, opts = {}) {
    const s = opts.scale || 1, W = Math.round(BW * s), H = Math.round(BH * s);
    const col = inks(pal), seed = (spec.no || 1) * 31 + 3;
    const out = paper(W, H, s, seed + 1), g = out.getContext('2d');
    const X = v => v * s, bx = BOX, L = leaflet || Leaflet.fallback(spec.phrase, spec.en);
    const spotL = U.canvas(W, H), inkL = U.canvas(W, H);
    const sg = spotL.getContext('2d'), ig = inkL.getContext('2d');
    const paperTxt = U.contrast(col.spot, PAPER) > 2.2 ? PAPER : col.ink;

    // header band
    sg.fillStyle = col.spot; sg.fillRect(X(bx.x0), X(bx.y0), X(bx.x1 - bx.x0), X(132));
    U.drawMixed(sg, X(bx.x0 + 30), X(bx.y0 + 50), '情绪药品说明书', 'caps', 'cjk_small', Math.round(44 * s), paperTxt, 6 * s, 1, 'left');
    U.drawTracked(sg, X(bx.x0 + 32), X(bx.y0 + 100), 'PACKAGE INSERT · READ CAREFULLY BEFORE FEELING', U.font('caps_med', Math.round(17 * s)), paperTxt, 4 * s, 'left');
    // OTC oval
    sg.save(); sg.strokeStyle = paperTxt; sg.lineWidth = 4 * s;
    sg.beginPath(); sg.ellipse(X(bx.x1 - 86), X(bx.y0 + 66), X(56), X(34), 0, 0, Math.PI * 2); sg.stroke(); sg.restore();
    U.drawCentered(sg, X(bx.x1 - 86), X(bx.y0 + 66), 'OTC', U.font('caps', Math.round(34 * s)), paperTxt);

    // title
    const tsz = U.fitFont(ig, 'phrase_cjk', L.name, X(700), X(92));
    ig.font = U.font('phrase_cjk', tsz); ig.fillStyle = col.ink; ig.textAlign = 'left'; ig.textBaseline = 'alphabetic';
    ig.fillText(L.name, X(bx.x0), X(bx.y0 + 250));
    if (L.slogan) U.drawTracked(sg, X(bx.x0 + 2), X(bx.y0 + 296), L.slogan.toUpperCase(), U.font('caps', Math.round(22 * s)), col.spot, 7 * s, 'left');
    U.drawTracked(ig, X(bx.x1), X(bx.y0 + 214), `NO.${String(spec.no).padStart(3, '0')}`, U.font('caps', Math.round(26 * s)), col.ink, 5 * s, 'right');
    U.drawTracked(ig, X(bx.x1), X(bx.y0 + 250), (spec.date || '').replace(/-/g, '.'), U.font('caps_med', Math.round(20 * s)), col.ink, 4 * s, 'right');
    ig.fillStyle = col.ink; ig.fillRect(X(bx.x0), X(bx.y0 + 326), X(bx.x1 - bx.x0), Math.max(1, 3 * s));

    // ingredients: one stacked bar, each share printed in a different screen of the same two inks
    const head = (ctx, x, y, t, size) => U.drawMixed(ctx, x, y, `【${t}】`, 'caps', 'cjk_small', size, col.spot, 0, 1, 'left');
    let y = bx.y0 + 372;
    head(sg, X(bx.x0 - 8), X(y), '成分', Math.round(25 * s));
    const barY = y + 30, barH = 64, ing = L.ingredients || [];
    let x = bx.x0;
    const fills = [
      (c, a, b, w, h) => { c.fillStyle = col.c[0]; c.fillRect(a, b, w, h); },
      (c, a, b, w, h) => { c.save(); c.beginPath(); c.rect(a, b, w, h); c.clip(); c.fillStyle = col.c[1]; const cell = 12 * s; for (let yy = b; yy < b + h + cell; yy += cell) for (let xx = a + ((yy / cell) % 2) * cell / 2; xx < a + w + cell; xx += cell) { c.beginPath(); c.arc(xx, yy, cell * 0.34, 0, Math.PI * 2); c.fill(); } c.restore(); },
      (c, a, b, w, h) => { c.save(); c.beginPath(); c.rect(a, b, w, h); c.clip(); c.strokeStyle = col.c[2]; c.lineWidth = 4 * s; for (let t = -h; t < w + h; t += 12 * s) { c.beginPath(); c.moveTo(a + t, b + h); c.lineTo(a + t + h, b); c.stroke(); } c.restore(); },
      (c, a, b, w, h) => { c.fillStyle = col.c[3]; c.fillRect(a, b, w, h); },
      (c, a, b, w, h) => { c.strokeStyle = col.ink; c.lineWidth = 3 * s; c.strokeRect(a + 1.5 * s, b + 1.5 * s, w - 3 * s, h - 3 * s); },
    ];
    const total = ing.reduce((a, v) => a + v[1], 0) || 100, fullW = bx.x1 - bx.x0;
    ing.forEach(([name, pct], i) => {
      const w = fullW * pct / total, f = fills[i % fills.length];
      f(i % fills.length < 4 ? sg : ig, X(x), X(barY), X(w) - 3 * s, X(barH));
      x += w;
    });
    // legend under the bar
    let lx = bx.x0, ly = barY + barH + 38;
    const lsz = Math.round(23 * s);
    ing.forEach(([name, pct], i) => {
      const f = fills[i % fills.length], label = `${name} ${pct}%`;
      ig.font = U.font('cjk_small_med', lsz); const tw = ig.measureText(label).width / s;
      if (lx + 34 + tw > bx.x1) { lx = bx.x0; ly += 38; }
      f(i % fills.length < 4 ? sg : ig, X(lx), X(ly - 11), X(22), X(22));
      U.drawMixed(ig, X(lx + 32), X(ly), label, 'caps_med', 'cjk_small_med', lsz, col.ink, 0, 1, 'left');
      lx += 34 + tw + 30;
    });

    // body: flowing two columns
    const [yy, mm, dd] = (spec.date || '2026-01-01').split('-');
    const sections = [
      ['性状', L.appearance], ['适应症', L.indications], ['用法用量', L.dosage], ['不良反应', L.adverse],
      ['禁忌', L.contra], ['注意事项', L.cautions], ['贮藏', L.storage],
      ['有效期', `至 ${yy}.${mm}.${dd} 23:59，过期自动失效。`],
      ['节气', `${Terms.of(spec.date).name}（见正面图标）`],
      ['批号', `${yy}${mm}${dd}-${String(spec.no).padStart(3, '0')}`],
      ['批准文号', `国情准字 H${yy}${mm}${dd}`],
    ].filter(v => v[1]);
    const top = ly + 52, bottom = 1262, colW = (fullW - 48) / 2;
    let size = 25, placed = null;
    for (; size >= 17; size--) {
      const lh = size * 1.48, gap = size * 0.55, hs = size;
      ig.font = U.font('cjk_small_med', Math.round(size * s));
      const blocks = sections.map(([h, t]) => ({ h, lines: wrap(ig, t, X(colW)), hs }));
      let c = 0, yc = top; const pos = [];
      for (const b of blocks) {
        const need = hs * 1.5 + b.lines.length * lh + gap;
        if (yc + need > bottom && c === 0) { c = 1; yc = top; }
        pos.push({ ...b, c, y: yc }); yc += need;
      }
      if (yc <= bottom) { placed = { pos, lh, hs }; break; }
    }
    if (placed) for (const b of placed.pos) {
      const cx = bx.x0 + b.c * (colW + 48);
      head(sg, X(cx - 8), X(b.y + placed.hs * 0.55), b.h, Math.round(placed.hs * s));
      b.lines.forEach((ln, i) => U.drawMixed(ig, X(cx), X(b.y + placed.hs * 1.5 + placed.lh * (i + 0.5)), ln, 'caps_med', 'cjk_small_med', Math.round(size * s), col.ink, 0, 1, 'left'));
    }

    // footer: barcode + issuer
    ig.fillStyle = col.ink; ig.fillRect(X(bx.x0), X(1276), X(fullW), Math.max(1, 2 * s));
    const code = ean13(`69${yy}${mm}${dd}${String(spec.no).padStart(3, '0')}`.slice(0, 12).padEnd(12, '0'));
    const mod = 3.1, bh = 74, bx0 = bx.x0 + 14;
    [...code.bits].forEach((b, i) => { if (b === '1') ig.fillRect(X(bx0 + i * mod), X(1296), X(mod) + 0.3, X(bh + ([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94].includes(i) ? 6 : 0))); });
    U.drawTracked(ig, X(bx0 + 47.5 * mod), X(1398), code.text, U.font('caps_med', Math.round(17 * s)), col.ink, 7 * s, 'center');
    U.drawMixed(ig, X(bx.x1), X(1316), '每日邮政 监制 · DAILY POST', 'caps_med', 'cjk_small_med', Math.round(20 * s), col.ink, 2 * s, 1, 'right');
    U.drawMixed(ig, X(bx.x1), X(1350), '本品为情绪类邮资凭证，一日一枚，不可叠加使用', 'caps_med', 'cjk_small_med', Math.round(18 * s), col.ink, 1 * s, 1, 'right');
    U.drawMixed(ig, X(bx.x1), X(1382), '请置于儿童够得着的地方', 'caps_med', 'cjk_small_med', Math.round(18 * s), col.ink, 1 * s, 1, 'right');

    const mis = opts.misregister !== false;
    g.save(); g.globalCompositeOperation = 'multiply';
    if (mis) g.filter = `blur(${0.4 * s}px)`;
    g.drawImage(spotL, 0, 0); g.drawImage(inkL, mis ? 3 * s : 0, mis ? 2 * s : 0);
    g.restore();

    // the front's blind emboss shows through as a mirrored, sunken shape
    if (opts.embossFrom) {
      const e = opts.embossFrom, m = U.canvas(e.mask.width, e.mask.height), mg = m.getContext('2d');
      mg.translate(m.width, 0); mg.scale(-1, 1); mg.drawImage(e.mask, 0, 0);
      emboss(out, m, W - e.x - m.width, e.y, s, 0.55, true);
    }
    if (opts.grain !== false) U.grain(g, W, H, 0.22, 6);
    lightFall(g, W, H);
    perforate(g, W, H, s, seed);
    return out;
  }

  // ---------- the stamp lying on a desk, photographed from above
  function deskColor(pal) {
    return DESK;                                          // the desk never changes; the stamp carries the colour
  }
  function onDesk(stamp, pal, W, H, opts = {}) {
    const c = U.canvas(W, H), g = c.getContext('2d');
    g.fillStyle = opts.desk || deskColor(pal); g.fillRect(0, 0, W, H);
    const lg = g.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, Math.hypot(W, H));
    lg.addColorStop(0, 'rgba(255,255,255,0.10)'); lg.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    U.grain(g, W, H, 0.18, 3);
    const k = Math.min(W * 0.78 / stamp.width, H * 0.8 / stamp.height), sw = stamp.width * k, sh = stamp.height * k;
    g.save(); g.translate(W / 2, H / 2); g.rotate(opts.rot ?? -0.012);
    const u = sw / 1200;
    g.shadowColor = 'rgba(0,0,0,0.20)'; g.shadowBlur = 60 * u; g.shadowOffsetX = 14 * u; g.shadowOffsetY = 26 * u;
    g.drawImage(stamp, -sw / 2, -sh / 2, sw, sh);
    g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 5 * u; g.shadowOffsetX = 1.5 * u; g.shadowOffsetY = 3 * u;
    g.drawImage(stamp, -sw / 2, -sh / 2, sw, sh);
    g.restore();
    return c;
  }

  return { BW, BH, PAPER, DESK, inks, blank, renderFront, renderBack, onDesk, deskColor, perforate, paper, emboss, textMask, postmark };
})();
