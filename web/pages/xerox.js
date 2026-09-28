// 复印机: Xerox art. The stamp goes face down on the glass; press the big green key and the light sweeps under it, a
// copy slides out. Copy the copy and it drifts further: the colour drains, the contrast climbs, toner specks, a drum
// streak, the image creeping and turning a little each time, until it is stark black and white. Turn the dial to
// 141% to blow it up as you go. Staple the pile into an eight-page zine and keep it.
(() => {
  const TAU = Math.PI * 2, MAX = 8, CW = 440, CH = 550;

  /** one pass through the copier: src (a canvas) -> a new canvas, one generation worse */
  function copyOf(src, gen, zoom, seed) {
    const rnd = Print.rng(seed), w = CW, h = CH, c = U.canvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#F7F5EF'; g.fillRect(0, 0, w, h);
    // the image creeps: a little bigger, a little turned, a little off; 141% crops into the middle
    const k = (zoom ? 1.41 : 1) * (1 + 0.012 * rnd()), rot = (rnd() - 0.5) * 0.012 * Math.min(4, gen + 1), dx = (rnd() - 0.5) * 8, dy = (rnd() - 0.5) * 8;
    g.save(); g.translate(w / 2 + dx, h / 2 + dy); g.rotate(rot); g.scale(k, k);
    g.filter = gen > 1 ? `blur(${Math.min(1.2, 0.3 * gen)}px)` : 'none';
    g.drawImage(src, -w / 2, -h / 2, w, h); g.restore(); g.filter = 'none';
    // tone: colour drains, contrast climbs, and past the third generation it snaps to toner black or paper
    const id = g.getImageData(0, 0, w, h), d = id.data, sat = Math.max(0, 1 - 0.45 * (gen + 1)), con = 1.18 + 0.12 * gen, thr = gen >= 3;
    for (let i = 0; i < d.length; i += 4) {
      const L = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      for (let ch = 0; ch < 3; ch++) {
        let v = L + (d[i + ch] - L) * sat;
        v = (v - 138) * con + 138 + 10;
        if (thr) v = v + (Math.random() - 0.5) * 70 < 118 ? 26 : 247;
        d[i + ch] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      if (thr) { d[i] = d[i + 1] = d[i + 2] = d[i] < 128 ? 28 : 246; }
    }
    g.putImageData(id, 0, 0);
    // toner: specks everywhere, a dark lid shadow on one side, now and then a streak from a scratched drum
    g.fillStyle = '#1b1b1b';
    for (let i = 0; i < 90 + 160 * gen; i++) { g.globalAlpha = 0.25 + rnd() * 0.6; g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.4 + rnd() * 1.4, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    const edge = g.createLinearGradient(0, 0, 26, 0); edge.addColorStop(0, `rgba(20,20,20,${Math.min(0.85, 0.35 + gen * 0.12)})`); edge.addColorStop(1, 'rgba(20,20,20,0)');
    g.fillStyle = edge; g.fillRect(0, 0, 26, h);
    if (rnd() < 0.45) { const x = w * (0.2 + rnd() * 0.7); g.fillStyle = 'rgba(30,30,30,.22)'; g.fillRect(x, 0, 1.5 + rnd() * 2, h); }
    return c;
  }

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'xerox', () => layout());
    const status = P.status;
    const mach = el('div', 'xr-machine'), body = el('canvas', 'xr-body'), glass = el('div', 'xr-glass'), orig = el('canvas', 'xr-orig'), light = el('i', 'xr-light');
    const key = el('button', 'xr-key', 'COPY'), dial = el('button', 'xr-dial', '<b>100%</b>'), pile = el('div', 'xr-pile'), acts = el('div', 'xr-acts');
    const veil = el('div', 'xr-veil'), zine = el('canvas', 'xr-zine');
    key.type = 'button'; dial.type = 'button';
    glass.append(orig, light); mach.append(body, glass, key, dial); root.append(mach, pile, acts, veil, zine);
    const bSwap = Kit.button(acts, '换一枚'), bRe = Kit.button(acts, '复印原件'), bZine = Kit.button(acts, '装订成册'), bSave = Kit.button(acts, '存为图片');
    bZine.style.setProperty('--swash', '#ffb000'); bSave.style.setProperty('--swash', '#23D5E8'); bSave.hidden = true;
    const pal = deps.palettes[Kit.hash('xerox' + date) % deps.palettes.length];

    let i = 0, st = null, src = null, copies = [], zoom = false, busy = false, zineCv = null;
    const stOf = k => Kit.stampFor(`xerox|${date}|${k}`, deps.words, deps.palettes, k + 1, date);

    // ---- layout
    let W = 0, H = 0, phone = false, mw = 0, mh = 0, mx = 0, my = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      mw = phone ? W - 28 : Math.min(W * 0.46, 600); mh = mw * 0.74;
      mx = phone ? 14 : W * 0.34 - mw / 2; my = phone ? 100 : Math.max(108, (H - mh) / 2 - 10);
      Object.assign(mach.style, { left: mx + 'px', top: my + 'px', width: mw + 'px', height: mh + 'px' });
      const gh = mh * 0.62, gw = gh * 0.8 * 1.25;
      Object.assign(glass.style, { left: mw * 0.08 + 'px', top: mh * 0.2 + 'px', width: gw + 'px', height: gh + 'px' });
      const oh = gh * 0.78; Object.assign(orig.style, { left: (gw - oh * 0.8) / 2 + 'px', top: (gh - oh) / 2 + 'px', width: oh * 0.8 + 'px', height: oh + 'px' });
      const ks = mh * 0.24;
      Object.assign(key.style, { left: mw * 0.78 - ks / 2 + 'px', top: mh * 0.52 - ks / 2 + 'px', width: ks + 'px', height: ks + 'px', fontSize: ks * 0.2 + 'px' });
      const ds = mh * 0.16;
      Object.assign(dial.style, { left: mw * 0.78 - ds / 2 + 'px', top: mh * 0.2 - ds / 2 + 'px', width: ds + 'px', height: ds + 'px', fontSize: ds * 0.2 + 'px' });
      const ph = phone ? Math.min(H - my - mh - 120, 220) : Math.min(mh * 0.95, 420), pw2 = ph * 0.8;
      Object.assign(pile.style, phone ? { left: W / 2 - pw2 / 2 + 'px', top: my + mh + 16 + 'px', width: pw2 + 'px', height: ph + 'px' }
        : { left: mx + mw + Math.max(40, (W - mx - mw - pw2) / 2) + 'px', top: my + mh / 2 - ph / 2 + 'px', width: pw2 + 'px', height: ph + 'px' });
      acts.style.cssText = phone ? `left:10px;right:10px;top:${Math.min(H - 76, my + mh + ph + 26)}px` : `left:${mx}px;width:${mw}px;top:${my + mh + 18}px`;
      status.el.style.cssText = phone ? `left:16px;right:16px;top:${H - 30}px` : `left:${mx}px;width:${mw}px;top:${my + mh + 66}px`;
      drawBody();
    }
    function drawBody() {
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(mw * dpr), h = Math.round(mh * dpr);
      body.width = w; body.height = h;
      const g = body.getContext('2d'), k = w / 100; g.setTransform(k, 0, 0, k, 0, 0);
      const H2 = 74, ink = pal.ink;
      g.lineJoin = 'round'; g.lineWidth = 0.9; g.strokeStyle = ink;
      g.fillStyle = '#E9E5DA'; g.beginPath(); g.roundRect(1, 1, 98, H2 - 2, 4); g.fill(); g.stroke();
      g.fillStyle = pal.c[0]; g.beginPath(); g.roundRect(1, 1, 98, 11, [4, 4, 0, 0]); g.fill(); g.stroke();          // the lid, raised
      U.drawTracked(g, 6, 6.8, 'DAILY POST · COPIER 141', U.font('caps', 2.6), U.contrast(pal.c[0], '#fff') > 2.5 ? '#fff' : ink, 0.5, 'left');
      g.fillStyle = '#5b5a58'; g.beginPath(); g.roundRect(6.5, 13.3, 48.9, 48.9, 1.5); g.fill();              // around the glass (8, 14.8, 45.9 square)
      g.fillStyle = U.shade('#E9E5DA', 0.9); g.beginPath(); g.roundRect(66, 14, 30, 56, 2); g.fill(); g.stroke();                  // the panel
      U.drawCentered(g, 81, 64, 'COPY · 复印', U.font('caps_med', 2.4), ink);
    }

    // ---- the original on the glass
    async function setSource(s) {
      st = s; await deps.loadLeaflet(st.phrase);
      src = deps.makeFront(st, 0.37, { xerox: true });
      Kit.put(orig, src);
      status.set(`「${st.phrase}」放上了玻璃板 · 按 COPY`);
    }

    // ---- a copy: the light sweeps, a sheet slides out onto the pile
    key.onclick = async () => {
      if (busy || !src) return;
      busy = true; key.classList.add('down'); Kit.audio(); Kit.thump(0.25);
      light.getAnimations().forEach(a => a.cancel());
      await light.animate([{ transform: 'translateX(0)', opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { transform: `translateX(${glass.clientWidth}px)`, opacity: 0 }],
        { duration: 1300, easing: 'linear' }).finished;
      key.classList.remove('down');
      const from = copies.length ? copies[copies.length - 1] : { cv: src, gen: -1 };
      const gen = from.gen + 1, cv = copyOf(from.cv, gen, zoom, Kit.hash(st.seed + '|' + copies.length + '|' + Date.now()));
      copies.push({ cv, gen, zoom });
      const sheet = el('div', 'xr-sheet'), sc = el('canvas'); Kit.put(sc, cv); sheet.append(sc);
      const tag = el('span', '', `GEN ${gen + 1}${zoom ? ' · 141%' : ''}`); sheet.append(tag);
      sheet.style.setProperty('--r', ((Math.random() - 0.5) * 10).toFixed(1) + 'deg');
      pile.append(sheet);
      while (pile.children.length > MAX) pile.firstChild.remove();
      if (copies.length > MAX) copies.shift();
      const m = mach.getBoundingClientRect(), p = pile.getBoundingClientRect();
      sheet.animate([{ transform: `translate(${m.right - p.left - p.width * 0.8}px, ${m.top + m.height * 0.5 - p.top - p.height / 2}px) scale(.5) rotate(0deg)`, opacity: 0 },
        { opacity: 1, offset: 0.3 }, { transform: `rotate(var(--r))`, opacity: 1 }], { duration: 800, easing: 'cubic-bezier(.3,0,.2,1)' });
      Kit.rustle(0.05, 0.5);
      const last = copies[copies.length - 1];
      status.set(last.gen >= 3 ? `第 ${last.gen + 1} 代 · 只剩黑白了` : `第 ${last.gen + 1} 代 · 再按一次就复印这一张`);
      bZine.disabled = copies.length < 2;
      busy = false;
    };
    dial.onclick = () => { zoom = !zoom; dial.querySelector('b').textContent = zoom ? '141%' : '100%'; dial.classList.toggle('on', zoom); Kit.rustle(0.02, 0.06); };
    bRe.onclick = () => { if (!copies.length) return; copies = []; pile.replaceChildren(); bZine.disabled = true; status.set('从原件重新复印'); };
    bSwap.onclick = async () => { if (busy) return; i++; copies = []; pile.replaceChildren(); bZine.disabled = true; await setSource(stOf(i)); };

    // ---- the zine: eight pages imposed on one sheet, cover and back cover, stapled
    function makeZine() {
      const pw = 600, ph = 750, c = U.canvas(pw * 4, ph * 2), g = c.getContext('2d');
      g.fillStyle = '#F7F5EF'; g.fillRect(0, 0, c.width, c.height);
      const pages = copies.slice(-6), ink = '#161616';
      const page = (n, x, y) => {
        g.save(); g.translate(x, y);
        if (n === 0) {                                          // the cover
          g.drawImage(pages[pages.length - 1].cv, 60, 150, pw - 120, (pw - 120) * 1.25 * 0.8);
          U.drawMixed(g, pw / 2, 90, '每日一枚 ZINE', 'phrase_latin', 'phrase_cjk', 52, ink, 6, 1, 'center');
          U.drawTracked(g, pw / 2, ph - 50, `NO.${String(st.no).padStart(3, '0')} · ${date.replace(/-/g, '.')} · ${copies.length} GENERATIONS`, U.font('caps', 18), ink, 4, 'center');
        } else if (n === 7) {                                   // the back
          U.drawMixed(g, pw / 2, ph / 2 - 20, `「${st.phrase}」`, 'phrase_latin', 'phrase_cjk', 60, ink, 6, 1, 'center');
          U.drawTracked(g, pw / 2, ph / 2 + 50, 'COPY OF A COPY OF A COPY', U.font('caps', 20), ink, 6, 'center');
          U.drawTracked(g, pw / 2, ph - 60, 'DAILY POST COPIER 141 · NOT FOR SALE', U.font('caps_med', 14), ink, 4, 'center');
        } else {
          const p = pages[(n - 1) % pages.length];
          g.drawImage(p.cv, 40, 60, pw - 80, (pw - 80) * 1.25);
          U.drawTracked(g, pw / 2, ph - 28, `— ${n} — GEN ${p.gen + 1}`, U.font('caps', 16), ink, 4, 'center');
        }
        g.restore();
      };
      // the classic one-sheet fold: the top row upside down
      const top = [5, 4, 3, 2], bottom = [6, 7, 0, 1];
      top.forEach((n, k) => { g.save(); g.translate((k + 1) * pw, ph); g.rotate(Math.PI); page(n, 0, 0); g.restore(); });
      bottom.forEach((n, k) => page(n, k * pw, ph));
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.setLineDash([10, 10]); g.lineWidth = 2;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(k * pw, 0); g.lineTo(k * pw, c.height); g.stroke(); }
      g.beginPath(); g.moveTo(0, ph); g.lineTo(c.width, ph); g.stroke(); g.setLineDash([]);
      // two staples on the spine
      g.fillStyle = '#9a9a9a'; for (const y of [ph * 1.3, ph * 1.7]) { g.fillRect(2 * pw - 4, y - 30, 8, 60); }
      U.grain(g, c.width, c.height, 0.2, 5);
      return c;
    }
    bZine.onclick = async () => {
      if (copies.length < 2) return status.flash('先复印两张以上');
      zineCv = makeZine(); Kit.put(zine, zineCv);
      const zw = Math.min(W - 30, (H - 180) * 2), zh = zw / 2;
      Object.assign(zine.style, { left: (W - zw) / 2 + 'px', top: (H - zh) / 2 - 10 + 'px', width: zw + 'px', height: zh + 'px' });
      veil.classList.add('on'); zine.classList.add('on'); Kit.thump(0.7);
      bSave.hidden = false;
      deps.album.add({ id: 'xerox:' + Date.now(), kind: 'xerox', date, image: await Kit.blobOf(zineCv) });
      status.set('装订好了 · 收进了集邮册 · 点空白处收起');
    };
    veil.addEventListener('click', () => { veil.classList.remove('on'); zine.classList.remove('on'); });
    zine.addEventListener('click', () => { veil.classList.remove('on'); zine.classList.remove('on'); });
    bSave.onclick = async () => { if (zineCv) await Kit.save([{ cv: zineCv, name: `xerox-zine-${date}.png` }]); };

    layout(); bZine.disabled = true;
    const ready = Kit.afterFrame().then(() => setSource(stOf(0)));   // once the stamp flying in is off
    return P.api({
      ready, anchor: () => orig.getBoundingClientRect(),
      async receive(s) { if (busy) return 300; copies = []; pile.replaceChildren(); bZine.disabled = true; await setSource(s); return 350; },
      source: () => (copies.length ? copies[copies.length - 1].cv : null),
    });
  }
  Pages.define('xerox', mount);
})();
