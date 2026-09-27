// 八音盒: a punched-strip music box. Today's word is turned into a tune (the same word, the same tune: a walk on the
// pentatonic scale, 32 steps), punched as holes in a paper strip with stamp perforations down both edges. Turn the
// crank and the strip feeds through; every hole that reaches the comb plucks its tooth. Tap the strip to punch a hole
// or close one, and keep the strip in the album.
(() => {
  const STEPS = 32, LEAD = 3, TAU = Math.PI * 2;
  // two octaves of 宫商角徵羽 (C D E G A), low to high: one tooth each
  const PITCH = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
  const COLS = PITCH.length;

  /** the tune a word makes: phrases of eight steps, the third answering the first, notes wandering by small steps */
  function tuneOf(word) {
    const rnd = Print.rng(Kit.hash('tune|' + word)), rows = Array.from({ length: STEPS }, () => []);
    let p = 3 + Math.floor(rnd() * 4);
    const bar = () => Array.from({ length: 8 }, (_, i) => {
      if (i % 2 === 1 && rnd() < 0.45) return [];
      p = Math.max(0, Math.min(COLS - 1, p + [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)]));
      const out = [p];
      if (i % 4 === 0 && rnd() < 0.5 && p >= 3) out.push(p - 3);          // a low note under the beat
      return out;
    });
    const a = bar(), b = bar(), c = a.map(r => r.slice()), d = bar();
    d[7] = [0, 5];                                                          // it comes home at the end
    [a, b, c, d].flat().forEach((r, i) => { rows[i] = r; });
    return rows;
  }

  // the album's picture of a kept strip: a length of it, holes and all
  function stripPicture(phrase, notes, w, h) {
    const c = U.canvas(w, h), g = c.getContext('2d'), sw = w * 0.62, x0 = (w - sw) / 2, rowH = h / 16;
    g.fillStyle = '#2b2733'; g.fillRect(0, 0, w, h);
    g.drawImage(Stamp.paper(Math.round(sw), h, w / 480, 5), x0, 0);
    const colW = sw * 0.8 / COLS, cx0 = x0 + sw * 0.1;
    U.drawMixed(g, w / 2, rowH * 1.1, phrase, 'caps', 'phrase_cjk', Math.round(rowH * 0.9), '#1d1d1f', 2, 1, 'center');
    g.fillStyle = '#2b2733';
    for (let r = 0; r < 14; r++) for (const n of notes[r] || []) { g.beginPath(); g.roundRect(cx0 + n * colW + colW * 0.2, rowH * (2 + r) + rowH * 0.2, colW * 0.6, rowH * 0.6, colW * 0.3); g.fill(); }
    for (let y = rowH * 0.3; y < h; y += rowH * 0.6) for (const x of [x0 + sw * 0.04, x0 + sw * 0.96]) { g.beginPath(); g.arc(x, y, rowH * 0.12, 0, TAU); g.fill(); }
    return c;
  }
  Kit.thumbs.musicbox = async (e, sc) => stripPicture(e.phrase, e.notes || [], Math.round(Stamp.BW * sc), Math.round(Stamp.BH * sc));

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'musicbox', () => layout());
    const status = P.status;
    const stage = el('canvas', 'mb-stage'), crank = el('div', 'mb-crank', '<i></i><b></b>'), acts = el('div', 'mb-acts');
    root.append(stage, crank, acts);
    const bWord = Kit.button(acts, '换一个词'), bAuto = Kit.button(acts, '自己转'), bKeep = Kit.button(acts, '收进集邮册');
    bAuto.style.setProperty('--swash', '#23D5E8'); bKeep.style.setProperty('--swash', '#ffb000');
    const pal = deps.palettes[Kit.hash('musicbox' + date) % deps.palettes.length];
    const plans = deps.homePlans || [], today = plans[Home.FEATURES.findIndex(f => f.key === 'today')];
    let phrase = today ? today.phrase : (deps.words[0] || { phrase: '今天' }).phrase, notes = tuneOf(phrase);
    let pos = -LEAD, played = Math.floor(pos), auto = false;
    const ring = new Array(COLS).fill(0);                    // how hard each tooth is still ringing (0..1)

    // ---- sound: a plucked steel tooth, inharmonic partials dying away
    function pluck(n) {
      const a = Kit.audio(); if (!a) return;
      const t = a.currentTime, f = PITCH[n] * (1 + (Math.random() - 0.5) * 0.003), out = a.createGain();
      out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.18, t + 0.004); out.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      out.connect(a.destination);
      for (const [k, v, d] of [[1, 1, 1.6], [2.76, 0.28, 0.5], [5.4, 0.12, 0.22], [8.93, 0.05, 0.1]]) {
        const o = a.createOscillator(), gn = a.createGain(); o.type = 'sine'; o.frequency.value = f * k;
        gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(gn).connect(out); o.start(t); o.stop(t + d + 0.05);
      }
      ring[n] = 1; Kit.buzz(4);
    }

    // ---- layout: the strip runs up through the works; the comb lies across it; the crank on the right
    let W = 0, H = 0, phone = false, bw = 0, bh = 0, bx = 0, by = 0, sw = 0, sx = 0, rowH = 0, combY = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      bw = phone ? W - 24 : Math.min(W * 0.5, 560); bh = phone ? H - 200 : H - 190;
      bx = phone ? 12 : W * 0.42 - bw / 2; by = phone ? 96 : 100;
      Object.assign(stage.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
      sw = Math.min(bw * 0.56, 300); sx = bw * 0.44 - sw / 2; rowH = clamp(sw / 11, 18, 30); combY = bh * 0.42;
      const cr = phone ? 46 : 58;
      Object.assign(crank.style, { left: bx + Math.min(bw - cr - 6, sx + sw + (bw - sx - sw) / 2) - cr + 'px', top: by + combY - cr + 'px', width: cr * 2 + 'px', height: cr * 2 + 'px' });
      acts.style.cssText = `left:${bx}px;width:${bw}px;top:${by + bh + 12}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${Math.min(H - 30, by + bh + 58)}px`;
      draw();
    }
    const colX = c => sx + sw * 0.1 + (c + 0.5) * (sw * 0.8 / COLS);

    function draw() {
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(bw * dpr), h = Math.round(bh * dpr);
      if (stage.width !== w || stage.height !== h) { stage.width = w; stage.height = h; }
      const g = stage.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, bw, bh);
      const ink = pal.ink, colW = sw * 0.8 / COLS;
      // the box: a flat lid colour, rounded, the works sunk in the middle
      g.fillStyle = pal.c[0]; g.beginPath(); g.roundRect(0, 0, bw, bh, 18); g.fill();
      g.lineWidth = 3; g.strokeStyle = ink; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.roundRect(10, 10, bw - 20, bh - 20, 12); g.fill();
      // the strip: paper, perforated edges like a stamp's, faint lanes, the word at its head, holes punched through
      g.save(); g.beginPath(); g.rect(sx, 10, sw, bh - 20); g.clip();
      const top = combY + (-LEAD - 1 - pos) * rowH, len = (STEPS + LEAD + 3) * rowH;
      g.fillStyle = '#F4EEDF'; g.fillRect(sx, top, sw, len);
      g.strokeStyle = 'rgba(29,29,31,.08)'; g.lineWidth = 1;
      for (let c = 0; c <= COLS; c++) { const x = sx + sw * 0.1 + c * colW; g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + len); g.stroke(); }
      U.drawMixed(g, sx + sw / 2, combY + (-LEAD + 0.6 - pos) * rowH, phrase, 'caps', 'phrase_cjk', Math.round(rowH * 1.1), '#1d1d1f', 3, 1, 'center');
      U.drawTracked(g, sx + sw / 2, combY + (-LEAD + 1.6 - pos) * rowH, `DAILY POST MUSIC STRIP · ${date.replace(/-/g, '.')}`, U.font('caps_med', Math.round(rowH * 0.3)), 'rgba(29,29,31,.6)', 2, 'center');
      g.fillStyle = '#2b2733';
      for (let r = 0; r < STEPS; r++) {
        const y = combY + (r - pos) * rowH;
        if (y < -rowH || y > bh + rowH) continue;
        for (const n of notes[r]) { g.beginPath(); g.roundRect(colX(n) - colW * 0.3, y - rowH * 0.3, colW * 0.6, rowH * 0.6, colW * 0.3); g.fill(); }
      }
      for (let y = top + rowH * 0.3; y < top + len; y += rowH * 0.62) for (const x of [sx + sw * 0.045, sx + sw * 0.955]) { g.beginPath(); g.arc(x, y, rowH * 0.13, 0, TAU); g.fill(); }
      g.restore();
      // the works: a brass bar across the strip, the comb's teeth reaching to it, each still ringing if plucked
      g.fillStyle = '#C9A24A'; g.beginPath(); g.roundRect(sx - 14, combY - 7, sw + 28, 14, 5); g.fill(); g.lineWidth = 2.5; g.strokeStyle = ink; g.stroke();
      for (let c = 0; c < COLS; c++) {
        const x = colX(c), len2 = rowH * (3.4 - c * 0.2), sway = Math.sin(performance.now() / 18 + c) * ring[c] * 2.2;
        g.fillStyle = ring[c] > 0.05 ? '#F2D27A' : '#DCC07A';
        g.beginPath(); g.moveTo(x - colW * 0.28, combY - 7 - len2); g.lineTo(x + colW * 0.28, combY - 7 - len2); g.lineTo(x + colW * 0.2 + sway, combY - 7); g.lineTo(x - colW * 0.2 + sway, combY - 7); g.closePath();
        g.fill(); g.lineWidth = 1.5; g.strokeStyle = ink; g.stroke();
      }
      g.fillStyle = '#C9A24A'; g.beginPath(); g.roundRect(sx - 14, combY - 7 - rowH * 3.7, sw + 28, rowH * 0.8, 4); g.fill(); g.lineWidth = 2.5; g.stroke();
      U.drawTracked(g, sx + sw / 2, combY - 7 - rowH * 3.3, 'C  D  E  G  A  C  D  E  G  A', U.font('caps', Math.round(rowH * 0.34)), ink, 0, 'center');
    }

    // ---- turning: the crank's angle feeds the strip (four steps a turn); every row crossing the comb plays
    let turn = 0;
    function feed(steps) {
      if (steps <= 0) return;
      pos = Math.min(STEPS + 1, pos + steps);
      turn += steps / 4 * TAU; crank.style.setProperty('--turn', turn + 'rad');
      while (played < Math.floor(pos)) { played++; if (played >= 0 && played < STEPS) notes[played].forEach(pluck); }
      if (pos >= STEPS + 1) { auto = false; bAuto.classList.remove('on'); status.set('一曲完了 · 再转一次从头来'); }
    }
    let dragC = null;
    crank.addEventListener('pointerdown', e => {
      try { crank.setPointerCapture(e.pointerId); } catch {}
      Kit.audio(); if (pos >= STEPS + 1) { pos = -LEAD; played = Math.floor(pos); }
      const r = crank.getBoundingClientRect(); dragC = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, a: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) };
    });
    crank.addEventListener('pointermove', e => {
      if (!dragC) return;
      const a = Math.atan2(e.clientY - dragC.cy, e.clientX - dragC.cx);
      let d = a - dragC.a; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      dragC.a = a; if (d > 0) feed(d / TAU * 4);            // clockwise only: a music box won't play backwards
    });
    const up = () => { dragC = null; };
    crank.addEventListener('pointerup', up); crank.addEventListener('pointercancel', up);
    let spaceHeld = false;
    root.addEventListener('keydown', e => { if (Kit.visible(root) && e.key === ' ') { e.preventDefault(); Kit.audio(); if (pos >= STEPS + 1) { pos = -LEAD; played = Math.floor(pos); } spaceHeld = true; } });
    root.addEventListener('keyup', e => { if (e.key === ' ') spaceHeld = false; });
    bAuto.onclick = () => { Kit.audio(); auto = !auto; bAuto.classList.toggle('on', auto); if (auto && pos >= STEPS + 1) { pos = -LEAD; played = Math.floor(pos); } };

    // ---- punching: a tap on the strip opens or closes a hole
    stage.addEventListener('click', e => {
      const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < sx + sw * 0.1 || x > sx + sw * 0.9) return;
      const c = Math.floor((x - sx - sw * 0.1) / (sw * 0.8 / COLS)), row = Math.round((y - combY) / rowH + pos);
      if (row < 0 || row >= STEPS || c < 0 || c >= COLS) return;
      const k = notes[row].indexOf(c);
      if (k >= 0) notes[row].splice(k, 1); else { notes[row].push(c); Kit.audio(); pluck(c); }
      Kit.rustle(0.02, 0.05); draw();
      status.set(`第 ${row + 1} 拍 · ${k >= 0 ? '补上了一个孔' : '打了一个孔'}`);
    });
    bWord.onclick = () => {
      const ws = deps.words.filter(w => w.phrase !== phrase); if (!ws.length) return;
      phrase = ws[Math.floor(Math.random() * ws.length)].phrase; notes = tuneOf(phrase); pos = -LEAD; played = Math.floor(pos); draw();
      status.set(`「${phrase}」的曲子 · 摇手柄`);
    };
    bKeep.onclick = () => {
      deps.album.add({ id: `musicbox:${date}:${Date.now()}`, kind: 'musicbox', date, phrase, notes: notes.map(r => r.slice()) });
      Kit.thump(0.3); status.set('这条纸带收进了集邮册');
    };

    // ---- the clock
    let last = 0;
    function tick(t) {
      requestAnimationFrame(tick);
      if (!Kit.visible(root)) { last = 0; return; }
      const dt = last ? Math.min(50, t - last) : 16; last = t;
      if (auto || spaceHeld) feed(dt / 1000 * 3.2);
      let ringing = false; for (let c = 0; c < COLS; c++) { ring[c] = Math.max(0, ring[c] - dt / 700); ringing = ringing || ring[c] > 0; }
      if (ringing || auto || spaceHeld || dragC) draw();
    }
    requestAnimationFrame(tick);

    layout();
    status.set(`「${phrase}」的曲子 · 顺时针摇手柄，或者按住空格`);
    return P.api({
      ready: Promise.resolve(),
      anchor: () => { const r = stage.getBoundingClientRect(); return new DOMRect(r.left + sx, r.top + 20, sw, sw * 1.25); },
      receive(st) { phrase = st.phrase; notes = tuneOf(phrase); pos = -LEAD; played = Math.floor(pos); draw(); status.set(`「${phrase}」的曲子 · 摇手柄`); return 400; },
      source: () => null,
    });
  }
  Pages.define('musicbox', mount);
})();
