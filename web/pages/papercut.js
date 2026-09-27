// 剪纸窗花: a square of coloured paper folded four or eight times; a finger is the scissors. Every cut is made through
// all the layers at once, so unfolding it opens a symmetric window flower; cuts along a folded edge join up across it.
// The flower is then printed into a stamp (Matisse's cut-outs by way of a Chinese window): it lies on a two-ink ground,
// the word and the postmark over it, and the word's leaflet on the back.
(() => {
  const TAU = Math.PI * 2;
  // clip polygons of the square, in %: all with four points, so they morph into one another
  const SHAPES = {
    full: '0% 0%, 100% 0%, 100% 100%, 0% 100%', half: '0% 0%, 50% 0%, 50% 100%, 0% 100%',
    quarter: '0% 0%, 50% 0%, 50% 50%, 0% 50%', eighth: '0% 0%, 50% 50%, 50% 50%, 0% 50%',
  };

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'papercut', () => layout());
    const status = P.status;
    const stage = el('div', 'pc-stage'), view = el('canvas', 'pc-view'), sheet = el('canvas', 'pc-sheet'), acts = el('div', 'pc-acts'), veil = el('div', 'pc-veil');
    stage.append(sheet, view); root.append(stage, acts, veil);
    const btn = (label, swash) => { const b = Kit.button(acts, label); b.style.setProperty('--swash', swash); return b; };
    const b4 = btn('四折', '#ff5fa2'), b8 = btn('八折', '#23D5E8'), bUndo = btn('撤销', '#9f9684'), bOpen = btn('展开', '#ffb000'),
      bIssue = btn('印成邮票', '#ff6a00'), bAgain = btn('再剪一张', '#23D5E8'), bSave = btn('存为图片', '#ffb000');
    const plans = deps.homePlans || [];
    let st = plans[Home.FEATURES.findIndex(f => f.key === 'papercut')] || Kit.stampFor('papercut', deps.words, deps.palettes, 1, date);
    let pal = null, paperInk = '#E4002B';
    const setWord = s => {
      st = s; pal = Assets.palByName(st.palette);
      // the paper: the palette's loudest ink (the one furthest from grey)
      const chroma = c => { const [r, g, b] = U.hexToRgb(c); return Math.max(r, g, b) - Math.min(r, g, b); };
      paperInk = pal.c.slice().sort((a, b) => chroma(b) - chroma(a))[0];
    };
    setWord(st);

    let W = 0, H = 0, phone = false, S = 0, sx = 0, sy = 0;
    const dpr = () => Math.min(2, devicePixelRatio || 1);
    function layout() {
      ({ W, H, phone } = P.measure());
      S = phone ? Math.min(W - 44, H - 250) : Math.min(H - 250, 540);
      sx = W / 2 - S / 2; sy = phone ? 104 : 110;
      Object.assign(stage.style, { left: sx + 'px', top: sy + 'px', width: S + 'px', height: S + 'px' });
      acts.style.cssText = `left:12px;right:12px;top:${sy + S + 18}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${phone ? H - 30 : sy + S + 66}px`;
      if (card) card.place(W / 2, sy + S / 2, Math.min(S, H * 0.6) * 0.8, Math.min(S, H * 0.6));
      if (sheet.width > 4) { drawView(); if (state !== 'cut') drawSheet(); }
    }

    // ---- state: flat (choose a fold) -> cut (the folded wedge, zoomed) -> open (the flower) -> issued
    let state = 'flat', mode = 4, cuts = [];                 // a cut: {pts: [[a, b]...], w} or {dot: [a, b], r}; a, b = distance from the centre, 0..0.5
    const shown = () => {
      const m = { flat: [b4, b8], cut: [bUndo, bOpen], open: [bIssue, bAgain], issued: [bSave, bAgain] }[state];
      for (const b of [b4, b8, bUndo, bOpen, bIssue, bAgain, bSave]) b.hidden = !m.includes(b);
      stage.classList.toggle('cutting', state === 'cut');
    };

    // the folded wedge in the view: the square's top-left quarter (its bottom-right corner is the paper's middle), or,
    // folded eight times, that quarter's lower-left half
    const toView = (a, b) => [S - a * 2 * S, S - b * 2 * S];
    const inWedge = (a, b) => a >= 0 && b >= 0 && a <= 0.5 && b <= 0.5 && (mode === 4 || b <= a);
    function paperShape(g, w, h) { g.beginPath(); if (mode === 4) g.rect(0, 0, w, h); else { g.moveTo(0, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); } }
    function drawView() {
      const k = dpr(), n = Math.round(S * k); if (view.width !== n) { view.width = view.height = n; }
      const g = view.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, n, n); g.scale(k, k);
      if (state !== 'cut') return;
      g.save(); paperShape(g, S, S); g.clip();
      g.fillStyle = paperInk; g.fillRect(0, 0, S, S);
      // the folded edges: a shade where the layers turn
      const edge = (x0, y0, x1, y1) => { g.save(); g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 10; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore(); };
      edge(0, S, S, S); if (mode === 4) edge(S, 0, S, S); else edge(0, 0, S, S);
      g.globalCompositeOperation = 'destination-out';
      for (const c of cuts) cutPath(g, c, (a, b) => toView(a, b), 2 * S);
      g.restore();
      // where the folds are, in words
      g.save(); g.fillStyle = 'rgba(29,29,31,.45)'; g.font = U.font('cjk_small', 11); g.textAlign = 'center';
      g.fillText('折 边', S / 2, S - 12); if (mode === 4) { g.translate(S - 12, S / 2); g.rotate(-Math.PI / 2); g.fillText('折 边', 0, 0); } else { g.translate(S / 2 + 16, S / 2 - 16); g.rotate(Math.PI / 4); g.fillText('折 边', 0, 0); }
      g.restore();
    }
    function cutPath(g, c, map, unit) {
      if (c.dot) { const [x, y] = map(...c.dot); g.beginPath(); g.arc(x, y, c.r * unit, 0, TAU); g.fill(); return; }
      g.lineCap = g.lineJoin = 'round'; g.lineWidth = c.w * unit;
      g.beginPath(); c.pts.forEach(([a, b], i) => { const [x, y] = map(a, b); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    }
    /** the whole flower, N px square: every cut repeated through every layer */
    function flower(N) {
      const c = U.canvas(N, N), g = c.getContext('2d');
      g.fillStyle = paperInk; g.fillRect(0, 0, N, N);
      g.globalCompositeOperation = 'destination-out';
      const maps = [];
      for (const sx2 of [-1, 1]) for (const sy2 of [-1, 1]) {
        maps.push((a, b) => [(0.5 + sx2 * a) * N, (0.5 + sy2 * b) * N]);
        if (mode === 8) maps.push((a, b) => [(0.5 + sx2 * b) * N, (0.5 + sy2 * a) * N]);
      }
      for (const m of maps) for (const cut of cuts) cutPath(g, cut, m, N);
      return c;
    }
    function drawSheet() {
      const n = Math.round(S * dpr());
      if (state === 'open' || state === 'issued') { Kit.put(sheet, flower(n)); return; }
      sheet.width = sheet.height = n; const g = sheet.getContext('2d'); g.fillStyle = paperInk; g.fillRect(0, 0, n, n);
    }

    // ---- folding and unfolding: the sheet is clipped a crease at a time, then its quarter zoomed to fill the view
    const clipTo = (shape, zoom, D = 420) => sheet.animate([{}, { clipPath: `polygon(${SHAPES[shape]})`, transform: `scale(${zoom})` }], { duration: D, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' }).finished;
    async function fold(m) {
      mode = m; cuts = []; Kit.audio();
      sheet.style.transformOrigin = '0 0';
      const steps = m === 8 ? ['half', 'quarter', 'eighth'] : ['half', 'quarter'];
      for (const s of steps) { Kit.rustle(0.05, 0.2); await clipTo(s, 1); await Kit.wait(90); }
      await clipTo(steps[steps.length - 1], 2, 520);
      state = 'cut'; shown(); drawView();
      sheet.style.visibility = 'hidden';
      status.set('手指划过就是一刀 · 点一下打个孔 · 在折边上剪，展开会连成花');
    }
    async function unfold() {
      if (!cuts.length) return status.flash('先剪几刀');
      state = 'open'; drawSheet(); sheet.style.visibility = ''; drawView(); shown();
      for (const b of acts.children) b.disabled = true;
      await clipTo(mode === 8 ? 'eighth' : 'quarter', 2, 1);
      await clipTo(mode === 8 ? 'eighth' : 'quarter', 1, 520);
      const steps = mode === 8 ? ['quarter', 'half', 'full'] : ['half', 'full'];
      for (const s of steps) { Kit.rustle(0.05, 0.22); await clipTo(s, 1, 480); await Kit.wait(80); }
      for (const b of acts.children) b.disabled = false;
      status.set('展开了 · 印成一枚邮票吧');
    }
    async function reset() {
      if (card) dropCard();
      state = 'flat'; cuts = []; shown();
      sheet.getAnimations().forEach(a => a.cancel()); sheet.style.visibility = '';
      drawSheet(); drawView();
      sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease' });
      status.set('一张彩纸 · 先选四折还是八折');
    }

    // ---- cutting
    let stroke = null;
    const toPaper = e => { const r = view.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * S, y = (e.clientY - r.top) / r.height * S; return [(S - x) / (2 * S), (S - y) / (2 * S)]; };
    view.addEventListener('pointerdown', e => {
      if (state !== 'cut') return;
      view.setPointerCapture(e.pointerId); Kit.audio();
      stroke = { pts: [toPaper(e)], w: 0.026, len: 0 }; cuts.push(stroke);
    });
    view.addEventListener('pointermove', e => {
      if (!stroke) return;
      const p = toPaper(e), q = stroke.pts[stroke.pts.length - 1], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < 0.004) return;
      stroke.pts.push(p); stroke.len += d; drawView();
      if (Math.random() < 0.3) { Kit.rustle(0.03, 0.04); Kit.buzz(2); }
    });
    const up = () => {
      if (!stroke) return;
      const s = stroke; stroke = null;
      if (s.len < 0.015) { cuts[cuts.length - 1] = { dot: s.pts[0], r: 0.028 }; Kit.crackle(); }
      drawView();
    };
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);

    // ---- the stamp: the flower on a two-ink ground cut on a slant
    let card = null, out = null;
    function issueIt() {
      const others = pal.c.filter(c => c !== paperInk).sort((a, b) => U.contrast(b, paperInk) - U.contrast(a, paperInk));
      const [g1, g2] = others, fl = flower(900), seed = Kit.hash(date + cuts.length + mode);
      out = Kit.issue({ sc: 0.6, pal, phrase: st.phrase, en: st.en, date, no: st.no || 1, kicker: 'PAPER CUT · 剪纸', seed: seed % 1000, labelFill: others[2] || g1,
        art: (g, w, h) => {
          g.fillStyle = g1; g.fillRect(0, 0, w, h);
          g.fillStyle = g2; g.beginPath(); g.moveTo(0, h * 0.7); g.lineTo(w, h * 0.34); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
          const s = w * 0.84;
          g.save(); g.translate(w / 2, h * 0.47); g.rotate(-0.07);
          // the paper's shadow in the key ink, a little off: a screen print's misregistration
          const sh = U.canvas(fl.width, fl.height), sg = sh.getContext('2d'); sg.drawImage(fl, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = pal.ink; sg.fillRect(0, 0, sh.width, sh.height);
          g.drawImage(sh, -s / 2 + s * 0.018, -s / 2 + s * 0.022, s, s); sh.width = sh.height = 0;
          g.drawImage(fl, -s / 2, -s / 2, s, s);
          g.restore();
        } });
      fl.width = fl.height = 0;
      const h = Math.min(S, H * 0.6);
      card = Kit.card(root, deps, { cls: 'pc-card' }); card.place(W / 2, sy + S / 2, h * 0.8, h); card.turn(1, true);
      card.show(out, deps.makeBack(st, card.scale(), null));
      veil.classList.add('on');
      card.box.animate([{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'ease' });
      Kit.thump(0.7);
      Kit.blobOf(out).then(image => deps.album.add({ id: `papercut:${Date.now()}`, kind: 'papercut', date, image }));
      state = 'issued'; shown();
      status.set('印好了 · 收进了集邮册 · 点它翻面看说明书');
    }
    function dropCard() {
      const c = card; card = null; veil.classList.remove('on');
      c.box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => c.box.remove());
    }
    veil.addEventListener('click', () => { if (card) { dropCard(); state = 'open'; shown(); } });

    b4.onclick = () => fold(4); b8.onclick = () => fold(8);
    bUndo.onclick = () => { cuts.pop(); drawView(); };
    bOpen.onclick = unfold; bIssue.onclick = issueIt; bAgain.onclick = reset;
    bSave.onclick = async () => { if (out) await Kit.save([{ cv: out, name: `papercut-${date}.png` }]); };

    layout(); shown();
    status.set('一张彩纸 · 先选四折还是八折');
    return P.api({
      ready: Promise.resolve(),
      // the paper is cut the first time the page is opened, not while the app loads
      enter() { if (!sheet.width || sheet.width < 4) { drawSheet(); drawView(); } },
      leave() { if (state === 'flat') { sheet.width = sheet.height = 1; } },
      anchor: () => { const h = S * 0.9; return new DOMRect(W / 2 - h * 0.4, sy + S / 2 - h / 2, h * 0.8, h); },
      receive(s) { if (state === 'flat') { setWord(s); drawSheet(); } else setWord(s); },
      source: () => (card ? out : null),
    });
  }
  Pages.define('papercut', mount);
})();
