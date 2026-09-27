// 撕一张: a pane of 32 stamps lies face down on the desk with a pop poster hidden under it. Once a day one stamp is torn
// off along its perforations, bridge by bridge (the paper swings round what still holds it, curls up toward the hand,
// leaves fibres on both edges, crackles and buzzes), then flies clear and turns over to print. The hole it leaves shows a
// piece of the poster; 32 days clear the pane and the whole poster, then a new pane lies on a new poster.
const Tear = (() => {
  const COLS = 8, ROWS = 4, N = COLS * ROWS, KEY = 'dc-tear', TAU = Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const FREE = params.has('tearfree');                    // test: no one-a-day limit
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FIBRE = '#EBE4D3';

  // ---- the pane: cells, neighbours, which may be torn (one side on the pane's edge or on a hole)
  const rc = k => [Math.floor(k / COLS), k % COLS];
  const nb = (k, side) => {                               // sides clockwise: 0 top, 1 right, 2 bottom, 3 left; -1 = pane edge
    const [r, c] = rc(k), [dr, dc] = [[-1, 0], [0, 1], [1, 0], [0, -1]][side], R = r + dr, C = c + dc;
    return R < 0 || R >= ROWS || C < 0 || C >= COLS ? -1 : R * COLS + C;
  };
  const tearable = (k, torn) => !torn.has(k) && [0, 1, 2, 3].some(s => { const n = nb(k, s); return n < 0 || torn.has(n); });

  const stampFor = (date, pane, cell, no, words, palettes) => Kit.stampFor(`${date}|${pane}|${cell}`, words, palettes, no, date);

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window: the tear lives for this visit */ } };

  // the poster's three ink plates (R = key, G = magenta, B = cyan), from the channel-mask PNG
  function posterMasks(img) {
    const w = img.naturalWidth, h = img.naturalHeight, src = U.canvas(w, h), sg = src.getContext('2d');
    sg.drawImage(img, 0, 0);
    const d = sg.getImageData(0, 0, w, h).data;
    const out = [0, 1, 2].map(() => { const c = U.canvas(w, h); return { c, id: c.getContext('2d').createImageData(w, h) }; });
    for (let i = 0; i < d.length; i += 4) {
      const ch = d[i] > 127 ? 0 : d[i + 1] > 127 ? 1 : d[i + 2] > 127 ? 2 : -1;
      if (ch >= 0) out[ch].id.data[i + 3] = 255;
    }
    return out.map(o => { o.c.getContext('2d').putImageData(o.id, 0, 0); return o.c; });
  }

  /** deps: {date, words, palettes, makeFront, makeBack, printIn, loadLeaflet}; returns {ready, anchor(), source()} */
  function mount(root, deps) {
    const { date, words, palettes } = deps;
    Kit.head(root, 'tear');
    const paneEl = el('div', 'tear-pane'), posterCv = el('canvas', 'tear-poster'), sheetCv = el('canvas', 'tear-sheet');
    const status = el('p', 'kit-status'), spot = el('p', 'tear-spot', '今天这一枚<br>会落在这里');
    paneEl.append(posterCv, sheetCv);
    root.append(paneEl, status, spot);
    root.tabIndex = 0;
    root.style.opacity = '0';

    // ---- saved state: {pane, torn: [{cell, date, st}], done: [earlier panes]}
    let S = load();
    if (!S || !Array.isArray(S.torn)) S = { pane: 1, torn: [], done: [] };
    if (params.has('tearfill')) {                           // test: tear n cells first, in an order a hand could have
      const n = clamp(+params.get('tearfill') || 0, 0, N), rnd = Print.rng(99);
      S = { pane: S.pane, torn: [], done: S.done || [] };
      while (S.torn.length < n) {
        const set = new Set(S.torn.map(t => t.cell)), cand = [...Array(N).keys()].filter(k => tearable(k, set));
        S.torn.push({ cell: cand[Math.floor(rnd() * cand.length)], date: '2000-01-01', st: null });
      }
      save(S);
    }
    // a finished pane gives way to a fresh one (and the next poster) the day after
    if (S.torn.length >= N && S.torn[S.torn.length - 1].date !== date) {
      S.done = [...(S.done || []), { pane: S.pane, torn: S.torn }]; S.pane++; S.torn = []; save(S);
    }
    const tornSet = () => new Set(S.torn.map(t => t.cell));
    const todays = () => S.torn.filter(t => t.date === date && t.st).slice(-1)[0] || null;
    const canTear = () => FREE || !todays();

    // ---- layout. Pane-local units are CSS px; on a tall screen the pane lies on its side (rotated 90°)
    let W = 0, H = 0, portrait = false, cw = 0, ch = 0, M = 0, pw = 0, ph = 0, ox = 0, oy = 0, dpr = 1;
    let cardW = 0, cardH = 0, cardX = 0, cardY = 0;
    const toLocal = (sx, sy) => portrait ? { x: sy - oy, y: ox - sx } : { x: sx - ox, y: sy - oy };
    const toScreen = (lx, ly) => portrait ? { x: ox - ly, y: oy + lx } : { x: ox + lx, y: oy + ly };
    function layout() {
      W = innerWidth; H = innerHeight; portrait = W < H; dpr = Math.min(2, devicePixelRatio || 1);
      cw = portrait ? Math.min(H * 0.6 / 8.6, (W - 32) / 5.6) : Math.min(W * 0.6 / 8.6, (H - 210) / 5.6);
      ch = cw * 1.25; M = cw * 0.3; pw = COLS * cw + 2 * M; ph = ROWS * ch + 2 * M;
      if (!portrait) {
        const left = Math.max(28, W * 0.05);
        ox = left; oy = Math.max(118, (H - ph) / 2 + 18);
        cardH = Math.min(H * 0.55, (W - left - pw) * 0.78 * 1.25); cardW = cardH * 0.8;
        cardX = (left + pw + W) / 2; cardY = oy + ph / 2;
        paneEl.style.transform = `translate(${ox}px, ${oy}px)`;
        Object.assign(status.style, { left: ox + 'px', width: pw + 'px', top: oy + ph + 16 + 'px' });
      } else {
        const L = (W - ph) / 2, T = Math.max(96, (H - pw) / 2 + 20);
        ox = L + ph; oy = T;
        paneEl.style.transform = `translate(${ox}px, ${oy}px) rotate(90deg)`;
        cardH = Math.min(H * 0.5, W * 0.78 * 1.25); cardW = cardH * 0.8; cardX = W / 2; cardY = T + pw / 2;
        Object.assign(status.style, { left: '16px', width: W - 32 + 'px', top: T + pw + 12 + 'px' });
      }
      Object.assign(paneEl.style, { width: pw + 'px', height: ph + 'px' });
      Object.assign(spot.style, { left: cardX + 'px', top: cardY + 'px', display: portrait ? 'none' : '' });
    }

    // ---- perforation geometry: holes sit on the grid lines, a whole number per cell edge, so corners line up
    const pitch = () => cw * 0.062, holeR = () => cw * 0.019;
    const segN = len => Math.max(2, Math.round(len / pitch()));
    const cellRect = k => { const [r, c] = rc(k); return { x0: M + c * cw, y0: M + r * ch, x1: M + (c + 1) * cw, y1: M + (r + 1) * ch }; };
    const cellAt = p => {
      const c = Math.floor((p.x - M) / cw), r = Math.floor((p.y - M) / ch);
      return c < 0 || c >= COLS || r < 0 || r >= ROWS ? -1 : r * COLS + c;
    };
    /** a torn edge from (ax, ay) to (bx, by): each bridge between two holes breaks ragged, with a few loose fibres,
     *  sticking out along (nx, ny). Drawn in pane-local units on a context already scaled to them. */
    function raggedEdge(g, ax, ay, bx, by, nx, ny, rnd, only = null) {
      const len = Math.hypot(bx - ax, by - ay), n = segN(len), ux = (bx - ax) / len, uy = (by - ay) / len, r = holeR();
      g.fillStyle = FIBRE; g.strokeStyle = FIBRE; g.lineWidth = Math.max(0.35, cw * 0.004); g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        if (only !== null && only !== i) continue;
        const s0 = i * len / n + r * 0.9, s1 = (i + 1) * len / n - r * 0.9, steps = 5;
        g.beginPath(); g.moveTo(ax + ux * s0, ay + uy * s0);
        for (let j = 0; j <= steps; j++) {
          const s = s0 + (s1 - s0) * j / steps, out = (0.25 + rnd()) * cw * 0.011 * Math.sin(Math.PI * j / steps);
          g.lineTo(ax + ux * s + nx * out, ay + uy * s + ny * out);
        }
        g.lineTo(ax + ux * s1, ay + uy * s1); g.closePath(); g.fill();
        for (let f = 0, m = 1 + Math.floor(rnd() * 3); f < m; f++) {
          const s = s0 + (s1 - s0) * rnd(), l = cw * (0.012 + rnd() * 0.022), a = (rnd() - 0.5) * 1.3;
          const dx = nx * Math.cos(a) - ny * Math.sin(a), dy = nx * Math.sin(a) + ny * Math.cos(a);
          const x = ax + ux * s, y = ay + uy * s;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * l * 0.5 + ux * l * 0.3 * (rnd() - 0.5), y + dy * l * 0.5 + uy * l * 0.3 * (rnd() - 0.5), x + dx * l, y + dy * l); g.stroke();
        }
      }
    }
    // the four edges of a cell (clockwise), with the outward normal of the cell
    const edgesOf = k => {
      const { x0, y0, x1, y1 } = cellRect(k);
      return [[x0, y0, x1, y0, 0, -1], [x1, y0, x1, y1, 1, 0], [x1, y1, x0, y1, 0, 1], [x0, y1, x0, y0, -1, 0]];
    };
    /** clear a cell out of a pane canvas; what is left around it keeps half holes and ragged, fibrous bridges */
    function cutCell(g, k, rnd) {
      const { x0, y0, x1, y1 } = cellRect(k), torn = tornSet();
      g.save(); g.clearRect(x0, y0, x1 - x0, y1 - y0);
      edgesOf(k).forEach(([ax, ay, bx, by, nx, ny], s) => {
        const n = nb(k, s);
        if (n >= 0 && torn.has(n) && n !== k) return;          // nothing left on that side to tear
        raggedEdge(g, ax, ay, bx, by, -nx, -ny, rnd);             // the neighbour's fibres point into the hole
      });
      g.restore();
    }

    // ---- the pane's back: warm gum paper with a diagonal sheen, a faint watermark seal per stamp, real holes
    let paneBase = null;
    function renderPane() {
      const w = Math.round(pw * dpr), h = Math.round(ph * dpr);
      const cv = Stamp.paper(w, h, cw * dpr / 1200 * 2.2, 17 + S.pane), g = cv.getContext('2d');
      g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(238,224,190,.28)'; g.fillRect(0, 0, w, h); g.restore();
      const sheen = g.createLinearGradient(w * 0.05, 0, w * 0.6, h);
      sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.46, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.53, 'rgba(255,255,255,.20)'); sheen.addColorStop(0.62, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sheen; g.fillRect(0, 0, w, h);
      U.grain(g, w, h, 0.18, 9);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const wm = 'rgba(128,104,66,.15)';
      for (let k = 0; k < N; k++) {
        const { x0, y0 } = cellRect(k);
        g.save(); g.translate(x0 + cw / 2, y0 + ch / 2); g.rotate(-0.52 + (k % 3) * 0.05);
        g.strokeStyle = wm; g.lineWidth = Math.max(0.6, cw * 0.01);
        g.beginPath(); g.arc(0, 0, cw * 0.2, 0, TAU); g.stroke();
        g.beginPath(); g.arc(0, 0, cw * 0.168, 0, TAU); g.stroke();
        U.drawCentered(g, 0, 0, '每日邮政', U.font('cjk_small', Math.max(6, Math.round(cw * 0.066))), wm);
        g.restore();
      }
      // holes: along every grid line, and a little way into the selvage
      const rnd = Print.rng(7 + S.pane), r = holeR(), ext = M * 0.7;
      g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
      const line = (ax, ay, bx, by) => {
        const n = segN(Math.hypot(bx - ax, by - ay));
        for (let i = 0; i <= n; i++) { g.beginPath(); g.arc(ax + (bx - ax) * i / n, ay + (by - ay) * i / n, r * (0.94 + rnd() * 0.12), 0, TAU); g.fill(); }
      };
      for (let c = 0; c <= COLS; c++) {
        const x = M + c * cw; line(x, M - ext, x, M); line(x, ph - M, x, ph - M + ext);
        for (let rr = 0; rr < ROWS; rr++) line(x, M + rr * ch, x, M + (rr + 1) * ch);
      }
      for (let rr = 0; rr <= ROWS; rr++) {
        const y = M + rr * ch; line(M - ext, y, M, y); line(pw - M, y, pw - M + ext, y);
        for (let c = 0; c < COLS; c++) line(M + c * cw, y, M + (c + 1) * cw, y);
      }
      g.restore();
      const cut = Print.rng(31 + S.pane);
      for (const t of S.torn) cutCell(g, t.cell, cut);
      paneBase = cv;
      showSheet();
    }
    function showSheet() {
      sheetCv.width = paneBase.width; sheetCv.height = paneBase.height;
      Object.assign(sheetCv.style, { width: pw + 'px', height: ph + 'px' });
      const g = sheetCv.getContext('2d'); g.drawImage(paneBase, 0, 0);
      if (piece) { g.setTransform(dpr, 0, 0, dpr, 0, 0); cutCell(g, piece.k, Print.rng(piece.k + 5)); }
      sheetCv.style.opacity = S.torn.length >= N ? '0' : '';
    }

    // ---- the poster: this pane's picture, printed in the pane's palette over a two-ink comic sunburst
    let poster = null;                                          // {masks} or {emblem} (fallback)
    const posterRect = () => ({ x: M * 0.45, y: M * 0.45, w: pw - M * 0.9, h: ph - M * 0.9 });
    async function loadPoster() {
      const list = await fetch('/posters/index.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => []);
      if (list.length) {
        const it = list[(S.pane - 1) % list.length];
        const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = '/' + it.file + '?v=' + it.v; });
        if (img) return { masks: posterMasks(img) };
      }
      const ws = words.filter(e => e.img);                     // no poster drawn yet: a library emblem, blown up
      return ws.length ? { emblem: ws[(S.pane * 5) % ws.length] } : {};
    }
    function renderPoster() {
      const R = posterRect(), w = Math.round(R.w * dpr), h = Math.round(R.h * dpr);
      const cv = posterCv, g = cv.getContext('2d');
      cv.width = w; cv.height = h;
      Object.assign(cv.style, { left: R.x + 'px', top: R.y + 'px', width: R.w + 'px', height: R.h + 'px' });
      // a palette with no paper-pale ink, or the poster would read as bare paper through the holes
      const pals = palettes.filter(q => q.c.every(x => U.contrast(x, Stamp.PAPER) > 1.25));
      const rnd = Print.rng(S.pane * 131 + 7), pal = pals[Math.floor(rnd() * pals.length)], c = Colors.roles(pal, Math.floor(rnd() * 4));
      g.fillStyle = c[0]; g.fillRect(0, 0, w, h);
      Pattern.rays(g, w * (0.3 + rnd() * 0.4), h * (0.3 + rnd() * 0.4), 28, c[1], Math.hypot(w, h), rnd() * TAU);
      const plate = (m, col, dx, dy, box) => g.drawImage(Print.tinted(m, col, box.w), box.x + dx * dpr, box.y + dy * dpr, box.w, box.h);
      if (poster && poster.masks) {
        const [key, mag, cyan] = poster.masks, k = Math.max(w / key.width, h / key.height);
        const box = { w: key.width * k, h: key.height * k }; box.x = (w - box.w) / 2; box.y = (h - box.h) / 2;
        plate(cyan, c[2], 1.5, -1, box); plate(mag, c[3], 1.5, -1, box); plate(key, pal.ink, -1, 1, box);
      } else if (poster && poster.emblem) {
        const [key, acc, band] = Print.channelMasks(poster.emblem), s = h * 1.25;
        const box = { x: w * 0.62 - s / 2, y: h * 0.55 - s / 2, w: s, h: s };
        plate(band, c[2], 1.5, -1, box); plate(acc, c[3], 1.5, -1, box); plate(key, pal.ink, -1, 1, box);
      }
      U.grain(g, w, h, 0.22, 5);
    }

    // ---- the piece being torn
    let piece = null;
    function makePiece(k) {
      const { x0, y0, x1, y1 } = cellRect(k), pad = cw * 0.06, w = x1 - x0 + 2 * pad, h = y1 - y0 + 2 * pad;
      const cv = U.canvas(Math.round(w * dpr), Math.round(h * dpr)), g = cv.getContext('2d');
      g.drawImage(paneBase, (x0 - pad) * dpr, (y0 - pad) * dpr, w * dpr, h * dpr, 0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'destination-in'; g.fillRect(pad * dpr, pad * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr);
      g.globalCompositeOperation = 'source-over'; g.setTransform(dpr, 0, 0, dpr, -(x0 - pad) * dpr, -(y0 - pad) * dpr);
      const torn = tornSet(), frnd = Print.rng(k * 13 + 1);
      edgesOf(k).forEach(([ax, ay, bx, by, nx, ny], s) => { const n = nb(k, s); if (n >= 0 && torn.has(n)) raggedEdge(g, ax, ay, bx, by, nx, ny, frnd); });
      const box = el('div', 'tear-piece'), shadow = el('div', 'tear-piece-shadow'), inner = el('div', 'tear-piece-in'), gloss = el('div', 'tear-gloss');
      const mask = `url("${cv.toDataURL()}")`; gloss.style.maskImage = mask; gloss.style.webkitMaskImage = mask;
      inner.append(cv, gloss); box.append(shadow, inner);
      Object.assign(box.style, { left: x0 - pad + 'px', top: y0 - pad + 'px', width: w + 'px', height: h + 'px' });
      paneEl.append(box);
      const p = { k, box, inner, shadow, gloss, cv, g, org: { x: x0 - pad, y: y0 - pad }, pad, x0, y0, x1, y1,
        bridges: null, next: 0, effort: 0, theta: 0, jolt: 0, rest: 0, t: { x: 0, y: 0 }, P: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
        lift: 0, hover: 0, holding: false, free: false, grab: null, ptr: null, lastBreak: 0, vel: { x: 0, y: 0 } };
      piece = p; showSheet();
      return p;
    }
    function dropPiece() {
      if (!piece || piece.next > 0 || piece.holding) return;
      piece.box.remove(); piece = null; showSheet();
    }
    /** the path the tear runs: the sides still attached, from the free side on, or from the pane-edge corner nearest
     *  the hand; each bridge between two holes has its own strength, corners and the very first one are tougher */
    function arm(p, grab) {
      const k = p.k, torn = tornSet(), { x0, y0, x1, y1 } = p, corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      const sides = edgesOf(k).map(([ax, ay, bx, by, nx, ny], s) => {
        const len = Math.hypot(bx - ax, by - ay), n = segN(len), pts = [];
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx, ny, s, i, n, ax, ay, bx, by }); }
        const o = nb(k, s);
        return { pts, attached: o < 0 || !torn.has(o), border: o < 0 };
      });
      let order = [];
      const free = sides.findIndex(sd => !sd.attached);
      if (free >= 0) for (let j = 1; j <= 4; j++) { const sd = sides[(free + j) % 4]; if (sd.attached) order.push(...sd.pts); }
      else {
        let best = Infinity, start = 0, clockwise = true;
        corners.forEach(([cx, cy], j) => {
          const d = Math.hypot(cx - grab.x, cy - grab.y);
          if (d < best && (sides[j].border || sides[(j + 3) % 4].border)) { best = d; start = j; clockwise = sides[j].border; }
        });
        if (clockwise) for (let j = 0; j < 4; j++) order.push(...sides[(start + j) % 4].pts);
        else for (let j = 1; j <= 4; j++) order.push(...sides[(start - j + 4) % 4].pts.slice().reverse());
      }
      const nSides = sides.filter(sd => sd.attached).length, total = cw * 0.95 * nSides;
      order.forEach((b, i) => { b.cost = (0.55 + Math.random() * 0.9) * (b.i === 0 || b.i === b.n - 1 ? 1.7 : 1) * (i === 0 ? 2.4 : 1); });
      const sum = order.reduce((a, b) => a + b.cost, 0);
      let acc = 0; order.forEach(b => { acc += b.cost / sum * total; b.cum = acc; });
      p.bridges = order; p.total = total; p.next = 0; p.effort = 0;
    }
    function breakOne(p, t) {
      const b = p.bridges[p.next++]; p.lastBreak = t;
      p.g.save(); raggedEdge(p.g, b.ax, b.ay, b.bx, b.by, b.nx, b.ny, Math.random, b.i); p.g.restore();
      p.jolt += (p.theta >= 0 ? 1 : -1) * (0.006 + Math.random() * 0.012); p.lift += 1.6;
      if (p.next < p.bridges.length) return Kit.crackle();
      Kit.crackle(true); p.free = true;
      reanchor(p, { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2 });
      p.thetaFree = p.theta;
      commit(p);
    }
    // moving the pivot keeps the paper where it is: the offset absorbs the difference, then settles
    function reanchor(p, P) {
      const c = Math.cos(p.theta), s = Math.sin(p.theta);
      const f = Q => ({ x: Q.x - (c * Q.x - s * Q.y), y: Q.y - (s * Q.x + c * Q.y) });
      const a = f(p.P), b = f(P);
      p.t.x += a.x - b.x; p.t.y += a.y - b.y; p.P = P;
    }

    // ---- once a day: the stamp is free. Save it, then it flies clear and turns over
    let card = null;
    function commit(p) {
      const no = (S.pane - 1) * N + S.torn.length + 1, st = stampFor(date, S.pane, p.k, no, words, palettes);
      S.torn.push({ cell: p.k, date, st }); save(S);
      if (deps.album) deps.album.add({ id: `tear:${S.pane}:${p.k}`, kind: 'tear', date, st });
      const g = paneBase.getContext('2d'); g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); cutCell(g, p.k, Print.rng(p.k + 5)); g.restore();
      p.st = st; setStatus();
      if (!p.holding) reveal(p);
    }
    const newCard = () => { const c = Kit.card(root, deps, { cls: 'tear-card' }); c.place(cardX, cardY, cardW, cardH); return c; };
    async function reveal(p) {
      spot.style.opacity = '0';
      const pc = { x: p.pad + (p.x1 - p.x0) / 2, y: p.pad + (p.y1 - p.y0) / 2 };      // the piece's middle, where it is now
      const Pd = { x: p.P.x - p.org.x, y: p.P.y - p.org.y }, c0 = Math.cos(p.theta), s0 = Math.sin(p.theta);
      const qx = c0 * (pc.x - Pd.x) - s0 * (pc.y - Pd.y) + Pd.x + p.t.x + p.org.x, qy = s0 * (pc.x - Pd.x) + c0 * (pc.y - Pd.y) + Pd.y + p.t.y + p.org.y;
      const at = toScreen(qx, qy), ang = p.theta + (portrait ? Math.PI / 2 : 0), k = cw / cardW;
      if (card) card.box.remove();
      const c = card = newCard();
      Kit.put(c.back, Kit.gum(c.scale(), 3 + p.k));
      const start = `translate(${at.x - cardX}px, ${at.y - cardY}px) rotate(${ang}rad) scale(${k * 1.03})`;
      const lifted = `translate(${at.x - cardX}px, ${at.y - cardY - cw * 0.12}px) rotate(${ang * 0.8}rad) scale(${k * 1.1})`;
      const rest = 'translate(0px, 0px) rotate(-2.5deg) scale(1)';
      c.box.style.transform = start;
      c.box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, fill: 'backwards' });
      p.box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }).finished.then(() => p.box.remove());
      piece = null;
      if (reduce) { c.box.style.transform = rest; c.box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 }); c.turn(1); await c.print(p.st); return finish(); }
      // a beat in the air so the eye goes to the hole and the poster in it, then over to its place and over
      await c.box.animate([{ transform: start }, { transform: lifted }], { duration: 520, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' }).finished;
      await new Promise(r => setTimeout(r, 260));
      const fly = c.box.animate([{ transform: lifted }, { transform: rest }], { duration: 1000, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
      setTimeout(() => c.turn(1), 520);
      await new Promise(r => setTimeout(r, 520 + 430));                 // halfway over, the front starts to print
      const printing = c.print(p.st);
      await fly.finished; c.box.style.transform = rest; fly.cancel();
      await printing;
      finish();
    }
    function finish() {
      if (S.torn.length >= N) sheetCv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1600, easing: 'ease', fill: 'forwards' });
      setStatus();
    }
    /** today's stamp, already torn: it fades onto its place and prints again */
    function showToday() {
      const t = todays(); if (!t) return;
      spot.style.opacity = '0';
      const c = card = newCard();
      c.box.style.transform = 'rotate(-2.5deg)'; c.turn(1, true);
      Kit.put(c.front, Stamp.blank(c.scale(), 3 + t.cell));
      c.box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease', fill: 'backwards' });
      setTimeout(() => c.print(t.st), 300);
    }

    // ---- status line
    let flashT = 0;
    function setStatus(msg) {
      clearTimeout(flashT);
      const n = S.torn.length;
      const base = n >= N ? `第 ${S.pane} 辑 · 海报集齐` : `第 ${S.pane} 辑 · 已撕 ${n} / ${N} · ` + (canTear() ? '背后藏着一张海报' : '今天撕过了 · 明天再来');
      status.textContent = msg || base;
      status.classList.toggle('flash', !!msg);
      if (msg) flashT = setTimeout(() => setStatus(), 2200);
    }
    function shake(k) {
      if (piece) return;
      const p = makePiece(k); p.shaking = true;
      p.box.style.transformOrigin = '50% 50%';
      p.box.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(1.4deg)' }, { transform: 'rotate(-1.1deg)' }, { transform: 'rotate(.6deg)' }, { transform: 'rotate(0)' }],
        { duration: 420, easing: 'ease-out' }).finished.then(() => { if (piece === p) { p.shaking = false; dropPiece(); } });
    }

    // ---- input
    let hoverK = -1;
    const cursor = k => { root.style.cursor = k >= 0 && canTear() && tearable(k, tornSet()) && (!piece || piece.k === k || !piece.next) ? 'grab' : ''; };
    function hover(k) {
      if (piece && (piece.next > 0 || piece.holding || piece.shaking || piece.free)) return;
      if (k === hoverK && piece) return;
      hoverK = k;
      if (piece) dropPiece();
      if (k >= 0 && canTear() && tearable(k, tornSet())) makePiece(k).hoverOn = true;
    }
    function begin(k, at, auto = false) {
      Kit.audio();
      let p = piece && piece.k === k ? piece : null;
      if (!p) { if (piece) { if (piece.next > 0) return setStatus('先把这一枚撕下来'); dropPiece(); } p = makePiece(k); }
      if (!p.next) arm(p, at);
      p.holding = true; p.grab = { ...at }; p.ptr = { ...at }; p.auto = auto; p.autoT = 0; p.moved = 0;
      // the grab point, fixed on the paper (in the piece's own frame)
      const c = Math.cos(-p.theta), s = Math.sin(-p.theta), Pd = { x: p.P.x - p.org.x, y: p.P.y - p.org.y };
      const lx = at.x - p.org.x - p.t.x - Pd.x, ly = at.y - p.org.y - p.t.y - Pd.y;
      p.grabDiv = { x: c * lx - s * ly + Pd.x, y: s * lx + c * ly + Pd.y };
      root.style.cursor = 'grabbing';
    }
    function end(p) {
      p.holding = false; p.auto = false; root.style.cursor = '';
      if (p.free) { if (p.st) reveal(p); return; }
      p.rest = p.theta * 0.35;
      if (!p.moved) { p.jolt += 0.03; setStatus('按住，往外拉'); }
    }
    let down = null;
    paneEl.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const at = toLocal(e.clientX, e.clientY), k = cellAt(at), torn = tornSet();
      if (k < 0 || torn.has(k) || (piece && piece.free)) return;
      if (!canTear()) return setStatus('今天撕过了 · 明天再来');
      if (!tearable(k, torn)) { shake(k); return setStatus('先从边上撕起'); }
      if (piece && piece.next > 0 && piece.k !== k) return setStatus('先把这一枚撕下来');
      e.preventDefault();
      paneEl.setPointerCapture(e.pointerId);
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
      begin(k, at, reduce);
    });
    paneEl.addEventListener('pointermove', e => {
      const at = toLocal(e.clientX, e.clientY);
      if (!down || down.id !== e.pointerId) { if (e.pointerType === 'mouse') { const k = cellAt(at); hover(k); cursor(k); } return; }
      const p = piece; if (!p || !p.holding) return;
      const dx = at.x - p.ptr.x, dy = at.y - p.ptr.y, d = Math.hypot(dx, dy), dt = Math.max(1, e.timeStamp - down.t);
      p.vel = { x: dx / dt, y: dy / dt }; down.t = e.timeStamp;
      p.ptr = at; p.moved += d;
      // only a pull tears: wiggling on the spot does little until the hand has moved off where it took hold
      const pull = Math.hypot(at.x - p.grab.x, at.y - p.grab.y);
      p.effort += d * clamp((pull - cw * 0.03) / (cw * 0.12), 0, 1);
    });
    const up = e => { if (!down || down.id !== e.pointerId) return; down = null; if (piece && piece.holding && !piece.auto) end(piece); };
    paneEl.addEventListener('pointerup', up);
    paneEl.addEventListener('pointercancel', up);
    paneEl.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !down) { hover(-1); cursor(-1); } });
    // keyboard: arrows pick a stamp that can be torn, Enter tears it off
    let focusK = -1;
    root.addEventListener('keydown', e => {
      if (!Kit.visible(root)) return;
      const torn = tornSet(), ok = [...Array(N).keys()].filter(k => tearable(k, torn));
      if (!ok.length || !canTear()) return;
      const mv = { ArrowRight: 1, ArrowDown: COLS, ArrowLeft: -1, ArrowUp: -COLS }[e.key];
      if (mv) {
        e.preventDefault();
        let k = focusK < 0 ? ok[0] : focusK;
        for (let i = 0; i < N; i++) { k = (k + mv + N) % N; if (ok.includes(k)) break; }
        focusK = k; hover(k);
      } else if ((e.key === 'Enter' || e.key === ' ') && focusK >= 0 && !(piece && piece.holding)) {
        e.preventDefault();
        const { x0, y0, x1, y1 } = cellRect(focusK); begin(focusK, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, true);
      }
    });

    // ---- the loop: the paper swings round what still holds it, curls up toward the hand, lifts off
    function step(dt, now) {
      const p = piece; if (!p || p.shaking) return;
      if (p.auto && p.holding) {                              // keyboard / reduced motion: a steady pull with a little wiggle
        p.autoT += dt;
        const b = p.bridges[0], dir = { x: b.nx * 0.7 - b.ny * 0.7, y: b.ny * 0.7 + b.nx * 0.7 }, a = Math.min(1, p.autoT / 300);
        p.ptr = { x: p.grab.x + dir.x * cw * 0.35 * a + Math.sin(p.autoT / 90) * cw * 0.06, y: p.grab.y + dir.y * cw * 0.35 * a + Math.cos(p.autoT / 110) * cw * 0.06 };
        p.effort += dt * p.total / (reduce ? 500 : 1500); p.moved = 1;
      }
      if (p.bridges && !p.free && p.next < p.bridges.length && p.effort >= p.bridges[p.next].cum && now - p.lastBreak > 14 + Math.random() * 22) breakOne(p, now);
      if (p.auto && p.free && p.holding) { end(p); return; }
      const k1 = x => 1 - Math.exp(-dt / x);
      if (!p.free) {
        const rest = p.bridges ? p.bridges.slice(p.next) : [];
        if (rest.length) {
          const P = rest.reduce((a, b) => ({ x: a.x + b.x / rest.length, y: a.y + b.y / rest.length }), { x: 0, y: 0 });
          if (Math.hypot(P.x - p.P.x, P.y - p.P.y) > 0.01) reanchor(p, P);
        }
        const broken = p.bridges ? p.next / p.bridges.length : 0;
        let target = p.rest;
        if (p.holding) {
          const ax = p.grab.x - p.P.x, ay = p.grab.y - p.P.y, bx = p.ptr.x - p.P.x, by = p.ptr.y - p.P.y;
          const a = Math.atan2(ax * by - ay * bx, ax * bx + ay * by), allow = 0.018 + 0.26 * Math.pow(broken, 0.8);
          target = clamp(a * 0.55, -allow, allow);
        }
        p.theta += (target + p.jolt - p.theta) * k1(55);
        p.jolt *= Math.exp(-dt / 60);
        p.t.x *= Math.exp(-dt / 110); p.t.y *= Math.exp(-dt / 110);
        p.lift += ((p.holding ? 5 + 24 * broken : 3 * broken) - p.lift) * k1(90);
      } else if (p.holding) {                                  // free: it hangs from the fingers, swinging with the hand
        const vt = clamp(p.vel.x * 0.35, -0.3, 0.3);
        p.theta += (p.thetaFree * 0.5 + vt - p.theta) * k1(120);
        const Pd = { x: p.P.x - p.org.x, y: p.P.y - p.org.y }, c = Math.cos(p.theta), s = Math.sin(p.theta);
        const gx = p.grabDiv.x - Pd.x, gy = p.grabDiv.y - Pd.y;
        const tx = p.ptr.x - p.org.x - (c * gx - s * gy + Pd.x), ty = p.ptr.y - p.org.y - (s * gx + c * gy + Pd.y);
        p.t.x += (tx - p.t.x) * k1(70); p.t.y += (ty - p.t.y) * k1(70);
        p.lift += (30 - p.lift) * k1(120);
      }
      p.hover += ((p.hoverOn && !p.holding && !p.next ? 1 : 0) - p.hover) * k1(90);
      apply(p);
    }
    function apply(p) {
      const Pd = { x: p.P.x - p.org.x, y: p.P.y - p.org.y };
      p.box.style.transform = `translate(${(Pd.x + p.t.x).toFixed(2)}px, ${(Pd.y + p.t.y).toFixed(2)}px) rotate(${p.theta.toFixed(4)}rad) translate(${(-Pd.x).toFixed(2)}px, ${(-Pd.y).toFixed(2)}px)`;
      // the curl: the paper bends up around the attachment furthest from the hand
      const hand = p.ptr || { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2 };
      const rest = p.bridges && !p.free ? p.bridges.slice(p.next) : null;
      let O = { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2 };
      if (rest && rest.length) O = rest.reduce((a, b) => (Math.hypot(b.x - hand.x, b.y - hand.y) > Math.hypot(a.x - hand.x, a.y - hand.y) ? b : a));
      let dx = hand.x - O.x, dy = hand.y - O.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const lift = reduce ? 0 : p.lift, h = p.hover;
      p.inner.style.transformOrigin = `${(O.x - p.org.x).toFixed(1)}px ${(O.y - p.org.y).toFixed(1)}px`;
      p.inner.style.transform = `perspective(${(cw * 7).toFixed(0)}px) rotate3d(${(-dy).toFixed(3)}, ${dx.toFixed(3)}, 0, ${(-lift).toFixed(2)}deg) translateY(${(-h * 1.5).toFixed(2)}px) scale(${(1 + h * 0.012 + lift * 0.001).toFixed(4)})`;
      const L = Math.min(1, lift / 30 + h * 0.25);
      p.shadow.style.opacity = (L * 0.55).toFixed(3);
      p.shadow.style.transform = `translate(${(L * cw * 0.05).toFixed(2)}px, ${(L * cw * 0.1).toFixed(2)}px) scale(${(1 + L * 0.04).toFixed(3)})`;
      p.shadow.style.filter = `blur(${(1.5 + L * cw * 0.06).toFixed(1)}px)`;
      p.gloss.style.opacity = (Math.min(1, lift / 18) * 0.7).toFixed(3);
      p.gloss.style.backgroundPosition = `${(50 - dx * lift * 1.6).toFixed(1)}% ${(50 - dy * lift * 1.6).toFixed(1)}%`;
    }
    let last = 0;
    const loop = t => {
      requestAnimationFrame(loop);
      if (!Kit.visible(root)) { last = 0; return; }
      const dt = last ? Math.min(50, t - last) : 16; last = t;
      step(dt, t);
    };
    requestAnimationFrame(loop);

    let resizeT = 0;
    addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if (piece && !piece.free) { piece.box.remove(); piece = null; }
        layout(); renderPane(); renderPoster();
        if (card) card.place(cardX, cardY, cardW, cardH);
      }, 150);
    });

    layout();
    renderPane();
    setStatus();
    const ready = loadPoster().then(ps => {
      poster = ps; renderPoster();
      root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
      root.style.opacity = '';
      showToday();
    });

    /** where a stamp flying in from the home lands (today's stamp, or the middle of the pane) */
    function anchor() {
      if (card) return card.box.getBoundingClientRect();
      const c = toScreen(pw / 2, ph / 2), h = (portrait ? pw : ph) * 0.72, w = h * 0.8;
      return new DOMRect(c.x - w / 2, c.y - h / 2, w, h);
    }
    const source = () => (card && card.ready ? card.front : null);
    return { ready, anchor, source };
  }

  return { mount };
})();
Pages.define('tear', (root, deps) => Tear.mount(root, deps));
