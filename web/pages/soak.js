// 泡票: the collector's old ritual. A corner torn off an airmail envelope, the stamp still stuck on it and cancelled
// across the edge. Drop it into the enamel basin; the paper darkens, and stirring the water makes the gum let go
// sooner. The stamp floats up: lift it out with the tweezers onto the blotting paper, where it lies curled and wet,
// then hold it (or lay the book on it) until it dries flat. Into the album it goes, postmark and all.
(() => {
  const TAU = Math.PI * 2, SOAK_MS = 6500, PRESS_MS = 1600;
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

  function mount(root, deps) {
    const { el, clamp } = Kit;
    const date = deps.date;
    const P = Kit.page(root, 'soak', () => layout());
    const status = P.status;
    const desk = el('div', 'sq-desk'), basin = el('canvas', 'sq-basin'), blotter = el('div', 'sq-blotter');
    const envEl = el('div', 'sq-env'), envCv = el('canvas'), stampEl = el('div', 'sq-stamp'), stampCv = el('canvas'), gloss = el('i', 'sq-gloss');
    const tweezers = el('div', 'sq-tweezers', '<svg viewBox="0 0 40 120" aria-hidden="true"><path d="M8 2 L18 112 M32 2 L22 112"/></svg>');
    const book = el('div', 'sq-book', '<span>集邮手册</span><i>STAMP CATALOGUE</i>');
    const acts = el('div', 'sq-acts');
    envEl.append(envCv); stampEl.append(stampCv, gloss);
    desk.append(basin, blotter, envEl, stampEl, book, tweezers); root.append(desk, acts);
    const bPress = Kit.button(acts, '压一本书'), bNext = Kit.button(acts, '下一封');
    bPress.style.setProperty('--swash', '#23D5E8'); bNext.style.setProperty('--swash', '#ffb000');

    let i = 0;                                              // which envelope of the day
    const stOf = k => Kit.stampFor(`soak|${date}|${k}`, deps.words, deps.palettes, k + 1, date);
    const pal = deps.palettes[Kit.hash('soak' + date) % deps.palettes.length];
    // the enamel rim takes the palette's most colourful ink (a basin's rim is red or blue, never black)
    const rim = pal.c.slice().sort((a, b) => U.oklch(b)[1] - U.oklch(a)[1] || U.oklch(a)[0] - U.oklch(b)[0])[0];

    // ---- layout: the basin in the middle, the envelope beside it, the blotting paper on the other side
    let W = 0, H = 0, phone = false, R = 0, bx = 0, by = 0, sh = 0, sw = 0, blot = null, home = null;
    function layout() {
      ({ W, H, phone } = P.measure());
      R = phone ? Math.min(W * 0.36, H * 0.2) : Math.min(H * 0.28, W * 0.17);
      bx = phone ? W / 2 : W * 0.46; by = phone ? H * 0.4 : H * 0.52;
      sh = phone ? Math.min(H * 0.15, 130) : Math.min(H * 0.24, 200); sw = sh * 0.8;
      const bw = sh * 1.35, bh = sh * 1.5;
      blot = phone ? { x: W * 0.73, y: by + R + bh * 0.62 + 18, w: bw, h: bh } : { x: bx + R + (W - bx - R) * 0.5, y: by, w: bw, h: bh };
      home = phone ? { x: W * 0.27, y: blot.y } : { x: (bx - R) * 0.5, y: by };
      Object.assign(basin.style, { left: bx - R * 1.08 + 'px', top: by - R * 1.08 + 'px', width: R * 2.16 + 'px', height: R * 2.16 + 'px' });
      Object.assign(blotter.style, { left: blot.x - blot.w / 2 + 'px', top: blot.y - blot.h / 2 + 'px', width: blot.w + 'px', height: blot.h + 'px' });
      Object.assign(book.style, { width: blot.w * 1.25 + 'px', height: blot.h * 1.18 + 'px' });
      acts.style.cssText = phone ? `left:12px;right:12px;top:${Math.min(H - 84, blot.y + blot.h / 2 + 14)}px` : `left:0;right:0;top:${by + R + 30}px`;
      status.el.style.cssText = phone ? `left:16px;right:16px;top:${H - 30}px` : `left:16px;right:16px;top:${by + R + 78}px`;
      drawBasin(performance.now());
      place();
    }

    // ---- the envelope corner: airmail edging on its two real edges, torn on the other two, the stamp stuck on at a
    // tilt and cancelled across its edge. Built at the stamp's print scale (sc px per stamp unit)
    let cur = null;                                         // {st, sc, env, stamp, mark, srot, ex, ey, ew, eh}
    function build(st) {
      const dpr = Math.min(2, devicePixelRatio || 1), sc = clamp(sh * dpr / Stamp.BH, 0.12, 0.4);
      const fr = deps.makeFront(st, sc), SW = fr.width, SH = fr.height;
      const ew = Math.round(SW * 1.75), eh = Math.round(SH * 1.55), rnd = Print.rng(Kit.hash(st.seed + '|env'));
      const env = U.canvas(ew, eh), g = env.getContext('2d');
      // the paper: two straight sides (the envelope's own corner, top right), two torn by hand
      g.save(); g.beginPath(); g.moveTo(ew, 0);
      g.lineTo(ew, eh * (0.86 + rnd() * 0.1));
      for (let x = ew; x > 0; x -= ew / 26) g.lineTo(x, eh * (0.9 + (rnd() - 0.5) * 0.08) - (ew - x) * 0.05);
      for (let y = eh * 0.84; y > 0; y -= eh / 22) g.lineTo(ew * (0.03 + rnd() * 0.05) + y * 0.04, y);
      g.closePath(); g.clip();
      g.drawImage(Stamp.paper(ew, eh, sc * 1.4, Kit.hash(st.seed + 'p') % 999), 0, 0);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(240,232,210,.5)'; g.fillRect(0, 0, ew, eh); g.globalCompositeOperation = 'source-over';
      // airmail bars along the top and the right edge
      const cols = [pal.c[0], pal.c[1]], band = SW * 0.07, bar = SW * 0.09;
      g.save(); g.beginPath(); g.rect(0, 0, ew, band); g.rect(ew - band, 0, band, eh); g.clip();
      for (let k = -30; k < (ew + eh) / bar + 30; k++) {
        if (k % 3 === 2) continue;
        const x = k * bar; g.fillStyle = cols[k % 3];
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + bar * 0.6, 0); g.lineTo(x + bar * 0.6 - eh, eh); g.lineTo(x - eh, eh); g.fill();
      }
      g.restore();
      U.grain(g, ew, eh, 0.16, 7);
      g.restore();
      // the stamp, stuck on a little crooked near the corner
      const srot = (rnd() - 0.5) * 0.1, ex = ew - band - SW * 0.62, ey = band + SH * 0.62;
      g.save(); g.translate(ex, ey); g.rotate(srot); g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 3 * sc * 4; g.shadowOffsetY = sc * 4;
      g.drawImage(fr, -SW / 2, -SH / 2); g.restore();
      // the postmark sits over the stamp's left edge, its waves running onto the stamp
      const mark = { type: 'round', x: -40 + rnd() * 60, y: 380 + rnd() * 500, rot: -0.3 + rnd() * 0.2, weight: 0.9, seed: Kit.hash(st.seed + 'm') % 99999, date };
      const spec = { no: st.no, date };
      const mx = (mark.x - Stamp.BW / 2) * sc, my = (mark.y - Stamp.BH / 2) * sc, c = Math.cos(srot), s = Math.sin(srot);
      const ink = U.canvas(ew, eh);
      Stamp.postmark(ink.getContext('2d'), ex + c * mx - s * my, ey + s * mx + c * my, 150 * sc, sc, spec, mark.rot + srot, mark.seed);
      ink.getContext('2d').globalCompositeOperation = 'destination-in'; ink.getContext('2d').drawImage(env, 0, 0);
      g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(ink, 0, 0); g.restore();
      // what comes off in the water: the stamp with its share of the postmark
      const stamp = U.canvas(SW, SH), sg = stamp.getContext('2d');
      sg.drawImage(fr, 0, 0);
      Kit.drawMarks(sg, [mark], sc, st);
      // what stays: the paper, a paler patch of gum where the stamp was
      const bare = U.canvas(ew, eh), bg = bare.getContext('2d');
      bg.drawImage(env, 0, 0);
      bg.save(); bg.translate(ex, ey); bg.rotate(srot); bg.globalCompositeOperation = 'destination-out'; bg.drawImage(fr, -SW / 2, -SH / 2); bg.restore();
      bg.save(); bg.globalCompositeOperation = 'destination-over'; bg.fillStyle = '#E6DABB';   // the gum's yellowed ghost
      bg.translate(ex, ey); bg.rotate(srot); bg.fillRect(-SW / 2, -SH / 2, SW, SH); bg.restore();
      bg.save(); bg.globalCompositeOperation = 'destination-in'; bg.drawImage(env, 0, 0); bg.restore();
      return { st, sc, dpr, env, bare, stamp, mark, srot, ex, ey, ew, eh, SW, SH };
    }

    // ---- where things are: the envelope and the stamp each have a spot (x, y: screen px of their middle), a turn, and
    // how wet they are; the stamp also how curled
    const E = { x: 0, y: 0, r: -0.08, wet: 0, inWater: false }, S = { x: 0, y: 0, r: 0, wet: 0, curl: 0, free: false, on: 'env' };
    let phase = 'dry';                                      // dry -> soaking -> floating -> blotter -> pressed
    let soak = 0, pressT = 0, stir = 0;
    const envSize = () => ({ w: cur.ew / cur.dpr, h: cur.eh / cur.dpr });
    function place() {
      if (!cur) return;
      const { w, h } = envSize(), wob = E.inWater ? Math.sin(performance.now() / 900) * 0.012 : 0;
      Object.assign(envEl.style, { width: w + 'px', height: h + 'px', left: E.x - w / 2 + 'px', top: E.y - h / 2 + 'px',
        transform: `rotate(${E.r + wob}rad) scale(${E.inWater && phase !== 'dry' ? 0.985 : 1})`,
        filter: `brightness(${(1 - 0.16 * E.wet).toFixed(3)}) saturate(${(1 + 0.25 * E.wet).toFixed(3)})` });
      const sw2 = cur.SW / cur.dpr, sh2 = cur.SH / cur.dpr;
      if (!S.free) {                                        // riding on the envelope
        const c = Math.cos(E.r + wob), s = Math.sin(E.r + wob), lx = cur.ex / cur.dpr - w / 2, ly = cur.ey / cur.dpr - h / 2;
        S.x = E.x + c * lx - s * ly; S.y = E.y + s * lx + c * ly; S.r = E.r + wob + cur.srot;
      }
      const curl = S.curl, lift = S.free && phase === 'floating' ? Math.sin(performance.now() / 700) * 0.02 : 0;
      Object.assign(stampEl.style, { width: sw2 + 'px', height: sh2 + 'px', left: S.x - sw2 / 2 + 'px', top: S.y - sh2 / 2 + 'px',
        transform: `perspective(${(sh2 * 4).toFixed(0)}px) rotate(${S.r + lift}rad) rotateX(${(curl * 22).toFixed(2)}deg) rotateY(${(-curl * 9).toFixed(2)}deg) scale(${(1 - curl * 0.05).toFixed(4)})`,
        filter: `brightness(${(1 - 0.12 * S.wet).toFixed(3)}) saturate(${(1 + 0.2 * S.wet).toFixed(3)})`, visibility: S.free ? 'visible' : 'hidden' });
      gloss.style.opacity = (S.wet * 0.75).toFixed(3);
      stampEl.classList.toggle('lifted', S.free && phase === 'floating');
    }
    function setEnvelope(st) {
      cur = build(st);
      Kit.put(envCv, cur.env); Kit.put(stampCv, cur.stamp);
      Object.assign(E, { x: home.x, y: home.y, r: -0.08, wet: 0, inWater: false });
      Object.assign(S, { wet: 0, curl: 0, free: false, on: 'env' });
      phase = 'dry'; soak = 0; pressT = 0; stir = 0;
      bPress.hidden = true; bNext.hidden = true;
      place();
      status.set('把信封角拖进水盆里 · 泡开背胶');
    }

    // ---- the basin: a white enamel wash basin seen from above, a blue rim, flat water, rings where it was stirred
    const rings = [];
    let lastPaint = 0;
    function drawBasin(t) {
      const dpr = Math.min(2, devicePixelRatio || 1), s = Math.round(R * 2.16 * dpr);
      if (basin.width !== s) { basin.width = basin.height = s; }
      const g = basin.getContext('2d'), c = s / 2, r = R * dpr;
      g.clearRect(0, 0, s, s);
      g.fillStyle = '#F6F2E8'; g.beginPath(); g.arc(c, c, r * 1.07, 0, TAU); g.fill();              // the enamel lip
      g.lineWidth = r * 0.038; g.strokeStyle = rim; g.beginPath(); g.arc(c, c, r * 1.05, 0, TAU); g.stroke();
      g.lineWidth = r * 0.012; g.strokeStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(c, c, r * 0.985, 0, TAU); g.stroke();
      g.fillStyle = '#9ED8E4'; g.beginPath(); g.arc(c, c, r * 0.97, 0, TAU); g.fill();              // the water
      // two enamel flowers on the bottom, blurred by the water
      g.save(); g.beginPath(); g.arc(c, c, r * 0.97, 0, TAU); g.clip();
      g.globalAlpha = 0.28;
      for (const [fx, fy, fr, col] of [[-0.35, 0.38, 0.2, pal.c[1]], [0.42, -0.3, 0.14, pal.c[3]]]) {
        g.fillStyle = col;
        for (let k = 0; k < 5; k++) { const a = k * TAU / 5 + t / 9000; g.beginPath(); g.arc(c + (fx + Math.cos(a) * fr * 0.55) * r, c + (fy + Math.sin(a) * fr * 0.55) * r, fr * 0.45 * r, 0, TAU); g.fill(); }
      }
      g.globalAlpha = 1;
      // stirred rings
      g.lineWidth = r * 0.012; g.strokeStyle = '#ffffff';
      for (let k = rings.length - 1; k >= 0; k--) {
        const q = rings[k], age = t - q.t;
        if (age > 1600) { rings.splice(k, 1); continue; }
        g.globalAlpha = (1 - age / 1600) * 0.8;
        g.beginPath(); g.arc(q.x * dpr + c, q.y * dpr + c, (6 + age * 0.07) * dpr, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
      // a slow white glint
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.ellipse(c - r * 0.42, c - r * 0.5, r * 0.28, r * 0.07, -0.6 + Math.sin(t / 2600) * 0.05, 0, TAU); g.fill();
      g.restore();
    }
    const inBasin = (x, y, k = 0.8) => Math.hypot(x - bx, y - by) < R * k;
    const onBlotter = (x, y) => Math.abs(x - blot.x) < blot.w * 0.7 && Math.abs(y - blot.y) < blot.h * 0.7;
    const ripple = (x, y) => rings.push({ x: x - bx, y: y - by, t: performance.now() });

    // ---- the clock: soaking, floating, drying
    function tick(dt, t) {
      if (phase === 'soaking') {
        E.wet = Math.min(1, E.wet + dt / 1500);
        soak += dt * (1 + Math.min(2.5, stir)) / SOAK_MS; stir = Math.max(0, stir - dt / 600);
        if (soak >= 1) float();
        else if (soak > 0.35) status.set(`背胶在化开 · ${Math.round(soak * 100)}% · 搅一搅水会快一些`);
      }
      if (phase === 'floating') {                           // it drifts off the paper, edges lifting
        S.x += (S.tx - S.x) * (1 - Math.exp(-dt / 900)); S.y += (S.ty - S.y) * (1 - Math.exp(-dt / 900));
        S.curl = Math.min(0.35, S.curl + dt / 3000);
      }
      if (phase === 'blotter' && holding) press(dt);
      if (t - lastPaint > 33) { drawBasin(t); lastPaint = t; }
      place();
    }
    Kit.loop(root, tick);

    function float() {
      phase = 'floating'; S.free = true; S.wet = 1;
      const a = Math.random() * TAU; S.tx = S.x + Math.cos(a) * R * 0.18; S.ty = S.y + Math.sin(a) * R * 0.18;
      Kit.put(envCv, cur.bare);
      envEl.animate([{ opacity: 1 }, { opacity: 0.75 }], { duration: 1200, fill: 'forwards' });
      stampEl.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
      ripple(S.x, S.y); Kit.rustle(0.03, 0.3);
      status.set('邮票浮起来了 · 用镊子把它夹出来');
    }
    function toBlotter() {
      phase = 'blotter'; S.x = blot.x; S.y = blot.y; S.r = (Math.random() - 0.5) * 0.12; S.curl = 1;
      bPress.hidden = false; bPress.disabled = false;
      status.set('湿邮票会卷边 · 按住它压平，或者压一本书');
    }
    let holding = false;
    function press(dt) {
      pressT = Math.min(PRESS_MS, pressT + dt);
      const k = pressT / PRESS_MS;
      S.curl = 1 - ease(k); S.wet = 1 - k;
      if (pressT >= PRESS_MS) dried();
    }
    async function dried() {
      phase = 'pressed'; holding = false; S.curl = 0; S.wet = 0; bPress.hidden = true; bNext.hidden = false; bNext.disabled = false;
      Kit.thump(0.3);
      deps.album.add({ id: `soak:${date}:${i}:${Date.now()}`, kind: 'soak', date, st: cur.st, marks: [cur.mark] });
      status.set('晾干压平了 · 收进了集邮册');
    }

    // ---- input: drag the envelope in; stir the water; lift the stamp out with the tweezers; hold it flat
    let drag = null;
    const at = e => ({ x: e.clientX, y: e.clientY });
    function showTweezers(p, on) {
      tweezers.classList.toggle('on', on);
      if (p) Object.assign(tweezers.style, { left: p.x + 'px', top: p.y + 'px' });
    }
    desk.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const p = at(e); Kit.audio();
      if (phase === 'dry' && e.target.closest('.sq-env')) drag = { what: 'env', dx: p.x - E.x, dy: p.y - E.y };
      else if (phase === 'floating' && e.target.closest('.sq-stamp')) { drag = { what: 'stamp', dx: p.x - S.x, dy: p.y - S.y }; showTweezers(p, true); Kit.rustle(0.02, 0.08); }
      else if (phase === 'blotter' && e.target.closest('.sq-stamp')) { holding = true; drag = { what: 'hold' }; }
      else if (inBasin(p.x, p.y, 0.97) && (phase === 'soaking' || phase === 'floating')) { drag = { what: 'stir', lx: p.x, ly: p.y }; ripple(p.x, p.y); }
      if (drag) desk.setPointerCapture(e.pointerId);
    });
    desk.addEventListener('pointermove', e => {
      const p = at(e);
      if (!drag) { if (phase === 'floating') showTweezers(p, !!e.target.closest('.sq-stamp') && e.pointerType === 'mouse'); return; }
      if (drag.what === 'env') { E.x = p.x - drag.dx; E.y = p.y - drag.dy; }
      else if (drag.what === 'stamp') { S.x = p.x - drag.dx; S.y = p.y - drag.dy; S.tx = S.x; S.ty = S.y; showTweezers(p, true); if (inBasin(p.x, p.y)) ripple(p.x, p.y); }
      else if (drag.what === 'stir' && inBasin(p.x, p.y, 0.97)) {
        const d = Math.hypot(p.x - drag.lx, p.y - drag.ly);
        if (d > 14) { ripple(p.x, p.y); stir = Math.min(3, stir + d / 120); drag.lx = p.x; drag.ly = p.y; if (Math.random() < 0.3) Kit.rustle(0.012, 0.06); }
      }
    });
    const up = e => {
      const d = drag; drag = null; holding = false; showTweezers(null, false);
      if (!d) return;
      if (d.what === 'env') {
        if (inBasin(E.x, E.y)) {
          phase = 'soaking'; E.inWater = true; ripple(E.x, E.y); ripple(E.x + 20, E.y - 10); Kit.rustle(0.05, 0.35);
          const tx = bx + (E.x - bx) * 0.4, ty = by + (E.y - by) * 0.4;
          envEl.animate([{ filter: envEl.style.filter }, { filter: 'brightness(.9)' }], { duration: 600 });
          E.x = tx; E.y = ty;
          status.set('泡着 · 纸在吸水');
        }
      } else if (d.what === 'stamp') {
        if (!inBasin(S.x, S.y, 1.05)) toBlotter();
      }
    };
    desk.addEventListener('pointerup', up); desk.addEventListener('pointercancel', up);

    bPress.onclick = async () => {
      if (phase !== 'blotter') return;
      bPress.disabled = true;
      const start = { left: blot.x - blot.w * 0.62 + 'px', top: blot.y - blot.h * 0.59 - H * 0.3 + 'px' };
      Object.assign(book.style, { left: start.left, top: start.top });
      book.classList.add('on');
      await book.animate([{ transform: 'translateY(0) rotate(-8deg)', opacity: 0 }, { transform: `translateY(${H * 0.3}px) rotate(3deg)`, opacity: 1 }],
        { duration: 650, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' }).finished;
      Kit.thump(0.8);
      holding = true;
      await Kit.wait(PRESS_MS + 60);
      await book.animate([{ transform: `translateY(${H * 0.3}px) rotate(3deg)`, opacity: 1 }, { transform: `translate(${W * 0.1}px, ${H * 0.3 - 30}px) rotate(12deg)`, opacity: 0 }],
        { duration: 600, easing: 'ease-in', fill: 'forwards' }).finished;
      book.classList.remove('on');
    };
    bNext.onclick = async () => {
      if (phase !== 'pressed') return;
      bNext.disabled = true;
      await Promise.all([envEl, stampEl].map(x => x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).finished));
      i++; setEnvelope(stOf(i));
      [envEl, stampEl].forEach(x => { x.getAnimations().forEach(a => a.cancel()); x.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease' }); });
    };

    layout();
    const ready = Promise.all([deps.loadLeaflet(stOf(0).phrase), Kit.afterFrame()]).then(() => setEnvelope(stOf(0)));   // once the stamp flying in is off
    // the stamp from the home lands where the envelope's stamp is, and becomes it
    function anchor() {
      if (!cur) return new DOMRect(home.x - sw / 2, home.y - sh / 2, sw, sh);
      const w = cur.SW / cur.dpr, h = cur.SH / cur.dpr;
      return new DOMRect(S.x - w / 2, S.y - h / 2, w, h);
    }
    async function receive(st) {
      if (phase !== 'dry') return 300;
      await deps.loadLeaflet(st.phrase);
      setEnvelope({ ...st, no: st.no || 1 });
      return 350;
    }
    return P.api({ ready, anchor, receive, source: () => (phase === 'pressed' ? stampCv : null) });
  }
  Pages.define('soak', mount);
})();
