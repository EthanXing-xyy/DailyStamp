// 时光信: a letter to your future self. Write on the paper, choose the day it may be opened, seal it: the paper folds
// in three, goes into an envelope with today's stamp, the stamp is cancelled with today's date, and the envelope drops
// into the letter box. Until its day it will not open, whatever you do: shake it and it rustles, hold it to the light
// and a blur of mirrored writing shows through. On the day it glows; tear it open and read.
// Letters live in this browser only (localStorage dc-later).
(() => {
  const KEY = 'dc-later', EW = 900, EH = 600;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const save = l => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { /* too full: this visit only */ } };
  const fmt = d => `${d.slice(0, 4)}.${+d.slice(5, 7)}.${+d.slice(8, 10)}`;

  /** the front of an envelope: airmail edging in the stamp's inks, the address in a brush hand, the stamp, the mark */
  function envelope(L, deps, { cancelled = true, opened = false } = {}) {
    const c = U.canvas(EW, EH), g = c.getContext('2d');
    g.drawImage(Stamp.paper(EW, EH, 0.7, Kit.hash(L.id) % 997), 0, 0);
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(236,222,190,.5)'; g.fillRect(0, 0, EW, EH); g.restore();
    const pal = deps.palettes.find(p => p.name === (L.st && L.st.palette)) || deps.palettes[0], cols = [pal.c[0], pal.c[2]];
    // airmail edging: slanted bars all round, alternating two inks
    g.save(); g.beginPath(); g.rect(0, 0, EW, EH); g.rect(26, 26, EW - 52, EH - 52); g.clip('evenodd');
    for (let i = -40, k = 0; i < (EW + EH) * 2 / 34; i++, k++) {
      g.fillStyle = k % 3 === 2 ? 'rgba(0,0,0,0)' : cols[k % 3];
      const x = i * 34; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, 0); g.lineTo(x + 20 - EH, EH); g.lineTo(x - EH, EH); g.fill();
    }
    g.restore();
    U.grain(g, EW, EH, 0.18, 7);
    g.fillStyle = '#1f2a55';
    g.font = U.font('brand_cjk', 64); g.textAlign = 'left'; g.fillText('未来的我  收', 110, 360);
    U.drawMixed(g, 112, 440, `拆信日 ${fmt(L.openOn)}`, 'caps', 'cjk_small', 30, '#1f2a55', 6, 1, 'left');
    U.drawMixed(g, 112, 486, `寄出 ${fmt(L.written)} · 每日邮政 时光信`, 'caps_med', 'cjk_small_med', 20, 'rgba(31,42,85,.65)', 4, 1, 'left');
    if (L.st && L._stamp) {
      g.save(); g.shadowColor = 'rgba(0,0,0,.2)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
      g.translate(EW - 170, 175); g.rotate(0.04); g.drawImage(L._stamp, -95, -119, 190, 238); g.restore();
    }
    if (cancelled) Stamp.postmark(g, EW - 300, 250, 86, 0.72, { no: L.no || 1, date: L.written }, -0.35, Kit.hash(L.id) % 9999);
    if (opened) {                                           // torn along the top: a ragged edge, the envelope gaping a little
      g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= EW; x += 14) g.lineTo(x, 22 + Math.sin(x * 0.7) * 6 + (Kit.hash(L.id + x) % 9));
      g.lineTo(EW, 0); g.fill(); g.restore();
    }
    return c;
  }
  /** the letter itself, for reading (and for the album once it is open) */
  function letter(L, w = 900) {
    const h = Math.round(w * 1.3), c = U.canvas(w, h), g = c.getContext('2d'), k = w / 900;
    g.drawImage(Stamp.paper(w, h, 0.8 * k, 31), 0, 0); U.grain(g, w, h, 0.16, 5);
    g.fillStyle = '#1f2a55'; g.font = U.font('brand_cjk', Math.round(54 * k)); g.textAlign = 'left';
    g.fillText('写给未来的我：', 90 * k, 150 * k);
    g.font = U.font('brand_cjk', Math.round(46 * k));
    let y = 250 * k, line = '';
    for (const para of String(L.text || '').split('\n')) {
      for (const ch of para) { if (g.measureText(line + ch).width > w - 180 * k && line) { g.fillText(line, 90 * k, y); y += 72 * k; line = ch; } else line += ch; }
      g.fillText(line, 90 * k, y); y += 72 * k; line = '';
    }
    g.font = U.font('brand_cjk', Math.round(40 * k)); g.textAlign = 'right';
    g.fillText(fmt(L.written), w - 90 * k, h - 110 * k);
    return c;
  }

  function mount(root, deps) {
    const { el, clamp } = Kit;
    const today = deps.date;
    const P = Kit.page(root, 'later', () => layout());
    const status = P.status;
    const desk = el('div', 'lt-desk'), paper = el('div', 'lt-paper'), pcv = el('canvas'), txt = el('textarea', 'lt-text');
    txt.placeholder = '写给未来的自己……'; txt.maxLength = 600;
    paper.append(pcv, el('span', 'lt-to', '写给未来的我：'), el('span', 'lt-date', fmt(today)), txt);
    const when = el('div', 'lt-when'), bSeal = Kit.button(desk, '封好'); bSeal.classList.add('lt-seal');
    const custom = el('input', 'lt-custom'); custom.type = 'date'; custom.min = Kit.addDays(today, 1);
    const box = el('div', 'lt-box'), boxHead = el('p', 'lt-box-head', '信匣'), veil = el('div', 'lt-veil'), note = el('p', 'lt-note', '信只存在这台设备的浏览器里');
    desk.append(paper, when, note);
    root.append(desk, boxHead, box, veil);

    const CHOICES = [['一个月', 30], ['三个月', 91], ['半年', 182], ['一年', 365], ['自选', 0]];
    let days = 365;
    CHOICES.forEach(([t, n]) => {
      const b = Kit.button(when, t); b.dataset.n = n;
      b.onclick = () => { days = n; when.querySelectorAll('.kit-btn').forEach(x => x.classList.toggle('on', x === b)); custom.classList.toggle('on', !n); if (!n) custom.showPicker && custom.showPicker(); };
    });
    when.append(custom);
    when.querySelectorAll('.kit-btn')[3].classList.add('on');
    custom.value = Kit.addDays(today, 100);

    let W = 0, H = 0, phone = false, pw = 0, ph = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      const short = !phone && H < 560;                        // a phone on its side: same layout, tighter
      ph = phone ? Math.min(H * 0.42, (W - 40) * 1.3) : Math.min(H - (short ? 222 : 290), W * 0.3 * 1.3); pw = ph / 1.3;
      const px = phone ? (W - pw) / 2 : W * 0.3 - pw / 2, py = phone ? 100 : short ? 72 : 110;
      Object.assign(paper.style, { left: px + 'px', top: py + 'px', width: pw + 'px', height: ph + 'px' });
      root.style.setProperty('--lk', (pw / 900).toFixed(4));
      const ww = phone ? W - 16 : Math.max(pw + 120, 330), wx = phone ? 8 : px + pw / 2 - ww / 2, gap = short ? 0.75 : 1;
      when.style.cssText = `left:${wx}px;width:${ww}px;top:${py + ph + 12 * gap}px`;
      bSeal.style.cssText = `position:absolute;left:${phone ? W * 0.5 : px + pw / 2}px;top:${py + ph + 56 * gap}px;transform:translateX(-50%)`;
      note.style.cssText = `left:${wx}px;width:${ww}px;top:${py + ph + 100 * gap}px`;
      if (phone) { box.style.cssText = `left:12px;right:12px;top:${py + ph + 130}px;bottom:36px`; boxHead.style.cssText = `left:16px;top:${py + ph + 118}px`; }
      else { box.style.cssText = `left:${W * 0.55}px;right:36px;top:${short ? 96 : 130}px;bottom:${short ? 40 : 70}px`; boxHead.style.cssText = `left:${W * 0.55}px;top:${short ? 72 : 104}px`; }
      status.el.style.cssText = `left:16px;right:16px;top:${H - 30}px`;
      const dpr = Math.min(2, devicePixelRatio || 1);
      pcv.width = Math.round(pw * dpr); pcv.height = Math.round(ph * dpr);
      const g = pcv.getContext('2d'); g.drawImage(Stamp.paper(pcv.width, pcv.height, 0.6, 31), 0, 0); U.grain(g, pcv.width, pcv.height, 0.16, 5);
    }

    // ---- the letter box
    let letters = load();
    const stampOf = L => { if (!L._stamp && L.st) L._stamp = deps.makeFront(L.st, 0.2); return L._stamp; };
    function daysLeft(L) { return Kit.dayNo(L.openOn) - Kit.dayNo(today); }
    function fillBox(fresh) {
      box.innerHTML = '';
      if (!letters.length) { box.append(el('p', 'lt-empty', '还没有寄出的信')); return; }
      letters.slice().sort((a, b) => a.openOn.localeCompare(b.openOn)).forEach((L, i) => {
        const e = el('div', 'lt-env'), cv = el('canvas'), lab = el('span');
        const due = daysLeft(L) <= 0;
        e.classList.toggle('due', due && !L.opened); e.classList.toggle('opened', !!L.opened);
        lab.textContent = L.opened ? `${fmt(L.openOn)} 拆开` : due ? '可以拆了' : `还有 ${daysLeft(L)} 天`;
        e.append(cv, lab); box.append(e);
        e.style.setProperty('--r', (((Kit.hash(L.id) % 100) / 100 - 0.5) * 6).toFixed(2) + 'deg');
        stampOf(L);
        Kit.put(cv, envelope(L, deps, { opened: L.opened }));
        if (L.id === fresh) e.animate([{ opacity: 0, transform: 'translateY(-30px) rotate(var(--r))' }, { opacity: 1, transform: 'rotate(var(--r))' }], { duration: 600, easing: 'ease-out' });
        handle(e, L);
      });
    }
    // shake it, hold it to the light, open it on its day
    function handle(e, L) {
      let d = null, holdT = 0, lit = null;
      e.addEventListener('pointerdown', ev => {
        d = { x: ev.clientX, y: ev.clientY, moved: false }; e.setPointerCapture(ev.pointerId); Kit.audio();
        holdT = setTimeout(() => { if (d && !d.moved && daysLeft(L) > 0) lit = toLight(e, L); }, 480);
      });
      e.addEventListener('pointermove', ev => {
        if (!d) return;
        const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
        if (Math.hypot(dx, dy) > 6) { d.moved = true; clearTimeout(holdT); }
        if (d.moved) { e.style.transform = `translate(${dx * 0.3}px, ${dy * 0.3}px) rotate(calc(var(--r) + ${(dx * 0.08).toFixed(1)}deg))`; if (Math.random() < 0.25) Kit.rustle(0.035, 0.08); }
      });
      const up = () => {
        if (!d) return; clearTimeout(holdT);
        const wasLit = lit; if (lit) { const o = lit; o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => o.remove()); lit = null; }
        if (d.moved) { e.animate([{ transform: e.style.transform }, { transform: 'rotate(var(--r))' }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.4,1)' }); e.style.transform = ''; }
        else if (!wasLit) tap(e, L);
        d = null;
      };
      e.addEventListener('pointerup', up); e.addEventListener('pointercancel', up);
    }
    function toLight(e, L) {
      const r = e.getBoundingClientRect(), o = el('div', 'lt-light'), cv = el('canvas');
      Object.assign(o.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height * 0.8 + 'px' });
      const s = letter(L, 600), m = U.canvas(600, 400), g = m.getContext('2d');
      g.translate(600, 0); g.scale(-1, 1); g.filter = 'blur(3.5px)'; g.globalAlpha = 0.5; g.drawImage(s, 0, 60, 600, 780); // mirrored, blurred, unreadable
      Kit.put(cv, m); o.append(cv); root.append(o);
      o.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: 'ease' });
      status.flash('对着光，只看得到一团模糊的字', 1800);
      return o;
    }
    async function tap(e, L) {
      const n = daysLeft(L);
      if (L.opened) return read(L);
      if (n > 0) {
        e.animate([{ transform: 'rotate(var(--r))' }, { transform: 'rotate(calc(var(--r) + 3deg)) translateX(3px)' }, { transform: 'rotate(calc(var(--r) - 3deg)) translateX(-3px)' }, { transform: 'rotate(var(--r))' }], { duration: 360 });
        Kit.rustle(0.04, 0.1); status.flash(`封得好好的 · 还有 ${n} 天才能拆`); return;
      }
      // its day: tear along the top, bridge by bridge
      for (let i = 0; i < 9; i++) { Kit.crackle(i === 8); await Kit.wait(40 + Math.random() * 40); }
      L.opened = today; save(letters.map(x => ({ ...x, _stamp: undefined })));
      deps.album.add({ id: 'later:' + L.id, kind: 'later', date: L.written, meta: { openOn: L.openOn, opened: true, id: L.id }, back: await Kit.blobOf(letter(L, 900)) });
      fillBox(); read(L);
    }
    let reading = null;
    function read(L) {
      const c = el('canvas', 'lt-read'); Kit.put(c, letter(L, 900));
      const h = Math.min(H * 0.8, (W - 40) * 1.3); Object.assign(c.style, { height: h + 'px', width: h / 1.3 + 'px', left: (W - h / 1.3) / 2 + 'px', top: (H - h) / 2 + 'px' });
      root.append(c); veil.classList.add('on'); reading = c;
      c.animate([{ transform: 'translateY(40px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.3,0,.2,1)' });
    }
    veil.addEventListener('click', () => { if (!reading) return; const c = reading; reading = null; veil.classList.remove('on');
      c.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(30px) scale(.95)' }], { duration: 380, fill: 'forwards' }).finished.then(() => c.remove()); });

    // ---- sealing
    let sealing = false;
    bSeal.onclick = async () => {
      if (sealing) return;
      const text = txt.value.trim();
      if (!text) return status.flash('先写几句给未来的自己');
      const openOn = days ? Kit.addDays(today, days) : custom.value;
      if (!openOn || openOn <= today) return status.flash('拆信日要在今天之后');
      sealing = true; Kit.audio();
      const i = (deps.homePlans || []).length - 1;
      const st = { ...((deps.homePlans || [])[i] || Kit.stampFor('later|' + today, deps.words, deps.palettes, 11, today)) };
      const L = { id: Date.now().toString(36), written: today, openOn, text, st, no: letters.length + 1 };
      // fold in three
      Kit.rustle(0.05, 0.35);
      await paper.animate([{ transform: 'none' }, { transform: 'perspective(900px) rotateX(38deg) scaleY(.66)', offset: 0.45 }, { transform: 'perspective(900px) rotateX(0deg) scaleY(.34) scaleX(.96)' }],
        { duration: 800, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished;
      // into the envelope, which then gets its stamp and today's mark
      const r = paper.getBoundingClientRect(), ew = Math.min(pw * 1.25, W - 40), eh = ew / 1.5;
      const env = el('canvas', 'lt-fly'); Kit.put(env, envelope(L, deps, { cancelled: false })); root.append(env);
      Object.assign(env.style, { left: r.left + r.width / 2 - ew / 2 + 'px', top: r.top + r.height / 2 - eh / 2 + 'px', width: ew + 'px', height: eh + 'px' });
      env.animate([{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
      paper.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      await Kit.wait(560);
      stampOf(L);
      Kit.put(env, envelope(L, deps, { cancelled: false }));
      Kit.rustle(0.03, 0.12); await Kit.wait(420);
      Kit.thump(0.8); Kit.put(env, envelope(L, deps, { cancelled: true }));
      env.animate([{ transform: 'scale(1)' }, { transform: 'scale(.985) translateY(2px)' }, { transform: 'none' }], { duration: 220 });
      await Kit.wait(700);
      letters.push(L); save(letters.map(x => ({ ...x, _stamp: undefined })));
      deps.album.add({ id: 'later:' + L.id, kind: 'later', date: today, meta: { openOn, opened: false, id: L.id } });
      // off into the box
      const br = box.getBoundingClientRect();
      await env.animate([{ transform: 'none' }, { transform: `translate(${br.left + br.width / 2 - (parseFloat(env.style.left) + ew / 2)}px, ${br.top + 80 - (parseFloat(env.style.top) + eh / 2)}px) scale(.3) rotate(8deg)`, opacity: 0.2 }],
        { duration: 700, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' }).finished;
      env.remove(); fillBox(L.id);
      txt.value = '';
      paper.getAnimations().forEach(a => a.cancel());
      paper.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
      status.set(`封好了 · ${fmt(openOn)} 那天才能拆开`);
      sealing = false;
    };

    layout(); fillBox();
    const due = letters.filter(L => !L.opened && daysLeft(L) <= 0).length;
    status.set(due ? `有 ${due} 封信到日子了` : letters.length ? `信匣里有 ${letters.length} 封信` : '写一封信，定一个拆开的日子');
    return P.api({ ready: Promise.resolve(), anchor: () => paper.getBoundingClientRect(), source: () => null });
  }
  Pages.define('later', mount);
  // the album draws letters as envelopes (sealed, or torn open once read)
  Kit.thumbs.later = async (e, sc, deps) => {
    const L = load().find(x => x.id === (e.meta && e.meta.id)) || { id: e.id, written: e.date, openOn: (e.meta || {}).openOn || e.date, st: null };
    if (L.st) L._stamp = deps.makeFront(L.st, 0.2);
    return envelope(L, deps, { opened: !!(e.meta && e.meta.opened) });
  };
})();
