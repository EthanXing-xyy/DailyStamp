// 盖戳: a stack of stamps and a rubber stamp. Tap anywhere on the top stamp and a mark lands there (a round date
// stamp with its waves, bare killer waves, or a little red 已阅), turned however it falls; hold longer for more ink, tap
// fast for a double strike. Flick the stamp away and it lands on the pile; the next one comes up. Pure release.
(() => {
  function mount(root, deps) {
    const { el, clamp, TAU } = Kit;
    const date = deps.date, KEY = 'ds-cancel';
    const P = Kit.page(root, 'cancel', () => layout());
    const status = P.status;
    const desk = el('div', 'cx-desk'), stackEl = el('div', 'cx-stack'), pile = el('div', 'cx-pile'), ring = el('div', 'cx-ring');
    desk.append(stackEl, pile, ring); root.append(desk);

    let S = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } })();
    if (!S || S.date !== date) S = { date, i: 0, count: 0 };
    const saveS = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* this visit only */ } };
    const stOf = i => Kit.stampFor(`cancel|${date}|${i}`, deps.words, deps.palettes, i + 1, date);

    let W = 0, H = 0, sh = 0, sw = 0, sx = 0, sy = 0, phone = false;
    function layout() {
      ({ W, H, phone } = P.measure());
      sh = phone ? Math.min((W - 60) * 1.25, H * 0.52) : Math.min(H * 0.6, 520); sw = sh * 0.8;
      sx = phone ? W / 2 : W * 0.42; sy = phone ? H * 0.47 : H * 0.55;
      Object.assign(stackEl.style, { left: sx - sw / 2 + 'px', top: sy - sh / 2 + 'px', width: sw + 'px', height: sh + 'px' });
      Object.assign(pile.style, phone ? { left: W - 110 + 'px', top: H - 150 + 'px', width: '84px', height: '105px' }
        : { left: W * 0.78 - 70 + 'px', top: sy - 30 + 'px', width: '140px', height: '175px' });
      status.el.style.cssText = `left:16px;right:16px;top:${Math.min(H - 28, sy + sh / 2 + 26)}px`;
    }

    // ---- the stack: the top stamp (paper + its marks) and a few under it, showing their edges
    const dpr = () => Math.min(2, devicePixelRatio || 1);
    const scale = () => clamp(sh * dpr() / Stamp.BH, 0.3, 0.8);
    let top = null;                                              // {i, st, box, cv, marks, mk}
    const under = [];
    function makeTop(i, fromUnder) {
      const st = stOf(i), box = el('div', 'cx-top'), cv = el('canvas'), mk = el('canvas');
      box.append(cv, mk); stackEl.append(box);
      const sc = scale();
      Kit.put(cv, Stamp.blank(sc, 20 + i));
      mk.width = cv.width; mk.height = cv.height;
      const t = { i, st, box, cv, mk, marks: [], sc };
      deps.loadLeaflet(st.phrase).then(() => {
        const fr = deps.makeFront(st, sc, { stages: true });
        deps.printIn(cv, fr.stages, { D: fromUnder ? 380 : 650 });
      });
      return t;
    }
    function makeUnder() {
      under.forEach(u => u.remove()); under.length = 0;
      for (let k = 1; k <= 3; k++) {
        const u = el('canvas', 'cx-under'), rnd = Print.rng(Kit.hash(date + (S.i + k)));
        u.style.transform = `translate(${((rnd() - 0.5) * 16).toFixed(1)}px, ${(k * 5 + rnd() * 4).toFixed(1)}px) rotate(${((rnd() - 0.5) * 7).toFixed(2)}deg)`;
        u.style.zIndex = String(10 - k);
        stackEl.prepend(u); under.push(u);
        const sc = clamp(sh / Stamp.BH, 0.2, 0.4);
        deps.loadLeaflet(stOf(S.i + k).phrase).then(() => Kit.put(u, deps.makeFront(stOf(S.i + k), sc)));
      }
    }

    // ---- stamping
    // with a seal of your own carved in 刻章, it comes up too
    const TYPES = () => Kit.mySeal() ? [['round', 0.4], ['wave', 0.2], ['seal', 0.15], ['mine', 0.25]] : [['round', 0.5], ['wave', 0.3], ['seal', 0.2]];
    const pickType = () => { let r = Math.random(), a = 0; for (const [t, w] of TYPES()) { a += w; if (r < a) return t; } return 'round'; };
    let last = null;
    function strike(px, py, weight) {
      if (!top) return;
      Kit.audio(); Kit.thump(weight);
      const r = top.box.getBoundingClientRect(), k = Stamp.BW / r.width;
      const x = (px - r.left) * k, y = (py - r.top) * k, now = performance.now();
      const type = pickType(), rot = type === 'wave' ? (Math.random() < 0.5 ? -1 : 1) * (0.26 + Math.random() * 0.36) : (Math.random() - 0.5) * 1.6;
      const m = { type, x, y, rot, weight, seed: Math.floor(Math.random() * 1e6), date };
      const g = top.mk.getContext('2d');
      const draw = mm => { const t = U.canvas(top.mk.width, top.mk.height), tg = t.getContext('2d'); Kit.drawMark(tg, mm, top.sc, { no: top.st.no, date });
        tg.globalCompositeOperation = 'destination-in'; tg.drawImage(top.cv, 0, 0); g.drawImage(t, 0, 0); };
      draw(m); top.marks.push(m);
      // a quick second tap bounces: a faint double strike just beside the first
      if (last && now - last.t < 260 && Math.hypot(px - last.x, py - last.y) < 40) {
        const gh = { ...m, x: m.x + 10 + Math.random() * 14, y: m.y + 6 + Math.random() * 10, rot: m.rot + 0.05, ghost: true };
        draw(gh); top.marks.push(gh);
      }
      last = { t: now, x: px, y: py };
      top.box.animate([{ transform: 'scale(1)' }, { transform: `scale(${(0.985 - weight * 0.012).toFixed(3)}) translateY(2px)` }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
      top.mk.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 160 });
      S.count++; saveS();
      status.set(`今天盖了 ${S.count} 个戳 · 甩走这一枚换下一枚`);
    }

    // ---- input: a tap stamps (held longer = more ink), a drag carries the stamp, a flick sends it to the pile
    let down = null;
    stackEl.addEventListener('pointerdown', e => {
      if (!top || (e.pointerType === 'mouse' && e.button !== 0)) return;
      down = { x: e.clientX, y: e.clientY, t: e.timeStamp, drag: false, samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }] };
      stackEl.setPointerCapture(e.pointerId);
      Object.assign(ring.style, { left: e.clientX + 'px', top: e.clientY + 'px' });
      ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on');
    });
    stackEl.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (down.samples.length > 6) down.samples.shift();
      if (!down.drag && Math.hypot(dx, dy) > 10) { down.drag = true; ring.classList.remove('on'); }
      if (down.drag) { top.dx = dx; top.dy = dy; top.box.style.transform = `translate(${dx}px, ${dy}px) rotate(${(dx * 0.03).toFixed(2)}deg)`; }
    });
    const up = e => {
      if (!down) return;
      const d = down; down = null; ring.classList.remove('on');
      if (!d.drag) return strike(d.x, d.y, clamp((e.timeStamp - d.t) / 650, 0.2, 1));
      const a = d.samples[0], b = d.samples[d.samples.length - 1], dt = Math.max(1, b.t - a.t);
      const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.hypot(vx, vy) > 0.5 || Math.hypot(dx, dy) > sw * 0.45) next(dx, dy);
      else top.box.animate([{ transform: top.box.style.transform }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.3,.7,.3,1)' }).finished.then(() => { if (top) top.box.style.transform = ''; });
    };
    stackEl.addEventListener('pointerup', up); stackEl.addEventListener('pointercancel', up);
    root.addEventListener('keydown', e => {
      if (!Kit.visible(root) || !top) return;
      if (e.key === ' ') { e.preventDefault(); const r = top.box.getBoundingClientRect(); strike(r.left + r.width * (0.25 + Math.random() * 0.5), r.top + r.height * (0.25 + Math.random() * 0.5), 0.4 + Math.random() * 0.5); }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(260, -40); }
    });

    // ---- off to the pile; the next one comes up
    const piled = [];
    async function next(dx, dy) {
      const t = top; if (!t) return;
      top = null; Kit.rustle(0.05, 0.2);
      if (t.marks.length) {
        deps.album.add({ id: `cancel:${date}:${t.i}`, kind: 'cancel', date, st: t.st, marks: t.marks });
        // the pile keeps a small copy of the stamp with its marks
        const pc = U.canvas(Math.round(t.cv.width * 0.4), Math.round(t.cv.height * 0.4)), pg = pc.getContext('2d');
        pg.drawImage(t.cv, 0, 0, pc.width, pc.height); pg.drawImage(t.mk, 0, 0, pc.width, pc.height);
        const p = el('canvas', 'cx-piled'); Kit.put(p, pc); p.style.transform = `rotate(${((Math.random() - 0.5) * 24).toFixed(1)}deg) translate(${((Math.random() - 0.5) * 14).toFixed(1)}px, ${((Math.random() - 0.5) * 10).toFixed(1)}px)`;
        pile.append(p); piled.push(p); if (piled.length > 8) piled.shift().remove();
        const pr = pile.getBoundingClientRect(), r = t.box.getBoundingClientRect();
        p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 350, fill: 'backwards' });
        t.box.animate([{ transform: t.box.style.transform || 'none' },
          { transform: `translate(${pr.left + pr.width / 2 - (r.left + r.width / 2) + (t.dx || 0)}px, ${pr.top + pr.height / 2 - (r.top + r.height / 2) + (t.dy || 0)}px) scale(${pr.width / r.width}) rotate(${(Math.random() - 0.5) * 30}deg)`, opacity: 0.4 }],
          { duration: 520, easing: 'cubic-bezier(.3,0,.3,1)', fill: 'forwards' }).finished.then(() => t.box.remove());
      } else {
        t.box.animate([{ transform: t.box.style.transform || 'none' }, { transform: `translate(${dx * 3}px, ${dy * 3}px) rotate(${dx * 0.08}deg)`, opacity: 0 }],
          { duration: 420, easing: 'ease-in', fill: 'forwards' }).finished.then(() => t.box.remove());
      }
      S.i++; saveS();
      await Kit.wait(180);
      top = makeTop(S.i, true);
      top.box.animate([{ transform: 'translateY(10px) scale(.97)', opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'ease-out' });
      makeUnder();
    }

    layout();
    makeUnder();
    top = makeTop(S.i, false);
    top.box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
    status.set(S.count ? `今天盖了 ${S.count} 个戳` : '点邮票盖一个戳 · 按久一点墨更重 · 甩走换下一枚');
    return P.api({
      ready: Promise.resolve(),
      anchor: () => stackEl.getBoundingClientRect(),
      source: () => null,
    });
  }
  Pages.define('cancel', mount);
})();
