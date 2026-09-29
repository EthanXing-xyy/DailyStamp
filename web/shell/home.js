// 首页: an endless carousel of the day's stamps (after jfa-awards.snp.agency's index). The one in the middle is big, its
// neighbours shrink and are cut off by the screen edge; drag, wheel or arrow keys slide it round, the function's name
// rises in letter by letter under it. Every visit deals a fresh carousel: word, palette and layout of each stamp, and the
// desk's paper shapes, are new on every reload (`?homeseed=N` pins one deal, for screenshots).
// Tapping the middle one presses it (Win8), then it lifts off and flies to its page. The stamps are all printed while
// the loading screen is up (fill), so the carousel never draws a stamp while it moves; show() lifts the titles in.
// Phones: nothing here repaints while the wheel turns. The stamps' shadows are bitmaps drawn once, so are the desk and
// every word (web/shell/type.js), a stamp off the screen is off the page; the frame loop only moves layers: the wheel
// while it turns, and the floating of the stamps on the screen, 30 poses a second (`?fps` shows the frame rate).
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
  // its own period; its shadow stays on the desk, fainter, softer and further off the higher the stamp floats. An aged
  // stamp's shadow is its own (drawn with the kit, lying right under it): at the bottom of its bob the stamp touches it.
  // The frame loop poses each stamp on the screen t s into the floating (a looping compositor animation stood still on
  // an iPhone whenever nothing else on the page changed, and only woke when the wheel turned)
  const PERIODS = [6.2, 49.6 / 6, 49.6 / 7, 49.6 / 9, 49.6 / 5];   // bob, sway, turn, tip, lean: about 6.2 8.3 7.1 5.5 9.9 s
  function pose(sl, t) {
    const w = k => Math.sin(t * 2 * Math.PI / PERIODS[k] + sl.ph[k]);
    const fy = 14 * w(0), fx = 5 * w(1), rz = 2 * w(2), rx = 5 * w(3), ry = 6 * w(4);
    const lift = (14 - fy) / 28;                            // 0 resting low .. 1 at the top of its bob
    sl.inner.style.transform = `translate(${fx.toFixed(2)}px, ${fy.toFixed(2)}px) rotate(${rz.toFixed(3)}deg) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    const s = sl.shadow.style;
    if (sl.aged) {
      s.transform = `translate(${(fx + lift * 8).toFixed(2)}px, ${(14 + lift * 8).toFixed(2)}px) rotate(${rz.toFixed(3)}deg) scale(${(1 + lift * 0.04).toFixed(4)})`;
      s.opacity = (1 - lift * 0.4).toFixed(3);
    } else {
      s.transform = `translate(${(fx * 0.5 + 6 + lift * 10).toFixed(2)}px, ${(12 + lift * 16).toFixed(2)}px) rotate(${(rz * 0.7).toFixed(3)}deg) scale(${(0.95 + lift * 0.09).toFixed(4)})`;
      s.opacity = (0.62 - lift * 0.3).toFixed(3);
    }
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
    const top = el('div', 'home-top', '<span class="home-brand"></span><span class="home-date"></span>');
    const ring = el('div', 'carousel');
    const kicker = el('p', 'home-kicker'), title = el('h2', 'home-title');
    const count = el('div', 'home-count', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle class="arc" cx="12" cy="12" r="9" pathLength="100"/></svg><span></span>');
    // the desk: kraft paper with a few little pictures on it, painted once into one canvas (web/shell/desk.js)
    const bg = el('div', 'home-bg'), deskCv = el('canvas'), arcEl = count.querySelector('.arc');
    bg.append(deskCv);
    root.append(bg, top, ring, kicker, title, count);
    root.tabIndex = 0;
    const slots = FEATURES.map((f, i) => {
      const btn = el('div', 'card'), shadow = el('canvas', 'card-shadow'), inner = el('div', 'card-in');
      const contact = el('canvas', 'card-contact'), cv = el('canvas', 'card-face');
      btn.setAttribute('role', 'button'); btn.setAttribute('aria-label', f.cn);
      inner.append(contact, cv); btn.append(shadow, inner); ring.append(btn);
      // each stamp drifts on its own phases, so the eleven never move in step
      const ph = [0, 1, 2, 3, 4].map(k => (i * 2.399 + k * 1.913) % (2 * Math.PI));
      // aged: the stamp as the home shows it, handled for years (web/shell/age.js), on its contact canvas
      return { ...f, index: i, btn, shadow, inner, contact, cv, st: null, printed: null, ph, far: null, tr: '', op: '', z: '',
        aged: null, agedOf: null };
    });

    // ---- sizes. The stamps ride the rim of a big wheel whose hub sits below the screen: the further out, the lower
    // and the more tipped. Wide screens show five (the outer two cut by the edge), phones three (half a neighbour each side).
    // Both leave the paper at the foot and in the upper corners to the desk's pictures.
    let W = 0, H = 0, cw = 0, ch = 0, gap = 0, cy = 0, R = 0, fadeFrom = 0, gone = 0, ANG = [0, 0], SCL = [1, 1];
    let typed = false, titleSize = 30, typeKey = '', typeT = 0;   // the words: printed yet, the title's size, what they were printed for
    function layout() {
      W = innerWidth; H = innerHeight;
      const wide = W > H;
      if (wide) {
        const n = W / H > 2.05 ? 3 : 2;                     // ultrawide screens show seven
        SCL = n === 3 ? [1, 0.74, 0.56, 0.46, 0.4] : [1, 0.74, 0.56, 0.46];
        // the outer pair must sit half off the screen, as on the reference: with the height-led size, open the paper
        // between the stamps until their middles land on the edges; if even the narrowest gap is too wide, shrink them.
        // A flat wheel and stamps a little up the screen: the foot of the desk is left to its pictures
        R = W * 2.0;
        const angles = (w, g) => {
          const t = [0];
          for (let k = 1; k < SCL.length; k++) t.push(t[k - 1] + 2 * Math.asin(Math.min(1, ((SCL[k - 1] + SCL[k]) * w / 2 + g) / (2 * R))));
          return t;
        };
        const edgeAt = (w, g) => R * Math.sin(angles(w, g)[n]), half = W / 2;
        let w = H * 0.50 * 0.8, g = Math.max(18, w * 0.05);
        if (edgeAt(w, g) > half) {
          let lo = 40, hi = w;
          for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; edgeAt(m, Math.max(18, m * 0.05)) > half ? hi = m : lo = m; }
          w = lo; g = Math.max(18, w * 0.05);
        } else {
          let lo = g, hi = w * 0.6;                         // (very wide screens: wide gaps, the stamps stay their size)
          for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; edgeAt(w, m) > half ? hi = m : lo = m; }
          g = lo;
        }
        cw = w; ch = w / 0.8;
        ANG = angles(cw, g);
        fadeFrom = n + 0.4;
      } else {
        SCL = [1, 0.62, 0.62 * 0.8, 0.62 * 0.72];           // smaller stamps: no stamp covers another
        ch = Math.min(W * 0.52 * 1.25, H * 0.52); cw = ch * 0.8;
        R = W * 2.9;
        const a = Math.asin(W / 2 / R);                     // a neighbour's middle sits right on the screen edge
        ANG = [0, a, 2 * a, 3 * a];
        fadeFrom = 1.6;
      }
      gap = R * Math.sin(ANG[1]);                           // px a drag travels per stamp
      cy = H * (wide ? 0.42 : 0.45);
      // a stamp is on the page only while some of it (its shadow, a lifted corner, its floating) can be on the screen
      gone = fadeFrom + 0.6;
      for (let a = 1; a < gone; a += 0.05) {
        const th = along(ANG, a), s = along(SCL, a);
        if (R * Math.sin(th) - (cw * 0.77 * Math.cos(th) + ch * 0.72 * Math.sin(th)) * s - 20 > W / 2) { gone = a; break; }
      }
      root.style.setProperty('--cw', cw + 'px'); root.style.setProperty('--ch', ch + 'px'); root.style.setProperty('--cy', cy + 'px');
      drawShadows(); slots.forEach(contact);
      paintDesk();
      // the words are printed for the title's size and the screen's px: when those change (a window being resized:
      // when it stops), they are printed again, the ones on the page first
      const fs = parseFloat(getComputedStyle(title).fontSize) || 30, key = fs + '@' + Type.ratio();
      if (key !== typeKey) {
        typeKey = key;
        if (!typed) titleSize = fs;
        else {
          clearTimeout(typeT);
          typeT = setTimeout(() => { titleSize = fs; Type.forget(); retype(); printAll(() => new Promise(r => setTimeout(r, 0))).catch(() => {}); }, 180);
        }
      }
    }
    /** where the stamps and the type ever are, on a grid of 4 px: every place a stamp passes as the wheel turns (with
     *  room for its floating and its lifted corners), the lines of type (the title as long as the longest name) */
    function zone() {
      const c = 4, gw = Math.ceil(W / c), gh = Math.ceil(H / c), z = el('canvas');
      z.width = gw; z.height = gh;
      const g = z.getContext('2d', { willReadFrequently: true });
      g.scale(1 / c, 1 / c); g.fillStyle = '#000';
      const reach = fadeFrom + 0.6;
      for (let d = -reach; d <= reach + 1e-6; d += 0.05) {
        const a = Math.abs(d), th = Math.sign(d) * along(ANG, a), s = along(SCL, a);
        const hw = cw * s / 2 + 21 + 0.05 * ch * s, hh = ch * s / 2 + 30 + 0.05 * cw * s;
        g.save(); g.translate(W / 2 + R * Math.sin(th), cy + R * (1 - Math.cos(th))); g.rotate(th);
        g.fillRect(-hw, -hh, 2 * hw, 2 * hh); g.restore();
      }
      const m = 8, fs = parseFloat(getComputedStyle(title).fontSize) || 30;
      const tw = Math.max(...FEATURES.map(f => f.cn.length)) * fs * 1.12, tt = cy + ch / 2 + Math.min(18, H * 0.034);
      g.fillRect(W / 2 - tw / 2 - m, tt - m, tw + 2 * m, fs * 1.3 + 2 * m);
      const kt = cy - ch / 2 - Math.min(38, H * 0.07);
      g.fillRect(W / 2 - 190, kt - m, 380, 16 + 2 * m);
      g.fillRect(0, 0, W, 32);                              // the top line
      g.fillRect(W / 2 - 95, H - 44, 190, 44);              // the page count
      const px = g.getImageData(0, 0, gw, gh).data, occ = new Uint8Array(gw * gh);
      for (let i = 0; i < occ.length; i++) occ[i] = px[i * 4 + 3] > 0 ? 1 : 0;
      z.width = z.height = 0;
      return { cell: c, gw, gh, occ };
    }
    // the desk is painted once per layout (a window being resized paints it when it stops)
    let deskT = 0;
    function paintDesk() {
      clearTimeout(deskT);
      deskT = setTimeout(() => { if (W && H) Desk.draw(deskCv, W, H, zone()); }, deskCv.width ? 180 : 0);
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
        if (sl.aged) continue;                              // (an aged stamp brings its own shadow)
        put(sl.shadow, art);
        Object.assign(sl.shadow.style, { left: (cw * 0.06 - SPILL).toFixed(1) + 'px', top: (ch * 0.05 - SPILL).toFixed(1) + 'px',
          width: (w / q).toFixed(1) + 'px', height: (h / q).toFixed(1) + 'px', transformOrigin: '' });
      }
    }
    /** the contact shadow round a stamp's own edge (its perforations, a torn fibre), from its canvas at a third the size */
    function contact(sl) {
      const src = sl.cv, c = sl.contact;
      if (!src.width || !cw || sl.aged) return;
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
    // something moves: the wheel, and once the home is up (never with reduced motion) the floating, 30 poses a second
    let pos = 0, to = 0, last = 0, vel = 0, tilt = 0, dragging = false, shown = -1, arc = '', raf = 0;
    let floatFrom = -1, posed = -1e9;                       // when the floating began (-1: not yet), when last posed
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
      const floating = floatFrom >= 0, posing = floating && t - posed >= 22, ft = (t - floatFrom) / 1000;
      if (posing) posed = t;
      for (const sl of slots) {
        const d = wrap(sl.index - pos), a = Math.abs(d);
        const far = a > gone, was = sl.far;                 // out of sight: hidden, not posed
        if (far !== was) { sl.far = far; sl.btn.classList.toggle('far', far); }
        if (far) continue;
        if (floating && (posing || was !== false)) pose(sl, ft);   // (one coming into sight is posed at once)
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
      const off = (Math.round((100 - (mod(pos, N) + 1) / N * 100) * 2) / 2).toFixed(1);
      if (off !== arc) arcEl.style.strokeDashoffset = arc = off;
      if (c !== shown) showTitle(c);
      return true;
    }
    const turning = () => dragging || Math.abs(to - pos) > 1e-4 || Math.abs(tilt) > 0.01;
    // while only the floating moves, the next frame is asked for 20 ms on: a pose every other frame at 60 Hz, and no
    // frames in between that would do nothing
    let nap = 0;
    const loop = t => {
      raf = 0;
      if (!frame(t)) { last = 0; return; }
      if (turning()) raf = requestAnimationFrame(loop);
      else if (floatFrom >= 0) { clearTimeout(nap); nap = setTimeout(kick, 20); }
      else last = 0;
    };
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
    // ---- the stamps as the home shows them: handled for years (web/shell/age.js). The printed stamp stays on its own
    // canvas (hidden), for the flight to its page and for the pages; the aged one, with the desk round it for its lifted
    // corners, is the contact canvas, and its shadow the desk shadow's
    async function age(sl) {
      const kit = Age.kitOf(sl.index);
      if (kit == null || !sl.cv.width) return false;
      const was = sl.printed, got = await Age.apply(sl.cv, kit, sl.contact, sl.shadow);
      if (!got) return false;
      const pc = v => (v * 100).toFixed(3) + '%', place = (c, [l, t, w, h]) => Object.assign(c.style, { left: pc(l), top: pc(t), width: pc(w), height: pc(h) });
      place(sl.contact, got.picture); place(sl.shadow, got.shadow);
      sl.shadow.style.transformOrigin = got.origin.map(pc).join(' ');
      sl.aged = got; sl.agedOf = was; sl.btn.classList.add('aged');   // (from its next pose its shadow floats as an aged one's)
      return true;
    }

    let live = false;                                       // the loading screen has lifted

    // ---- the words. Each is printed once into a little bitmap (web/shell/type.js: specks of missed ink, a rough
    // edge), all of them under the loading screen; the page only moves them. A word that can't be printed is set plain
    const BRAND = '每日邮政 · DAILY POST', SOON = '即将发行 · COMING SOON', SMALL = 10;
    const TRACK = { title: 0.12, top: 0.28, kicker: 0.34, count: 0.3 };   // the letters' spacing (home.css has the same)
    const kickerOf = i => `${two(i + 1)} · ${FEATURES[i].en}`, countOf = i => `${two(i + 1)} — ${two(N)}`;
    let dateText = '', kickerText = '';
    const ink = (text, track, marks) => Type.word(text, 'small', SMALL, { track, marks, mid: W / 2 });
    const inks = text => Type.letters(text, titleSize, { track: TRACK.title, mid: W / 2 });
    const word = (text, track, marks) => {
      const m = ink(text, track, marks);
      return m ? Type.show(m) : el('span', 'plain', text.replace(/[&<]/g, c => (c === '&' ? '&amp;' : '&lt;')));
    };
    const lettersOf = text => {
      const ms = inks(text);
      return ms ? ms.map(Type.show) : [...text].map(ch => el('span', 'plain', ch));
    };
    const clear = box => { box.querySelectorAll('canvas').forEach(Type.drop); box.textContent = ''; };
    const setWord = (box, text, track) => { box.setAttribute('aria-label', text); if (typed) { clear(box); box.append(word(text, track)); } };
    /** every word of the carousel, printed ahead (under the loading screen; again when the type's size changed), so
     *  that turning the wheel prints nothing; what the printing needed is let go after */
    let printing = 0;
    async function printAll(breath) {
      const my = ++printing;
      const cn = FEATURES.map(f => f.cn).join(''), small = BRAND + dateText + SOON + FEATURES.map((f, i) => kickerOf(i) + countOf(i)).join('') + '◦';
      await Promise.all([Type.fonts('title', titleSize, cn), Type.fonts('small', SMALL, small), Desk.load(DEAL).then(() => Type.load(Desk.version))]);
      for (const [i, f] of FEATURES.entries()) {
        if (my !== printing) return;                        // (a later printing took over)
        inks(f.cn); ink(kickerOf(i), TRACK.kicker, true); ink(countOf(i), TRACK.count);
        if (breath) await breath();
      }
      ink(SOON, TRACK.kicker, true); ink(BRAND, TRACK.top); ink(dateText, TRACK.top);
      typed = true; Type.rest();
    }
    /** all the words on the page now, printed (again) as they stand */
    function retype() {
      if (!typed) return;
      setWord(top.querySelector('.home-brand'), BRAND, TRACK.top); setWord(top.querySelector('.home-date'), dateText, TRACK.top);
      if (shown < 0) return;
      setWord(count.querySelector('span'), countOf(shown), TRACK.count);
      if (!inked) return;
      clear(title); clear(kicker);
      const line = el('span', 'line'); line.append(...lettersOf(FEATURES[shown].cn)); title.append(line);
      kicker.append(word(kickerText, TRACK.kicker, true));
    }

    // ---- the title: the old name drifts up and away, the new one rises letter by letter out of its baseline
    let inked = false;
    function showTitle(c) {
      shown = c;
      const f = FEATURES[c];
      setWord(count.querySelector('span'), countOf(c), TRACK.count);
      if (!inked) return;
      for (const old of title.querySelectorAll('.line:not(.leaving)')) {
        old.classList.add('leaving');
        const letters = [...old.children];
        letters.forEach((l, i) => l.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-38%)', opacity: 0 }],
          { duration: 230, delay: i * 25, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }));
        setTimeout(() => { letters.forEach(Type.drop); old.remove(); }, 230 + letters.length * 25 + 20);
      }
      const line = el('span', 'line');
      line.append(...lettersOf(f.cn));
      title.append(line); title.setAttribute('aria-label', f.cn);
      [...line.children].forEach((l, i) => l.animate([{ transform: 'translateY(72%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
        { duration: 520, delay: 200 + i * 55, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
      setKicker(kickerOf(c));
    }
    function setKicker(text) {
      kickerText = text; kicker.setAttribute('aria-label', text);
      const old = kicker.querySelector(':scope > :not(.leaving)');
      if (old) { old.classList.add('leaving'); old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }); setTimeout(() => { Type.drop(old); old.remove(); }, 240); }
      const s = word(text, TRACK.kicker, true); kicker.append(s);
      s.animate([{ opacity: 0, transform: 'translateY(40%)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120, easing: 'ease-out', fill: 'backwards' });
    }

    // ---- opening a stamp
    let busy = false, soonT = 0;
    const current = () => slots[mod(Math.round(pos), N)];
    const soon = sl => { setKicker(SOON); clearTimeout(soonT); soonT = setTimeout(() => { if (current() === sl) setKicker(kickerOf(sl.index)); }, 2000); };
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
      if (busy || !document.body.classList.contains('daily-home') || e.target.closest?.('input, textarea') || document.getElementById('loader')) return;
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
     *  them so the loader can paint; onEach(i, canvas) hands each one to the loader's slots. Then ages them, the stamps
     *  of one kit together (its maps are read once), off the page's thread (onAged(0..1) tells how far). The desk's
     *  paper and pictures load meanwhile, and the words are printed */
    async function fill(plans, { date, term, render, onEach, onAged, breath }) {
      slots.forEach((sl, i) => { sl.st = plans[i]; });
      dateText = `${(date || '').replace(/-/g, '.')} · ${term}`;
      const deskIn = Desk.load(DEAL).then(paintDesk), kitsIn = Age.load(DEAL);
      const typeIn = printAll(breath).catch(() => { typed = true; }).then(retype);
      const order = slots.slice().sort((p, q) => Math.abs(wrap(p.index - pos)) - Math.abs(wrap(q.index - pos)));
      for (const sl of order) {
        if (!sl.printed) {
          // the slot's own canvas is the printed stamp (a second copy of every stamp was ~1 MB each a phone can't spare)
          put(sl.cv, render(sl.st, sc)); sl.printed = sl.cv; contact(sl);
        }
        if (onEach) onEach(sl.index, sl.printed);
        if (breath) await breath();
      }
      if (await kitsIn) {
        const byKit = slots.slice().sort((p, q) => Age.kitOf(p.index) - Age.kitOf(q.index) || p.index - q.index);
        let n = 0;
        for (const sl of byKit) {
          if (!sl.aged) await age(sl);
          if (onAged) onAged(++n / N);
          if (breath) await breath();
        }
        Age.rest();
      }
      await Promise.all([deskIn, typeIn]);
    }
    /** the loading screen lifts: the title rises letter by letter, the stamps start floating */
    function show() {
      if (live) return;
      typed = true; retype();
      live = true; inked = true;
      document.body.classList.add('home-inked'); showTitle(mod(Math.round(pos), N));
      if (!reduce) floatFrom = performance.now();
      kick();
    }

    const find = key => slots.find(sl => sl.key === key);
    /** turn the carousel to a stamp at once (the home is still hidden when this is called) */
    function reveal(sl) { pos = to = Math.round(pos) + wrap(sl.index - Math.round(pos)); tilt = 0; frame(performance.now(), true); }
    /** a slot takes what its page made (the router, on the way home, before the stamp flies back): onto its own canvas,
     *  aged again by its kit (or with its contact shadow, if it can't be aged) */
    async function repaint(sl) {
      if (!sl.printed || sl.printed === sl.agedOf) return;
      if (sl.printed !== sl.cv && sl.cv.width) sl.cv.getContext('2d').drawImage(sl.printed, 0, 0, sl.cv.width, sl.cv.height);
      if (!(await age(sl))) { sl.aged = null; sl.btn.classList.remove('aged'); drawShadows(); contact(sl); }
      Age.rest();
    }
    return { slots, find, fill, show, reveal, repaint, scale: sc };
  }

  /** a copy of a stamp flies from one screen rect to another. Leaving, it lifts first; coming home, it settles into its
   *  place. Resolves when it lands; the caller removes it (after fading it out if it wants). over: the home's aged
   *  stamp ({ canvas, picture: where it lies, as shares of the stamp }): on the way out the stamp grows new as it
   *  flies (the pages keep it as printed), on the way home it ages again as it settles */
  function fly(src, from, to, { lift = true, duration = 820, over = null } = {}) {
    const f = el('div', 'flyer'), cv = el('canvas'), sh = el('div', 'flyer-shadow');
    put(cv, src); f.append(sh, cv);
    let old = null;
    if (over && over.canvas.width && !reduce) {
      old = el('canvas', 'flyer-aged'); put(old, over.canvas);
      const pc = v => (v * 100).toFixed(3) + '%';
      const [l, t, w, h] = over.picture;
      Object.assign(old.style, { left: pc(l), top: pc(t), width: pc(w), height: pc(h) });
      f.append(old);
    }
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
    if (old) old.animate(lift ? [{ opacity: 1 }, { opacity: 1, offset: 0.08 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration, fill: 'forwards', easing: 'ease-in-out' });
    return a.finished.then(() => f);
  }

  return { FEATURES, DEAL, plan, mount, fly };
})();
