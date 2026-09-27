// 放大镜鉴定: a stamp on black felt and a collector's loupe. At a glance it is just the stamp; under the glass there is
// more: a line of microprint running round the margin, the ink's own grain, and now and then a variety (a hairline,
// a speck of stray ink, an unprinted spot, a doubled impression) worth a tap to note. Send it off to be graded: it is
// sealed in a clear slab with a label, a grade out of ten worked out from its centring, its teeth and its printing.
(() => {
  const TAU = Math.PI * 2, BW = 1200, BH = 1500, ZOOM = 3.2;
  const WORDS = { 10: 'GEM MINT', 9: 'MINT', 8: 'NM-MT', 7: 'NEAR MINT', 6: 'EX-MT', 5: 'EXCELLENT', 4: 'VG-EX', 3: 'VERY GOOD', 2: 'GOOD', 1: 'POOR' };
  const KINDS = { hair: '发丝线', fleck: '飞墨', void: '漏印', double: '重影' };

  /** what this stamp hides and how it was cut, all from its seed: 0-2 varieties, a missing tooth now and then, how far
   *  off centre the perforations ran, how far the plates slipped */
  function survey(st) {
    const rnd = Print.rng(Kit.hash('loupe|' + st.seed + '|' + st.phrase));
    const n = rnd() < 0.25 ? 0 : rnd() < 0.7 ? 1 : 2, kinds = Object.keys(KINDS), vars = [];
    for (let i = 0; i < n; i++) vars.push({ kind: kinds[Math.floor(rnd() * kinds.length)], x: 200 + rnd() * 800, y: 240 + rnd() * 1000, a: rnd() * TAU, found: false });
    const cx = Math.round((rnd() - 0.5) * 2 * (rnd() < 0.5 ? 6 : 16)), cy = Math.round((rnd() - 0.5) * 2 * (rnd() < 0.5 ? 6 : 16));
    const tooth = rnd() < 0.3 ? { side: Math.floor(rnd() * 4), t: 0.15 + rnd() * 0.7 } : null;
    const slip = +(0.5 + rnd() * 3.5).toFixed(1);
    return { vars, cx, cy, tooth, slip };
  }
  function grade(sv) {
    const centre = Math.max(Math.abs(sv.cx), Math.abs(sv.cy));         // print shift, in stamp units (of 52 margin)
    let g = 10 - (centre > 12 ? 2 : centre > 6 ? 1 : 0) - (sv.tooth ? 2 : 0) - (sv.slip > 3 ? 1 : 0) - (sv.slip > 2 && centre > 6 ? 1 : 0);
    return Math.max(1, Math.min(10, g));
  }
  const pct = v => `${Math.round(50 + v / 52 * 50)}/${Math.round(50 - v / 52 * 50)}`;

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'loupe', () => layout());
    const status = P.status;
    const felt = el('div', 'lp-felt'), view = el('canvas', 'lp-stamp'), marks = el('div', 'lp-marks');
    const lens = el('div', 'lp-lens'), lensCv = el('canvas'), handle = el('i', 'lp-handle');
    const side = el('div', 'lp-side'), sheet = el('div', 'lp-sheet'), acts = el('div', 'lp-acts');
    const slab = el('canvas', 'lp-slab');
    lens.append(handle, lensCv);
    felt.append(view, marks, slab); side.append(sheet, acts); root.append(felt, side, lens);
    const bNext = Kit.button(acts, '换一枚'), bGrade = Kit.button(acts, '送评'), bSave = Kit.button(acts, '存为图片');
    bGrade.style.setProperty('--swash', '#ffb000'); bSave.style.setProperty('--swash', '#23D5E8'); bSave.hidden = true;

    let i = 0, st = null, sv = null, hi = null, graded = null;
    const stOf = k => Kit.stampFor(`loupe|${date}|${k}`, deps.words, deps.palettes, k + 1, date);

    // ---- layout: the felt and the stamp on it, the notes beside (below on a phone)
    let W = 0, H = 0, phone = false, dw = 0, dh = 0, fx = 0, fy = 0, L = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      dh = phone ? Math.min(H * 0.5, (W - 70) * 1.25) : Math.min(H - 230, W * 0.34 * 1.25); dw = dh * 0.8;
      const fw = dw * 1.22, fh = dh * 1.16;
      fx = phone ? W / 2 : W * 0.4; fy = phone ? 100 + fh / 2 : Math.max(110 + fh / 2, H * 0.52);
      Object.assign(felt.style, { left: fx - fw / 2 + 'px', top: fy - fh / 2 + 'px', width: fw + 'px', height: fh + 'px' });
      for (const x of [view, marks, slab]) Object.assign(x.style, { left: (fw - dw) / 2 + 'px', top: (fh - dh) / 2 + 'px', width: dw + 'px', height: dh + 'px' });
      Object.assign(slab.style, { left: (fw - dh * 0.66) / 2 + 'px', top: (fh - dh * 1.0) / 2 + 'px', width: dh * 0.66 + 'px', height: dh * 1.0 + 'px' });
      L = phone ? 150 : Math.min(220, dh * 0.42);
      Object.assign(lens.style, { width: L + 'px', height: L + 'px' });
      side.style.cssText = phone ? `left:16px;right:16px;top:${fy + fh / 2 + 12}px` : `left:${fx + fw / 2 + 40}px;width:${Math.min(320, W - fx - fw / 2 - 70)}px;top:${fy - fh / 2 + 10}px`;
      status.el.style.cssText = phone ? `left:16px;right:16px;top:${H - 30}px` : `left:${fx - fw / 2}px;width:${fw}px;top:${fy + fh / 2 + 14}px`;
      if (hi) drawView();
    }

    // ---- the stamp, high enough to be looked at through the glass (drawn when the page comes on, let go when it goes)
    function paintHi() {
      hi = deps.makeFront(st, 1, { hires: true });
      const g = hi.getContext('2d'), rnd = Print.rng(Kit.hash(st.seed + 'hi'));
      const pal = deps.palettes.find(p => p.name === st.palette) || deps.palettes[0];
      // off centre: the print slid on its paper (perforations stay; the printed field moves)
      if (sv.cx || sv.cy) {
        const c = U.canvas(BW, BH), cg = c.getContext('2d'); cg.drawImage(hi, 0, 0);
        const F = { x0: 52, y0: 52, x1: 1148, y1: 1448 };
        g.save(); g.beginPath(); g.rect(F.x0 - 30, F.y0 - 30, F.x1 - F.x0 + 60, F.y1 - F.y0 + 60); g.clip();
        g.fillStyle = Stamp.PAPER; g.fillRect(F.x0 - 30, F.y0 - 30, F.x1 - F.x0 + 60, F.y1 - F.y0 + 60);
        g.drawImage(c, F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0, F.x0 + sv.cx, F.y0 + sv.cy, F.x1 - F.x0, F.y1 - F.y0); g.restore();
      }
      // microprint in the margin, all the way round: a grey line at arm's length, words under the glass
      const txt = `每日邮政 DAILY POST No.${String(st.no).padStart(3, '0')} ${st.date.replace(/-/g, '.')} · `.repeat(12);
      g.save(); g.fillStyle = 'rgba(60,52,44,.72)'; g.font = U.font('cjk_small_med', 9); g.textBaseline = 'middle';
      const run = (x, y, rot, len) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.rect(0, -8, len, 16); g.clip(); g.fillText(txt, 0, 0); g.restore(); };
      run(60, 36, 0, BW - 120); run(BW - 36, 60, Math.PI / 2, BH - 120); run(BW - 60, BH - 36, Math.PI, BW - 120); run(36, BH - 60, -Math.PI / 2, BH - 120);
      g.restore();
      // the varieties
      for (const v of sv.vars) {
        g.save(); g.translate(v.x, v.y); g.rotate(v.a);
        if (v.kind === 'hair') { g.strokeStyle = pal.ink; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-40, 0); g.bezierCurveTo(-12, -14, 14, 12, 42, -3); g.stroke(); }
        else if (v.kind === 'fleck') { g.fillStyle = pal.c[1]; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc((rnd() - 0.5) * 30, (rnd() - 0.5) * 30, 1.5 + rnd() * 3.5, 0, TAU); g.fill(); } }
        else if (v.kind === 'void') { g.fillStyle = Stamp.PAPER; g.beginPath(); g.ellipse(0, 0, 9, 6, 0, 0, TAU); g.fill(); }
        else { g.globalAlpha = 0.4; g.globalCompositeOperation = 'multiply'; g.drawImage(hi, v.x - 50, v.y - 50, 100, 100, -46, -46, 100, 100); }
        g.restore();
      }
      // a torn tooth: a bite out of the perforated edge
      if (sv.tooth) {
        const { side: sd, t } = sv.tooth, x = sd === 1 ? BW : sd === 3 ? 0 : t * BW, y = sd === 2 ? BH : sd === 0 ? 0 : t * BH;
        g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(x, y, 30, 30, 0, 0, TAU); g.fill(); g.restore();
      }
    }
    function drawView() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      view.width = Math.round(dw * dpr); view.height = Math.round(dh * dpr);
      const g = view.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(hi, 0, 0, view.width, view.height);
    }
    function load(next) {
      if (next !== st) { st = next; sv = survey(st); graded = null; }
      paintHi(); drawView(); drawMarks();
      slab.classList.remove('on'); view.classList.remove('off'); bSave.hidden = true; bGrade.hidden = false; bGrade.disabled = false; bNext.disabled = false;
      notes();
      status.set('拿放大镜看看 · 看到不对劲的地方点一下');
    }
    function drawMarks() {
      marks.replaceChildren(...sv.vars.filter(v => v.found).map(v => {
        const m = el('i', 'lp-found'); Object.assign(m.style, { left: v.x / BW * 100 + '%', top: v.y / BH * 100 + '%' }); return m;
      }));
    }
    function notes() {
      const found = sv.vars.filter(v => v.found);
      sheet.innerHTML = `<b>「${st.phrase}」</b><span>No.${String(st.no).padStart(3, '0')} · ${st.date.replace(/-/g, '.')}</span>` +
        `<p>变体 · ${found.length ? found.map(v => KINDS[v.kind]).join('、') : '还没发现'}</p>` +
        (graded ? `<p>居中 ${pct(sv.cx)} · ${pct(sv.cy)}</p><p>齿孔 ${sv.tooth ? '缺一齿' : '完整'} · 套色偏 ${sv.slip}</p>` : '<p>居中、齿孔、套色 · 送评后揭晓</p>');
    }

    // ---- the loupe: what is under the pointer, 3.2 times as big; on a touch screen it floats above the finger
    let over = null;
    function lensAt(px, py, touch) {
      const r = view.getBoundingClientRect();
      const u = (px - r.left) / r.width, v = (py - r.top) / r.height;
      if (u < -0.08 || u > 1.08 || v < -0.08 || v > 1.08 || !hi || graded) { lens.classList.remove('on'); over = null; return; }
      over = { x: u * BW, y: v * BH };
      const cx = px, cy = touch ? py - L * 0.75 : py;
      Object.assign(lens.style, { left: cx - L / 2 + 'px', top: cy - L / 2 + 'px' });
      lens.classList.add('on');
      const dpr = Math.min(2, devicePixelRatio || 1), s = Math.round(L * dpr);
      if (lensCv.width !== s) lensCv.width = lensCv.height = s;
      const g = lensCv.getContext('2d'), span = L / ZOOM * (BW / r.width);
      g.fillStyle = '#141313'; g.fillRect(0, 0, s, s);
      g.imageSmoothingQuality = 'high';
      g.drawImage(hi, over.x - span / 2, over.y - span / 2, span, span, 0, 0, s, s);
    }
    felt.addEventListener('pointermove', e => lensAt(e.clientX, e.clientY, e.pointerType !== 'mouse'));
    felt.addEventListener('pointerdown', e => { try { felt.setPointerCapture(e.pointerId); } catch {} lensAt(e.clientX, e.clientY, e.pointerType !== 'mouse'); felt.dataset.t = e.timeStamp; });
    felt.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') lens.classList.remove('on'); });
    felt.addEventListener('pointerup', e => {
      if (e.pointerType !== 'mouse') lens.classList.remove('on');
      if (!over || graded) return;
      const v = sv.vars.find(q => !q.found && Math.hypot(q.x - over.x, q.y - over.y) < 60);
      if (v) { v.found = true; Kit.thump(0.2); drawMarks(); notes(); status.flash(`发现变体 · ${KINDS[v.kind]}`); }
      else if (e.pointerType === 'mouse' || e.timeStamp - (+felt.dataset.t || 0) < 300) status.flash('这里看着没问题');
    });

    // ---- grading: into the slab, a label printed with the grade
    function makeSlab() {
      const w = 900, h = 1360, c = U.canvas(w, h), g = c.getContext('2d'), gr = grade(sv);
      const pal = deps.palettes.find(p => p.name === st.palette) || deps.palettes[0];
      const round = (x, y, ww, hh, r) => { g.beginPath(); g.roundRect(x, y, ww, hh, r); };
      // the clear case: a thick bevelled edge, the well the stamp sits in
      round(10, 10, w - 20, h - 20, 46); g.fillStyle = 'rgba(236,240,244,.55)'; g.fill();
      g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
      round(34, 34, w - 68, h - 68, 30); g.lineWidth = 3; g.strokeStyle = 'rgba(120,130,140,.35)'; g.stroke();
      // the label: paper with a pinked lower edge, the grade in a comic burst
      const ly = 64, lh = 290;
      g.save(); g.beginPath(); g.moveTo(64, ly); g.lineTo(w - 64, ly); g.lineTo(w - 64, ly + lh);
      for (let x = w - 64; x > 64; x -= 24) { g.lineTo(x - 12, ly + lh + 12); g.lineTo(x - 24, ly + lh); }
      g.closePath(); g.fillStyle = '#F6F1E4'; g.fill(); g.restore();
      U.drawMixed(g, 100, ly + 50, '每日邮政鉴定', 'caps', 'cjk_small', 30, pal.ink, 6, 1, 'left');
      U.drawTracked(g, 100, ly + 84, 'DAILY POST GRADING', U.font('caps_med', 18), pal.ink, 5, 'left');
      U.drawMixed(g, 100, ly + 148, st.phrase, 'caps', 'phrase_cjk', 56, '#1d1d1f', 4, 1, 'left');
      U.drawTracked(g, 100, ly + 204, `${st.date.slice(0, 4)} 每日一枚 · No.${String(st.no).padStart(3, '0')}`.toUpperCase(), U.font('caps_med', 20), '#1d1d1f', 3, 'left');
      const found = sv.vars.filter(v => v.found);
      if (found.length) U.drawMixed(g, 100, ly + 244, `VARIETY · ${found.map(v => KINDS[v.kind]).join(' ')}`, 'caps', 'cjk_small', 22, '#B0172F', 3, 1, 'left');
      U.drawTracked(g, 100, ly + 276, `CERT ${String(Kit.hash(st.seed + st.phrase) % 90000000 + 10000000)}`, U.font('caps_med', 16), 'rgba(29,29,31,.6)', 4, 'left');
      const bx = w - 190, by2 = ly + 140, rnd = Print.rng(gr + 7);
      g.fillStyle = pal.c.find(x => U.contrast(x, '#1d1d1f') > 4) || pal.c[2];
      Pattern.poly(g, Pattern.burstPts(bx, by2, 88, 124, 14, rnd)); g.fill();
      g.lineWidth = 5; g.strokeStyle = pal.ink; g.stroke();
      U.drawCentered(g, bx, by2 - 8, String(gr), U.font('caps', 104), pal.ink);
      U.drawTracked(g, bx, by2 + 62, WORDS[gr], U.font('caps', 20), pal.ink, 3, 'center');
      // the stamp in its well, and a sheen across the plastic
      const sw = 620, sh = sw * BH / BW, sx = (w - sw) / 2, sy = ly + lh + 60;
      g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 16; g.shadowOffsetY = 6; g.drawImage(hi, sx, sy, sw, sh); g.restore();
      const sheen = g.createLinearGradient(0, 0, w, h);
      sheen.addColorStop(0.3, 'rgba(255,255,255,0)'); sheen.addColorStop(0.42, 'rgba(255,255,255,.28)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      round(10, 10, w - 20, h - 20, 46); g.fillStyle = sheen; g.fill();
      return { c, gr };
    }
    bGrade.onclick = async () => {
      if (graded) return;
      bGrade.disabled = true; bNext.disabled = true; lens.classList.remove('on');
      const { c, gr } = makeSlab(); graded = { c, gr };
      Kit.put(slab, c); notes();
      Kit.rustle(0.04, 0.3);
      view.classList.add('off'); slab.classList.add('on');
      await Kit.wait(700); Kit.thump(0.6);
      status.set(`${gr} 分 · ${WORDS[gr]} · 已收进集邮册`);
      deps.album.add({ id: `grade:${date}:${Date.now()}`, kind: 'grade', date, image: await Kit.blobOf(c) });
      bSave.hidden = false; bGrade.hidden = true; bNext.disabled = false;
    };
    bSave.onclick = async () => { if (graded) await Kit.save([{ cv: graded.c, name: `graded-${date}-${st.phrase}.png` }]); };
    bNext.onclick = async () => {
      bNext.disabled = true;
      await felt.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' }).finished;
      i++; await deps.loadLeaflet(stOf(i).phrase); load(stOf(i));
      felt.getAnimations().forEach(a => a.cancel()); felt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease' });
    };

    layout();
    let first = stOf(0);
    const ready = deps.loadLeaflet(first.phrase);
    return P.api({
      ready,
      // the big stamp is drawn only while the page is on show (a 1200 x 1500 canvas is ~7 MB a phone keeps otherwise)
      enter() { if (!hi) load(st || first); },
      leave() { if (hi) { hi.width = hi.height = 0; hi = null; } },
      anchor: () => view.getBoundingClientRect(),
      async receive(s) { if (graded || s.seed === (st && st.seed)) return 300; await deps.loadLeaflet(s.phrase); first = s; load(s); return 350; },
      source: () => (graded ? view : null),
    });
  }
  Pages.define('loupe', mount);
})();
