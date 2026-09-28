// 首页: an endless carousel of the day's stamps (after jfa-awards.snp.agency's index). The one in the middle is big, its
// neighbours shrink and are cut off by the screen edge; drag, wheel or arrow keys slide it round, the function's name
// rises in letter by letter under it. Every visit deals a fresh carousel: word, palette and layout of each stamp, and the
// desk's paper shapes, are new on every reload (`?homeseed=N` pins one deal, for screenshots).
// Tapping the middle one presses it (Win8), then it lifts off and flies to its page. The stamps are all printed while
// the loading screen is up (fill), so the carousel never draws a stamp while it moves; show() lifts the titles in.
// Phones: nothing here repaints while the wheel turns. The stamps float on the compositor (looping animations), their
// shadows are bitmaps drawn once, the desk changes colour by fading one sheet over another, and the frame loop only
// runs while the wheel moves (`?fps` shows the frame rate).
const Home = (() => {
  const FEATURES = Features.LIST.map(f => ({ live: true, ...f }));   // web/app/features.js
  const N = FEATURES.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TILT = reduce ? 0 : 7;
  const slow = +new URLSearchParams(location.search).get('homeslow') || 1;   // stretch the carousel's easing (screenshots)
  const DEAL = +new URLSearchParams(location.search).get('homeseed') || 1 + Math.floor(Math.random() * 2147483646);
  const FPS = new URLSearchParams(location.search).has('fps');
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const put = (cv, src) => { cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); };
  const mod = (a, n) => ((a % n) + n) % n;
  const wrap = d => mod(d + N / 2, N) - N / 2;              // ring distance, in [-N/2, N/2)
  const two = n => String(n).padStart(2, '0');

  // paper riding moving air: every stamp bobs, wanders in a slow figure of eight, turns and tips to the light, each on
  // its own period; its shadow stays on the desk, fainter, softer and further off the higher the stamp floats. One
  // looping animation per stamp, sampled from these sines; the periods fit the loop a whole number of times.
  const LOOP = 49.6, SAMPLES = 160;
  const PERIODS = [6.2, LOOP / 6, LOOP / 7, LOOP / 9, LOOP / 5];   // bob, sway, turn, tip, lean: about 6.2 8.3 7.1 5.5 9.9 s
  function floatFrames(ph) {
    const inner = [], shadow = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i * LOOP / SAMPLES, w = k => Math.sin(t * 2 * Math.PI / PERIODS[k] + ph[k]);
      const fy = 14 * w(0), fx = 5 * w(1), rz = 2 * w(2), rx = 5 * w(3), ry = 6 * w(4);
      const lift = (14 - fy) / 28;                          // 0 resting low .. 1 at the top of its bob
      inner.push({ transform: `translate(${fx.toFixed(2)}px, ${fy.toFixed(2)}px) rotate(${rz.toFixed(3)}deg) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)` });
      shadow.push({ transform: `translate(${(fx * 0.5 + 6 + lift * 10).toFixed(2)}px, ${(12 + lift * 16).toFixed(2)}px) rotate(${(rz * 0.7).toFixed(3)}deg) scale(${(0.95 + lift * 0.09).toFixed(4)})`,
        opacity: +(0.62 - lift * 0.3).toFixed(3) });
    }
    return [inner, shadow];
  }

  /** this visit's stamps: library words, palettes and layouts dealt afresh on every load (the date only goes on the stamp) */
  function plan(date, words, palettes) {
    const rnd = Print.rng(DEAL);
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const ws = shuffle(words), ps = shuffle(palettes);
    return FEATURES.map((f, i) => {
      const w = ws.length ? ws[i % ws.length] : { phrase: '今天', en: 'today' };
      return { phrase: w.phrase, en: w.en || '', no: i + 1, date, palette: ps[i % ps.length].name, layout: 'gen',
        seed: Math.floor(rnd() * 1e9), shift: Math.floor(rnd() * 4), emblem: 'auto', misregister: true, grain: true, side: 'front' };
    });
  }

  /** builds the carousel in root with unprinted stamps (needs no fonts or artwork); fill() prints them, show() reveals */
  function mount(root, { onOpen }) {
    root.innerHTML = '';
    const top = el('div', 'home-top', '<span>每日邮政 · DAILY POST</span><span class="home-date"></span>');
    const ring = el('div', 'carousel');
    const kicker = el('p', 'home-kicker'), title = el('h2', 'home-title');
    const count = el('div', 'home-count', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle class="arc" cx="12" cy="12" r="9" pathLength="100"/></svg><span></span>');
    // the desk: two sheets of plain colour and, for each paper shape, two tinted canvases. The lower ones carry an even
    // stamp's tones, the upper ones an odd stamp's, faded over as the wheel turns (paintBackdrop)
    const bg = el('div', 'home-bg');
    const desks = [el('i', 'bd-desk'), el('i', 'bd-desk up')];
    bg.append(...desks);
    const sets = [0, 1].map(() => {
      const g = el('div', 'bd-set'), cvs = [el('canvas', 'bd-tone'), el('canvas', 'bd-tone up')];
      g.append(...cvs); bg.append(g);
      return { g, cvs, pick: null, img: null, drift: null, rot: '' };
    });
    root.append(bg, top, ring, kicker, title, count);
    root.tabIndex = 0;
    const slots = FEATURES.map((f, i) => {
      const btn = el('div', 'card'), shadow = el('canvas', 'card-shadow'), inner = el('div', 'card-in');
      const contact = el('canvas', 'card-contact'), cv = el('canvas', 'card-face');
      btn.setAttribute('role', 'button'); btn.setAttribute('aria-label', f.cn);
      inner.append(contact, cv); btn.append(shadow, inner); ring.append(btn);
      // each stamp drifts on its own phases, so the eleven never move in step
      const ph = [0, 1, 2, 3, 4].map(k => (i * 2.399 + k * 1.913) % (2 * Math.PI));
      return { ...f, index: i, btn, shadow, inner, contact, cv, st: null, printed: null, ph, anims: null, far: null, tr: '', op: '', z: '' };
    });

    // ---- sizes. The stamps ride the rim of a big wheel whose hub sits below the screen: the further out, the lower
    // and the more tipped. Wide screens show five (the outer two cut by the edge), phones three (half a neighbour each side).
    let bdDay = null;                                       // the date whose backdrop shapes are on the desk
    let W = 0, H = 0, cw = 0, ch = 0, gap = 0, cy = 0, R = 0, fadeFrom = 0, ANG = [0, 0], SCL = [1, 1];
    function layout() {
      W = innerWidth; H = innerHeight;
      const wide = W > H;
      if (wide) {
        const n = W / H > 2.05 ? 3 : 2;                     // ultrawide screens show seven
        SCL = n === 3 ? [1, 0.74, 0.56, 0.46, 0.4] : [1, 0.74, 0.56, 0.46];
        // the outer pair must sit half off the screen, as on the reference: with the height-led size, open the paper
        // between the stamps until their middles land on the edges; if even the narrowest gap is too wide, shrink them
        R = W * 1.1;
        const angles = (w, g) => {
          const t = [0];
          for (let k = 1; k < SCL.length; k++) t.push(t[k - 1] + 2 * Math.asin(Math.min(1, ((SCL[k - 1] + SCL[k]) * w / 2 + g) / (2 * R))));
          return t;
        };
        const edgeAt = (w, g) => R * Math.sin(angles(w, g)[n]), half = W / 2;
        let w = H * 0.52 * 0.8, g = Math.max(18, w * 0.05);
        if (edgeAt(w, g) > half) {
          let lo = 40, hi = w;
          for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; edgeAt(m, Math.max(18, m * 0.05)) > half ? hi = m : lo = m; }
          w = lo; g = Math.max(18, w * 0.05);
        } else {
          let lo = g, hi = w * 0.2;
          if (edgeAt(w, hi) < half) {                       // very wide screens: grow the stamps a little too
            hi = w * 0.2;
            let a = w, b = H * 0.6 * 0.8;
            for (let i = 0; i < 30; i++) { const m = (a + b) / 2; edgeAt(m, m * 0.2) > half ? b = m : a = m; }
            w = a; lo = hi = w * 0.2;
          }
          for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; edgeAt(w, m) > half ? hi = m : lo = m; }
          g = lo;
        }
        cw = w; ch = w / 0.8;
        ANG = angles(cw, g);
        fadeFrom = n + 0.4;
      } else {
        SCL = [1, 0.62, 0.5, 0.45];
        ch = Math.min(W * 0.62 * 1.25, H * 0.52); cw = ch * 0.8;
        R = W * 2.9;
        const a = Math.asin(W / 2 / R);                     // a neighbour's middle sits right on the screen edge
        ANG = [0, a, 2 * a, 3 * a];
        fadeFrom = 1.6;
      }
      gap = R * Math.sin(ANG[1]);                           // px a drag travels per stamp
      cy = H * 0.45;
      root.style.setProperty('--cw', cw + 'px'); root.style.setProperty('--ch', ch + 'px'); root.style.setProperty('--cy', cy + 'px');
      drawShadows(); slots.forEach(contact);
      placeBackdrops();
    }
    /** a stamp |d| steps from the middle: its angle on the wheel, or its scale (past the table it carries on at the last step) */
    const along = (tbl, a) => {
      const k = Math.min(tbl.length - 2, Math.floor(a));
      return tbl[k] + (tbl[k + 1] - tbl[k]) * (a - k);
    };

    // ---- shadows, drawn once rather than blurred on every frame
    const SPILL = 48;                                       // px the desk shadow's blur (σ 16) spills past its sheet
    /** the soft shadow each stamp casts on the desk: a rounded sheet a little inside the stamp, blurred, drawn a quarter size */
    function drawShadows() {
      const q = 0.25, rw = cw * 0.88, rh = ch * 0.9;
      const w = Math.ceil((rw + 2 * SPILL) * q), h = Math.ceil((rh + 2 * SPILL) * q), off = w + h;
      const art = el('canvas'); art.width = w; art.height = h;
      const g = art.getContext('2d');
      g.shadowColor = 'rgba(40,30,20,.34)'; g.shadowBlur = 2 * 16 * q; g.shadowOffsetX = off;   // σ = blur / 2
      g.beginPath();
      if (g.roundRect) g.roundRect(SPILL * q - off, SPILL * q, rw * q, rh * q, [{ x: rw * q * 0.04, y: rh * q * 0.04 }]);
      else g.rect(SPILL * q - off, SPILL * q, rw * q, rh * q);
      g.fill();
      for (const sl of slots) {
        put(sl.shadow, art);
        Object.assign(sl.shadow.style, { left: (cw * 0.06 - SPILL).toFixed(1) + 'px', top: (ch * 0.05 - SPILL).toFixed(1) + 'px',
          width: (w / q).toFixed(1) + 'px', height: (h / q).toFixed(1) + 'px' });
      }
    }
    /** the contact shadow round a stamp's own edge (its perforations, a torn fibre), from its canvas at a third the size */
    function contact(sl) {
      const src = sl.cv, c = sl.contact;
      if (!src.width || !cw) return;
      const w = Math.max(1, Math.round(src.width / 3)), h = Math.max(1, Math.round(src.height / 3)), s = w / cw;
      const pad = Math.ceil(4 * s) + 2;
      c.width = w + 2 * pad; c.height = h + 2 * pad;
      const g = c.getContext('2d'), off = c.width + c.height;
      g.shadowColor = 'rgba(0,0,0,.24)'; g.shadowBlur = 1.5 * s; g.shadowOffsetX = off + s; g.shadowOffsetY = 2 * s;
      g.drawImage(src, pad - off, pad, w, h);
      Object.assign(c.style, { left: (-pad / w * 100).toFixed(3) + '%', top: (-pad / h * 100).toFixed(3) + '%',
        width: (c.width / w * 100).toFixed(3) + '%', height: (c.height / h * 100).toFixed(3) + '%' });
    }

    layout();
    const sc = Math.min(0.6, Math.max(0.3, cw * Math.min(2, devicePixelRatio || 1) / 1200));
    slots.forEach(sl => { put(sl.cv, Stamp.blank(sc, 3 + sl.index)); contact(sl); });

    // ---- the engine: pos (which stamp is in the middle, fractional) eases toward to. The loop only runs while
    // something moves; the floating is the compositor's
    let pos = 0, to = 0, last = 0, vel = 0, tilt = 0, dragging = false, shown = -1, arc = '', raf = 0;
    function frame(t, force) {
      // (under the loading screen the wheel stands still: every frame there goes to printing)
      const visible = document.body.classList.contains('daily-home') && document.body.classList.contains('loaded') && !document.hidden;
      if (!visible && !force) { last = 0; return false; }
      const dt = last ? Math.min(64, t - last) : 16; last = t;
      const before = pos;
      if (!dragging) pos += (to - pos) * (1 - Math.exp(-dt / (110 * slow)));
      if (Math.abs(to - pos) < 1e-4) pos = to;
      vel = (pos - before) / Math.max(1, dt);
      tilt += (Math.max(-6, Math.min(6, vel * 750)) * (reduce ? 0 : 1) - tilt) * (1 - Math.exp(-dt / (120 * slow)));
      const c = mod(Math.round(pos), N), near = [];
      for (const sl of slots) {
        const d = wrap(sl.index - pos), a = Math.abs(d);
        const far = a > fadeFrom + 0.6;                     // out of sight: hidden, its floating paused
        if (far !== sl.far) {
          sl.far = far; sl.btn.classList.toggle('far', far);
          if (sl.anims) for (const an of sl.anims) far ? an.pause() : an.play();
        }
        if (far) continue;
        const th = Math.sign(d) * along(ANG, a), s = along(SCL, a);
        const x = R * Math.sin(th), y = R * (1 - Math.cos(th));
        const tf = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(th * 180 / Math.PI).toFixed(3)}deg) scale(${s.toFixed(4)}) rotateY(${tilt.toFixed(2)}deg)`;
        if (tf !== sl.tr) sl.btn.style.transform = sl.tr = tf;
        const op = a < fadeFrom ? '' : Math.max(0, 1 - (a - fadeFrom) / 0.6).toFixed(3);
        if (op !== sl.op) sl.btn.style.opacity = sl.op = op;
        sl.a = a; near.push(sl);
      }
      // the nearer lies on top; the order is only written when it changes
      near.sort((p, q) => p.a - q.a || p.index - q.index);
      near.forEach((sl, i) => { const z = String(100 - i); if (z !== sl.z) sl.btn.style.zIndex = sl.z = z; });
      paintBackdrop(t);
      const off = (Math.round((100 - (mod(pos, N) + 1) / N * 100) * 2) / 2).toFixed(1);
      if (off !== arc) count.querySelector('.arc').style.strokeDashoffset = arc = off;
      if (c !== shown) showTitle(c);
      return true;
    }
    const moving = () => dragging || Math.abs(to - pos) > 1e-4 || Math.abs(tilt) > 0.01 || (tintFrom > 0 && performance.now() - tintFrom < 1000);
    const loop = t => { raf = 0; if (frame(t) && moving()) raf = requestAnimationFrame(loop); else last = 0; };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    // the home coming on show (loaded, back from a page) is a change of the body's classes
    new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', kick);
    addEventListener('resize', () => { layout(); frame(performance.now(), true); kick(); });

    // Win8 press on the stamp in the middle: it tips toward the finger and sinks, outside its floating
    let pressed = null;
    const unpress = sl => { sl.inner.style.rotate = sl.inner.style.scale = ''; sl.shadow.style.translate = sl.shadow.style.scale = ''; };
    const presser = U.presser(now => {
      const sl = current(), pd = now.d;
      if (pressed && (pressed !== sl || pd < 1e-3)) { unpress(pressed); pressed = null; }
      if (pd < 1e-3) return;
      pressed = sl;
      const tx = -now.y * TILT * pd, ty = now.x * TILT * pd, turn = Math.hypot(tx, ty);
      const k = 1 - 0.035 * pd * (1 - 0.55 * Math.min(1, Math.hypot(now.x, now.y)));
      sl.inner.style.rotate = turn > 1e-3 ? `${tx.toFixed(4)} ${ty.toFixed(4)} 0 ${turn.toFixed(3)}deg` : 'none';
      sl.inner.style.scale = k.toFixed(4);
      sl.shadow.style.translate = `0 ${(-pd * 8).toFixed(2)}px`; sl.shadow.style.scale = (1 - pd * 0.03).toFixed(4);
    });
    /** the stamps start floating when the loading screen lifts (never with reduced motion) */
    function float() {
      if (reduce || slots[0].anims) return;
      const o = { duration: LOOP * 1000, iterations: Infinity };
      for (const sl of slots) {
        const [inner, shadow] = floatFrames(sl.ph);
        sl.anims = [sl.inner.animate(inner, o), sl.shadow.animate(shadow, o)];
        if (sl.far) for (const an of sl.anims) an.pause();
      }
    }

    // ---- the desk: it takes the colour of the stamp in the middle (muted right down, blended as the wheel turns), and two
    // big hand-cut paper shapes (Matisse's cut-outs, Warhol's Flowers) lie on it tone on tone, a new pair every visit. The
    // wheel carries them round too. Before the stamps are printed the desk stays the neutral grey of every other page.
    const NEUTRAL = { desk: '#D9D5CC', shape: U.fromOklch(0.81, 0.016, 1.52), ghost: U.fromOklch(0.84, 0.014, 1.52) };
    /** the ink that covers most of the printed stamp (its paper margin and key ink don't count) */
    function mainInk(sl) {
      const pal = sl.st && Colors.PALETTES.find(p => p.name === sl.st.palette);
      if (!pal || !sl.printed) return null;
      const w = 24, h = 30, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(sl.printed, 0, 0, w, h);
      const px = g.getImageData(0, 0, w, h).data, inks = pal.c.map(U.hexToRgb), n = inks.map(() => 0);
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 200) continue;
        let best = -1, bd = 60 * 60 * 3;                    // only pixels close to one of the four spot inks
        inks.forEach((c, k) => { const d = (c[0] - px[i]) ** 2 + (c[1] - px[i + 1]) ** 2 + (c[2] - px[i + 2]) ** 2; if (d < bd) { bd = d; best = k; } });
        if (best >= 0) n[best]++;
      }
      // a colourless ink (Campbell's cream) makes no tint: the strongest-coloured of the big ones wins
      const order = pal.c.map((c, k) => k).sort((a, b) => n[b] - n[a]);
      const k = order.find(k => U.oklch(pal.c[k])[1] >= 0.08 && n[k] >= n[order[0]] * 0.5);
      return pal.c[k ?? order[0]];
    }
    function tones(sl) {
      if (sl.toneOf === sl.printed) return sl.tone;
      const ink = mainInk(sl);
      let tone = null;
      if (ink) {
        const [, C, h] = U.oklch(ink), deg = ((h * 180 / Math.PI) + 360) % 360;
        // yellows muted grey go khaki: they stay light and keep more colour, a butter paper
        const y = deg > 70 && deg < 115 ? 1 : 0;
        tone = { desk: U.fromOklch(0.87 + 0.03 * y, Math.min(C, 0.045 + 0.03 * y), h),
          shape: U.fromOklch(0.81 + 0.04 * y, Math.min(C, 0.075 + 0.04 * y), h),
          ghost: U.fromOklch(0.845 + 0.035 * y, Math.min(C, 0.06 + 0.035 * y), h) };
      }
      sl.toneOf = sl.printed; sl.tone = tone;
      return tone;
    }
    let tintFrom = 0, live = false, toned = [null, null], upOp = null;   // live: the loading screen has lifted
    const blend = (a, b, k) => ({ desk: U.mixOklab(a.desk, b.desk, k), shape: U.mixOklab(a.shape, b.shape, k), ghost: U.mixOklab(a.ghost, b.ghost, k) });
    const TR = Math.min(1.5, devicePixelRatio || 1);        // the shapes are soft and tone on tone: 1.5 px per px is plenty
    /** a shape's canvas in tones c: its misregistered ghost with the shape over it. Only plain compositing: the ghost's
     *  mask filled with its ink, the shape's outline cut out of it, the shape's ink laid behind, then everything outside
     *  the two outlines (s.union, drawn once per size) taken away */
    function tint(s, L, c) {
      const p = s.pick, img = s.img;
      if (!p || !img || !p.size) return;
      const w = Math.ceil((p.size + p.gx) * TR), h = Math.ceil((p.size + p.gy) * TR), S = p.size * TR, ar = img.naturalWidth / img.naturalHeight;
      const mw = ar >= 1 ? S : S * ar, mh = ar >= 1 ? S / ar : S, mx = (S - mw) / 2, my = (S - mh) / 2, gx = mx + p.gx * TR, gy = my + p.gy * TR;
      if (!s.union || s.union.width !== w || s.union.height !== h) {
        s.union = el('canvas'); s.union.width = w; s.union.height = h;
        const u = s.union.getContext('2d'); u.drawImage(img, gx, gy, mw, mh); u.drawImage(img, mx, my, mw, mh);
      }
      const cv = s.cvs[L];
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext('2d'), op = m => { g.globalCompositeOperation = m; };
      op('source-over'); g.clearRect(0, 0, w, h); g.drawImage(img, gx, gy, mw, mh);
      op('source-in'); g.fillStyle = c.ghost; g.fillRect(0, 0, w, h);
      op('destination-out'); g.drawImage(img, mx, my, mw, mh);
      op('destination-over'); g.fillStyle = c.shape; g.fillRect(0, 0, w, h);
      op('destination-in'); g.drawImage(s.union, 0, 0);
      op('source-over');
    }
    function paintBackdrop(t) {
      const k = tintFrom ? Math.min(1, (t - tintFrom) / 900) : 0, kk = k * k * (3 - 2 * k);
      // the lower sheets carry whichever of the two stamps either side of the middle is even, the upper ones the odd
      // one, faded in by how far the wheel has gone toward it: passing a stamp retints one pair while the other hides it
      const c0 = Math.floor(pos), f = pos - c0, odd = mod(c0, 2) === 1;
      const up = +(odd ? 1 - f : f).toFixed(3);
      if (up !== upOp) { upOp = up; desks[1].style.opacity = up; for (const s of sets) s.cvs[1].style.opacity = up; }
      for (const L of [0, 1]) {
        if ((L ? up <= 0 : up >= 1) && k < 1) continue;   // a hidden pair waits until the desk has taken its colour
        const tn = tones(slots[mod(odd ? c0 + 1 - L : c0 + L, N)]) || NEUTRAL, c = kk < 1 ? blend(NEUTRAL, tn, kk) : tn;
        const key = c.desk + c.shape + c.ghost;
        if (key === toned[L]) continue;
        toned[L] = key;
        desks[L].style.backgroundColor = c.desk;
        for (const s of sets) tint(s, L, c);
      }
      for (const [i, s] of sets.entries()) {
        if (!s.pick) continue;
        const r = (s.pick.rot + (reduce ? 0 : (i ? -5 : 9) * pos)).toFixed(2) + 'deg';
        if (r !== s.rot) s.g.style.rotate = s.rot = r;
      }
    }
    /** a shape's slow drift, on the compositor: a loop of two minutes (periods about 20 and 24 s, or 24 and 17 s) */
    function drift(s, i) {
      if (s.drift) s.drift.cancel();
      s.drift = null;
      if (reduce) return;
      const dr = 0.01 * s.pick.size, T = 120, n = 240, px = i ? 24 : 20, py = i ? T / 7 : 24, kf = [];
      for (let k = 0; k <= n; k++) {
        const t = k * T / n;
        kf.push({ translate: `${(dr * Math.sin(t * 2 * Math.PI / px + i * 2)).toFixed(2)}px ${(dr * Math.cos(t * 2 * Math.PI / py + i)).toFixed(2)}px` });
      }
      s.drift = s.g.animate(kf, { duration: T * 1000, iterations: Infinity });
    }
    /** the visit's two shapes: a big one bleeding off a corner, a smaller one off the opposite corner */
    function placeBackdrops() {
      if (!bdDay) return;
      const m = Math.min(W, H);
      for (const [i, s] of sets.entries()) {
        const p = s.pick; if (!p) continue;
        p.size = (i ? 0.55 : 1.1) * m * (W > H ? 1 : 1.25);
        p.gx = 0.012 * m; p.gy = 0.009 * m;                 // the ghost's misregistration
        const [sx, sy] = p.corner, inset = (i ? 0.2 : 0.14) * p.size;
        const cx = sx ? W - inset : inset, cy2 = sy ? H - inset : inset;
        Object.assign(s.g.style, { left: (cx - p.size / 2).toFixed(1) + 'px', top: (cy2 - p.size / 2).toFixed(1) + 'px',
          width: p.size.toFixed(1) + 'px', height: p.size.toFixed(1) + 'px' });
        for (const cv of s.cvs) Object.assign(cv.style, { width: (p.size + p.gx).toFixed(1) + 'px', height: (p.size + p.gy).toFixed(1) + 'px' });
        drift(s, i);
      }
      toned = [null, null];
      paintBackdrop(performance.now());
    }
    async function loadBackdrops(date) {
      const list = await fetch('/backdrops/index.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => []);
      if (!list.length) return;
      const rnd = Print.rng(DEAL + 7919);                  // a new pair of shapes on every visit, like the stamps
      const first = list[Math.floor(rnd() * list.length)];
      const rest = list.filter(x => x !== first), second = rest.length ? rest[Math.floor(rnd() * rest.length)] : first;
      const corners = [[0, 1], [1, 1], [0, 0], [1, 0]], hero = corners[Math.floor(rnd() * 4)];
      const rots = [0, 1].map(() => Math.floor(rnd() * 360) - 180);
      bdDay = date;
      await Promise.all([first, second].map(async (it, i) => {
        const url = `/${it.file}?v=${it.v}`, img = new Image();
        img.src = url;
        try { await img.decode(); } catch { return; }
        const s = sets[i];
        s.pick = { corner: i ? hero.map(v => 1 - v) : hero, rot: rots[i], size: 0 }; s.img = img;
        placeBackdrops();
        if (live) requestAnimationFrame(() => s.g.classList.add('on'));
      }));
    }

    // ---- the title: the old name drifts up and away, the new one rises letter by letter out of its baseline
    let inked = false;
    function showTitle(c) {
      shown = c;
      const f = FEATURES[c];
      count.querySelector('span').textContent = `${two(c + 1)} — ${two(N)}`;
      if (!inked) return;
      for (const old of title.querySelectorAll('.line:not(.leaving)')) {
        old.classList.add('leaving');
        const letters = [...old.children];
        letters.forEach((l, i) => l.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-38%)', opacity: 0 }],
          { duration: 230, delay: i * 25, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }));
        setTimeout(() => old.remove(), 230 + letters.length * 25 + 20);
      }
      const line = el('span', 'line');
      for (const ch of f.cn) line.append(el('span', '', ch));
      title.append(line);
      [...line.children].forEach((l, i) => l.animate([{ transform: 'translateY(72%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 520, delay: 200 + i * 55, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
      setKicker(`${two(c + 1)} · ${f.en}`);
    }
    function setKicker(text) {
      const old = kicker.querySelector('span:not(.leaving)');
      if (old) { old.classList.add('leaving'); old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }); setTimeout(() => old.remove(), 240); }
      const s = el('span', '', text); kicker.append(s);
      s.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120, easing: 'ease-out', fill: 'backwards' });
    }

    // ---- opening a stamp
    let busy = false, soonT = 0;
    const current = () => slots[mod(Math.round(pos), N)];
    const soon = sl => { setKicker('即将发行 · COMING SOON'); clearTimeout(soonT); soonT = setTimeout(() => { if (current() === sl) setKicker(`${two(sl.index + 1)} · ${sl.en}`); }, 2000); };
    const activate = sl => {
      if (busy) return;
      if (!sl.live || !sl.st) return soon(sl);
      busy = true;
      setTimeout(async () => { try { await onOpen(sl); } finally { busy = false; } }, 120);   // let the press be felt first
    };
    const goTo = i => { to = Math.round(pos) + wrap(i - Math.round(pos)); kick(); };
    const step = k => { to = Math.round(to) + k; kick(); };

    // ---- input: drag (flicks carry on), wheel (one stamp per gesture), arrow keys, taps
    let down = null, samples = [];
    ring.addEventListener('pointerdown', e => {
      if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
      // a mouse drag is geared down: a hand on a mouse sweeps much further than it means to
      down = { x: e.clientX, y: e.clientY, pos, k: e.pointerType === 'mouse' ? 0.3 : 1, card: e.target.closest('.card') }; samples = [{ x: e.clientX, t: e.timeStamp }];
      ring.setPointerCapture(e.pointerId);
      const cur = current();
      if (down.card === cur.btn) presser.down(presser.point(cur.inner, e.clientX, e.clientY));
    });
    ring.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x;
      samples.push({ x: e.clientX, t: e.timeStamp }); if (samples.length > 6) samples.shift();
      if (!dragging && Math.hypot(dx, e.clientY - down.y) > 7) { dragging = true; presser.release(); }
      if (dragging) { pos = down.pos - dx * down.k / gap; to = pos; kick(); }
      else if (presser.held) presser.aim(presser.point(current().inner, e.clientX, e.clientY));
    });
    const up = e => {
      if (!down) return;
      const d = down; down = null; presser.release();
      if (dragging) {
        dragging = false;
        const a = samples[0], b = samples[samples.length - 1], v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;   // px per ms
        const flung = pos - v * d.k * 220 / gap;
        to = Math.max(Math.round(d.pos) - 3, Math.min(Math.round(d.pos) + 3, Math.round(flung)));
        kick();
        return;
      }
      if (e.type === 'pointercancel' || !d.card) return;
      const sl = slots.find(x => x.btn === d.card);
      if (sl === current()) activate(sl); else goTo(sl.index);
    };
    ring.addEventListener('pointerup', up);
    ring.addEventListener('pointercancel', up);
    let wheelAcc = 0, wheelUntil = 0;
    root.addEventListener('wheel', e => {
      e.preventDefault();
      if (busy) return;
      const dlt = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY, now = e.timeStamp;
      if (Math.abs(dlt) >= 50) {                            // a mouse wheel notch
        if (now > wheelUntil) { step(Math.sign(dlt)); wheelUntil = now + 280; }
        return;
      }
      // a trackpad: one stamp per gesture, and the gesture ends when its events stop
      if (now > wheelUntil) wheelAcc = 0;
      const fresh = wheelAcc !== null;
      if (fresh) { wheelAcc += dlt; if (Math.abs(wheelAcc) > 30) { step(Math.sign(wheelAcc)); wheelAcc = null; } }
      wheelUntil = now + 160;
    }, { passive: false });
    addEventListener('keydown', e => {
      if (busy || !document.body.classList.contains('daily-home') || e.target.closest?.('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); presser.down(); presser.release(); activate(current()); }
    });

    // ?fps: the frame rate and the slowest frame of each second, small in a corner (for trying it on a phone)
    if (FPS) {
      const meter = el('p', 'home-fps'); document.body.append(meter);
      let n = 0, worst = 0, from = 0, prev = 0;
      const tick = t => {
        if (prev) { worst = Math.max(worst, t - prev); n++; }
        prev = t; from = from || t;
        if (t - from >= 1000) { meter.textContent = `${Math.round(n * 1000 / (t - from))} FPS · MAX ${Math.round(worst)} MS`; n = 0; worst = 0; from = t; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    /** prints the visit's stamps under the loading screen, the middle one first and then outwards, with a breath between
     *  them so the loader can paint; onEach(i, canvas) hands each one to the loader's slots */
    async function fill(plans, { date, term, render, onEach, breath }) {
      slots.forEach((sl, i) => { sl.st = plans[i]; });
      root.querySelector('.home-date').textContent = `${(date || '').replace(/-/g, '.')} · ${term}`;
      const shapes = bdDay !== date && date ? loadBackdrops(date) : null;
      const order = slots.slice().sort((p, q) => Math.abs(wrap(p.index - pos)) - Math.abs(wrap(q.index - pos)));
      for (const sl of order) {
        if (!sl.printed) {
          // the slot's own canvas is the printed stamp (a second copy of every stamp was ~1 MB each a phone can't spare)
          put(sl.cv, render(sl.st, sc)); sl.printed = sl.cv; contact(sl);
          tones(sl);                                        // the desk colour it gives, worked out now rather than mid-turn
        }
        if (onEach) onEach(sl.index, sl.printed);
        if (breath) await breath();
      }
      await shapes;
    }
    /** the loading screen lifts: the title rises letter by letter, the desk takes its colour, the paper shapes fade in */
    function show() {
      if (live) return;
      live = true; inked = true;
      document.body.classList.add('home-inked'); showTitle(mod(Math.round(pos), N));
      tintFrom = performance.now();
      for (const s of sets) if (s.pick) s.g.classList.add('on');
      float(); kick();
    }

    const find = key => slots.find(sl => sl.key === key);
    /** turn the carousel to a stamp at once (the home is still hidden when this is called) */
    function reveal(sl) { pos = to = Math.round(pos) + wrap(sl.index - Math.round(pos)); tilt = 0; frame(performance.now(), true); }
    /** a slot takes what its page made (the router, on the way home): onto its own canvas, with its contact shadow */
    function repaint(sl) {
      if (sl.printed && sl.printed !== sl.cv && sl.cv.width) sl.cv.getContext('2d').drawImage(sl.printed, 0, 0, sl.cv.width, sl.cv.height);
      contact(sl);
    }
    return { slots, find, fill, show, reveal, repaint, scale: sc };
  }

  /** a copy of a stamp flies from one screen rect to another. Leaving, it lifts first; coming home, it settles into its
   *  place. Resolves when it lands; the caller removes it (after fading it out if it wants). */
  function fly(src, from, to, { lift = true, duration = 820 } = {}) {
    const f = el('div', 'flyer'), cv = el('canvas'), sh = el('div', 'flyer-shadow');
    put(cv, src); f.append(sh, cv);
    // the stamp keeps its own shape: both ends are fitted inside the boxes they are given, centred
    const ar = src.width / src.height;
    const fit = r => { const w = Math.min(r.width, r.height * ar), h = w / ar; return new DOMRect(r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h); };
    from = fit(from); to = fit(to);
    const box = lift ? to : from;                           // the element is laid out at the big end, and scaled down
    Object.assign(f.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
    document.body.append(f);
    const small = lift ? from : to;
    const k = small.width / box.width;
    const dx = small.left + small.width / 2 - (box.left + box.width / 2), dy = small.top + small.height / 2 - (box.top + box.height / 2);
    const inSlot = `translate(${dx}px, ${dy}px) scale(${k})`;
    const lifted = `translate(${dx}px, ${dy - small.height * 0.05}px) scale(${k * 1.04}) rotate(-2deg)`;
    if (reduce) {
      f.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'forwards' });
      return new Promise(r => setTimeout(() => r(f), 260));
    }
    const out = [
      { transform: inSlot, easing: 'cubic-bezier(.3,0,.2,1)' },
      { transform: lifted, offset: 0.24, easing: 'cubic-bezier(.45,0,.2,1)' },
      { transform: 'none' },
    ];
    const home = [
      { transform: 'none', easing: 'cubic-bezier(.45,0,.2,1)' },
      { transform: lifted, offset: 0.76, easing: 'cubic-bezier(.3,0,.2,1)' },
      { transform: inSlot },
    ];
    const a = f.animate(lift ? out : home, { duration, fill: 'forwards' });
    sh.animate(lift ? [{ opacity: 0.3 }, { opacity: 1, offset: 0.24 }, { opacity: 0.55 }] : [{ opacity: 0.55 }, { opacity: 1, offset: 0.76 }, { opacity: 0.3 }],
      { duration, fill: 'forwards' });
    return a.finished.then(() => f);
  }

  return { FEATURES, DEAL, plan, mount, fly };
})();
