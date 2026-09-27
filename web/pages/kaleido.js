// 万花筒: the day's stamp dropped into the object end of a kaleidoscope. Drag round the eyepiece to turn the tube (drag
// in and out to slide the stamp under the mirrors); a phone can be tilted instead. The mirrors repeat one wedge of the
// stamp six or eight times, every other one flipped. 定格 prints what you see as a stamp of its own, the word and the
// postmark over it, the word's leaflet on the back.
(() => {
  const TAU = Math.PI * 2;

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'kaleido', () => layout());
    const status = P.status;
    const tube = el('div', 'kd-tube'), eye = el('canvas', 'kd-eye'), glint = el('i', 'kd-glint'), acts = el('div', 'kd-acts'), veil = el('div', 'kd-veil');
    tube.innerHTML = '<span class="kd-label"><b>每日邮政 · 万花筒</b><i>KALEIDOSCOPE</i></span>';
    tube.append(eye, glint); root.append(tube, acts, veil);
    const btn = (label, swash) => { const b = Kit.button(acts, label); b.style.setProperty('--swash', swash); return b; };
    const bFold = btn('八面镜', '#23D5E8'), bNext = btn('换一枚', '#ff5fa2'), bTilt = btn('倾斜手机', '#B6F03C'), bShot = btn('定格', '#ff6a00'), bSave = btn('存为图片', '#ffb000');
    bSave.hidden = true;
    bTilt.hidden = !('DeviceOrientationEvent' in window) || !matchMedia('(pointer: coarse)').matches;
    const plans = deps.homePlans || [];
    let st = plans[Home.FEATURES.findIndex(f => f.key === 'kaleido')] || Kit.stampFor('kaleido', deps.words, deps.palettes, 1, date), n = 0;
    const pal0 = Assets.palByName(st.palette);
    tube.style.setProperty('--body', pal0.c[0]); tube.style.setProperty('--rim', pal0.ink);

    let W = 0, H = 0, phone = false, D = 0, cx = 0, cy = 0;
    const dpr = () => Math.min(2, devicePixelRatio || 1);
    function layout() {
      ({ W, H, phone } = P.measure());
      D = phone ? Math.min(W - 70, H - 280) : Math.min(H - 270, 520);
      cx = W / 2; cy = (phone ? 104 : 110) + D / 2 + 16;
      Object.assign(tube.style, { left: cx - D / 2 - 18 + 'px', top: cy - D / 2 - 18 + 'px', width: D + 36 + 'px', height: D + 36 + 'px' });
      acts.style.cssText = `left:12px;right:12px;top:${cy + D / 2 + 34}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${phone ? H - 30 : cy + D / 2 + 82}px`;
      if (card) card.place(cx, cy, D * 0.8 * 0.95, D * 0.95);
      if (src) { size(); draw(); }
    }

    // ---- the picture: a wedge of the stamp, mirrored round
    let src = null, seg = 6, rot = 0.3, slide = 0.28, spin = 0, wedge = null;
    function load(s) {
      st = s; if (src) src.width = src.height = 0;
      src = deps.makeFront(st, 0.5);                       // 600 x 750
      size(); draw();
    }
    function size() {
      const N = Math.round(clamp(D * dpr(), 200, 1024));
      if (eye.width !== N) { eye.width = eye.height = N; }
      const R = Math.ceil(N / 2) + 2;
      if (!wedge || wedge.width !== R) { if (wedge) wedge.width = 0; wedge = U.canvas(R, R); }
    }
    function paintInto(g, N) {
      const R = N / 2, a = TAU / (seg * 2), w = wedge.getContext('2d'), WR = wedge.width;
      // one wedge: the stamp under the mirrors, turned with the tube and slid along it
      w.setTransform(1, 0, 0, 1, 0, 0); w.clearRect(0, 0, WR, WR);
      w.save(); w.beginPath(); w.moveTo(0, 0); w.arc(0, 0, WR, -0.002, a + 0.004); w.closePath(); w.clip();
      const k = WR * 2.1 / src.width;
      w.translate(WR * (0.2 + slide), WR * 0.25); w.rotate(rot);
      w.drawImage(src, -src.width * k / 2, -src.height * k / 2, src.width * k, src.height * k);
      w.restore();
      g.save(); g.translate(R, R);
      for (let i = 0; i < seg; i++) {                      // each wedge, and its mirror image across the mirror's edge
        g.save(); g.rotate(i * 2 * a); g.drawImage(wedge, 0, 0); g.scale(1, -1); g.drawImage(wedge, 0, 0); g.restore();
      }
      g.restore();
    }
    function draw() {
      if (!src) return;
      const N = eye.width, g = eye.getContext('2d');
      g.clearRect(0, 0, N, N);
      g.save(); g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, TAU); g.clip();
      g.fillStyle = '#111'; g.fillRect(0, 0, N, N);
      paintInto(g, N);
      // the eyepiece darkens toward its rim
      const v = g.createRadialGradient(N / 2, N / 2, N * 0.3, N / 2, N / 2, N / 2);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)');
      g.fillStyle = v; g.fillRect(0, 0, N, N);
      g.restore();
    }

    // ---- turning: drag round the middle turns the tube, in and out slides the stamp; it coasts a little after
    let drag = null, raf = 0;
    const polar = e => { const r = eye.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; return { a: Math.atan2(y, x), d: Math.hypot(x, y) / (r.width / 2) }; };
    eye.addEventListener('pointerdown', e => { if (!src) return; eye.setPointerCapture(e.pointerId); Kit.audio(); drag = { ...polar(e), t: performance.now() }; spin = 0; });
    eye.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = polar(e); let da = p.a - drag.a; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
      const now = performance.now(), dt = Math.max(8, now - drag.t);
      rot += da * 0.9; slide = clamp(slide + (p.d - drag.d) * 0.35, 0, 0.6);
      spin = da * 0.9 / dt * 16;
      drag = { ...p, t: now };
      if (Math.random() < 0.2) Kit.rustle(0.012, 0.05);
      queue();
    });
    const up = () => { if (!drag) return; drag = null; coast(); };
    eye.addEventListener('pointerup', up); eye.addEventListener('pointercancel', up);
    const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
    function coast() {
      if (Math.abs(spin) < 0.001 || drag) return;
      rot += spin; spin *= 0.94; draw(); requestAnimationFrame(coast);
    }
    // tilting a phone slides and turns it
    let tilting = false;
    const onTilt = e => { if (drag || e.gamma == null) return; rot = (e.gamma || 0) / 30; slide = clamp(((e.beta || 45) - 20) / 90, 0, 0.6); queue(); };
    bTilt.onclick = async () => {
      if (tilting) { removeEventListener('deviceorientation', onTilt); tilting = false; bTilt.textContent = '倾斜手机'; return; }
      try { if (typeof DeviceOrientationEvent.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return status.flash('没有拿到倾斜权限 · 用手指转也行'); }
      catch (e) { return status.flash('没有拿到倾斜权限 · 用手指转也行'); }
      addEventListener('deviceorientation', onTilt); tilting = true; bTilt.textContent = '停止倾斜';
    };
    bFold.onclick = () => { seg = seg === 6 ? 8 : 6; bFold.textContent = seg === 6 ? '八面镜' : '六面镜'; Kit.rustle(0.03, 0.1); draw(); };
    bNext.onclick = () => {
      n++; load(Kit.visitStamps(deps, 'kaleido|' + n, 1)[0]);
      eye.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 500, easing: 'ease' });
      status.set(`装进了「${st.phrase}」· 拖动转一转`);
    };

    // ---- 定格: what is in the eyepiece, printed as a stamp
    let card = null, out = null;
    bShot.onclick = () => {
      if (!src) return;
      if (card) dropCard();
      const pal = Assets.palByName(st.palette), N = 900;
      const pic = U.canvas(N, N), pg = pic.getContext('2d');
      const keepW = wedge; wedge = U.canvas(N / 2 + 2, N / 2 + 2);
      pg.fillStyle = '#111'; pg.fillRect(0, 0, N, N); paintInto(pg, N);
      wedge.width = 0; wedge = keepW;
      out = Kit.issue({ sc: 0.6, pal, phrase: st.phrase, en: st.en, date, no: st.no || 1, kicker: 'KALEIDOSCOPE · 万花筒', seed: Kit.hash(date + rot.toFixed(3)) % 1000, labelFill: pal.c[2],
        art: (g, w, h) => {
          g.fillStyle = pal.c[0]; g.fillRect(0, 0, w, h);
          const s = Math.max(w, h) * 1.02;
          g.drawImage(pic, (w - s) / 2, (h - s) / 2, s, s);
        } });
      pic.width = pic.height = 0;
      card = Kit.card(root, deps, { cls: 'kd-card' }); card.place(cx, cy, D * 0.8 * 0.95, D * 0.95); card.turn(1, true);
      card.show(out, deps.makeBack(st, card.scale(), null));
      veil.classList.add('on');
      card.box.animate([{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'ease' });
      Kit.thump(0.6);
      Kit.blobOf(out).then(image => deps.album.add({ id: `kaleido:${Date.now()}`, kind: 'kaleido', date, image }));
      bSave.hidden = false;
      status.set('定格了 · 收进了集邮册 · 点它翻面 · 点空白处接着转');
    };
    function dropCard() {
      const c = card; card = null; veil.classList.remove('on'); bSave.hidden = true;
      if (c) c.box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => c.box.remove());
    }
    veil.addEventListener('click', dropCard);
    bSave.onclick = async () => { if (out) await Kit.save([{ cv: out, name: `kaleidoscope-${date}.png` }]); };

    layout();
    status.set('拖动镜筒转一转 · 往里往外拖换个花样');
    return P.api({
      ready: Promise.resolve(),
      // the eyepiece is only drawn while the page is on show
      enter() { if (!src) load(st); },
      leave() {
        if (tilting) bTilt.onclick();
        if (card) dropCard();
        if (src) { src.width = src.height = 0; src = null; }
        if (wedge) { wedge.width = wedge.height = 0; wedge = null; }
        eye.width = eye.height = 1;
      },
      anchor: () => new DOMRect(cx - D * 0.36, cy - D * 0.45, D * 0.72, D * 0.9),
      receive(s) { load(s); return undefined; },
      source: () => (card ? out : null),
    });
  }
  Pages.define('kaleido', mount);
})();
