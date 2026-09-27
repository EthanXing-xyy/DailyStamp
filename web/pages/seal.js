// 刻章: carve a seal. Type one to four characters (a name, or a line for a leisure seal), choose 白文 (the characters
// cut away, printing white in red) or 朱文 (the ground cut away, the characters and a frame printing red). The
// characters are pencilled onto the stone back to front, as a carver does; scrub over them and the knife takes the
// stone away in chips. Once it is cut, dip it in the cinnabar paste and press it onto the paper, the ink a little
// uneven, fainter with each press until it is dipped again. The seal is kept, and 盖戳 can strike it too.
(() => {
  const N = 512, G = 96, TAU = Math.PI * 2, RED = '#C42A1E';

  /** the characters' shape on the seal face, as an alpha mask (N x N), read the right way round; mode picks what is
   *  cut away: 'bai' the characters, 'zhu' everything but the characters and a frame */
  function design(text, mode) {
    const chars = [...text].slice(0, 4), c = U.canvas(N, N), g = c.getContext('2d');
    const m = N * 0.1, inner = N - 2 * m;
    // boxes (x, y, w, h), read right to left, top to bottom, as seals are
    const boxes = chars.length <= 1 ? [[m, m, inner, inner]]
      : chars.length === 2 ? [[m + inner / 2, m, inner / 2, inner], [m, m, inner / 2, inner]]
      : chars.length === 3 ? [[m + inner / 2, m, inner / 2, inner], [m, m, inner / 2, inner / 2], [m, m + inner / 2, inner / 2, inner / 2]]
      : [[m + inner / 2, m, inner / 2, inner / 2], [m + inner / 2, m + inner / 2, inner / 2, inner / 2], [m, m, inner / 2, inner / 2], [m, m + inner / 2, inner / 2, inner / 2]];
    const ch = U.canvas(N, N), cg = ch.getContext('2d');
    chars.forEach((t, i) => {
      const [x, y, w, h] = boxes[i], pad = Math.min(w, h) * 0.06;
      cg.clearRect(0, 0, N, N);
      cg.font = U.font(U.hasCjk(t) ? 'phrase_cjk' : 'phrase_latin', 300); cg.textBaseline = 'alphabetic'; cg.fillStyle = '#000';
      const mt = cg.measureText(t), gw = mt.actualBoundingBoxLeft + mt.actualBoundingBoxRight, gh = mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent;
      if (!gw || !gh) return;
      g.save(); g.translate(x + pad, y + pad); g.scale((w - 2 * pad) / gw, (h - 2 * pad) / gh);
      g.font = cg.font; g.fillStyle = '#000'; g.textBaseline = 'alphabetic';
      g.fillText(t, mt.actualBoundingBoxLeft, mt.actualBoundingBoxAscent); g.restore();
    });
    if (mode === 'bai') return c;
    // 朱文: the ground inside a frame is cut, the characters and the frame stay
    const out = U.canvas(N, N), o = out.getContext('2d'), f = N * 0.06;
    o.fillStyle = '#000'; o.fillRect(f, f, N - 2 * f, N - 2 * f);
    o.globalCompositeOperation = 'destination-out'; o.drawImage(c, 0, 0);
    return out;
  }
  const mirror = src => { const c = U.canvas(src.width, src.height), g = c.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); return c; };
  const alphaGrid = src => { const c = U.canvas(G, G), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, G, G);
    const d = g.getImageData(0, 0, G, G).data, a = new Uint8Array(G * G); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 100 ? 1 : 0; return a; };

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'seal', () => layout());
    const status = P.status;
    const stoneBox = el('div', 'se-stone'), face = el('canvas', 'se-face'), chips = el('canvas', 'se-chips');
    const form = el('div', 'se-form'), input = el('input', 'se-input'), modes = el('div', 'se-modes'), sugg = el('div', 'se-sugg');
    const paper = el('canvas', 'se-paper'), pad = el('button', 'se-pad', '<i></i><span>印泥</span>'), acts = el('div', 'se-acts');
    stoneBox.append(face, chips); form.append(input, modes, sugg);
    root.append(stoneBox, form, paper, pad, acts);
    input.maxLength = 4; input.placeholder = '刻什么字'; input.setAttribute('enterkeyhint', 'done'); input.autocomplete = 'off';
    const bBai = Kit.button(modes, '白文'), bZhu = Kit.button(modes, '朱文'), bRedo = Kit.button(acts, '重刻'), bSave = Kit.button(acts, '存为图片');
    bSave.style.setProperty('--swash', '#23D5E8'); bRedo.style.setProperty('--swash', '#ffb000');
    pad.type = 'button';
    const pal = deps.palettes[Kit.hash('seal' + date) % deps.palettes.length];
    const stoneCol = pal.c.slice().sort((a, b) => U.oklch(b)[0] - U.oklch(a)[0])[1];   // a light-ish ink of the day: the stone
    stoneBox.style.setProperty('--stone', stoneCol);
    for (const w of ['摸鱼', '躺平', '松弛', '上岸', '暴富', '情绪稳定']) { const b = el('button', 'se-chip', w); b.type = 'button'; b.onclick = () => { input.value = w; start(); }; sugg.append(b); }

    // ---- state: the text, the mode, the cut so far, the ink on the seal
    let text = '', mode = 'bai', want = null, wantGrid = null, cut = null, cutG = null, done = false, ink = 0, presses = [];
    const saved = (() => { try { return JSON.parse(localStorage.getItem('ds-seal') || 'null'); } catch (e) { return null; } })();

    // ---- layout
    let W = 0, H = 0, phone = false, S = 0, pw = 0, ph = 0, px0 = 0, py0 = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      S = phone ? Math.min(W * 0.46, H * 0.28) : Math.min(H * 0.42, W * 0.26, 380);
      const sx = phone ? 20 : W * 0.26 - S / 2, sy = phone ? 104 : 118;
      Object.assign(stoneBox.style, { left: sx + 'px', top: sy + 'px', width: S + 'px', height: S + 'px' });
      form.style.cssText = phone ? `left:${sx + S + 18}px;right:14px;top:${sy + 4}px` : `left:${sx - 20}px;width:${S + 40}px;top:${sy + S + 26}px`;
      pw = phone ? W - 32 : Math.min(W * 0.4, 560); ph = phone ? Math.max(170, H - (sy + S + 30) - 96) : Math.min(H - 230, pw * 1.1);
      px0 = phone ? 16 : W * 0.66 - pw / 2; py0 = phone ? sy + S + 22 : 118;
      Object.assign(paper.style, { left: px0 + 'px', top: py0 + 'px', width: pw + 'px', height: ph + 'px' });
      const pr = phone ? 34 : 46;
      Object.assign(pad.style, phone ? { left: px0 + pw - pr * 2 - 8 + 'px', top: py0 - pr * 0.7 + 'px', width: pr * 2 + 'px', height: pr * 2 + 'px' }
        : { left: px0 + pw + 20 + 'px', top: py0 + 10 + 'px', width: pr * 2 + 'px', height: pr * 2 + 'px' });
      acts.style.cssText = `left:${px0}px;width:${pw}px;top:${py0 + ph + 10}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${Math.min(H - 30, py0 + ph + 58)}px`;
      drawPaper(); drawFace();
    }

    // ---- the stone's face: soapstone in the day's ink, the characters pencilled on back to front, the cut darker
    let stone = null;
    function stoneTex() {
      const c = U.canvas(N, N), g = c.getContext('2d'), rnd = Print.rng(Kit.hash(stoneCol));
      g.fillStyle = stoneCol; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 9; i++) {                         // soft veins
        const x = rnd() * N, y = rnd() * N, r = N * (0.2 + rnd() * 0.4), gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rnd() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, N, N);
      }
      U.grain(g, N, N, 0.22, 3);
      return c;
    }
    function drawFace() {
      const dpr = Math.min(2, devicePixelRatio || 1), s = Math.round(S * dpr);
      if (face.width !== s) { face.width = face.height = s; chips.width = chips.height = s; }
      const g = face.getContext('2d');
      stone = stone || stoneTex();
      g.drawImage(stone, 0, 0, s, s);
      if (!want) return;
      const faceWant = mirror(want);
      if (!done) {                                          // the pencilled guide where the knife has still to go
        const t = U.canvas(N, N), tg = t.getContext('2d'); tg.drawImage(faceWant, 0, 0);
        tg.globalCompositeOperation = 'source-in'; tg.fillStyle = 'rgba(40,30,30,.22)'; tg.fillRect(0, 0, N, N);
        g.drawImage(t, 0, 0, s, s);
      }
      // the cut: a darker hollow with a lit lower edge
      const k = U.canvas(N, N), kg = k.getContext('2d'); kg.drawImage(cut, 0, 0); kg.globalCompositeOperation = 'destination-in'; kg.drawImage(faceWant, 0, 0);
      const hollow = U.canvas(N, N), hg = hollow.getContext('2d');
      hg.drawImage(k, 0, 0); hg.globalCompositeOperation = 'source-in'; hg.fillStyle = U.shade(stoneCol, 0.52); hg.fillRect(0, 0, N, N);
      hg.globalCompositeOperation = 'destination-out'; hg.globalAlpha = 0.5; hg.drawImage(k, 0, -3);
      g.drawImage(hollow, 0, 0, s, s);
      const lit = U.canvas(N, N), lg = lit.getContext('2d'); lg.drawImage(k, 0, 2); lg.globalCompositeOperation = 'destination-out'; lg.drawImage(k, 0, 0);
      lg.globalCompositeOperation = 'source-in'; lg.fillStyle = 'rgba(255,255,255,.55)'; lg.fillRect(0, 0, N, N);
      g.drawImage(lit, 0, 0, s, s);
      if (ink > 0) { g.save(); g.globalAlpha = 0.55 * ink; g.globalCompositeOperation = 'multiply'; const r = impression(1, 0); g.drawImage(mirror(r), 0, 0, s, s); g.restore(); }
    }

    // ---- starting a seal
    async function start() {
      const t = [...input.value.trim()].slice(0, 4).join('');
      if (!t) return status.flash('先写一两个字');
      text = t; done = false; ink = 0;
      await document.fonts.load(`40px "DS Phrase"`, text).catch(() => {});
      want = design(text, mode); wantGrid = alphaGrid(mirror(want));
      cut = U.canvas(N, N); cutG = new Uint8Array(G * G);
      stone = null; drawFace();
      stoneBox.classList.add('live'); pad.classList.remove('ready');
      status.set(`「${text}」${mode === 'bai' ? '白文' : '朱文'} · 印面上是反字 · 在石头上来回刮`);
    }
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); start(); } });
    input.addEventListener('change', start);
    const setMode = m => { mode = m; bBai.classList.toggle('on', m === 'bai'); bZhu.classList.toggle('on', m === 'zhu'); if (text) { input.value = text; start(); } };
    bBai.onclick = () => setMode('bai'); bZhu.onclick = () => setMode('zhu');
    bBai.classList.add('on');
    bRedo.onclick = () => { if (text) { input.value = text; start(); } else input.focus(); };

    // ---- carving: the knife takes a round bite wherever it passes, chips fly
    const flying = [];
    let carving = null;
    function bite(u, v) {
      const g = cut.getContext('2d'), r = N * 0.05;
      g.fillStyle = '#000'; g.beginPath(); g.arc(u * N, v * N, r, 0, TAU); g.fill();
      const gr = Math.ceil(r / N * G);
      for (let y = Math.floor(v * G) - gr; y <= v * G + gr; y++) for (let x = Math.floor(u * G) - gr; x <= u * G + gr; x++)
        if (x >= 0 && y >= 0 && x < G && y < G && Math.hypot(x + 0.5 - u * G, y + 0.5 - v * G) < gr) cutG[y * G + x] = 1;
      if (wantGrid[Math.min(G - 1, Math.floor(v * G)) * G + Math.min(G - 1, Math.floor(u * G))]) {
        for (let i = 0; i < 3; i++) flying.push({ x: u * S, y: v * S, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 3, t: 0 });
        Kit.buzz(2); if (Math.random() < 0.35) Kit.rustle(0.02, 0.05);
      }
    }
    function progress() { let a = 0, b = 0; for (let i = 0; i < wantGrid.length; i++) if (wantGrid[i]) { a++; if (cutG[i]) b++; } return a ? b / a : 0; }
    function drawChips() {
      const dpr = Math.min(2, devicePixelRatio || 1), g = chips.getContext('2d');
      g.clearRect(0, 0, chips.width, chips.height);
      for (let i = flying.length - 1; i >= 0; i--) {
        const c = flying[i]; c.t++; c.vy += 0.25; c.x += c.vx; c.y += c.vy;
        if (c.t > 40) { flying.splice(i, 1); continue; }
        g.fillStyle = U.shade(stoneCol, 0.85); g.globalAlpha = 1 - c.t / 40;
        g.fillRect(c.x * dpr, c.y * dpr, 3 * dpr, 2 * dpr);
      }
      g.globalAlpha = 1;
      if (flying.length) requestAnimationFrame(drawChips);
    }
    stoneBox.addEventListener('pointerdown', e => {
      if (!want || done) { if (!want) { input.focus(); status.flash('先写字'); } return; }
      try { stoneBox.setPointerCapture(e.pointerId); } catch {}
      carving = { last: null }; Kit.audio(); carveAt(e);
    });
    stoneBox.addEventListener('pointermove', e => { if (carving) carveAt(e); });
    const endCarve = () => { carving = null; };
    stoneBox.addEventListener('pointerup', endCarve); stoneBox.addEventListener('pointercancel', endCarve);
    function carveAt(e) {
      const r = face.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      const l = carving.last || { u, v }, steps = Math.max(1, Math.ceil(Math.hypot(u - l.u, v - l.v) / 0.02));
      for (let i = 1; i <= steps; i++) bite(l.u + (u - l.u) * i / steps, l.v + (v - l.v) * i / steps);
      carving.last = { u, v };
      if (flying.length) requestAnimationFrame(drawChips);
      drawFace();
      const p = progress();
      if (p >= 0.85) finish(); else status.set(`刻了 ${Math.round(p * 100)}%`);
    }
    // the last of the stone goes at once, and the edge takes a few knocks (a seal is never quite square)
    function finish() {
      done = true; carving = null;
      const g = cut.getContext('2d'); g.drawImage(mirror(want), 0, 0);
      drawFace(); Kit.thump(0.4);
      pad.classList.add('ready');
      status.set('刻好了 · 蘸一下印泥，再往纸上盖');
    }

    // ---- the print: red where stone is left standing, read the right way round; the edge chipped, the ink uneven
    let chipped = null;
    function impression(weight, seed) {
      const c = U.canvas(N, N), g = c.getContext('2d');
      g.fillStyle = RED; g.fillRect(N * 0.02, N * 0.02, N * 0.96, N * 0.96);
      g.globalCompositeOperation = 'destination-out';
      g.drawImage(want, 0, 0);                              // what was cut prints nothing (want is already read-right)
      if (!chipped) {                                       // knocks on the edge, the same every time for this seal
        chipped = U.canvas(N, N); const cg = chipped.getContext('2d'), rnd = Print.rng(Kit.hash(text + mode));
        cg.fillStyle = '#000';
        for (let i = 0; i < 16; i++) { const side = Math.floor(rnd() * 4), t = rnd() * N, r = N * (0.008 + rnd() * 0.025);
          const [x, y] = side === 0 ? [t, N * 0.02] : side === 1 ? [N * 0.98, t] : side === 2 ? [t, N * 0.98] : [N * 0.02, t];
          cg.beginPath(); cg.arc(x, y, r, 0, TAU); cg.fill(); }
      }
      g.drawImage(chipped, 0, 0);
      const rnd = Print.rng(seed * 7 + 1);
      for (let i = 0; i < 900 * (1.4 - weight); i++) { g.fillStyle = `rgba(0,0,0,${0.2 + rnd() * 0.6})`; g.beginPath(); g.arc(rnd() * N, rnd() * N, 0.8 + rnd() * 3, 0, TAU); g.fill(); }
      const fade = g.createLinearGradient(rnd() * N, 0, rnd() * N, N);
      fade.addColorStop(0, `rgba(0,0,0,${0.5 * (1 - weight)})`); fade.addColorStop(1, `rgba(0,0,0,${0.15 + 0.5 * (1 - weight)})`);
      g.fillStyle = fade; g.fillRect(0, 0, N, N);
      return c;
    }

    // ---- the ink pad, the paper
    pad.onclick = () => {
      if (!done) return status.flash(want ? '还没刻完' : '先刻一方章');
      ink = 1; Kit.thump(0.25); drawFace();
      stoneBox.animate([{ transform: 'none' }, { transform: 'translateY(4px) scale(.97)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
      status.set('蘸好了 · 点纸盖印');
    };
    function drawPaper() {
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(pw * dpr), h = Math.round(ph * dpr);
      paper.width = w; paper.height = h;
      const g = paper.getContext('2d');
      g.drawImage(Stamp.paper(w, h, dpr * 0.5, 23), 0, 0);
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(245,236,214,.5)'; g.fillRect(0, 0, w, h); g.restore();
      for (const p of presses) stampOn(g, p, dpr);
    }
    function stampOn(g, p, dpr) {
      const size = p.size * dpr;
      g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.92;
      g.translate(p.x * pw * dpr, p.y * ph * dpr); g.rotate(p.rot); g.drawImage(p.img, -size / 2, -size / 2, size, size); g.restore();
    }
    paper.addEventListener('click', e => {
      if (!done) return status.flash(want ? '先刻完' : '先刻一方章');
      if (ink <= 0.05) return status.flash('印泥干了 · 再蘸一下');
      const r = paper.getBoundingClientRect(), size = Math.min(pw, ph) * 0.36;
      const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, rot: (Math.random() - 0.5) * 0.08, size, img: impression(ink, presses.length + 1) };
      presses.push(p); stampOn(paper.getContext('2d'), p, Math.min(2, devicePixelRatio || 1));
      Kit.thump(0.5 + ink * 0.4);
      ink = Math.max(0, ink - 0.3); drawFace();
      keep();
      status.set(ink > 0.05 ? `盖了 ${presses.length} 个 · 印泥越来越淡` : '印泥用完了 · 再蘸一下');
    });
    // the seal is kept (a small print of it), so 盖戳 can strike it too
    function keep() {
      const c = U.canvas(180, 180), g = c.getContext('2d'); g.drawImage(impression(0.9, 99), 0, 0, 180, 180);
      const rec = { text, mode, img: c.toDataURL('image/png') };
      try { localStorage.setItem('ds-seal', JSON.stringify(rec)); } catch (e) { /* no room: this visit only */ }
      if (Kit.mySeal) Kit.mySeal(rec);
    }
    bSave.onclick = async () => {
      if (!presses.length) return status.flash('先盖一个');
      const s = 2, c = U.canvas(Math.round(pw * s), Math.round(ph * s)), g = c.getContext('2d');
      g.drawImage(Stamp.paper(c.width, c.height, 1, 23), 0, 0);
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(245,236,214,.5)'; g.fillRect(0, 0, c.width, c.height); g.restore();
      for (const p of presses) stampOn(g, p, s);
      const how = await Kit.save([{ cv: c, name: `seal-${text}.png` }]);
      if (how !== 'cancelled') { deps.album.add({ id: 'seal:' + Date.now(), kind: 'seal', date, image: await Kit.blobOf(c) }); status.set('存好了 · 也收进了集邮册'); }
    };

    layout();
    if (saved && saved.text) { input.value = saved.text; mode = saved.mode === 'zhu' ? 'zhu' : 'bai'; bBai.classList.toggle('on', mode === 'bai'); bZhu.classList.toggle('on', mode === 'zhu'); }
    status.set(saved ? `上次刻的是「${saved.text}」 · 改几个字或者直接开刻` : '写一到四个字 · 名字或者一句闲话');
    const ready = (saved && saved.text ? document.fonts.load('40px "DS Phrase"', saved.text).catch(() => {}) : Promise.resolve());
    return P.api({ ready, anchor: () => paper.getBoundingClientRect(), source: () => null });
  }
  Pages.define('seal', mount);
})();
