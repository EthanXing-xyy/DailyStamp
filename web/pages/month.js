// 月度小版张: a miniature sheet for the month, one stamp a day. Today's space is a blank you print by choosing the mood
// of the day from the library; a day gone by without one stays blank (no filling in afterwards), days to come are only
// a faint number in the paper. The selvage carries the month, the plate number and the colour bar; tap a stamp to
// turn it over for its leaflet, and keep the whole sheet as a picture. Days live in this browser (localStorage ds-month).
(() => {
  const KEY = 'ds-month', TAU = Math.PI * 2;
  const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const DAYS = ['一', '二', '三', '四', '五', '六', '日'];
  const GROUPS = [['work', '打工'], ['mood', '心情'], ['social', '社交'], ['meme', '网梗']];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const store = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* this visit only */ } };
  const two = n => String(n).padStart(2, '0');

  function mount(root, deps) {
    const { el, clamp } = Kit, today = deps.date;
    const P = Kit.page(root, 'month', () => layout());
    const status = P.status;
    const sheet = el('canvas', 'mo-sheet'), acts = el('div', 'mo-acts'), veil = el('div', 'mo-veil'), picker = el('div', 'mo-picker');
    root.append(sheet, acts, veil, picker);
    const bPrev = Kit.button(acts, '‹ 上个月'), bSave = Kit.button(acts, '存为图片'), bNext = Kit.button(acts, '下个月 ›');
    bSave.style.setProperty('--swash', '#23D5E8');
    const dbg = Kit.debugRow(root);
    dbg.add('重选今天', () => { const d = load(), m = d[ym(today)]; if (m) { delete m[+today.slice(8)]; store(d); } cache.delete(`${ym(today)}|${+today.slice(8)}`); draw(); openPicker(); });

    const ym = date => date.slice(0, 7);
    let month = ym(today);                                  // the month on show
    const words = deps.words;
    /** the stamp of a day, from what was chosen for it */
    function stOf(mon, d, rec) {
      const w = words.find(x => x.phrase === rec.phrase) || { phrase: rec.phrase, en: rec.en || '' };
      const rnd = Print.rng(Kit.hash(`month|${mon}|${d}|${rec.phrase}`));
      return { phrase: w.phrase, en: w.en || '', no: d, date: `${mon}-${two(d)}`, palette: deps.palettes[Math.floor(rnd() * deps.palettes.length)].name,
        layout: 'gen', seed: Math.floor(rnd() * 1e9), shift: Math.floor(rnd() * 4), emblem: 'auto', misregister: true, grain: true, side: 'front' };
    }

    // ---- the sheet's geometry, in stamp units (1200 x 1500 a stamp); drawn at whatever scale fits the screen
    const geo = mon => {
      const [y, m] = mon.split('-').map(Number), days = new Date(y, m, 0).getDate(), lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
      const rows = Math.ceil((lead + days) / 7), BW = 1200, BH = 1500, SX = 380, ST = 1500, SB = 700;
      return { y, m, days, lead, rows, BW, BH, SX, ST, SB, W: 7 * BW + 2 * SX, H: rows * BH + ST + SB };
    };
    const cellOf = (G, d) => { const k = G.lead + d - 1; return { x: G.SX + (k % 7) * G.BW, y: G.ST + Math.floor(k / 7) * G.BH }; };

    let W = 0, H = 0, phone = false, sx = 0, sy = 0, sw = 0, shh = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      const G = geo(month), ar = G.W / G.H;
      const maxH = phone ? H - 196 : H - 196, maxW = phone ? W - 20 : Math.min(W - 80, 1100);
      sw = Math.min(maxW, maxH * ar); shh = sw / ar;
      sx = (W - sw) / 2; sy = phone ? 96 : 100;
      Object.assign(sheet.style, { left: sx + 'px', top: sy + 'px', width: sw + 'px', height: shh + 'px' });
      acts.style.cssText = `left:12px;right:12px;top:${sy + shh + 10}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${Math.min(H - 30, sy + shh + 58)}px`;
      draw();
    }

    // ---- drawing: the paper, the selvage, a stamp in every chosen day, then the shared perforations
    const cache = new Map();                                // `${month}|${day}` -> printed canvas at the current scale
    let scaleNow = 0;
    function stampCanvas(mon, d, rec, s) {
      const k = `${mon}|${d}`, have = cache.get(k);
      if (have && have.s === s && have.phrase === rec.phrase) return have.cv;
      const cv = deps.makeFront(stOf(mon, d, rec), s, { noPerf: true, grain: false });
      cache.set(k, { s, phrase: rec.phrase, cv });
      return cv;
    }
    function render(mon, s, out) {
      const G = geo(mon), data = load()[mon] || {}, X = v => v * s;
      const c = out || U.canvas(Math.round(G.W * s), Math.round(G.H * s)), g = c.getContext('2d');
      if (out) { c.width = Math.round(G.W * s); c.height = Math.round(G.H * s); }
      g.drawImage(Stamp.paper(c.width, c.height, s, 17), 0, 0);
      const ink = '#1d1d1f', inks = [];
      // selvage: the month big, what it is, the weekdays over their columns
      U.drawCentered(g, X(G.SX + 560), X(700), two(G.m), U.font('phrase_latin', Math.round(X(760))), ink);
      U.drawMixed(g, X(G.SX + 1260), X(520), '每日一枚 · 月度小版张', 'caps', 'phrase_cjk', Math.round(X(230)), ink, X(20), 1, 'left');
      U.drawTracked(g, X(G.SX + 1270), X(830), `${MONTHS[G.m - 1]} ${G.y} · ONE MOOD A DAY · ${G.days} STAMPS`, U.font('caps_med', Math.round(X(110))), ink, X(26), 'left');
      DAYS.forEach((w, i) => U.drawCentered(g, X(G.SX + (i + 0.5) * G.BW), X(G.ST - 190), w, U.font('cjk_small', Math.round(X(150))), 'rgba(29,29,31,.7)'));
      const now = mon === ym(today) ? +today.slice(8) : mon < ym(today) ? 99 : 0;
      let n = 0;
      for (let d = 1; d <= G.days; d++) {
        const { x, y } = cellOf(G, d), rec = mon === ym(today) && d === pressing ? null : data[d];
        if (rec) {
          const cv = stampCanvas(mon, d, rec, s);
          g.drawImage(cv, X(x), X(y), X(G.BW), X(G.BH)); n++;
          const p = deps.palettes.find(q => q.name === stOf(mon, d, rec).palette); if (p) inks.push(...p.c);
        } else if (d > now) {                                          // days to come: a faint number pressed in
          U.drawCentered(g, X(x + G.BW / 2), X(y + G.BH / 2), String(d), U.font('phrase_latin', Math.round(X(420))), 'rgba(120,105,80,.12)');
        } else if (d === pressing && mon === ym(today)) {               // being printed right now (an overlay does it)
      } else if (d === now) {                                        // today, waiting
          g.save(); g.strokeStyle = 'rgba(29,29,31,.45)'; g.setLineDash([X(40), X(34)]); g.lineWidth = X(14);
          g.beginPath(); g.arc(X(x + G.BW / 2), X(y + G.BH / 2 - 60), X(330), 0, TAU); g.stroke(); g.restore();
          U.drawCentered(g, X(x + G.BW / 2), X(y + G.BH / 2 - 60), '+', U.font('caps', Math.round(X(360))), 'rgba(29,29,31,.6)');
          U.drawCentered(g, X(x + G.BW / 2), X(y + G.BH / 2 + 420), '今天', U.font('cjk_small', Math.round(X(150))), 'rgba(29,29,31,.6)');
        } else {                                                       // missed: blank, with only its date
          U.drawCentered(g, X(x + G.BW / 2), X(y + G.BH - 170), String(d), U.font('caps_med', Math.round(X(130))), 'rgba(120,105,80,.35)');
        }
      }
      // lower selvage: the plate number, the count, the colour bar
      const by = G.H - G.SB / 2;
      U.drawMixed(g, X(G.SX), X(by), `版号 P${two(G.m)} · ${G.y}`, 'caps', 'cjk_small', Math.round(X(130)), ink, X(14), 1, 'left');
      U.drawMixed(g, X(G.SX + 2900), X(by), `本月 ${n} / ${G.days} 枚`, 'caps', 'cjk_small', Math.round(X(130)), ink, X(14), 1, 'left');
      const bar = [...new Set(inks)].slice(0, 12).concat(['#00AEEF', '#EC008C', '#FFF200', '#111111']), sq = X(150);
      bar.forEach((col, i) => { g.fillStyle = col; g.fillRect(X(G.W - G.SX) - (bar.length - i) * (sq + X(30)), X(by) - sq / 2, sq, sq); });
      U.grain(g, c.width, c.height, 0.18, 9);
      // shared perforations: every line of the grid, running a little way into the selvage
      g.save(); g.globalCompositeOperation = 'destination-out';
      const rnd = Print.rng(7), r0 = X(13), pitch = X(46);
      const line = (x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0), m = Math.max(2, Math.round(len / pitch));
        for (let i = 0; i <= m; i++) { const t = i / m; g.beginPath(); g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 * (0.95 + rnd() * 0.1), 0, TAU); g.fill(); } };
      const ext = X(120), gx0 = X(G.SX), gy0 = X(G.ST), gx1 = X(G.SX + 7 * G.BW), gy1 = X(G.ST + G.rows * G.BH);
      for (let c2 = 0; c2 <= 7; c2++) line(gx0 + X(c2 * G.BW), gy0 - ext, gx0 + X(c2 * G.BW), gy1 + ext);
      for (let r = 0; r <= G.rows; r++) line(gx0 - ext, gy0 + X(r * G.BH), gx1 + ext, gy0 + X(r * G.BH));
      g.restore();
      return c;
    }
    function draw() {
      const G = geo(month), dpr = Math.min(2, devicePixelRatio || 1), s = sw * dpr / G.W;
      if (Math.abs(s - scaleNow) > 1e-6) { cache.clear(); scaleNow = s; }
      render(month, s, sheet);
      const m = month.split('-');
      bNext.disabled = month >= ym(today);
      const data = load()[month] || {}, n = Object.keys(data).length;
      if (!picking) status.set(month === ym(today) ? (data[+today.slice(8)] ? `今天是「${data[+today.slice(8)].phrase}」 · 本月已印 ${n} 枚` : '点「今天」那一格，挑一个今天的心情')
        : `${m[0]} 年 ${+m[1]} 月 · 印了 ${n} 枚`);
    }

    // ---- choosing today's mood: the library's words, in their four cabinets
    let picking = false, group = 'mood', pressing = 0;
    function openPicker() {
      picking = true; veil.classList.add('on'); picker.classList.add('on');
      renderPicker();
      status.set('今天是什么心情？');
    }
    function closePicker() { picking = false; veil.classList.remove('on'); picker.classList.remove('on'); draw(); }
    function renderPicker() {
      picker.replaceChildren();
      const tabs = el('div', 'mo-tabs'), list = el('div', 'mo-words');
      for (const [k, cn] of GROUPS) { const b = Kit.button(tabs, cn); b.classList.toggle('on', k === group); b.onclick = () => { group = k; renderPicker(); }; }
      words.filter(w => (w.group || 'mood') === group).sort((a, b) => a.phrase.localeCompare(b.phrase, 'zh')).forEach((w, i) => {
        const b = el('button', 'mo-chip', `<b>${U.hasCjk(w.phrase) ? w.phrase : w.phrase.toUpperCase()}</b>`);
        b.type = 'button'; b.style.setProperty('--tilt', ((Print.rng(i + 5)() - 0.5) * 6).toFixed(1) + 'deg');
        b.onclick = () => choose(w);
        list.append(b);
      });
      picker.append(tabs, list);
    }
    async function choose(w) {
      const d = +today.slice(8), mon = ym(today), all = load();
      (all[mon] = all[mon] || {})[d] = { phrase: w.phrase, en: w.en || '' }; store(all);
      picking = false; veil.classList.remove('on'); picker.classList.remove('on');
      month = mon; pressing = d; layout();
      // it prints into its space plate by plate
      const G = geo(mon), { x, y } = cellOf(G, d), k = sw / G.W, st = stOf(mon, d, all[mon][d]);
      await deps.loadLeaflet(st.phrase);
      const dpr = Math.min(2, devicePixelRatio || 1), fr = deps.makeFront(st, scaleNow, { stages: true, noPerf: true, grain: false });
      const cv = el('canvas', 'mo-press'); Kit.put(cv, fr.stages.blank);
      Object.assign(cv.style, { left: sx + x * k + 'px', top: sy + y * k + 'px', width: G.BW * k + 'px', height: G.BH * k + 'px' });
      root.append(cv); Kit.thump(0.5);
      await new Promise(res => deps.printIn(cv, fr.stages, { D: 700, onDone: res }));
      pressing = 0; draw(); cv.remove();
      deps.album.add({ id: `month:${today}`, kind: 'month-day', date: today, st });
      status.set(`今天是「${w.phrase}」 · 印好了`);
    }
    veil.addEventListener('click', () => { if (picking) closePicker(); else closeCard(); });

    // ---- tapping the sheet: today's blank opens the words; a printed day turns over
    let card = null;
    sheet.addEventListener('click', e => {
      const r = sheet.getBoundingClientRect(), G = geo(month), u = (e.clientX - r.left) / r.width * G.W, v = (e.clientY - r.top) / r.height * G.H;
      const c = Math.floor((u - G.SX) / G.BW), row = Math.floor((v - G.ST) / G.BH), d = row * 7 + c - G.lead + 1;
      if (c < 0 || c > 6 || row < 0 || row >= G.rows || d < 1 || d > G.days) return;
      const rec = (load()[month] || {})[d];
      if (rec) return openCard(stOf(month, d, rec), { x: r.left + (G.SX + c * G.BW) / G.W * r.width, y: r.top + (G.ST + row * G.BH) / G.H * r.height, w: G.BW / G.W * r.width });
      if (month === ym(today) && d === +today.slice(8)) return openPicker();
      status.flash(month === ym(today) && d > +today.slice(8) ? `${d} 号还没到` : '那天没有印 · 小版张上留白了');
    });
    async function openCard(st, from) {
      closeCard(true);
      const h = Math.min(H * 0.62, (W - 40) * 1.25), w = h * 0.8, c = card = Kit.card(root, deps, { cls: 'mo-card' });
      c.place(W / 2, H / 2, w, h); c.turn(1, true);
      Kit.put(c.front, Stamp.blank(c.scale(), 3));
      veil.classList.add('on');
      c.box.animate([{ transform: `translate(${from.x + from.w / 2 - W / 2}px, ${from.y + from.w * 0.625 - H / 2}px) scale(${from.w / w})`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
        { duration: 520, easing: 'cubic-bezier(.3,0,.2,1)' });
      await c.print(st, { D: 500 });
    }
    function closeCard(now) {
      if (!card) return; const c = card; card = null; veil.classList.remove('on');
      if (now) return c.box.remove();
      c.box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => c.box.remove());
    }

    // ---- other months, and the sheet as a picture
    const shift = k => { const [y, m] = month.split('-').map(Number), d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${two(d.getMonth() + 1)}`; };
    bPrev.onclick = () => { month = shift(-1); cache.clear(); layout(); };
    bNext.onclick = () => { if (month < ym(today)) { month = shift(1); cache.clear(); layout(); } };
    bSave.onclick = async () => {
      bSave.disabled = true; status.set('印整张小版张…');
      await Kit.wait(30);
      const G = geo(month), s = 2600 / G.W, big = render(month, s);
      for (const k of [...cache.keys()]) if (cache.get(k).s === s) cache.delete(k);
      const how = await Kit.save([{ cv: big, name: `monthly-sheet-${month}.png` }]);
      if (how !== 'cancelled') deps.album.add({ id: `month:${month}`, kind: 'month', date: today, image: await Kit.blobOf(big) });
      bSave.disabled = false; draw();
      if (how !== 'cancelled') status.set('存好了 · 也收进了集邮册');
    };
    root.addEventListener('keydown', e => { if (Kit.visible(root) && e.key === 'Escape') { if (picking) closePicker(); else closeCard(); } });

    layout();
    // the stamps are printed a few at a time once the page is up, so mounting never stalls the loading screen
    const ready = Promise.all(Object.values(load()[month] || {}).map(r => deps.loadLeaflet(r.phrase).catch(() => null))).then(() => draw());
    return P.api({
      ready,
      anchor: () => {                                       // a stamp from the home lands on today's space
        const G = geo(ym(today)), { x, y } = cellOf(G, +today.slice(8)), k = sw / G.W;
        return new DOMRect(sx + x * k, sy + y * k, G.BW * k, G.BH * k);
      },
      source: () => null,
    });
  }
  Pages.define('month', mount);
})();
