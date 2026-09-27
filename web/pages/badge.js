// 徽章机: a button-badge press. Pick a stamp off the tray and it lies on the die; pull the lever (or tap the stamp) and
// it comes out a 58 mm tin badge: the stamp's middle domed under the shine, its edge wrapped round the rim. Tap the
// badge to see its back (the pin, a paper label). Press the next one and the last is pinned on the tote bag; the day's
// badges stay on it and go into the album.
(() => {
  const TAU = Math.PI * 2;

  /** the two faces of a badge made from a stamp's front, D px across -> {face, back} */
  function faces(front, D, st, date, pal) {
    const r = D / 2, face = U.canvas(D, D), g = face.getContext('2d');
    const s = D * 1.12 / front.width;                                     // the stamp a little wider than the badge
    const fw = front.width * s, fh = front.height * s, cx = r, cy = r;
    const put = k => g.drawImage(front, cx - fw * k / 2, cy - fh * k * 0.52, fw * k, fh * k);
    // the rim: the print wrapped round the curl, darker as it turns away
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip(); put(1.1);
    const curl = g.createRadialGradient(cx, cy, r * 0.86, cx, cy, r);
    curl.addColorStop(0, 'rgba(0,0,0,0)'); curl.addColorStop(0.55, 'rgba(0,0,0,.28)'); curl.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = curl; g.fillRect(0, 0, D, D); g.restore();
    // the dome
    g.save(); g.beginPath(); g.arc(cx, cy, r * 0.9, 0, TAU); g.clip(); put(1);
    const dome = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r * 0.92);
    dome.addColorStop(0, 'rgba(255,255,255,.10)'); dome.addColorStop(0.7, 'rgba(0,0,0,0)'); dome.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = dome; g.fillRect(0, 0, D, D); g.restore();
    // where the dome meets the curl, a fine bright line; and the printed shine of the mylar
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(1, D * 0.006); g.beginPath(); g.arc(cx, cy, r * 0.9, Math.PI * 0.95, Math.PI * 1.75); g.stroke();
    g.save(); g.globalCompositeOperation = 'screen';
    const shine = g.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 0, cx - r * 0.38, cy - r * 0.45, r * 0.55);
    shine.addColorStop(0, 'rgba(255,255,255,.42)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = shine; g.beginPath(); g.arc(cx, cy, r * 0.9, 0, TAU); g.fill(); g.restore();

    // the back: tin, the paper wrapped over the rim, a pin, a little round label
    const back = U.canvas(D, D), b = back.getContext('2d');
    b.save(); b.beginPath(); b.arc(cx, cy, r, 0, TAU); b.clip(); b.drawImage(face, 0, 0);
    const tin = b.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 0.88);
    tin.addColorStop(0, '#f1f1f3'); tin.addColorStop(0.6, '#c3c3c8'); tin.addColorStop(1, '#8e8e95');
    b.fillStyle = tin; b.beginPath(); b.arc(cx, cy, r * 0.88, 0, TAU); b.fill(); b.restore();
    b.strokeStyle = 'rgba(0,0,0,.25)'; b.lineWidth = D * 0.008; b.beginPath(); b.arc(cx, cy, r * 0.88, 0, TAU); b.stroke();
    // the label
    b.fillStyle = '#F4EEDF'; b.beginPath(); b.arc(cx, cy + r * 0.2, r * 0.36, 0, TAU); b.fill();
    const k = D / 300, word = U.hasCjk(st.phrase) ? st.phrase : st.phrase.toUpperCase();
    U.drawMixed(b, cx, cy + r * 0.2 - 22 * k, '每日邮政', 'caps', 'cjk_small', Math.round(13 * k), pal.ink, 2 * k, 1, 'center');
    U.drawMixed(b, cx, cy + r * 0.2 + 2 * k, word, 'caps', 'phrase_cjk', Math.round(Math.min(22, 70 / [...word].length) * k), '#1d1d1f', 1 * k, 1, 'center');
    U.drawTracked(b, cx, cy + r * 0.2 + 26 * k, `58MM · ${date.replace(/-/g, '.')}`, U.font('caps_med', Math.round(7 * k)), pal.ink, 2 * k, 'center');
    // the pin: a steel bar with its coil at one end and the catch at the other
    const py = cy - r * 0.32, x0 = cx - r * 0.62, x1 = cx + r * 0.6;
    b.lineCap = 'round'; b.strokeStyle = '#6d6d74'; b.lineWidth = D * 0.022;
    b.beginPath(); b.moveTo(x0, py); b.lineTo(x1, py - r * 0.04); b.stroke();
    b.strokeStyle = '#e9e9ee'; b.lineWidth = D * 0.008; b.beginPath(); b.moveTo(x0, py - D * 0.006); b.lineTo(x1, py - r * 0.04 - D * 0.006); b.stroke();
    b.fillStyle = '#7a7a82'; b.beginPath(); b.arc(x0, py, D * 0.035, 0, TAU); b.fill();
    b.fillStyle = '#9a9aa2'; b.beginPath(); b.roundRect(x1 - D * 0.01, py - r * 0.04 - D * 0.03, D * 0.06, D * 0.06, D * 0.015); b.fill();
    return { face, back };
  }

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'badge', () => layout());
    const status = P.status;
    const press = el('div', 'bd-press'), die = el('i', 'bd-die'), lever = el('button', 'bd-lever'), load = el('canvas', 'bd-load');
    lever.type = 'button'; lever.setAttribute('aria-label', '压下杠杆');
    press.innerHTML = '<span class="bd-plate"><b>每日邮政</b><i>BADGE PRESS · 58</i></span>';
    press.append(die, lever);
    const tray = el('div', 'bd-tray'), bag = el('div', 'bd-bag'), acts = el('div', 'bd-acts');
    bag.innerHTML = '<i class="bd-handle"></i><span class="bd-print">每日邮政</span>';
    root.append(bag, press, load, tray, acts);
    const bSave = Kit.button(acts, '存为图片'); bSave.style.setProperty('--swash', '#ffb000'); bSave.hidden = true;
    const pal = deps.palettes[Kit.hash('badge' + date + Kit.visit) % deps.palettes.length];
    press.style.setProperty('--body', pal.c[1]); press.style.setProperty('--key', pal.ink); press.style.setProperty('--arm', pal.c[3]);
    bag.style.setProperty('--strap', pal.c[0]);
    const plans = deps.homePlans || [], mine = plans[Home.FEATURES.findIndex(f => f.key === 'badge')];

    // ---- the tray: three stamps to choose from; a used one is replaced by a new one
    let dealt = 0;
    const deal = () => Kit.visitStamps(deps, 'badge|' + dealt++, 1)[0];
    const slots = [0, 1, 2].map(i => {
      const b = el('button', 'bd-src'), cv = el('canvas'); b.type = 'button'; b.append(cv); tray.append(b);
      const sl = { b, cv, st: i === 0 && mine ? mine : deal() };
      b.onclick = () => pick(sl);
      return sl;
    });
    const drawSlot = sl => Kit.put(sl.cv, deps.makeFront(sl.st, 0.18));

    let W = 0, H = 0, phone = false, ds = 0, dx = 0, dy = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      ds = phone ? Math.min(W * 0.5, H * 0.29) : Math.min(290, H * 0.36);
      const mw = ds * 1.55, mh = ds * 1.3;
      dx = phone ? W / 2 - ds * 0.12 : W * 0.32 - ds * 0.12;
      dy = phone ? 104 + mh / 2 : Math.max(120 + mh / 2, H * 0.44);
      Object.assign(press.style, { left: dx - mw / 2 + ds * 0.12 + 'px', top: dy - mh / 2 + 'px', width: mw + 'px', height: mh + 'px' });
      Object.assign(die.style, { left: dx - (dx - mw / 2 + ds * 0.12) - ds * 0.53 + 'px', top: mh / 2 - ds * 0.53 + 'px', width: ds * 1.06 + 'px', height: ds * 1.06 + 'px' });
      const lh = mh * 0.62;
      Object.assign(lever.style, { right: mw * 0.02 + 'px', top: mh * 0.08 + 'px', width: mw * 0.16 + 'px', height: lh + 'px' });
      const sw = ds * 0.84, sh = sw * 1.25;
      Object.assign(load.style, { left: dx - sw / 2 + 'px', top: dy - sh / 2 + 'px', width: sw + 'px', height: sh + 'px' });
      const tTop = dy + mh / 2 + 14, th = phone ? clamp(H * 0.1, 54, 76) : 96;
      tray.style.cssText = phone ? `left:16px;top:${tTop}px;height:${th}px` : `left:${dx - mw / 2}px;top:${tTop}px;height:${th}px`;
      acts.style.cssText = phone ? `right:14px;top:${tTop + th / 2 - 20}px` : `left:${dx - mw / 2 + mw / 2 + 60}px;top:${tTop + th / 2 - 20}px`;
      if (phone) {
        const bt = tTop + th + 16, bb = H - 44;
        Object.assign(bag.style, { left: '22px', width: W - 44 + 'px', top: bt + 'px', height: Math.max(80, bb - bt) + 'px' });
        status.el.style.cssText = `left:16px;right:16px;top:${H - 30}px`;
      } else {
        const bw = Math.min(W * 0.34, 470), bh = Math.min(H - 220, bw * 1.1);
        Object.assign(bag.style, { left: W * 0.74 - bw / 2 + 'px', width: bw + 'px', top: (H - bh) / 2 + 40 + 'px', height: bh + 'px' });
        status.el.style.cssText = `left:${dx - mw / 2}px;width:${mw}px;top:${tTop + th + 20}px`;
      }
      if (made) made.c.place(dx, dy, ds, ds);
      pins.forEach(placePin);
    }

    // ---- the die: the chosen stamp lies on it
    let loaded = null, busy = false, made = null, lastFront = null;
    function pick(sl, instant = false) {
      if (busy) return;
      Kit.audio(); Kit.rustle(0.03, 0.15);
      if (made) pinIt();
      loaded = sl.st;
      Kit.put(load, deps.makeFront(sl.st, clamp(ds * 0.84 * 1.25 * Math.min(2, devicePixelRatio || 1) / Stamp.BH, 0.2, 0.36)));
      load.classList.add('on');
      if (!instant) load.animate([{ opacity: 0, transform: 'translateY(-18px) rotate(-3deg)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.25,.8,.3,1)' });
      sl.st = deal(); drawSlot(sl);
      status.set(`「${loaded.phrase}」放好了 · 压下杠杆`);
    }
    async function pressIt() {
      if (busy || !loaded) return status.flash('先从下面挑一枚邮票');
      busy = true; Kit.audio();
      const st = loaded; loaded = null;
      await lever.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(38deg)' }], { duration: 260, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }).finished;
      Kit.thump(0.9);
      const dpr = Math.min(2, devicePixelRatio || 1), D = Math.round(clamp(ds * dpr, 200, 560));
      const front = deps.makeFront(st, clamp(D * 1.12 / Stamp.BW, 0.2, 0.36));
      const f = faces(front, D, st, date, pal);
      const c = Kit.card(root, deps, { cls: 'bd-badge' }); c.place(dx, dy, ds, ds); c.turn(1, true); c.show(f.face, f.back); c.st = st; c.face = f.face;
      load.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.9)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' }).finished.then(() => { load.classList.remove('on'); load.getAnimations().forEach(a => a.cancel()); });
      c.box.animate([{ opacity: 0, transform: 'scale(1.05)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'ease-out' });
      await Kit.wait(200);
      lever.animate([{ transform: 'rotate(38deg)' }, { transform: 'rotate(0deg)' }], { duration: 480, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
      made = { c, st }; lastFront = front;
      deps.album.add({ id: `badge:${date}:${Date.now()}`, kind: 'badge', date, image: await Kit.blobOf(f.face) });
      bSave.hidden = false; busy = false;
      status.set('压好了 · 点它看背面 · 再挑一枚，这枚就别到包上');
    }
    lever.onclick = pressIt;
    load.addEventListener('click', pressIt);

    // ---- the tote: the day's badges pinned on it
    const pins = [];
    function spotFor(i) {
      const rnd = Print.rng(Kit.hash('pin' + date) + i * 97);
      return { u: 0.14 + rnd() * 0.72, v: 0.18 + rnd() * 0.66, rot: (rnd() - 0.5) * 30, k: 0.9 + rnd() * 0.2 };
    }
    function placePin(p) {
      const r = bag.getBoundingClientRect(), size = Math.min(r.width, r.height) * (phone ? 0.3 : 0.24) * p.spot.k;
      Object.assign(p.el.style, { left: p.spot.u * r.width - size / 2 + 'px', top: p.spot.v * r.height - size / 2 + 'px', width: size + 'px', height: size + 'px', transform: `rotate(${p.spot.rot}deg)` });
    }
    function addPin(src, animateFrom) {
      if (pins.length >= 12) { const old = pins.shift(); old.el.remove(); }
      const e = el('canvas', 'bd-pin'), n = 160; e.width = e.height = n; e.getContext('2d').drawImage(src, 0, 0, n, n);
      bag.append(e);
      const p = { el: e, spot: spotFor(pins.length + pinned) }; pins.push(p); placePin(p);
      if (animateFrom) {
        const r = e.getBoundingClientRect();
        e.animate([{ transform: `translate(${animateFrom.left + animateFrom.width / 2 - r.left - r.width / 2}px, ${animateFrom.top + animateFrom.height / 2 - r.top - r.height / 2}px) scale(${animateFrom.width / r.width})` },
          { transform: `rotate(${p.spot.rot}deg)` }], { duration: 700, easing: 'cubic-bezier(.3,.7,.2,1)' });
      }
    }
    let pinned = 0;
    function pinIt() {
      const m = made; made = null; bSave.hidden = true;
      const from = m.c.box.getBoundingClientRect();
      addPin(m.face || m.c.face, from); pinned++;
      m.c.box.remove(); Kit.thump(0.2);
    }
    bSave.onclick = async () => { if (made) await Kit.save([{ cv: made.c.face, name: `badge-${date}.png` }]); };

    layout();
    slots.forEach(drawSlot);
    status.set('从下面挑一枚邮票 · 压成徽章');
    const ready = deps.album.all().then(async all => {
      const mineToday = all.filter(e => e.kind === 'badge' && e.date === date && e.image).slice(-12);
      for (const e of mineToday) { const img = await Kit.imageOf(e.image); if (img) addPin(img); }
      pinned = pins.length;
    });
    return P.api({
      ready: Promise.race([ready, Kit.wait(600)]),
      enter() { requestAnimationFrame(() => pins.forEach(placePin)); },
      anchor: () => load.getBoundingClientRect(),
      receive(st) { if (busy) return; pick({ st, cv: el('canvas'), b: null }, true); return 250; },
      source: () => lastFront,
    });
  }
  Pages.define('badge', mount);
})();
