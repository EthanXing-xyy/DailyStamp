// 丝网印刷机: Warhol's Marilyn, by hand. Pick a photo (it never leaves the browser) or a library emblem; it is split
// into flat plates the way Warhol's were (a hand-painted colour block, the light and the mid tones, a hot accent, the
// black key). Drag the squeegee across the screen and the next square prints under it, each in another palette, each
// plate off register in its own way, the ink never quite even. Fill a 2 x 2 or 3 x 3 sheet, keep it as a picture.
(() => {
  function mount(root, deps) {
    const { el, clamp } = Kit;
    Kit.head(root, 9, 'SILKSCREEN', '丝网印刷机');
    const status = Kit.status(root);
    const bed = el('div', 'sk-bed'), frame = el('div', 'sk-frame'), stencil = el('canvas', 'sk-stencil'), blade = el('div', 'sk-blade', '<i></i>');
    const side = el('div', 'sk-side'), srcRow = el('div', 'sk-src'), note = el('p', 'sk-note', '照片只在你的浏览器里处理，不会上传');
    const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.setAttribute('capture', 'user'); file.hidden = true;
    const gridRow = el('div', 'sk-grid-row'), acts = el('div', 'sk-acts');
    const b2 = Kit.button(gridRow, '2 × 2'), b3 = Kit.button(gridRow, '3 × 3');
    const bPhoto = Kit.button(acts, '拍照 / 上传'), bSave = Kit.button(acts, '存为图片'), bAgain = Kit.button(acts, '再印一版');
    bPhoto.style.setProperty('--swash', '#23D5E8'); bSave.style.setProperty('--swash', '#ff6a00');
    side.append(gridRow, acts, srcRow, note, file);
    frame.append(stencil); bed.append(frame, blade);
    root.append(bed, side);

    let n = 2, cells = [], cur = 0, prog = 0, plates = null, srcName = '', W = 0, H = 0, S = 0, phone = false, prints = [];
    const dpr = () => Math.min(2, devicePixelRatio || 1);

    // ---- plates
    const N = 420;
    function smooth(mask, blur, thr, grain = 0) {
      const c = U.canvas(N, N), g = c.getContext('2d'), id = g.createImageData(N, N);
      for (let i = 0; i < N * N; i++) id.data[i * 4 + 3] = mask[i] ? 255 : 0;
      g.putImageData(id, 0, 0);
      const b = U.canvas(N, N), bg = b.getContext('2d'); bg.filter = `blur(${blur}px)`; bg.drawImage(c, 0, 0);
      const d = bg.getImageData(0, 0, N, N), o = g.createImageData(N, N);
      for (let i = 0; i < N * N; i++) { const a = d.data[i * 4 + 3] / 255 + (grain ? (Math.random() - 0.5) * grain : 0); o.data[i * 4 + 3] = a > thr ? 255 : 0; }
      g.putImageData(o, 0, 0); return c;
    }
    function fromImage(img) {
      const c = U.canvas(N, N), g = c.getContext('2d'), w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
      g.drawImage(img, (w - s) / 2, (h - s) / 2 * 0.6, s, s, 0, 0, N, N);        // square, a little high: faces sit in the top half
      const d = g.getImageData(0, 0, N, N).data, L = new Float32Array(N * N), acc = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) {
        const r = d[i * 4] / 255, gg = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        L[i] = 0.3 * r + 0.59 * gg + 0.11 * b;
        const sat = mx ? (mx - mn) / mx : 0; let hue = 0;
        if (mx !== mn) hue = mx === r ? ((gg - b) / (mx - mn) + 6) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
        hue *= 60; acc[i] = sat > 0.42 && (hue < 22 || hue > 335) && L[i] > 0.18 && L[i] < 0.8 ? 1 : 0;
      }
      const sorted = Float32Array.from(L).sort(), p = q => sorted[Math.floor(q * (sorted.length - 1))];
      const lo = p(0.26), hi = p(0.62);
      const key = new Uint8Array(N * N), mid = new Uint8Array(N * N), light = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) { key[i] = L[i] < lo ? 1 : 0; light[i] = L[i] > hi ? 1 : 0; mid[i] = !key[i] && !light[i] ? 1 : 0; }
      return { photo: true, key: smooth(key, 1.2, 0.5, 0.25), mid: smooth(mid, 6, 0.45), light: smooth(light, 6, 0.5), accent: smooth(acc, 3, 0.55) };
    }
    function fromEmblem(e) {
      const [key, accent, band] = Print.channelMasks(e);
      return { photo: false, key, mid: Print.silhouette(e, 0.05), light: band, accent };
    }

    // ---- one print: another palette, every plate off register its own way, uneven ink, now and then a starved streak
    function printOne(size, seed) {
      const rnd = Print.rng(seed), pal = deps.palettes[Math.floor(rnd() * deps.palettes.length)], c = Colors.roles(pal, Math.floor(rnd() * 4));
      const out = U.canvas(size, size), g = out.getContext('2d'), k = size / 300;
      const off = () => [(rnd() - 0.5) * 2 * (2 + rnd() * 6) * k, (rnd() - 0.5) * 2 * (2 + rnd() * 6) * k];
      g.fillStyle = c[0]; g.fillRect(0, 0, size, size);
      const inset = plates.photo ? 0 : size * 0.1, box = size - inset * 2;
      const plate = (m, col) => { const [dx, dy] = off(); g.drawImage(Print.tinted(m, col, box), inset + dx, inset + dy, box, box); };
      if (plates.photo) { plate(plates.light, c[1]); plate(plates.mid, c[2]); plate(plates.accent, c[3]); }
      else { plate(plates.mid, c[1]); plate(plates.light, c[2]); plate(plates.accent, c[3]); }
      // the key, sometimes starved of ink along a slanting streak
      const kk = Print.tinted(plates.key, pal.ink, box), [dx, dy] = off();
      if (rnd() < 0.35) {
        const kg = kk.getContext('2d'), a = rnd() * kk.width, grd = kg.createLinearGradient(a, 0, a + kk.width * 0.3, kk.height);
        grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, `rgba(0,0,0,${0.35 + rnd() * 0.3})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
        kg.globalCompositeOperation = 'destination-out'; kg.fillStyle = grd; kg.fillRect(0, 0, kk.width, kk.height);
      }
      g.drawImage(kk, inset + dx, inset + dy, box, box);
      // uneven ink: a few soft blotches, then paper grain
      for (let i = 0; i < 6; i++) {
        const x = rnd() * size, y = rnd() * size, r = size * (0.15 + rnd() * 0.3), gr = g.createRadialGradient(x, y, 0, x, y, r);
        const lt = rnd() < 0.5; gr.addColorStop(0, lt ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, size, size);
      }
      U.grain(g, size, size, 0.26, 3 + (seed % 5));
      return out;
    }

    // ---- the sheet on the bed, the screen frame over the square being printed, the squeegee
    function layout() {
      W = innerWidth; H = innerHeight; phone = W < H;
      const short = !phone && H < 560;                        // a phone on its side: same layout, less head room
      S = phone ? W - 32 : short ? Math.min(H - 116, W * 0.46) : Math.min(H - 220, W * 0.46);
      const bx = phone ? 16 : W * 0.42 - S / 2, by = phone ? 100 : short ? 72 : 108;
      Object.assign(bed.style, { left: bx + 'px', top: by + 'px', width: S + 'px', height: S + 'px' });
      side.style.cssText = phone ? `left:12px;right:12px;top:${by + S + 14}px` : `left:${bx + S + 44}px;width:${Math.min(360, W - bx - S - 70)}px;top:${by + 10}px`;
      status.el.style.cssText = phone ? `left:16px;right:16px;top:${H - 30}px` : `left:${bx}px;width:${S}px;top:${by + S + 16}px`;
      fitNote();
      buildCells();
    }
    // a short phone has no room for the privacy note above the status line: it gives way
    function fitNote() {
      note.style.display = '';
      if (phone && side.getBoundingClientRect().bottom > H - 38) note.style.display = 'none';
    }
    function cellRect(i) { const g = S * 0.035, cs = (S - g * (n + 1)) / n, r = Math.floor(i / n), c = i % n; return { x: g + c * (cs + g), y: g + r * (cs + g), s: cs }; }
    function buildCells() {
      bed.querySelectorAll('.sk-cell').forEach(x => x.remove());
      cells = [];
      for (let i = 0; i < n * n; i++) {
        const r = cellRect(i), cv = el('canvas', 'sk-cell');
        Object.assign(cv.style, { left: r.x + 'px', top: r.y + 'px', width: r.s + 'px', height: r.s + 'px' });
        bed.insertBefore(cv, frame);
        if (prints[i]) { Kit.put(cv, prints[i]); cv.style.clipPath = 'none'; } else cv.style.clipPath = 'inset(0 100% 0 0)';
        cells.push(cv);
      }
      placeFrame(false);
    }
    function placeFrame(anim = true) {
      if (cur >= n * n) { frame.classList.add('off'); blade.classList.add('off'); return; }
      frame.classList.remove('off'); blade.classList.remove('off');
      const r = cellRect(cur), pad = S * 0.018;
      const to = { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.s + pad * 2 + 'px', height: r.s + pad * 2 + 'px' };
      if (anim) frame.animate([{ left: frame.style.left, top: frame.style.top }, { left: to.left, top: to.top }], { duration: 500, easing: 'cubic-bezier(.3,0,.2,1)' });
      Object.assign(frame.style, to);
      Object.assign(stencil.style, { left: pad - 7 + 'px', top: pad - 7 + 'px', width: r.s + 'px', height: r.s + 'px' });
      frame.classList.toggle('pull', prog > 0);
      Object.assign(blade.style, { top: r.y - pad * 2 + 'px', height: r.s + pad * 4 + 'px', left: r.x + prog * r.s - 9 + 'px' });
    }
    // the picture on the screen, as the emulsion leaves it: it shows through the mesh until the ink goes through
    function drawStencil() {
      const s = 256, g = (stencil.width = stencil.height = s, stencil.getContext('2d'));
      g.clearRect(0, 0, s, s); if (!plates) return;
      const inset = plates.photo ? 0 : s * 0.1, box = s - inset * 2;
      g.globalAlpha = 0.45; g.drawImage(Print.tinted(plates.mid, '#6d5a3a', box), inset, inset, box, box);
      g.globalAlpha = 1; g.drawImage(Print.tinted(plates.key, '#2a2620', box), inset, inset, box, box);
    }
    function ready() {
      if (!plates || cur >= n * n || prints[cur]) return;
      const r = cellRect(cur), size = Math.round(r.s * dpr());
      prints[cur] = printOne(size, Kit.hash(srcName + cur + Date.now()));
      Kit.put(cells[cur], prints[cur]);
      cells[cur].style.clipPath = 'inset(0 100% 0 0)';
    }

    // ---- the pull
    let pulling = null, lastHiss = 0;
    const startPull = e => {
      if (!plates) return status.flash('先挑一张图');
      if (cur >= n * n) return status.flash('这一版印满了 · 存下来或者再印一版');
      pulling = { id: e.pointerId }; ready(); Kit.audio(); frame.classList.add('pull');
      bed.setPointerCapture(e.pointerId); movePull(e);
    };
    const movePull = e => {
      if (!pulling) return;
      const r = cellRect(cur), b = bed.getBoundingClientRect(), x = (e.clientX - b.left - r.x) / r.s;
      const p = clamp(x, prog, 1);
      if (p > prog) {
        prog = p;
        cells[cur].style.clipPath = `inset(0 ${((1 - prog) * 100).toFixed(2)}% 0 0)`;
        blade.style.left = r.x + prog * r.s - 9 + 'px';
        const now = performance.now(); if (now - lastHiss > 70) { Kit.rustle(0.035, 0.09); lastHiss = now; }
      }
      if (prog >= 0.999) finishCell();
    };
    const endPull = () => { pulling = null; };
    bed.addEventListener('pointerdown', startPull);
    bed.addEventListener('pointermove', movePull);
    bed.addEventListener('pointerup', endPull); bed.addEventListener('pointercancel', endPull);
    function finishCell() {
      pulling = null;
      cells[cur].style.clipPath = 'none';
      cells[cur].animate([{ filter: 'brightness(1.08) saturate(1.1)' }, { filter: 'none' }], { duration: 700 });
      cur++; prog = 0;
      if (cur >= n * n) {
        placeFrame(); bSave.disabled = false;
        status.set(`${n * n} 张印好了 · 每一张的套色都错得不一样`);
      } else { placeFrame(true); status.set(`第 ${cur + 1} / ${n * n} 张 · 推刮刀`); }
    }

    // ---- choosing what to print
    function reset() { prints = []; cur = 0; prog = 0; bSave.disabled = true; drawStencil(); buildCells(); }
    function useEmblem(e, b) {
      plates = fromEmblem(e); srcName = e.phrase;
      srcRow.querySelectorAll('.sk-pick').forEach(x => x.classList.toggle('on', x === b));
      reset(); status.set(`「${e.phrase}」上了网版 · 从左往右推刮刀`);
    }
    // the buttons go up at once; their pictures are drawn a few at a time, so opening the page never stalls a flight
    function fillSources() {
      srcRow.innerHTML = '';
      // a word cut ahead of time comes with its picture ready (emblems/cut/<id>.t.png): 64 words' four 1024 px plates
      // decoded just for 46 px buttons would be the memory iOS kills the tab over
      const btns = deps.words.map((e, i) => {
        const b = el('button', 'sk-pick'), cv = el(e.thumb ? 'img' : 'canvas'); b.type = 'button'; b.title = e.phrase; b.append(cv); srcRow.append(b);
        if (e.thumb) { cv.alt = ''; cv.decoding = 'async'; cv.src = e.thumb; }
        b.onclick = () => useEmblem(e, b);
        return b;
      });
      if (btns.length && !plates) useEmblem(deps.words[0], btns[0]);
      fitNote();
      (async () => {
        await Kit.wait(900);
        for (const [i, e] of deps.words.entries()) {
          if (e.thumb) continue;
          const cv = btns[i].querySelector('canvas'), s = 96, g = (cv.width = cv.height = s, cv.getContext('2d')), [key, acc, band] = Print.channelMasks(e);
          g.drawImage(Print.tinted(Print.silhouette(e, 0.05), '#F4EEDF', s), 0, 0, s, s);
          g.drawImage(Print.tinted(band, '#23D5E8', s), 0, 0, s, s); g.drawImage(Print.tinted(acc, '#FF2E88', s), 0, 0, s, s); g.drawImage(Print.tinted(key, '#111', s), 0, 0, s, s);
          cv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease' });
          if (i % 3 === 2) await Kit.wait(16);
        }
      })();
    }
    bPhoto.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0]; if (!f) return;
      const img = await Kit.imageOf(f);
      if (!img) return status.flash('这张图读不出来');
      plates = fromImage(img); srcName = 'photo';
      srcRow.querySelectorAll('.sk-pick').forEach(x => x.classList.remove('on'));
      reset(); status.set('照片上了网版 · 从左往右推刮刀'); file.value = '';
    };
    b2.onclick = () => { n = 2; b2.classList.add('on'); b3.classList.remove('on'); reset(); };
    b3.onclick = () => { n = 3; b3.classList.add('on'); b2.classList.remove('on'); reset(); };
    b2.classList.add('on');
    bAgain.onclick = () => { reset(); status.set('新的一版 · 推刮刀'); };
    bSave.onclick = async () => {
      if (cur < n * n) return;
      const cs = 700, gap = 36, M = 90, sz = n * cs + (n - 1) * gap + 2 * M, out = Stamp.paper(sz, sz, 1.2, 55), g = out.getContext('2d');
      prints.forEach((p, i) => { const r = Math.floor(i / n), c = i % n, j = Print.rng(i + 9); g.drawImage(p, M + c * (cs + gap) + (j() - 0.5) * 10, M + r * (cs + gap) + (j() - 0.5) * 10, cs, cs); });
      U.grain(g, sz, sz, 0.14, 4);
      const how = await Kit.save([{ cv: out, name: `silkscreen-${deps.date}-${srcName}.png` }]);
      if (how !== 'cancelled') { deps.album.add({ id: 'silk:' + Date.now(), kind: 'silk', date: deps.date, image: await Kit.blobOf(out) }); status.set('存好了 · 也收进了集邮册'); }
    };

    layout(); fillSources();
    addEventListener('resize', () => { if (Kit.visible(root)) layout(); });
    bSave.disabled = true;
    // the square under the screen is where a stamp from the home lands; its emblem goes onto the screen
    const anchor = () => { const b = bed.getBoundingClientRect(), r = cellRect(Math.min(cur, n * n - 1)); return new DOMRect(b.left + r.x, b.top + r.y, r.s, r.s); };
    function receive(st) {
      const i = deps.words.findIndex(e => e.phrase === st.phrase);
      if (i >= 0) useEmblem(deps.words[i], srcRow.querySelectorAll('.sk-pick')[i]);
      return 480;                                           // the stamp melts into its stencil on the screen
    }
    return { ready: Promise.resolve(), anchor, source: () => null, receive };
  }
  Pages.define('silkscreen', mount);
})();
