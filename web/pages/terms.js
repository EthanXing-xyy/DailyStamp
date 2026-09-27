// 节气历: the 24 solar terms on a ring. The one we are in sits at the top, lit and breathing; the ones already past this
// year are printed, those still to come are only blind-embossed into the desk. Turn the ring (drag, wheel, arrows, or
// tap a term) and the term at the top prints its commemorative stamp in the middle: the term's name, its icon, and a
// leaflet on the back.
(() => {
  const EN = ['Start of Spring', 'Rain Water', 'Awakening of Insects', 'Spring Equinox', 'Clear and Bright', 'Grain Rain',
    'Start of Summer', 'Grain Buds', 'Grain in Ear', 'Summer Solstice', 'Minor Heat', 'Major Heat',
    'Start of Autumn', 'End of Heat', 'White Dew', 'Autumn Equinox', 'Cold Dew', "Frost's Descent",
    'Start of Winter', 'Minor Snow', 'Major Snow', 'Winter Solstice', 'Minor Cold', 'Major Cold'];
  // one palette per season for the ring's ink
  const SEASON = ['Tiffany Cherry', 'City Pop', 'Nihon Buyo', 'Klein × Hermès'];

  function mount(root, deps) {
    const { el, clamp, TAU } = Kit;
    const today = deps.date, year = +today.slice(0, 4);
    Kit.head(root, 'terms');
    const ringEl = el('div', 'terms-ring'), info = el('div', 'terms-info', '<b></b><span></span><em></em>');
    const status = Kit.status(root);
    root.append(ringEl, info);
    root.tabIndex = 0;

    // ---- when each term begins, this calendar year (and the year after, for the countdown)
    function starts(y) {
      const out = new Map(); let prev = Terms.of(`${y}-01-01`).key;          // the term running into the new year began last year
      for (let d = new Date(y, 0, 1); d.getFullYear() <= y; d.setDate(d.getDate() + 1)) {
        const ds = Kit.localDate(d), k = Terms.of(ds).key;
        if (k !== prev) { if (!out.has(k)) out.set(k, ds); prev = k; }
      }
      return out;
    }
    const S0 = starts(year), S1 = starts(year + 1);
    const idxOf = key => Terms.LIST.findIndex(t => t[0] === key);
    const cur = idxOf(Terms.of(today).key);
    const startOf = i => S0.get(Terms.LIST[i][0]);
    const nextStart = i => { const k = Terms.LIST[(i + 1) % 24][0]; const a = S0.get(k); return a && a > startOf(i) ? a : S1.get(k); };
    const days = (a, b) => Kit.dayNo(b) - Kit.dayNo(a);
    const fmt = ds => ds ? `${+ds.slice(5, 7)}.${+ds.slice(8, 10)}` : '';
    const season = Math.floor(cur / 6);
    const pal = deps.palettes.find(p => p.name === SEASON[season]) || deps.palettes[0];

    // ---- the ring
    let W = 0, H = 0, cx = 0, cy = 0, R = 0, isz = 0, cardH = 0;
    const icons = Terms.LIST.map(([key, name], i) => {
      const box = el('button', 'terms-icon'), cv = el('canvas'), lab = el('span', '', name);
      box.type = 'button'; box.append(cv, lab); ringEl.append(box);
      box.addEventListener('click', e => { if (!moved) goTo(i); e.stopPropagation(); });
      return { key, name, i, box, cv, lab };
    });
    const past = i => startOf(i) && startOf(i) <= today;
    function drawIcon(ic) {
      const s = Math.round(isz * Math.min(2, devicePixelRatio || 1)), cv = ic.cv, g = cv.getContext('2d');
      cv.width = cv.height = s; g.clearRect(0, 0, s, s);
      const e = Terms.icon(ic.key);
      if (!e) { g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.3, 0, TAU); g.fill(); return; }
      const [key, acc] = Print.channelMasks(e);
      if (past(ic.i) || ic.i === cur) {                    // printed: the season's inks, a little out of register
        const col = pal.c[(ic.i + 1) % 4] === Stamp.PAPER ? pal.c[0] : pal.c[ic.i % 4];
        g.drawImage(Print.tinted(Print.silhouette(e, 0.05), Stamp.PAPER, s), 0, 0, s, s);
        g.drawImage(Print.tinted(acc, col, s), s * 0.012, -s * 0.008, s, s);
        g.drawImage(Print.tinted(key, pal.ink, s), 0, 0, s, s);
      } else {                                              // still to come: pressed blind into the desk
        const sil = Print.silhouette(e, 0.02);
        g.drawImage(Print.tinted(sil, 'rgba(255,255,255,.55)', s), -s * 0.012, -s * 0.012, s, s);
        g.drawImage(Print.tinted(sil, 'rgba(60,45,25,.16)', s), s * 0.012, s * 0.012, s, s);
        g.drawImage(Print.tinted(sil, '#D6D1C7', s), 0, 0, s, s);
      }
    }
    function layout() {
      W = innerWidth; H = innerHeight;
      const portrait = W < H * 0.9, short = !portrait && H < 560;   // short: a phone on its side
      // on a short screen the ring fits between the title (~78 px) and the status line
      R = portrait ? Math.min(W * 0.43, H * 0.3) : Math.min(H * 0.36, W * 0.3, short ? (H - 112) / 2 - 16 : Infinity);
      cx = W / 2; cy = portrait ? Math.max(120 + R, H * 0.46) : short ? 78 + R + 14 : Math.max(110 + R, H * 0.54);
      isz = clamp(R * 0.17, 26, 64); cardH = R * (portrait ? 0.9 : short ? 0.78 : 0.95);
      icons.forEach(ic => { Object.assign(ic.box.style, { width: isz + 'px', height: isz + 'px', marginLeft: -isz / 2 + 'px', marginTop: -isz / 2 + 'px' }); drawIcon(ic); });
      root.classList.toggle('terms-small', portrait);
      const infoTop = portrait ? cy + R + isz * 0.9 + 6 : cy + cardH * 0.5 + 12;   // on a phone the ring is too tight inside
      // on a short screen there is no room under the card inside the ring: the name and dates stand beside the ring
      if (short) Object.assign(info.style, { left: cx + R + isz * 1.6 + 'px', top: cy - 34 + 'px', transform: 'none', justifyItems: 'start', textAlign: 'left' });
      else Object.assign(info.style, { left: cx + 'px', top: infoTop + 'px', transform: '', justifyItems: '', textAlign: '' });
      status.el.style.cssText = `left:16px;right:16px;top:${Math.min(H - (short ? 22 : 30), portrait ? infoTop + 96 : cy + R + isz * 0.9 + 18)}px`;
      if (card) card.place(cx, cy - (portrait ? 0 : cardH * 0.08), cardH * 0.8, cardH);
    }

    // ---- turning: rot is the ring's angle in term steps (fractional); the term at the top is round(-rot) mod 24
    let rot = -cur, to = -cur, vel = 0, drag = null, moved = false, sel = -1, settleT = 0;
    const mod = (a, n) => ((a % n) + n) % n;
    const goTo = i => { const d = mod(-i - to + 12, 24) - 12; to += d; };
    function frame(dt, t) {
      if (!drag) rot += (to - rot) * (1 - Math.exp(-dt / 140));
      const top = mod(Math.round(-rot), 24);
      icons.forEach(ic => {
        const a = (ic.i + rot) / 24 * TAU - Math.PI / 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        const near = Math.max(0, 1 - Math.abs(mod(ic.i + rot + 12, 24) - 12));
        const breathe = ic.i === cur ? 1 + 0.05 * Math.sin(t / 900) : 1;
        ic.box.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${((1 + near * 0.45) * breathe).toFixed(3)})`;
        ic.box.classList.toggle('now', ic.i === cur);
        ic.box.classList.toggle('top', ic.i === top);
      });
      if (top !== sel && Math.abs(to - rot) < 0.02 && !drag) { clearTimeout(settleT); select(top); }
    }
    const angleAt = e => Math.atan2(e.clientY - cy, e.clientX - cx);
    root.addEventListener('pointerdown', e => {
      if (e.target.closest('.kit-card, .to-home')) return;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < R * 0.6) return;
      drag = { a: angleAt(e), rot, t: e.timeStamp }; moved = false; vel = 0;
      root.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointermove', e => {
      if (!drag) return;
      let da = angleAt(e) - drag.a; da = mod(da + Math.PI, TAU) - Math.PI;
      const r = drag.rot + da / TAU * 24, dt = Math.max(1, e.timeStamp - drag.t);
      if (Math.abs(r - drag.rot) > 0.08) moved = true;
      vel = (r - rot) / dt; rot = to = r; drag.t = e.timeStamp;
    });
    const up = () => { if (!drag) return; drag = null; to = Math.round(rot + clamp(vel * 260, -4, 4)); setTimeout(() => { moved = false; }, 0); };
    root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
    root.addEventListener('wheel', e => { e.preventDefault(); if (Math.abs(e.deltaY) + Math.abs(e.deltaX) > 20) { to = Math.round(to) - Math.sign(e.deltaY || e.deltaX); } }, { passive: false });
    root.addEventListener('keydown', e => {
      if (!Kit.visible(root)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); to = Math.round(to) - 1; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); to = Math.round(to) + 1; }
    });

    // ---- the stamp in the middle
    let card = null, printing = 0;
    const stOf = i => {
      const [key, name] = Terms.LIST[i], rnd = Print.rng(Kit.hash(key + year + '|' + Kit.visit));
      return { phrase: name, en: EN[i], no: i + 1, date: startOf(i) || today, palette: deps.palettes[Math.floor(rnd() * deps.palettes.length)].name,
        layout: 'gen', seed: Math.floor(rnd() * 1e9), shift: Math.floor(rnd() * 4), emblem: 'term:' + key, misregister: true, grain: true, side: 'front' };
    };
    async function select(i) {
      sel = i;
      const [, name] = Terms.LIST[i], st = startOf(i), nx = nextStart(i);
      info.querySelector('b').textContent = name;
      info.querySelector('span').textContent = st ? `${fmt(st)} — ${fmt(Kit.addDays(nx, -1))}` : '';
      info.querySelector('em').textContent = i === cur ? `距 ${Terms.LIST[(cur + 1) % 24][1]} 还有 ${days(today, nextStart(cur))} 天`
        : past(i) ? `${year} 年已经过去` : `还有 ${days(today, st)} 天`;
      info.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease' });
      const my = ++printing, old = card;
      if (old) { old.box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' }).finished.then(() => old.box.remove()); }
      card = Kit.card(root, deps, { cls: 'terms-card' }); card.place(cx, cy - (root.classList.contains('terms-small') ? 0 : cardH * 0.08), cardH * 0.8, cardH);
      card.turn(1, true);
      Kit.put(card.front, Stamp.blank(card.scale(), 40 + i));
      card.box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease', fill: 'backwards' });
      await Kit.wait(200);
      if (my !== printing) return;
      const s = stOf(i), c = card;
      await c.print(s, { emblem: Terms.icon(Terms.LIST[i][0]), D: 650 });
      if (i === cur && my === printing && deps.album) deps.album.add({ id: `term:${year}:${Terms.LIST[i][0]}`, kind: 'term', date: today, st: s, meta: { term: true } }, { keep: true });
    }

    let last = 0;
    const loop = t => { requestAnimationFrame(loop); if (!Kit.visible(root)) { last = 0; return; } const dt = last ? Math.min(50, t - last) : 16; last = t; frame(dt, t); };
    requestAnimationFrame(loop);
    addEventListener('resize', () => { layout(); });
    const ready = Terms.load().then(() => {
      layout();
      status.set(`${year} · 今天是${Terms.LIST[cur][1]}的第 ${days(startOf(cur), today) + 1} 天 · 转动圆环看每一期`);
      frame(16, 0);
    });
    layout();
    return {
      ready,
      anchor: () => card ? card.box.getBoundingClientRect() : new DOMRect(cx - cardH * 0.4, cy - cardH * 0.58, cardH * 0.8, cardH),
      source: () => (card && card.ready && sel === cur ? card.front : null),
    };
  }
  Pages.define('terms', mount);
})();
