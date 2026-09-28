// Shared bits for the app's pages: header, status line, the flip card a stamp prints onto, paper sounds (with a buzz on
// phones), the stamp behind a seed, saving / sharing a picture. Nothing here ever calls a model: every word, emblem and
// leaflet was made ahead of time.
const Kit = (() => {
  const TAU = Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  /** resolves once the next frame is out: a page built on the tap does its heavy drawing after this, so the stamp's
   *  flight (started in that frame, then run by the compositor) never waits for it (100 ms at most in a hidden tab) */
  const afterFrame = () => new Promise(r => { let go = () => { go = () => {}; setTimeout(r, 0); }; requestAnimationFrame(() => go()); setTimeout(() => go(), 100); });
  const two = n => String(n).padStart(2, '0');
  const put = (cv, src) => { cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); return cv; };
  const visible = root => root.classList.contains('on') && document.body.classList.contains('daily-layer') && !document.hidden;
  const localDate = (d = new Date()) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const dayNo = date => { const [y, m, d] = date.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
  const addDays = (date, n) => { const [y, m, d] = date.split('-').map(Number); return localDate(new Date(y, m - 1, d + n)); };
  const hash = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  /** page header: a small kicker over the name, like the home's; number and names come from web/app/features.js */
  function head(root, key) {
    const f = Features.byKey(key) || { cn: key, en: key.toUpperCase() };
    const h = el('div', 'kit-head', `<p class="kit-kicker">${two(Features.no(key))} · ${f.en}</p><h2>${f.cn}</h2>`);
    root.append(h);
    return h;
  }
  // A page may be closed (web/app/router.js keeps the six last opened): whatever it hooks outside its own section
  // (window, document, timers) is listed here against the section and undone by close(root), or the old page's
  // canvases stay alive behind a listener
  const hooks = new WeakMap();
  const hold = (root, off) => { if (!hooks.has(root)) hooks.set(root, []); hooks.get(root).push(off); };
  function on(root, target, type, fn, opts) { target.addEventListener(type, fn, opts); hold(root, () => target.removeEventListener(type, fn, opts)); }
  function close(root) {
    for (const off of hooks.get(root) || []) { try { off(); } catch (e) { console.error(e); } }
    hooks.delete(root);
  }

  /** what every page starts with: its header, its status line, and the screen's size. layout(P) runs on resize while the
   *  page is on show; a hidden page is laid out again when it next comes on (wrap its api with P.api()).
   *  P.measure() -> {W, H, phone (upright), short (a phone on its side)}. Listeners on the window or the document go
   *  through Kit.on(root, ...), timers through Kit.hold(root, off), so closing the page undoes them. */
  function page(root, key, layout = null) {
    const P = { head: head(root, key), status: status(root), W: 0, H: 0, phone: false, short: false, stale: false };
    P.measure = () => { P.W = innerWidth; P.H = innerHeight; P.phone = P.W < P.H; P.short = !P.phone && P.H < 560; return P; };
    P.layout = () => { P.stale = false; if (layout) layout(P); };
    on(root, window, 'resize', () => { if (visible(root)) P.layout(); else P.stale = true; });
    P.api = api => { const enter = api.enter; api.enter = () => { if (P.stale) P.layout(); if (enter) enter(); }; return api; };
    return P;
  }
  /** a page's clock: fn(dt, t) on every frame while the page is on show (dt in ms, at most 50, 16 on the first frame
   *  back). It sleeps while the page is hidden, so a page left behind costs the home nothing: a frame requested for
   *  nothing keeps the phone's main thread (and every running animation's style) busy */
  function loop(root, fn) {
    let raf = 0, last = 0;
    const tick = t => {
      raf = 0;
      if (!visible(root)) { last = 0; return; }
      const dt = last ? Math.min(50, t - last) : 16; last = t;
      raf = requestAnimationFrame(tick);
      fn(dt, t);
    };
    const wake = () => { if (!raf && visible(root)) raf = requestAnimationFrame(tick); };
    const seen = [root, document.body].map(target => { const o = new MutationObserver(wake); o.observe(target, { attributes: true, attributeFilter: ['class'] }); return o; });
    on(root, document, 'visibilitychange', wake);
    hold(root, () => { seen.forEach(o => o.disconnect()); cancelAnimationFrame(raf); raf = 0; });
    wake();
  }
  /** one line of status under the work; flash() shows a note for a while, then the line goes back */
  function status(root) {
    const p = el('p', 'kit-status'); root.append(p);
    let base = '', t = 0;
    return {
      el: p,
      set(text) { base = text; clearTimeout(t); p.classList.remove('flash'); p.textContent = text; },
      flash(text, ms = 2200) { clearTimeout(t); p.textContent = text; p.classList.add('flash'); t = setTimeout(() => { p.classList.remove('flash'); p.textContent = base; }, ms); },
    };
  }

  // ---- sound: band-passed noise for paper, a low knock for a rubber stamp; phones also buzz
  let actx = null, noise = null;
  function audio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return actx; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      noise = actx.createBuffer(1, Math.round(actx.sampleRate * 0.6), actx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { actx = null; }
    return actx;
  }
  const buzz = ms => { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* not allowed yet */ } };
  function burst({ f = 2400, q = 1, dur = 0.02, vol = 0.05, attack = 0.002 } = {}) {
    if (!actx || !noise) return;
    const a = actx, t = a.currentTime, src = a.createBufferSource(), bp = a.createBiquadFilter(), gn = a.createGain();
    src.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + attack); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(gn).connect(a.destination); src.start(t, Math.random() * 0.4, dur + 0.03);
  }
  /** a perforation bridge giving way (big: the stamp coming free) */
  function crackle(big = false) {
    buzz(big ? 14 : 3);
    burst(big ? { f: 1500, q: 0.8, dur: 0.16, vol: 0.11 } : { f: 1700 + Math.random() * 2800, q: 0.6 + Math.random() * 0.9, dur: 0.014 + Math.random() * 0.02, vol: 0.03 + Math.random() * 0.045 });
  }
  /** a rubber stamp hitting paper: a dull knock, heavier with more weight (0..1); still: no buzz on a phone */
  function thump(weight = 0.5, still = false) {
    if (!still) buzz(Math.round(12 + weight * 22));
    if (!actx) return;
    const a = actx, t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150 + Math.random() * 30, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 + weight * 0.14, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.16);
    burst({ f: 700 + Math.random() * 300, q: 0.7, dur: 0.05, vol: 0.05 + weight * 0.05 });
  }
  /** paper sliding / a squeegee: a soft hiss */
  function rustle(vol = 0.03, dur = 0.12) { burst({ f: 3200 + Math.random() * 1600, q: 0.5, dur, vol, attack: dur * 0.3 }); }
  /** a bicycle bell: two strikes of a small bell (a few inharmonic partials, each dying away) */
  function bell() {
    buzz(6);
    if (!actx) return;
    const a = actx;
    for (const [at, vol] of [[0, 0.09], [0.16, 0.07]]) {
      const t = a.currentTime + at;
      for (const [f, v, d] of [[2380, 1, 0.9], [3410, 0.55, 0.6], [5230, 0.3, 0.35], [7050, 0.15, 0.2]]) {
        const o = a.createOscillator(), g = a.createGain();
        o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02);
      }
    }
  }

  // this visit's deal (Home.DEAL): stamps come out new on every reload, and stay put while the page is open
  const visit = Home.DEAL;
  /** the stamp behind a seed in this visit: a library word, palette and layout drawn from it */
  function stampFor(seed, words, palettes, no, date) {
    const rnd = Print.rng(hash(seed + '|' + visit));
    const w = words.length ? words[Math.floor(rnd() * words.length)] : { phrase: '今天', en: 'today' };
    return { phrase: w.phrase, en: w.en || '', no, date, palette: palettes[Math.floor(rnd() * palettes.length)].name, layout: 'gen',
      seed: Math.floor(rnd() * 1e9), shift: Math.floor(rnd() * 4), emblem: 'auto', misregister: true, grain: true, side: 'front' };
  }

  /** n of this visit's home stamps, each a different word, drawn by seed. They are printed already and kept by
   *  Press.makeFront, so a page showing them only scales a copy down: a phone never decodes a fresh set of 1024 px plates
   *  per stamp (web/app/assets.js). Pages that deal many stamps take these. */
  function visitStamps(deps, seed, n) {
    const seen = new Set(), pool = (deps.homePlans || []).filter(s => !seen.has(s.phrase) && seen.add(s.phrase));
    const rnd = Print.rng(hash(seed + '|' + visit)), out = [];
    while (out.length < n && pool.length) out.push({ ...pool.splice(Math.floor(rnd() * pool.length), 1)[0] });
    while (out.length < n) out.push(stampFor(seed + '|' + out.length, deps.words, deps.palettes, out.length + 1, deps.date));
    return out;
  }

  /** a stamp-shaped card that turns over: the face shown at even turns is `back` (the gum side, then the leaflet), the
   *  one at odd turns is `front`. print(st) inks the front plate by plate and puts the leaflet on the back. */
  function card(parent, deps, { w, h, cls = '' } = {}) {
    const box = el('div', 'kit-card ' + cls), inner = el('div', 'kit-card-in'), back = el('canvas', 'kit-face back'), front = el('canvas', 'kit-face front');
    inner.append(back, front); box.append(inner); parent.append(box);
    let turns = 0;
    const c = {
      box, inner, back, front, ready: false,
      get turns() { return turns; },
      place(cx, cy, W, H) { Object.assign(box.style, { left: cx - W / 2 + 'px', top: cy - H / 2 + 'px', width: W + 'px', height: H + 'px' }); c.w = W; c.h = H; },
      turn(n, instant = false) {
        turns = n;
        // WebKit ignores backface-visibility on a face with a filter (the shadow): the face turned away is hidden by hand,
        // halfway through the turn (kit.css)
        if (instant) { box.classList.add('instant'); inner.style.transition = 'none'; }
        box.classList.toggle('odd', n % 2 === 1);
        inner.style.transform = `rotateY(${turns * 180}deg)`;
        if (instant) { void inner.offsetWidth; inner.style.transition = ''; box.classList.remove('instant'); }
      },
      scale() { return clamp((c.h || h) * Math.min(2, devicePixelRatio || 1) / Stamp.BH, 0.3, 0.9); },
      /** print a stamp state onto the front (plate by plate), then its leaflet onto the back */
      async print(st, { emblem, D = 800, backToo = true } = {}) {
        c.ready = false;
        await deps.loadLeaflet(st.phrase);
        const sc = c.scale(), fr = deps.makeFront(st, sc, { stages: true, ...(emblem !== undefined ? { emblem } : {}) });
        put(front, fr.stages.blank);
        await new Promise(res => deps.printIn(front, fr.stages, { D, onDone: res }));
        if (backToo) put(back, deps.makeBack(st, sc, null));
        c.ready = true; c.st = st;
        return c;
      },
      /** a stamp the home already printed (Kit.visitStamps): its kept print, scaled down, seeps onto a blank at once
       *  instead of plate by plate, so none of its plates is decoded again */
      async printCopy(st, { D = 1100 } = {}) {
        c.ready = false;
        await deps.loadLeaflet(st.phrase);
        const sc = Math.min(c.scale(), 0.36), fr = deps.makeFront(st, sc), blank = Stamp.blank(sc, 7);
        front.width = fr.width; front.height = fr.height;
        const g = front.getContext('2d');
        await new Promise(res => {
          const t0 = performance.now();
          const f = t => {
            const k = Math.min(1, (t - t0) / D), e = k * k * (3 - 2 * k);
            g.globalAlpha = 1; g.clearRect(0, 0, fr.width, fr.height); g.drawImage(blank, 0, 0); g.globalAlpha = e; g.drawImage(fr, 0, 0);
            if (k < 1) requestAnimationFrame(f); else { g.globalAlpha = 1; res(); }
          };
          requestAnimationFrame(f);
        });
        put(back, deps.makeBack(st, sc, null));
        c.ready = true; c.st = st;
        return c;
      },
      /** pictures instead of a stamp state (collages, prints, postcards) */
      show(frontSrc, backSrc) { put(front, frontSrc); if (backSrc) put(back, backSrc); c.ready = true; },
    };
    if (w) c.place(0, 0, w, h);
    box.addEventListener('click', () => { if (c.ready && !c.noFlip) c.turn(turns + 1); });
    return c;
  }
  /** the gum side of a stamp: warm paper with a faint diagonal watermark seal */
  function gum(sc, seed) {
    const b = Stamp.blank(sc, seed), g = b.getContext('2d'), w = b.width, h = b.height;
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(238,224,190,.22)'; g.fillRect(0, 0, w, h); g.restore();
    watermark(g, w / 2, h / 2, w * 0.2);
    return b;
  }
  function watermark(g, x, y, r, rot = -0.52) {
    const ink = 'rgba(128,104,66,.15)';
    g.save(); g.translate(x, y); g.rotate(rot); g.strokeStyle = ink; g.lineWidth = Math.max(0.6, r * 0.05);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.84, 0, TAU); g.stroke();
    U.drawCentered(g, 0, 0, '每日邮政', U.font('cjk_small', Math.max(6, Math.round(r * 0.33))), ink); g.restore();
  }

  /** a stamp of a page's own making (a paper cut, a kaleidoscope…): art(g, w, h) paints the printed field; a postmark,
   *  the issuer on an askew label and the word print over it in that order, so the type is always on top.
   *  {sc, pal, phrase, en, date, no, kicker, seed, labelFill, art} -> a perforated canvas at scale sc */
  function issue({ sc = 0.6, pal, phrase, en = '', date, no = 1, kicker = '', seed = 1, labelFill, art }) {
    const F = Layouts.F, out = Stamp.blank(sc, seed), W = out.width, H = out.height, rnd = Print.rng(seed * 7 + 3);
    const lay = U.canvas(W, H), g = lay.getContext('2d');
    const fw = Math.round((F.x1 - F.x0) * sc), fh = Math.round((F.y1 - F.y0) * sc), field = U.canvas(fw, fh), f = field.getContext('2d');
    art(f, fw, fh); U.grain(f, fw, fh, 0.22, 5 + seed % 7);
    g.drawImage(field, F.x0 * sc, F.y0 * sc);
    // the postmark, top right: dark ink on light print, pale where the art under it is dark
    const px = F.x1 - 330, py = F.y0 + 240, probe = U.canvas(8, 8).getContext('2d', { willReadFrequently: true });
    probe.drawImage(field, (px - 150 - F.x0) * sc, (py - 150 - F.y0) * sc, 300 * sc, 300 * sc, 0, 0, 8, 8);
    const d = probe.getImageData(0, 0, 8, 8).data; let lum = 0;
    for (let i = 0; i < d.length; i += 4) lum += U.lum(U.rgbToHex([d[i], d[i + 1], d[i + 2]])) / 64;
    Stamp.postmark(g, px * sc, py * sc, 150 * sc, sc, { no, date }, -0.22 + (rnd() - 0.5) * 0.2, Math.floor(rnd() * 1e5), lum < 0.3);
    // the issuer on a label stuck on askew, top left
    const L = { s: sc, ink: pal.ink, paper: Stamp.PAPER, TP: g, TK: g, K: g };
    const fr = Layouts.label(L, 330, 200, 470, 130, ['tape', 'swipe', 'balloon'][Math.floor(rnd() * 3)], labelFill || pal.c[1], rnd);
    Layouts.inLabel(L, g, 330, 200, fr, c => {
      U.drawMixed(c, 0, -14 * sc, `每日邮政 · ${(date || '').replace(/-/g, '.')}`, 'caps', 'cjk_small', Math.round(32 * sc), pal.ink, 3 * sc, 1, 'center');
      if (kicker) U.drawTracked(c, 0, 24 * sc, kicker, U.font('caps_med', Math.round(18 * sc)), pal.ink, 5 * sc, 'center');
    });
    // the word, big along the foot, paper-white with an offset key shadow (a Warhol screen's misprint)
    const word = U.hasCjk(phrase) ? phrase : phrase.toUpperCase(), n = Math.max(2, [...word].length), fs = Math.round(Math.min(190, 860 / n) * sc);
    const right = rnd() < 0.5, x = right ? (F.x1 - 50) * sc : (F.x0 + 50) * sc, y = (F.y1 - 70) * sc - fs * 0.5;
    const ink = '#F4EEDF';
    g.save(); g.shadowColor = pal.ink; g.shadowOffsetX = 7 * sc; g.shadowOffsetY = 7 * sc;
    U.drawMixed(g, x, y, word, 'phrase_latin', 'phrase_cjk', fs, ink, 4 * sc, 1, right ? 'right' : 'left');
    if (en) U.drawTracked(g, x, y - fs * 0.62 - 16 * sc, en.toUpperCase(), U.font('caps', Math.round(26 * sc)), ink, 6 * sc, right ? 'right' : 'left');
    g.restore();
    const o = out.getContext('2d'); o.save(); o.globalCompositeOperation = 'source-atop'; o.drawImage(lay, 0, 0); o.restore();
    lay.width = lay.height = field.width = field.height = 0;
    return out;
  }

  // ---- cancellations (盖戳). A mark is {type: round|wave|seal, x, y (stamp units, 1200 x 1500), rot, weight 0..1, seed,
  // ghost}; they print only on the paper of the stamp, never beside it
  const INK = '#26262b', RED = '#B0172F';
  // the seal carved in 刻章 (localStorage ds-seal: {text, mode, img: a small print as a data URL}), for 盖戳 to strike
  let mine = null;
  function mySeal(rec) {
    if (rec === undefined && !mine) { try { rec = JSON.parse(localStorage.getItem('ds-seal') || 'null'); } catch (e) { rec = null; } if (!rec) return null; }
    if (rec) { const img = new Image(); img.src = rec.img; mine = { ...rec, image: img }; }
    return mine && mine.image.complete && mine.image.naturalWidth ? mine : null;
  }
  mySeal();                                                     // decoded ahead, so the first strike can use it
  function drawMark(g, m, s, spec) {
    const rnd = Print.rng(m.seed || 1), a = (0.55 + 0.45 * m.weight) * (m.ghost ? 0.45 : 1);
    const x = m.x * s, y = m.y * s;
    if (m.type === 'mine') {                                    // the carved seal, a little uneven each time
      const me = mySeal(); if (!me) return;
      const size = 300 * s;
      g.save(); g.globalAlpha = Math.min(1, a * 1.05); g.globalCompositeOperation = 'multiply';
      g.translate(x, y); g.rotate(m.rot * 0.25); g.drawImage(me.image, -size / 2, -size / 2, size, size); g.restore();
      return;
    }
    if (m.type === 'round') {
      const T = U.canvas(g.canvas.width, g.canvas.height); Stamp.postmark(T.getContext('2d'), x, y, 150 * s, s, spec, m.rot, m.seed);
      g.save(); g.globalAlpha = Math.min(1, a / 0.8); g.globalCompositeOperation = 'multiply'; g.drawImage(T, 0, 0); g.restore();
      return;
    }
    const L = U.canvas(Math.ceil(900 * s), Math.ceil(520 * s)), p = L.getContext('2d'), ox = L.width / 2, oy = L.height / 2;
    if (m.type === 'wave') {                                   // killer bars: five waves, never laid level
      p.strokeStyle = INK; p.lineWidth = 9 * s; p.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const y0 = oy + (i - 2) * 50 * s; p.beginPath();
        for (let xx = ox - 360 * s; xx < ox + 360 * s; xx += 3 * s) p.lineTo(xx, y0 + Math.sin((xx - ox) / (34 * s) + i * 0.3) * 14 * s);
        p.stroke();
      }
    } else {                                                    // a little red 已阅, brushed, in an oval
      p.strokeStyle = RED; p.fillStyle = RED; p.lineWidth = 7 * s;
      p.beginPath(); p.ellipse(ox, oy, 190 * s, 118 * s, 0, 0, TAU); p.stroke();
      p.lineWidth = 3 * s; p.beginPath(); p.ellipse(ox, oy, 168 * s, 98 * s, 0, 0, TAU); p.stroke();
      p.save(); p.translate(ox, oy); p.transform(1, 0, -0.18, 1, 0, 0);
      U.drawCentered(p, 0, -4 * s, '已阅', U.font('brand_cjk', Math.round(118 * s)), RED); p.restore();
      U.drawTracked(p, ox, oy + 82 * s, (spec.date || '').replace(/-/g, '.'), U.font('caps', Math.round(20 * s)), RED, 4 * s, 'center');
    }
    // stamp-pad ink never lands evenly
    p.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) { p.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.6})`; p.beginPath(); p.arc(rnd() * L.width, rnd() * L.height, (0.8 + rnd() * 2.6) * s, 0, TAU); p.fill(); }
    const fade = p.createLinearGradient(0, 0, L.width, L.height * 0.5);
    fade.addColorStop(0, `rgba(0,0,0,${0.35 * (1 - m.weight)})`); fade.addColorStop(1, `rgba(0,0,0,${0.15 + 0.45 * (1 - m.weight)})`);
    p.fillStyle = fade; p.fillRect(0, 0, L.width, L.height);
    g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'multiply'; g.translate(x, y); g.rotate(m.rot); g.drawImage(L, -ox, -oy); g.restore();
  }
  /** marks onto a stamp canvas (ctx), clipped to its paper */
  function drawMarks(ctx, marks, s, st) {
    const c = ctx.canvas, t = U.canvas(c.width, c.height), g = t.getContext('2d');
    for (const m of marks) drawMark(g, m, s, { no: st.no, date: m.date || st.date });
    g.globalCompositeOperation = 'destination-in'; g.drawImage(c, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(t, 0, 0); ctx.restore();
  }

  // ---- a photo split into Warhol's plates (N x N, cropped square a little high, where faces sit): the black key, the
  // mid and light tones as soft hand-cut shapes, and a hot accent where the photo is strongly red/pink (lips, cheeks)
  /** -> {photo: true, key, mid, light, accent}: alpha masks for Print.tinted */
  function smooth(N, mask, blur, thr, grain = 0) {
    const c = U.canvas(N, N), g = c.getContext('2d'), id = g.createImageData(N, N);
    for (let i = 0; i < N * N; i++) id.data[i * 4 + 3] = mask[i] ? 255 : 0;
    g.putImageData(id, 0, 0);
    const b = U.canvas(N, N), bg = b.getContext('2d'); bg.filter = `blur(${blur}px)`; bg.drawImage(c, 0, 0);
    const d = bg.getImageData(0, 0, N, N), o = g.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const a = d.data[i * 4 + 3] / 255 + (grain ? (Math.random() - 0.5) * grain : 0); o.data[i * 4 + 3] = a > thr ? 255 : 0; }
    g.putImageData(o, 0, 0); return c;
  }
  function photoPlates(img, N = 420) {
    const c = U.canvas(N, N), g = c.getContext('2d'), w = img.naturalWidth || img.videoWidth || img.width, h = img.naturalHeight || img.videoHeight || img.height, s = Math.min(w, h);
    g.drawImage(img, (w - s) / 2, (h - s) / 2 * 0.6, s, s, 0, 0, N, N);        // square, a little high: faces sit in the top half
    const d = g.getImageData(0, 0, N, N).data, L = new Float32Array(N * N), acc = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      const r = d[i * 4] / 255, gg = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      L[i] = 0.3 * r + 0.59 * gg + 0.11 * b;
      const sat = mx ? (mx - mn) / mx : 0; let hue = 0;
      if (mx !== mn) hue = mx === r ? ((gg - b) / (mx - mn) + 6) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
      hue *= 60; acc[i] = sat > 0.42 && (hue < 22 || hue > 335) && L[i] > 0.18 && L[i] < 0.8 ? 1 : 0;
    }
    const sorted = Float32Array.from(L).sort(), p = q => sorted[Math.floor(q * (sorted.length - 1))];
    const lo = p(0.26), hi = p(0.62);
    const key = new Uint8Array(N * N), mid = new Uint8Array(N * N), light = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) { key[i] = L[i] < lo ? 1 : 0; light[i] = L[i] > hi ? 1 : 0; mid[i] = !key[i] && !light[i] ? 1 : 0; }
    return { photo: true, key: smooth(N, key, 1.2, 0.5, 0.25), mid: smooth(N, mid, 6, 0.45), light: smooth(N, light, 6, 0.5), accent: smooth(N, acc, 3, 0.55) };
  }

  /** hand a picture over: the share sheet on phones that can take files, a download everywhere else */
  async function save(items) {
    const blobs = await Promise.all(items.map(it => new Promise(r => it.cv.toBlob(b => r(new File([b], it.name, { type: 'image/png' })), 'image/png'))));
    if (navigator.canShare && matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: blobs })) {
      try { await navigator.share({ files: blobs, title: '每日一枚' }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    }
    for (const f of blobs) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000); await wait(250);
    }
    return 'saved';
  }
  const blobOf = cv => new Promise(r => cv.toBlob(r, 'image/png'));
  const imageOf = blob => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = URL.createObjectURL(blob); });

  // ---- debugging: while the app is being tried out, anything rationed (one tear a day, five coins…) gets a button that
  // gives it back at once. They all hang off DEBUG, so switching it off hides every one of them.
  const DEBUG = true;
  /** a quiet row of desk buttons in the page's lower right corner (on a phone: above the status line); add(label, fn) */
  function debugRow(root) {
    const row = el('div', 'kit-debug');
    if (!DEBUG) row.hidden = true;
    root.append(row);
    return {
      el: row,
      add(label, fn) { const b = button(row, `<small>调试 ·</small>${label}`); b.onclick = fn; return b; },
    };
  }

  /** a round button with a label; never a boxed rectangle */
  function button(parent, label, cls = '') { const b = el('button', 'kit-btn ' + cls, label); b.type = 'button'; parent.append(b); return b; }

  return { DEBUG, debugRow, TAU, reduce, el, clamp, wait, afterFrame, two, put, visible, loop, on, hold, close, localDate, dayNo, addDays, hash, head, status, audio, buzz, crackle, thump, rustle, bell,
    visit, visitStamps, stampFor, card, issue, page, photoPlates, gum, watermark, save, blobOf, imageOf, button, drawMark, drawMarks, mySeal,
    thumbs: {} };   // thumbs[kind](entry, scale, deps): how the album draws works that are not plain stamps
})();
