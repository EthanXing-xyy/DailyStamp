// 情绪药房: an apothecary cabinet, one drawer per mood word in the library. Pull a drawer and the pharmacist makes up
// a paper bag with a printed prescription; the stamp sticks out of it. Pull the stamp out, turn it over for the full
// leaflet. Same word in the same visit, same stamp; a reload deals new ones. Everything comes from the library; nothing is asked of a model.
(() => {
  function mount(root, deps) {
    const { el, clamp } = Kit;
    const P = Kit.page(root, 'pharmacy', () => layout());
    const status = P.status;
    const cab = el('div', 'rx-cabinet'), counter = el('div', 'rx-counter'), veil = el('div', 'rx-veil');
    root.append(cab, veil, counter);
    const date = deps.date, day = Print.rng(Kit.hash('pharmacy' + date));
    const pal = deps.palettes[Math.floor(day() * deps.palettes.length)];
    cab.style.setProperty('--body', pal.ink);

    // ---- drawers: the library's words, in four cabinets (打工 / 心情 / 社交 / 网梗, dailystamp/words.py) behind tabs on
    // the cabinet's top; each in the palette's four inks (none takes more than a quarter)
    const GROUPS = [['work', '打工', 'WORK'], ['mood', '心情', 'MOOD'], ['social', '社交', 'SOCIAL'], ['meme', '网梗', 'MEMES']];
    const groupOf = w => (GROUPS.some(([k]) => k === w.group) ? w.group : 'mood');
    const words = deps.words.slice().sort((a, b) => a.phrase.localeCompare(b.phrase, 'zh'));
    const drawers = words.map((w, i) => {
      const d = el('button', 'rx-drawer');
      d.type = 'button'; d.group = groupOf(w);
      d.style.setProperty('--tilt', ((Print.rng(i + 3)() - 0.5) * 5).toFixed(2) + 'deg');
      if ([...w.phrase].length > 3) d.classList.add('long');
      d.innerHTML = `<span class="rx-label"><b>${U.hasCjk(w.phrase) ? w.phrase : w.phrase.toUpperCase()}</b><i>${(w.en || '').toUpperCase()}</i></span><span class="rx-knob"></span>`;
      d.onclick = () => dispense(w, d);
      return d;
    });
    const shown = GROUPS.filter(([k]) => drawers.some(d => d.group === k));
    const tabs = el('div', 'rx-tabs');
    const tabOf = new Map(shown.map(([k, cn, en]) => {
      const t = el('button', 'rx-tab', `<span class="rx-label"><b>${cn}</b><i>${en}</i></span>`);
      t.type = 'button'; t.onclick = () => showGroup(k); tabs.append(t);
      return [k, t];
    }));
    tabs.style.setProperty('--body', pal.ink);
    cab.before(tabs);                                      // under the veil, like the cabinet
    // opens on the cabinet holding today's stamp
    const plans = deps.homePlans || [], today = plans[Home.FEATURES.findIndex(f => f.key === 'today')];
    const todayW = today && words.find(w => w.phrase === today.phrase);
    let group = todayW ? groupOf(todayW) : (shown.find(([k]) => k === 'mood') || shown[0] || ['mood'])[0];

    let cols = 6;
    /** the drawers of the cabinet on show, plus blank ones so every cabinet is as tall as the biggest */
    function fillCabinet() {
      cab.replaceChildren();
      const mine = drawers.filter(d => d.group === group);
      const most = Math.max(1, ...shown.map(([k]) => drawers.filter(d => d.group === k).length)), n = Math.ceil(most / cols) * cols;
      for (let i = 0; i < n; i++) {
        const face = pal.c[(i + Math.floor(i / cols)) % 4];
        const d = mine[i] || el('span', 'rx-drawer empty', '<span class="rx-knob"></span>');
        d.style.setProperty('--face', face); cab.append(d);
      }
      tabOf.forEach((t, k) => { t.classList.toggle('on', k === group); t.setAttribute('aria-pressed', String(k === group)); });
    }
    let switching = false;
    async function showGroup(k) {
      if (k === group || switching) return;
      switching = true; group = k; Kit.rustle(0.03, 0.15);
      tabOf.forEach((t, kk) => t.classList.toggle('on', kk === k));
      await cab.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished;
      fillCabinet();
      await cab.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished;
      switching = false;
    }

    let W = 0, H = 0, phone = false, bw = 0, bh = 0, bx = 0, by = 0;
    const TAB = 34;                                        // the tabs' height above the cabinet
    function layout() {
      ({ W, H, phone } = P.measure());
      cols = phone ? 4 : 6;
      const most = Math.max(1, ...shown.map(([k]) => drawers.filter(d => d.group === k).length)), rows = Math.ceil(most / cols);
      const top = (phone ? 104 : 100) + TAB, left = phone ? 14 : Math.max(24, W * 0.06);
      const cw = phone ? W - 28 : Math.min(W * 0.52, (H - 190 - TAB) / rows * cols / 0.82);
      Object.assign(cab.style, { width: cw + 'px', left: left + 'px', top: top + 'px' });
      Object.assign(tabs.style, { width: cw + 'px', left: left + 'px', top: top - TAB + 'px', height: TAB + 'px' });
      cab.style.setProperty('--cols', cols);
      fillCabinet();
      const ch = cab.getBoundingClientRect().height || cw / cols * 0.82 * rows;
      bh = phone ? Math.min(H * 0.44, 360) : Math.min(H * 0.5, 400); bw = bh * 0.78;
      bx = phone ? W / 2 : (left + cw + W) / 2; by = phone ? H - bh - 40 : H * 0.44;
      status.el.style.cssText = phone ? `left:16px;right:16px;top:${Math.min(H - 28, top + ch + 16)}px` : `left:${left}px;width:${cw}px;top:${top + ch + 16}px`;
      // a phone's cabinet reaches past the bag's middle: the hint sits in the room left under the status line
      const below = top + ch + 44;
      counter.style.cssText = `left:${bx}px;top:${phone ? Math.max(by + bh / 2, (below + H) / 2) : by + bh / 2}px`;
      if (phone && H - below < 80) counter.style.display = 'none';           // no room at all: the status line says it
    }

    // ---- the bag: kraft paper, a pinked top, the prescription printed on it
    function bagCanvas(w, word, leaflet) {
      const dpr = Math.min(2, devicePixelRatio || 1), c = U.canvas(Math.round(bw * dpr), Math.round(bh * dpr)), g = c.getContext('2d'), W2 = c.width, H2 = c.height;
      const k = W2 / 300;
      g.fillStyle = '#C9A06A'; g.fillRect(0, 0, W2, H2);
      const rnd = Print.rng(Kit.hash(word));
      g.lineCap = 'round';
      for (let i = 0; i < 700; i++) { const x = rnd() * W2, y = rnd() * H2, a = rnd() * Math.PI, l = (4 + rnd() * 14) * k;
        g.strokeStyle = rnd() < 0.5 ? 'rgba(90,60,25,.12)' : 'rgba(255,240,210,.18)'; g.lineWidth = (0.5 + rnd()) * k;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      const sh = g.createLinearGradient(0, 0, W2, 0);
      sh.addColorStop(0, 'rgba(0,0,0,.12)'); sh.addColorStop(0.08, 'rgba(0,0,0,0)'); sh.addColorStop(0.9, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.16)');
      g.fillStyle = sh; g.fillRect(0, 0, W2, H2);
      U.grain(g, W2, H2, 0.3, 11);
      // the pinked top edge
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath();
      const n = 16, t = 9 * k;
      for (let i = 0; i < n; i++) { const x0 = i * W2 / n; g.moveTo(x0, 0); g.lineTo(x0 + W2 / n / 2, t); g.lineTo(x0 + W2 / n, 0); }
      g.fill(); g.restore();
      const ink = '#3a2616', red = '#B0172F', L = 26 * k;
      U.drawMixed(g, L, 58 * k, '处 方 笺', 'caps', 'cjk_small', Math.round(26 * k), red, 8 * k, 1, 'left');
      U.drawTracked(g, L, 80 * k, 'DAILY POST PHARMACY · Rx', U.font('caps_med', Math.round(10 * k)), red, 3 * k, 'left');
      g.fillStyle = red; g.fillRect(L, 92 * k, W2 - 2 * L, 2 * k);
      const row = (y, a, b, big) => {
        U.drawMixed(g, L, y, a, 'caps_med', 'cjk_small_med', Math.round(12 * k), 'rgba(58,38,22,.7)', 2 * k, 1, 'left');
        U.drawMixed(g, L + 58 * k, y, b, 'caps', big ? 'phrase_cjk' : 'cjk_small', Math.round((big ? 22 : 13) * k), ink, 1 * k, 1, 'left');
      };
      row(124 * k, '日期', date.replace(/-/g, '.'));
      row(152 * k, '姓名', '你');
      row(186 * k, '诊断', word, true);
      row(216 * k, 'Rp.', leaflet.name || word + '缓释片');
      // dosage, wrapped
      g.font = U.font('cjk_small_med', Math.round(12 * k)); g.fillStyle = ink; g.textAlign = 'left';
      let y = 246 * k, line = '';
      const maxW = W2 - 2 * L - 58 * k;
      U.drawMixed(g, L, y, '用法', 'caps_med', 'cjk_small_med', Math.round(12 * k), 'rgba(58,38,22,.7)', 2 * k, 1, 'left');
      for (const ch of (leaflet.dosage || '').slice(0, 60)) { if (g.measureText(line + ch).width > maxW) { g.fillText(line, L + 58 * k, y); y += 18 * k; line = ch; if (y > H2 - 70 * k) break; } else line += ch; }
      if (line && y <= H2 - 70 * k) g.fillText(line, L + 58 * k, y);
      // the pharmacist's seal, a little crooked
      g.save(); g.translate(W2 - 70 * k, H2 - 58 * k); g.rotate(-0.22); g.globalAlpha = 0.8;
      g.strokeStyle = red; g.lineWidth = 2.4 * k; g.beginPath(); g.arc(0, 0, 32 * k, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1 * k; g.beginPath(); g.arc(0, 0, 26 * k, 0, Math.PI * 2); g.stroke();
      U.drawCentered(g, 0, -6 * k, '药剂师', U.font('cjk_small', Math.round(10 * k)), red);
      U.drawCentered(g, 0, 10 * k, '已 核', U.font('cjk_small', Math.round(13 * k)), red);
      g.restore();
      return c;
    }

    // ---- dispensing
    let rx = null, busy = false, lastFront = null, made = 0;
    async function dispense(w, d) {
      if (busy) return; busy = true;
      Kit.audio(); Kit.rustle(0.04, 0.25);
      if (rx) await clearRx();
      drawers.forEach(x => x.classList.toggle('open', x === d));
      const l = (await deps.loadLeaflet(w.phrase)) || {};
      const leaflet = l.status === 'ready' ? l : Leaflet.fallback(w.phrase, w.en);
      const rnd = Print.rng(Kit.hash(date + '|' + w.phrase + '|' + Kit.visit));
      const st = { phrase: w.phrase, en: w.en || '', no: drawers.indexOf(d) + 1, date, palette: deps.palettes[Math.floor(rnd() * deps.palettes.length)].name,
        layout: 'gen', seed: Math.floor(rnd() * 1e9), shift: Math.floor(rnd() * 4), emblem: 'auto', misregister: true, grain: true, side: 'front' };
      const box = el('div', 'rx-bag'), bag = bagCanvas(w, w.phrase, leaflet);
      box.append(bag);
      Object.assign(box.style, { left: bx - bw / 2 + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
      const sw = bw * 0.7, sh = sw * 1.25;
      const c = Kit.card(root, deps, { cls: 'rx-stamp' }); c.place(bx + bw * 0.04, by + sh * 0.12, sw, sh); c.noFlip = true;
      c.turn(1, true); Kit.put(c.front, Stamp.blank(c.scale(), 7));
      root.append(box);
      if (phone) veil.classList.add('on');
      const rise = [{ transform: `translateY(${H - by + 40}px) rotate(4deg)` }, { transform: 'translateY(-10px) rotate(-1deg)', offset: 0.8 }, { transform: 'rotate(-1.5deg)' }];
      box.animate(rise, { duration: 900, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
      c.box.animate(rise, { duration: 900, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
      rx = { box, c, st, pulled: false };
      counter.classList.remove('on');
      status.set(`「${w.phrase}」· ${leaflet.name || ''} · 点邮票把它抽出来`);
      await Kit.wait(500);
      await c.print(st, { D: 520 });
      deps.album.add({ id: `pharmacy:${date}:${w.phrase}`, kind: 'pharmacy', date, st }, { keep: true });
      made = new Set([...(await deps.album.all()).filter(e => e.kind === 'pharmacy' && e.date === date).map(e => e.id)]).size;
      lastFront = c.front;
      c.box.onclick = () => pull();
      busy = false;
    }
    // the stamp comes out of the bag and lies on top of it; from then on a tap turns it over
    async function pull() {
      if (!rx || rx.pulled) return;
      rx.pulled = true; Kit.rustle(0.05, 0.2);
      const c = rx.c;
      await c.box.animate([{ transform: 'rotate(-1.5deg)' }, { transform: `translateY(${-c.h * 0.75}px) rotate(-4deg)` }], { duration: 480, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' }).finished;
      c.box.style.zIndex = 6;
      await c.box.animate([{ transform: `translateY(${-c.h * 0.75}px) rotate(-4deg)` }, { transform: `translate(${phone ? 0 : -bw * 0.28}px, ${-c.h * 0.18}px) rotate(-6deg) scale(1.08)` }],
        { duration: 520, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' }).finished;
      c.box.onclick = null; c.noFlip = false;
      status.set(`今日已配 ${made} 剂 · 点邮票翻面看说明书`);
    }
    async function clearRx() {
      const r = rx; rx = null; veil.classList.remove('on');
      await Promise.all([r.box, r.c.box].map(b => b.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(40px) rotate(3deg)' }], { duration: 380, easing: 'ease-in', fill: 'forwards' }).finished));
      r.box.remove(); r.c.box.remove();
    }
    veil.addEventListener('click', () => { if (rx && !busy) { clearRx(); drawers.forEach(x => x.classList.remove('open')); counter.classList.add('on'); } });

    layout();
    counter.innerHTML = '<span>拉开一格抽屉</span><em>药剂师为你配一枚</em>';
    counter.classList.add('on');
    const ready = deps.album.all().then(all => {
      made = all.filter(e => e.kind === 'pharmacy' && e.date === date).length;
      status.set(made ? `今日已配 ${made} 剂` : `${drawers.length} 味情绪 · 今天还没配药`);
      requestAnimationFrame(layout);
    });
    return P.api({
      ready,
      anchor: () => { if (rx) return rx.c.box.getBoundingClientRect(); const h = bh * 0.8; return new DOMRect(bx - h * 0.4, by, h * 0.8, h); },
      source: () => (rx && rx.c.ready ? rx.c.front : null),
    });
  }
  Pages.define('pharmacy', mount);
})();
