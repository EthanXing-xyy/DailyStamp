// 拼贴机: Hamilton's collage machine. Tap a stamp in the tray and a ragged scrap tears off it (white paper core on the
// torn edge, a few fibres, never a straight cut) and lands on the blank stamp. Drag scraps about, turn them (two
// fingers, the round handle, or shift + wheel), tap to bring one to the top, drag it off the stamp to throw it away.
// 乱拼 tears a handful at random for you to rework; 完成 trims them to the stamp, cancels it and issues it.
(() => {
  function mount(root, deps) {
    const { el, clamp, TAU } = Kit;
    Kit.head(root, 10, 'COLLAGE', '拼贴机');
    const status = Kit.status(root);
    const tray = el('div', 'cl-tray'), work = el('div', 'cl-work'), base = el('canvas', 'cl-base'), handle = el('div', 'cl-handle');
    const acts = el('div', 'cl-acts');
    const bMess = Kit.button(acts, '乱拼'), bClear = Kit.button(acts, '清空'), bDone = Kit.button(acts, '完成');
    bMess.style.setProperty('--swash', '#FFD400'); bDone.style.setProperty('--swash', '#ff6a00');
    work.append(base, handle);
    root.append(tray, work, acts);

    let W = 0, H = 0, phone = false, bw = 0, bh = 0, bx = 0, by = 0;
    const dpr = () => Math.min(2, devicePixelRatio || 1);
    function layout() {
      W = innerWidth; H = innerHeight; phone = W < H;
      bh = phone ? Math.min(H * 0.5, (W - 60) * 1.25) : Math.min(H - 250, W * 0.36 * 1.25); bw = bh * 0.8;
      bx = phone ? W / 2 - bw / 2 : W * 0.5 - bw / 2; by = phone ? 104 : 108;
      Object.assign(base.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
      const bs = Stamp.blank(clamp(bh * dpr() / Stamp.BH, 0.3, 0.8), 12); Kit.put(base, bs);
      tray.style.cssText = phone ? `left:10px;right:10px;top:${by + bh + 64}px;height:92px` : `left:${Math.max(20, W * 0.06)}px;width:${Math.min(200, bx - W * 0.06 - 40)}px;top:${by}px;height:${bh}px`;
      acts.style.cssText = `left:0;right:0;top:${by + bh + 16}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${phone ? H - 30 : by + bh + 60}px`;
      k = bw / (Stamp.BW * 0.36);
      for (const f of frags) { Object.assign(f.el.style, { width: f.w * k + 'px', height: f.h * k + 'px' }); apply(f); }
    }

    // ---- the sources: today's stamps and the album's, drawn once at a size scraps can come from
    const sources = [];
    async function fillTray() {
      const seen = new Set(), list = [];
      for (const s of (deps.homePlans || []).slice(0, 6)) { const k = s.phrase + s.seed; if (!seen.has(k)) { seen.add(k); list.push(s); } }
      const al = (await deps.album.all()).filter(e => e.st && !e.marks).sort((a, b) => b.added - a.added);
      for (const e of al) { if (list.length >= 9) break; const k = e.st.phrase + e.st.seed; if (!seen.has(k)) { seen.add(k); list.push(e.st); } }
      for (const [i, st] of list.entries()) {
        const b = el('button', 'cl-src'), cv = el('canvas'); b.type = 'button'; b.append(cv); tray.append(b);
        await deps.loadLeaflet(st.phrase);
        const big = deps.makeFront(st, 0.36);
        sources.push(big); Kit.put(cv, big);
        cv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: i * 50, fill: 'backwards' });
        b.onclick = () => { Kit.audio(); const f = tearFrom(big, b); place(f, null); };
        await Kit.wait(0);
      }
    }

    // ---- tearing a scrap: a jagged polygon, its torn rim showing the white paper core and a few fibres
    let seq = 0;
    function tearFrom(src, fromEl) {
      const rnd = Print.rng(Kit.hash('scrap' + (seq++) + Date.now()));
      const sw = src.width, sh = src.height, F = { x0: sw * 0.1, y0: sh * 0.08, x1: sw * 0.9, y1: sh * 0.92 };
      const cx = F.x0 + rnd() * (F.x1 - F.x0), cy = F.y0 + rnd() * (F.y1 - F.y0), R = sw * (0.16 + rnd() * 0.2);
      const n = 7 + Math.floor(rnd() * 5), corners = [];
      for (let i = 0; i < n; i++) { const a = (i + rnd() * 0.7) / n * TAU; const r = R * (0.55 + rnd() * 0.55); corners.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * (0.8 + rnd() * 0.5)]); }
      const pts = [];                                       // every edge torn, not cut: many small wobbles along it
      corners.forEach((p, i) => {
        const q = corners[(i + 1) % n], m = 6 + Math.floor(rnd() * 5), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
        for (let j = 0; j < m; j++) { const t = j / m, w = (rnd() - 0.5) * R * 0.08; pts.push([p[0] + dx * t - dy / L * w, p[1] + dy * t + dx / L * w]); }
      });
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 6;
      const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
      const c = U.canvas(Math.ceil(w), Math.ceil(h)), g = c.getContext('2d');
      const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x - x0, y - y0) : g.moveTo(x - x0, y - y0))); g.closePath(); };
      g.save(); path(); g.clip(); g.drawImage(src, -x0, -y0); g.restore();
      // the torn rim: white core along most of the edge, thicker in places, then loose fibres
      g.save(); path(); g.clip();
      g.strokeStyle = '#F6F1E6'; g.lineJoin = 'round';
      for (let i = 0; i < pts.length; i++) {
        if (rnd() < 0.18) continue;
        const [ax, ay] = pts[i], [bx2, by2] = pts[(i + 1) % pts.length];
        g.lineWidth = 2 + rnd() * 5; g.beginPath(); g.moveTo(ax - x0, ay - y0); g.lineTo(bx2 - x0, by2 - y0); g.stroke();
      }
      g.restore();
      g.strokeStyle = '#EFE8D8'; g.lineWidth = 0.8; g.lineCap = 'round';
      for (let i = 0; i < pts.length; i += 2) {
        if (rnd() < 0.5) continue;
        const [ax, ay] = pts[i], a = Math.atan2(ay - cy, ax - cx) + (rnd() - 0.5), l = 2 + rnd() * 4;
        g.beginPath(); g.moveTo(ax - x0, ay - y0); g.lineTo(ax - x0 + Math.cos(a) * l, ay - y0 + Math.sin(a) * l); g.stroke();
      }
      const poly = pts.map(([x, y]) => [x - x0, y - y0]);
      return { c, poly, w: c.width, h: c.height, from: fromEl };
    }

    // ---- scraps on the work surface: {el, c, poly, w, h, x, y, a, s} (x, y = centre in page px; w, h in canvas px)
    const frags = [];
    let k = 1;                                               // canvas px -> page px (sources are drawn at 0.36)
    function place(f, at) {
      k = bw / (Stamp.BW * 0.36);
      const e = el('canvas', 'cl-frag'); Kit.put(e, f.c); work.append(e);
      Object.assign(e.style, { width: f.w * k + 'px', height: f.h * k + 'px' });
      Object.assign(f, { el: e, x: at ? at.x : bx + bw * (0.2 + Math.random() * 0.6), y: at ? at.y : by + bh * (0.2 + Math.random() * 0.6),
        a: at ? at.a : (Math.random() - 0.5) * 0.9, s: at ? at.s : 0.9 + Math.random() * 0.5 });
      frags.push(f); apply(f); select(f);
      if (f.from && !at) {                                   // it flies over from the stamp it came off
        const r = f.from.getBoundingClientRect();
        e.animate([{ transform: `translate(${r.left + r.width / 2 - f.w * k / 2}px, ${r.top + r.height / 2 - f.h * k / 2}px) rotate(0rad) scale(.4)`, opacity: 0.4 }, { transform: e.style.transform, opacity: 1 }],
          { duration: 520, easing: 'cubic-bezier(.3,0,.2,1)' });
        Kit.crackle(); setTimeout(() => Kit.crackle(), 60); setTimeout(() => Kit.crackle(true), 130);
      }
      bDone.disabled = false;
      status.set(`${frags.length} 片 · 拖动、转动，拖出邮票就扔掉`);
      return f;
    }
    function apply(f) { f.el.style.transform = `translate(${(f.x - f.w * k / 2).toFixed(1)}px, ${(f.y - f.h * k / 2).toFixed(1)}px) rotate(${f.a.toFixed(4)}rad) scale(${f.s.toFixed(4)})`; placeHandle(); }
    let active = null;
    function select(f) {
      active = f;
      if (f) { work.append(f.el); frags.splice(frags.indexOf(f), 1); frags.push(f); work.append(handle); }
      placeHandle();
    }
    function placeHandle() {
      if (!active) { handle.classList.remove('on'); return; }
      const f = active, r = Math.hypot(f.w, f.h) * k * f.s / 2 * 0.72, ang = f.a - Math.PI / 4;
      handle.classList.add('on');
      handle.style.transform = `translate(${f.x + Math.cos(ang) * r - 11}px, ${f.y + Math.sin(ang) * r - 11}px)`;
    }
    const inside = (poly, x, y) => { let hit = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit; } return hit; };
    function hitTest(px, py) {
      for (let i = frags.length - 1; i >= 0; i--) {
        const f = frags[i], dx = px - f.x, dy = py - f.y, c = Math.cos(-f.a), s = Math.sin(-f.a);
        const lx = (dx * c - dy * s) / (f.s * k) + f.w / 2, ly = (dx * s + dy * c) / (f.s * k) + f.h / 2;
        if (inside(f.poly, lx, ly)) return f;
      }
      return null;
    }

    // ---- gestures
    const pts = new Map();
    let g0 = null;
    work.addEventListener('pointerdown', e => {
      if (e.target === handle) { g0 = { mode: 'turn', f: active, a0: active.a, ang0: Math.atan2(e.clientY - active.y, e.clientX - active.x) }; handle.setPointerCapture(e.pointerId); return; }
      const f = pts.size && g0 && g0.f ? g0.f : hitTest(e.clientX, e.clientY);
      if (!f) { select(null); return; }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.target.setPointerCapture(e.pointerId);
      select(f);
      if (pts.size === 1) g0 = { mode: 'move', f, x: e.clientX, y: e.clientY, fx: f.x, fy: f.y };
      else if (pts.size === 2) { const [p, q] = [...pts.values()]; g0 = { mode: 'pinch', f, d0: Math.hypot(q.x - p.x, q.y - p.y), a0: Math.atan2(q.y - p.y, q.x - p.x), fa: f.a, fs: f.s }; }
    });
    work.addEventListener('pointermove', e => {
      if (!g0) return;
      const f = g0.f;
      if (g0.mode === 'turn') { f.a = g0.a0 + Math.atan2(e.clientY - f.y, e.clientX - f.x) - g0.ang0; apply(f); return; }
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (g0.mode === 'move') { f.x = g0.fx + e.clientX - g0.x; f.y = g0.fy + e.clientY - g0.y; apply(f); }
      else if (g0.mode === 'pinch' && pts.size >= 2) {
        const [p, q] = [...pts.values()];
        f.s = clamp(g0.fs * Math.hypot(q.x - p.x, q.y - p.y) / g0.d0, 0.3, 3.5); f.a = g0.fa + Math.atan2(q.y - p.y, q.x - p.x) - g0.a0; apply(f);
      }
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (!g0) return;
      const f = g0.f;
      if (!pts.size) {
        // dropped well off the stamp: thrown away
        if (g0.mode === 'move' && (f.x < bx - bw * 0.25 || f.x > bx + bw * 1.25 || f.y < by - bh * 0.2 || f.y > by + bh * 1.2)) drop(f);
        g0 = null;
      } else if (pts.size === 1) { const [p] = [...pts.values()]; g0 = { mode: 'move', f, x: p.x, y: p.y, fx: f.x, fy: f.y }; }
    };
    work.addEventListener('pointerup', up); work.addEventListener('pointercancel', up);
    work.addEventListener('wheel', e => {
      const f = hitTest(e.clientX, e.clientY) || active; if (!f) return;
      e.preventDefault();
      if (e.shiftKey) f.a += Math.sign(e.deltaY || e.deltaX) * 0.08; else f.s = clamp(f.s * (e.deltaY > 0 ? 0.95 : 1.05), 0.3, 3.5);
      apply(f);
    }, { passive: false });
    function drop(f) {
      frags.splice(frags.indexOf(f), 1); if (active === f) select(null);
      f.el.animate([{ opacity: 1 }, { opacity: 0, transform: f.el.style.transform + ' scale(.6)' }], { duration: 300, fill: 'forwards' }).finished.then(() => f.el.remove());
      status.set(frags.length ? `${frags.length} 片` : '从左边的邮票上撕一片'); bDone.disabled = !frags.length;
    }

    // ---- buttons
    function clear() { [...frags].forEach(drop); }
    bClear.onclick = () => { clear(); if (result) closeResult(); };
    bMess.onclick = async () => {
      if (!sources.length) return;
      if (result) closeResult();
      clear(); Kit.audio();
      const m = 5 + Math.floor(Math.random() * 4), btns = [...tray.querySelectorAll('.cl-src')];
      for (let i = 0; i < m; i++) {
        const si = Math.floor(Math.random() * sources.length), f = tearFrom(sources[si], btns[si]);
        place(f, null);
        f.s = 1.6 - i * 0.12 + Math.random() * 0.2; apply(f);   // the big ones go down first
        await Kit.wait(150);
      }
      select(null);
    };
    // 完成: trim to the stamp's printed area, cancel, issue
    let result = null;
    bDone.onclick = async () => {
      if (!frags.length) return status.flash('先撕几片放上去');
      const sc = 0.6, out = Stamp.blank(sc, 12), g = out.getContext('2d'), ow = out.width, oh = out.height, q = ow / bw;
      const F = { x0: 110 * sc, y0: 108 * sc, x1: 1090 * sc, y1: 1392 * sc };
      g.save(); g.beginPath(); g.rect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0); g.clip();
      g.fillStyle = '#EDE6D6'; g.fillRect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0);
      for (const f of frags) {
        g.save(); g.translate((f.x - bx) * q, (f.y - by) * q); g.rotate(f.a); g.scale(f.s * k * q, f.s * k * q);
        g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
        g.drawImage(f.c, -f.w / 2, -f.h / 2); g.restore();
      }
      g.restore();
      U.grain(g, ow, oh, 0.2, 6);
      U.drawTracked(g, F.x1, oh - 52 * sc, `拼贴 · ${deps.date.replace(/-/g, '.')}`.toUpperCase(), U.font('cjk_small', Math.round(24 * sc)), '#26262b', 4 * sc, 'right');
      Stamp.postmark(g, F.x0 + 190 * sc, F.y1 - 170 * sc, 150 * sc, sc, { no: 1, date: deps.date }, -0.25, Math.floor(Math.random() * 1e5));
      Kit.thump(0.8);
      select(null);
      result = Kit.card(root, deps, { cls: 'cl-result' }); result.place(bx + bw / 2, by + bh / 2, bw, bh);
      result.turn(1, true); result.show(out, Kit.gum(sc, 13));
      result.box.animate([{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'ease' });
      frags.forEach(f => f.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }));
      deps.album.add({ id: 'collage:' + Date.now(), kind: 'collage', date: deps.date, image: await Kit.blobOf(out) });
      bDone.textContent = '存为图片'; bDone.onclick = async () => { const how = await Kit.save([{ cv: out, name: `collage-${deps.date}.png` }]); if (how !== 'cancelled') status.set('存好了'); };
      status.set('出票了 · 也收进了集邮册 · 点它翻面');
    };
    const doneHandler = bDone.onclick;
    function closeResult() {
      const r = result; result = null;
      r.box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => r.box.remove());
      frags.forEach(f => f.el.getAnimations().forEach(a => a.cancel()));
      bDone.textContent = '完成'; bDone.onclick = doneHandler;
    }

    layout();
    addEventListener('resize', () => { if (Kit.visible(root)) layout(); });
    bDone.disabled = true;
    status.set('点左边的邮票撕一片下来 · 或者先乱拼一版');
    const ready = fillTray();
    return { ready: Promise.race([ready, Kit.wait(500)]), anchor: () => base.getBoundingClientRect(), source: () => (result ? result.front : null) };
  }
  Pages.define('collage', mount);
})();
