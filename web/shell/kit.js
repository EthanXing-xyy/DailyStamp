// Shared bits for the app's pages: header, status line, the flip card a stamp prints onto, paper sounds (with a buzz on
// phones), the stamp behind a seed, saving / sharing a picture. Nothing here ever calls a model: every word, emblem and
// leaflet was made ahead of time.
const Kit = (() => {
  const TAU = Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const two = n => String(n).padStart(2, '0');
  const put = (cv, src) => { cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); return cv; };
  const visible = root => root.classList.contains('on') && document.body.classList.contains('daily-layer') && !document.hidden;
  const localDate = (d = new Date()) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const dayNo = date => { const [y, m, d] = date.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
  const addDays = (date, n) => { const [y, m, d] = date.split('-').map(Number); return localDate(new Date(y, m - 1, d + n)); };
  const hash = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

  /** page header: a small kicker over the name, like the home's */
  function head(root, no, en, cn) {
    const h = el('div', 'kit-head', `<p class="kit-kicker">${two(no)} · ${en}</p><h2>${cn}</h2>`);
    root.append(h);
    return h;
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
  /** a rubber stamp hitting paper: a dull knock, heavier with more weight (0..1) */
  function thump(weight = 0.5) {
    buzz(Math.round(12 + weight * 22));
    if (!actx) return;
    const a = actx, t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150 + Math.random() * 30, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 + weight * 0.14, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.16);
    burst({ f: 700 + Math.random() * 300, q: 0.7, dur: 0.05, vol: 0.05 + weight * 0.05 });
  }
  /** paper sliding / a squeegee: a soft hiss */
  function rustle(vol = 0.03, dur = 0.12) { burst({ f: 3200 + Math.random() * 1600, q: 0.5, dur, vol, attack: dur * 0.3 }); }

  // this visit's deal (Home.DEAL): stamps come out new on every reload, and stay put while the page is open
  const visit = Home.DEAL;
  /** the stamp behind a seed in this visit: a library word, palette and layout drawn from it */
  function stampFor(seed, words, palettes, no, date) {
    const rnd = Print.rng(hash(seed + '|' + visit));
    const w = words.length ? words[Math.floor(rnd() * words.length)] : { phrase: '今天', en: 'today' };
    return { phrase: w.phrase, en: w.en || '', no, date, palette: palettes[Math.floor(rnd() * palettes.length)].name, layout: 'gen',
      seed: Math.floor(rnd() * 1e9), shift: Math.floor(rnd() * 4), emblem: 'auto', misregister: true, grain: true, side: 'front' };
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
        if (instant) { inner.style.transition = 'none'; inner.style.transform = `rotateY(${turns * 180}deg)`; void inner.offsetWidth; inner.style.transition = ''; }
        else inner.style.transform = `rotateY(${turns * 180}deg)`;
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

  // ---- cancellations (盖戳). A mark is {type: round|wave|seal, x, y (stamp units, 1200 x 1500), rot, weight 0..1, seed,
  // ghost}; they print only on the paper of the stamp, never beside it
  const INK = '#26262b', RED = '#B0172F';
  function drawMark(g, m, s, spec) {
    const rnd = Print.rng(m.seed || 1), a = (0.55 + 0.45 * m.weight) * (m.ghost ? 0.45 : 1);
    const x = m.x * s, y = m.y * s;
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

  /** a round button with a label; never a boxed rectangle */
  function button(parent, label, cls = '') { const b = el('button', 'kit-btn ' + cls, label); b.type = 'button'; parent.append(b); return b; }

  return { TAU, reduce, el, clamp, wait, two, put, visible, localDate, dayNo, addDays, hash, head, status, audio, buzz, crackle, thump, rustle,
    visit, stampFor, card, gum, watermark, save, blobOf, imageOf, button, drawMark, drawMarks,
    thumbs: {} };   // thumbs[kind](entry, scale, deps): how the album draws works that are not plain stamps
})();
