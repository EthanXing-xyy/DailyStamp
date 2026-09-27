// 小票打印机: a thermal receipt printer at the till of 每日邮政's mood store. 打印 feeds a slip up out of the slot, line
// by line: the stamp you bought in two thermal greys, the drug on its leaflet with its ingredients as the items, the
// dosage, a barcode, and at the foot the real stamp stuck on as postage and cancelled across onto the paper. Once it
// is out, drag it to read it, then tear it off (it goes into the album) or print another.
(() => {
  const CW = 560, INK = '#2a2830', PAPER = '#F7F4EC';

  /** the slip for one stamp -> canvas CW wide */
  function slip(st, leaflet, front, thumb, date, no) {
    const k = CW / 480, c = U.canvas(CW, Math.round(2100 * k)), g = c.getContext('2d'), L = 34 * k, R = CW - 34 * k;
    g.fillStyle = PAPER; g.fillRect(0, 0, c.width, c.height);
    let y = 58 * k;
    const text = (t, x, size, align = 'left', role = 'cjk_small', color = INK, track = 1) => U.drawMixed(g, x, y, t, 'caps', role, Math.round(size * k), color, track * k, 1, align);
    const rule = (dash = true) => { g.save(); g.strokeStyle = INK; g.lineWidth = 1.6 * k; if (dash) g.setLineDash([7 * k, 5 * k]); g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.restore(); };
    const now = new Date(), hm = `${Kit.two(now.getHours())}:${Kit.two(now.getMinutes())}`;
    text('每日邮政', CW / 2, 46, 'center', 'phrase_cjk', INK, 10); y += 44 * k;
    text('情绪零售 · MOOD STORE', CW / 2, 18, 'center', 'cjk_small_med', INK, 5); y += 30 * k;
    U.drawTracked(g, CW / 2, y, `${date.replace(/-/g, '.')}  ${hm}   NO.${String(no).padStart(4, '0')}`, U.font('caps_med', Math.round(15 * k)), INK, 3 * k, 'center'); y += 30 * k;
    rule(); y += 26 * k;
    // the stamp in thermal greys: dark print solid, middle tones a pale grey, the rest left paper
    const tw = Math.round(300 * k), th = Math.round(375 * k), t = U.canvas(tw, th), tg = t.getContext('2d', { willReadFrequently: true });
    tg.drawImage(thumb, 0, 0, tw, th);
    const id = tg.getImageData(0, 0, tw, th), d = id.data, dark = [0x2a, 0x28, 0x30], mid = [0xB9, 0xB5, 0xAE], pap = [0xF7, 0xF4, 0xEC];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2], p = l < 92 ? dark : l < 175 ? mid : pap;
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
    }
    tg.putImageData(id, 0, 0);
    g.drawImage(t, (CW - tw) / 2, y); t.width = t.height = 0; y += th + 26 * k;
    U.drawTracked(g, CW / 2, y, '商品图 · 仅供参考', U.font('cjk_small', Math.round(14 * k)), INK, 4 * k, 'center'); y += 30 * k;
    rule(); y += 30 * k;
    // the items: the drug, then what it is made of
    const word = U.hasCjk(st.phrase) ? st.phrase : st.phrase.toUpperCase();
    text(leaflet.name || word, L, 24, 'left', 'phrase_cjk', INK, 2); text('× 1', R, 18, 'right', 'cjk_small_med'); y += 30 * k;
    U.drawTracked(g, L, y, `SKU ${String(Kit.hash(st.phrase) % 1e6).padStart(6, '0')} · 「${word}」`, U.font('caps_med', Math.round(13 * k)), INK, 2 * k, 'left'); y += 32 * k;
    for (const [name, pct] of (leaflet.ingredients || []).slice(0, 6)) {
      text('· ' + name, L + 14 * k, 17, 'left'); text(pct + '%', R, 17, 'right'); y += 28 * k;
    }
    y += 6 * k; rule(); y += 30 * k;
    for (const [a, b] of [['合计', '1 枚'], ['实收', '今天'], ['找零', '明天']]) { text(a, L, 18, 'left', 'cjk_small_med', INK, 3); text(b, R, 18, 'right', 'cjk_small_med', INK, 3); y += 30 * k; }
    y += 4 * k; rule(); y += 30 * k;
    // the dosage off the leaflet, wrapped
    text('用法', L, 15, 'left', 'cjk_small_med', INK, 3);
    g.font = U.font('cjk_small', Math.round(16 * k)); g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle';
    let line = ''; const x0 = L + 58 * k, maxW = R - x0;
    for (const ch of leaflet.dosage || '') {
      if (g.measureText(line + ch).width > maxW && !'，。；、）」'.includes(ch)) { g.fillText(line, x0, y); y += 26 * k; line = ch; } else line += ch;
    }
    if (line) { g.fillText(line, x0, y); y += 26 * k; }
    y += 10 * k; rule(); y += 26 * k;
    // a barcode from the word and the day
    const rnd = Print.rng(Kit.hash(st.phrase + date)), bw = R - L - 40 * k, bh = 70 * k;
    let bx = L + 20 * k; g.fillStyle = INK;
    while (bx < L + 20 * k + bw) { const w = (1 + Math.floor(rnd() * 3)) * 2 * k; if (rnd() < 0.55) g.fillRect(bx, y, w, bh); bx += w + (1 + Math.floor(rnd() * 2)) * 2 * k; }
    y += bh + 20 * k;
    U.drawTracked(g, CW / 2, y, String(Kit.hash(st.phrase + date)).padStart(12, '0').slice(0, 12), U.font('caps', Math.round(15 * k)), INK, 7 * k, 'center'); y += 40 * k;
    // postage: the real stamp stuck on, cancelled across onto the slip
    text('邮资已付 · POSTAGE PAID', CW / 2, 16, 'center', 'cjk_small_med', INK, 4); y += 24 * k;
    const sw = Math.round(220 * k), sh = Math.round(sw * 1.25), sx = CW / 2 - sw / 2 - 20 * k, sy = y;
    g.save(); g.translate(sx + sw / 2, sy + sh / 2); g.rotate(-0.035); g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 5 * k; g.shadowOffsetY = 2 * k;
    g.drawImage(front, -sw / 2, -sh / 2, sw, sh); g.restore();
    Stamp.postmark(g, sx + sw * 0.86, sy + sh * 0.3, 62 * k, 0.42 * k, { no: st.no || 1, date }, -0.18, Kit.hash(st.phrase));
    y += sh + 44 * k;
    text('谢谢惠顾 · 情绪售出 概不退换', CW / 2, 16, 'center', 'cjk_small', INK, 4); y += 26 * k;
    U.drawTracked(g, CW / 2, y, 'THANK YOU · SEE YOU TOMORROW', U.font('caps_med', Math.round(12 * k)), INK, 4 * k, 'center'); y += 50 * k;
    // crop to what was printed; the top edge was torn off the last slip
    const out = U.canvas(CW, Math.round(y)), o = out.getContext('2d');
    o.drawImage(c, 0, 0); c.width = c.height = 0;
    tearEdge(o, 0, 1);
    U.grain(o, out.width, out.height, 0.12, 9);
    return out;
  }
  /** a torn edge along y (dir 1: the paper is below it, -1: above) */
  function tearEdge(g, y, dir) {
    const w = g.canvas.width, t = 9;
    g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, y - dir * 40);
    for (let x = 0, i = 0; x <= w + 12; x += 12, i++) g.lineTo(x, y + dir * (i % 2 ? t : 1 + Math.random() * 3));
    g.lineTo(w, y - dir * 40); g.closePath(); g.fill(); g.restore();
  }

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'receipt', () => layout());
    const status = P.status;
    const feed = el('div', 'rc-feed'), paper = el('div', 'rc-paper'), printer = el('div', 'rc-printer'), acts = el('div', 'rc-acts'), veil = el('div', 'rc-veil');
    printer.innerHTML = '<i class="rc-mouth"></i><span class="rc-plate"><b>每日邮政</b><i>THERMAL · 58MM</i></span><i class="rc-led"></i>';
    feed.append(paper); root.append(feed, printer, acts, veil);
    const bPrint = Kit.button(acts, '打印'), bTear = Kit.button(acts, '撕下'), bSave = Kit.button(acts, '存为图片');
    bPrint.style.setProperty('--swash', '#23D5E8'); bTear.style.setProperty('--swash', '#ff5fa2'); bSave.style.setProperty('--swash', '#ffb000');
    bTear.disabled = true; bSave.hidden = true;
    const pal = deps.palettes[Kit.hash('receipt' + date + Kit.visit) % deps.palettes.length];
    printer.style.setProperty('--body', pal.c[0]); printer.style.setProperty('--plate', pal.c[2]); printer.style.setProperty('--key', pal.ink);
    const plans = deps.homePlans || [], mine = plans[Home.FEATURES.findIndex(f => f.key === 'receipt')];

    let W = 0, H = 0, phone = false, rw = 0, slotY = 0, top = 0, pw = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      rw = phone ? Math.min(W - 96, 290) : Math.min(330, H * 0.36);
      pw = rw + (phone ? 56 : 80);
      const ph = phone ? 88 : 104;
      slotY = H - ph - (phone ? 92 : 96); top = phone ? 92 : 96;
      const cx = W / 2;
      Object.assign(printer.style, { left: cx - pw / 2 + 'px', top: slotY - 14 + 'px', width: pw + 'px', height: ph + 'px' });
      Object.assign(feed.style, { left: cx - rw / 2 - 20 + 'px', top: top + 'px', width: rw + 40 + 'px', height: slotY - top + 'px' });
      acts.style.cssText = `left:0;right:0;top:${slotY - 14 + ph + 12}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${slotY - 14 + ph + 58}px`;
      if (cur) size();
    }

    // ---- printing: the slip rises out of the mouth a few lines at a time
    let cur = null, busy = false, n = 0, off = 0, lastFront = null, pending = null;
    const size = () => { cur.h = rw * cur.cv.height / cur.cv.width; Object.assign(cur.cv.style, { width: rw + 'px', height: cur.h + 'px' }); place(); };
    const room = () => slotY - top;
    // off: how far above the mouth the slip's bottom sits (0 = its foot at the mouth; it may be pushed back in to read the top)
    const place = () => { paper.style.transform = `translate(20px, ${room() - cur.shown + off}px)`; };
    async function print() {
      if (busy) return; busy = true; bPrint.disabled = true; bTear.disabled = true; bSave.hidden = true;
      Kit.audio();
      if (cur) await tearOff(false);
      n++;
      const st = pending || (n === 1 && mine) || Kit.visitStamps(deps, 'receipt|' + n, 1)[0];
      pending = null;
      const l = (await deps.loadLeaflet(st.phrase)) || {}, leaflet = l.status === 'ready' ? l : Leaflet.fallback(st.phrase, st.en || '');
      const front = deps.makeFront(st, 0.36), thumb = deps.makeFront(st, 0.25);   // at most the home's size: copies of its prints
      lastFront = front;
      const cv = slip(st, leaflet, front, thumb, date, Kit.hash(date) % 900 + n);
      thumb.width = thumb.height = 0;
      cv.className = 'rc-slip';
      paper.replaceChildren(cv);
      cur = { cv, st, shown: 0, h: 0 }; off = 0; size();
      printer.classList.add('on');
      status.set(`正在打印 · 「${st.phrase}」`);
      // a line or two at a time, the head whirring
      const total = cur.h, t0 = performance.now(), dur = clamp(total * 6, 2400, 4800);
      await new Promise(res => {
        let last = 0;
        const step = t => {
          const k = Math.min(1, (t - t0) / dur), stepped = Math.floor(k * total / 6) * 6;
          if (stepped !== cur.shown) { cur.shown = Math.min(total, stepped); place(); }
          if (t - last > 90) { last = t; Kit.rustle(0.018, 0.07); }
          if (k < 1) requestAnimationFrame(step); else { cur.shown = total; place(); res(); }
        };
        requestAnimationFrame(step);
      });
      printer.classList.remove('on');
      deps.album.add({ id: `receipt:${date}:${n}:${Kit.visit}`, kind: 'receipt', date, image: await Kit.blobOf(cv) }, { keep: true });
      busy = false; bPrint.disabled = false; bTear.disabled = false;
      status.set(cur.h > room() ? '打好了 · 上下拖动小票看全 · 撕下它收进集邮册' : '打好了 · 撕下它 · 也已收进集邮册');
      bPrint.textContent = '再打一张';
    }
    // drag the slip to read it: pushed back into the mouth to see the top, never pulled off
    let drag = null;
    feed.addEventListener('pointerdown', e => { if (!cur || busy) return; drag = { y: e.clientY, off }; feed.setPointerCapture(e.pointerId); });
    feed.addEventListener('pointermove', e => {
      if (!drag) return;
      off = clamp(drag.off + e.clientY - drag.y, 0, Math.max(0, cur.h - room() + 24)); place();
    });
    const up = () => { drag = null; };
    feed.addEventListener('pointerup', up); feed.addEventListener('pointercancel', up);

    // ---- tearing off: the torn slip is laid on the desk whole, to be saved
    let kept = null;
    async function tearOff(show = true) {
      const c = cur; if (!c) return;
      cur = null; bTear.disabled = true;
      Kit.crackle(true); for (let i = 0; i < 6; i++) setTimeout(() => Kit.crackle(), 30 + i * 22);
      const g = c.cv.getContext('2d'); tearEdge(g, c.cv.height - 2, -1);
      if (!show) {
        await paper.animate([{ opacity: 1 }, { opacity: 0, transform: paper.style.transform + ' translateY(-30px) rotate(-3deg)' }], { duration: 380, easing: 'ease-in', fill: 'forwards' }).finished;
        paper.getAnimations().forEach(a => a.cancel()); paper.replaceChildren(); return;
      }
      // lay it out whole: the same canvas, flown from where it hangs to the middle of the desk
      const r = c.cv.getBoundingClientRect(), fitH = acts.getBoundingClientRect().top - 104, fitW = W - 40, sc = Math.min(1, fitH / c.h, fitW / rw);
      const box = el('div', 'rc-kept'); box.append(c.cv); root.append(box);
      const w = rw * sc, h = c.h * sc, x = W / 2 - w / 2, y = 92 + (fitH - h) / 2;
      Object.assign(box.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      Object.assign(c.cv.style, { width: '100%', height: '100%' });
      paper.replaceChildren();
      veil.classList.add('on');
      box.animate([{ transform: `translate(${r.left - x}px, ${r.top - y}px) scale(${rw / w})`, transformOrigin: '0 0' }, { transform: 'translate(0,0) rotate(-1.5deg) scale(1)', transformOrigin: '0 0' }],
        { duration: 700, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' });
      kept = { box, cv: c.cv, st: c.st };
      bSave.hidden = false;
      status.set('撕好了 · 收进了集邮册 · 点空白处放回');
    }
    function dropKept() {
      const k = kept; kept = null; veil.classList.remove('on'); bSave.hidden = true;
      if (!k) return;
      k.box.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(30px) rotate(2deg)' }], { duration: 360, easing: 'ease-in', fill: 'forwards' }).finished.then(() => k.box.remove());
      status.set('按「再打一张」');
    }
    veil.addEventListener('click', dropKept);
    bPrint.onclick = () => { if (kept) dropKept(); print(); };
    bTear.onclick = () => tearOff(true);
    bSave.onclick = async () => { if (kept) await Kit.save([{ cv: kept.cv, name: `receipt-${date}.png` }]); };

    layout();
    status.set('按「打印」· 今天的情绪小票');
    return P.api({
      ready: Promise.resolve(),
      leave() { if (kept) dropKept(); },
      // before a slip is out: the spot above the mouth, where the stamp goes in
      anchor: () => { const h = Math.min(room() * 0.8, rw * 1.1); return new DOMRect(W / 2 - h * 0.4, slotY - h - 10, h * 0.8, h); },
      receive(st) { if (busy) return; pending = st; setTimeout(print, 250); return 450; },
      source: () => lastFront,
    });
  }
  Pages.define('receipt', mount);
})();
