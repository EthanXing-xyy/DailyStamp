// 抓娃娃机: a claw machine full of capsules, a stamp curled up in each. Steer the claw with the stick (or ←/→),
// press 抓: it drops, closes, and holds on, or doesn't: a capsule caught off-centre tends to slip on the way up.
// Carried to the chute it drops out of the prize door; twist it open and the stamp inside prints and turns over.
// Five coins a day (localStorage ds-claw); while the app is being tried out a debug button fills them up again.
(() => {
  const KEY = 'ds-claw', COINS = 5, TAU = Math.PI * 2;
  // the machine in its own units: 100 wide, 140 tall
  const GL = { x0: 8, x1: 92, y0: 20, y1: 92 }, RAIL = 22, CHUTE = 28, WALL_TOP = 76, R = 6.4;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const store = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* this visit only */ } };

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'claw', () => layout());
    const status = P.status;
    const box = el('div', 'cw-box'), cv = el('canvas', 'cw-machine'), stick = el('div', 'cw-stick', '<i></i>'), grab = el('button', 'cw-grab', '抓');
    const coinsEl = el('div', 'cw-coins'), door = el('button', 'cw-prize'), veil = el('div', 'cw-veil');
    grab.type = 'button'; door.type = 'button';
    box.append(cv, stick, grab, coinsEl, door); root.append(box, veil);
    const dbg = Kit.debugRow(root);
    dbg.add('补满币', () => { S.left = COINS; store(S); coins(); status.set('币补满了 · 再来'); });

    const pal = deps.palettes[Kit.hash('claw' + date) % deps.palettes.length];
    let S = load(); if (!S || S.date !== date) { S = { date, left: COINS, n: 0 }; store(S); }

    // ---- capsules: two-colour shells, a stamp curled inside each
    const caps = [];
    let pending = null, card = null, settling = true;
    let made = 0;
    function capsule(x, y) {
      const n = made++, rnd = Print.rng(Kit.hash(`claw|${date}|${n}`)), cs = pal.c.concat([pal.ink]);
      const c = { n, x, y, vx: 0, vy: 0, a: rnd() * TAU, va: 0, col: cs[Math.floor(rnd() * 4)], st: Kit.stampFor(`claw|${date}|${n}`, deps.words, deps.palettes, S.n + n + 1, date), thumb: null };
      caps.push(c); return c;
    }
    function fill(count, fromTop) {
      for (let i = 0; i < count; i++) capsule(34 + Math.random() * 54, fromTop ? GL.y0 - 10 - i * 14 : GL.y0 + 10 + Math.random() * 50);
    }
    fill(14, false);
    for (let i = 0; i < 360; i++) physics(1 / 60);          // settle the pile before anyone sees it
    settling = false;

    // ---- physics: circles under gravity, against each other, the glass, the floor and the chute's wall
    function physics(dt) {
      for (const c of caps) { if (c.held) continue; c.vy += 320 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.va * dt; c.va *= 0.98; }
      for (let it = 0; it < 4; it++) {
        for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) {
          const a = caps[i], b = caps[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d > 0 && d < 2 * R) {
            const push = (2 * R - d) / 2, nx = dx / d, ny = dy / d, wa = a.held ? 0 : 1, wb = b.held ? 0 : 1, sum = wa + wb || 1;
            a.x -= nx * push * 2 * wa / sum; a.y -= ny * push * 2 * wa / sum; b.x += nx * push * 2 * wb / sum; b.y += ny * push * 2 * wb / sum;
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) { const imp = -rv * 0.6; a.vx -= nx * imp * wa / sum; a.vy -= ny * imp * wa / sum; b.vx += nx * imp * wb / sum; b.vy += ny * imp * wb / sum; a.va += imp * 0.05; b.va -= imp * 0.05; }
          }
        }
        for (const c of caps) {
          if (c.held || c.out) continue;
          if (c.x < GL.x0 + R) { c.x = GL.x0 + R; c.vx = Math.abs(c.vx) * 0.4; }
          if (c.x > GL.x1 - R) { c.x = GL.x1 - R; c.vx = -Math.abs(c.vx) * 0.4; }
          const inChute = c.x < CHUTE;
          if (!inChute && c.y > GL.y1 - R) { c.y = GL.y1 - R; c.vy = -Math.abs(c.vy) * 0.25; c.vx *= 0.9; c.va = c.vx / R; }
          // the chute's wall: a post from WALL_TOP down to the floor at x = CHUTE
          if (c.y > WALL_TOP - R) {
            const dy = Math.max(0, WALL_TOP - c.y), dx = c.x - CHUTE, d = c.y < WALL_TOP ? Math.hypot(dx, dy) : Math.abs(dx);
            if (d < R) { const k = c.y < WALL_TOP ? (R - d) / (d || 1) : 0;
              if (c.y < WALL_TOP) { c.x += dx * k; c.y -= dy * k; } else c.x = dx > 0 ? CHUTE + R : CHUTE - R;
              c.vx *= -0.3; }
          }
          if (inChute && c.y > GL.y1 + R) { if (settling) { c.x = 60 + Math.random() * 20; c.y = GL.y0; c.vx = c.vy = 0; } else prize(c); }
        }
      }
    }

    // ---- the claw: a carriage on the rail, a cable, a head with three prongs
    const claw = { x: 60, drop: 0, open: 1, state: 'idle', held: null, p: 0, vx: 0 };
    const CLAW_H = 9;
    const clawBottom = () => RAIL + 4 + claw.drop + CLAW_H;
    let busy = false;
    async function go() {
      if (busy || claw.state !== 'idle') return;
      if (S.left <= 0) return status.flash('今天的币用完了 · 明天再来');
      S.left--; S.n++; store(S); coins(); Kit.audio(); Kit.thump(0.2);
      busy = true; claw.state = 'down'; status.set('下去了…');
    }
    function stepClaw(dt) {
      if (claw.state === 'idle') { claw.x = clamp(claw.x + claw.vx * dt, 14, 88); return; }
      if (claw.state === 'down') {
        claw.drop += 34 * dt;
        const under = caps.filter(c => !c.out && Math.abs(c.x - claw.x) < R + 2.5);
        const stop = Math.min(GL.y1 - 1, ...under.map(c => c.y - R + 2.5));
        if (clawBottom() >= stop) { claw.state = 'close'; claw.t = 0; Kit.rustle(0.02, 0.1); }
      } else if (claw.state === 'close') {
        claw.t += dt; claw.open = Math.max(0, 1 - claw.t / 0.35);
        if (claw.t > 0.45) {
          const c = caps.filter(q => !q.out).map(q => ({ q, dx: Math.abs(q.x - claw.x), dy: q.y - clawBottom() })).filter(o => o.dx < R * 1.15 && o.dy > -R * 1.6 && o.dy < R * 1.2).sort((a, b) => a.dx - b.dx)[0];
          const p = c ? 1 - c.dx / (R * 1.15) : 0;
          if (c && Math.random() < 0.3 + 0.65 * p) { claw.held = c.q; c.q.held = true; claw.p = p; }
          claw.state = 'up';
        }
      } else if (claw.state === 'up') {
        claw.drop = Math.max(0, claw.drop - 26 * dt);
        if (claw.held && Math.random() < (1 - claw.p) * 1.1 * dt) slip();
        if (claw.drop <= 0) claw.state = 'home';
      } else if (claw.state === 'home') {
        claw.x = Math.max(18, claw.x - 30 * dt);
        if (claw.x <= 18) { claw.state = 'release'; claw.t = 0; }
      } else if (claw.state === 'release') {
        claw.t += dt; claw.open = Math.min(1, claw.t / 0.3);
        if (claw.held) { const h = claw.held; h.held = false; h.vy = 20; claw.held = null; }
        if (claw.t > 0.8) { claw.state = 'idle'; busy = false; if (!pending) status.set(S.left ? `还有 ${S.left} 个币 · 推摇杆，按「抓」` : '今天的币用完了 · 明天再来'); }
      }
      if (claw.held) { const h = claw.held; h.x = claw.x; h.y = clawBottom() + R - 3; h.vx = h.vy = 0; }
    }
    function slip() {
      const h = claw.held; if (!h) return;
      h.held = false; h.vx = (Math.random() - 0.5) * 30; h.vy = 10; claw.held = null; claw.open = 0.6;
      Kit.rustle(0.03, 0.12); status.flash('滑掉了！');
    }

    // ---- a prize: the capsule leaves the machine at the door; tapping it twists it open
    function prize(c) {
      c.out = true; caps.splice(caps.indexOf(c), 1);
      pending = c; Kit.thump(0.5);
      door.style.setProperty('--cap', c.col); door.classList.add('on');
      status.set('出来了！点扭蛋拧开');
      if (caps.length < 6) setTimeout(() => fill(8, true), 600);
    }
    door.onclick = async () => {
      const c = pending; if (!c) return;
      pending = null; door.classList.add('open');
      Kit.rustle(0.05, 0.25);
      await Kit.wait(420);
      door.classList.remove('on', 'open');
      if (card) card.box.remove();
      const cw = phone ? Math.min(W * 0.6, H * 0.4) : Math.min(H * 0.5, 320) * 0.8, ch = cw * 1.25;
      const c2 = card = Kit.card(root, deps, { cls: 'cw-card' });
      const cx = phone ? W / 2 : Math.min(W - cw / 2 - 30, mx + mw + (W - mx - mw) / 2), cy = phone ? H * 0.46 : my + mh * 0.42;
      c2.place(cx, cy, cw, ch); c2.turn(1, true); Kit.put(c2.front, Stamp.blank(c2.scale(), 3 + c.n));
      if (phone) veil.classList.add('on');
      const d = door.getBoundingClientRect();
      c2.box.animate([{ transform: `translate(${d.x + d.width / 2 - cx}px, ${d.y + d.height / 2 - cy}px) scale(.12)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 700, easing: 'cubic-bezier(.3,0,.2,1)' });
      await c2.print(c.st, { D: 650 });
      deps.album.add({ id: `claw:${date}:${c.n}:${Date.now()}`, kind: 'claw', date, st: c.st });
      status.set(`抓到「${c.st.phrase}」 · 收进了集邮册 · 点邮票翻面`);
    };
    veil.addEventListener('click', () => { veil.classList.remove('on'); if (card) { const c = card; card = null; c.box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => c.box.remove()); } });

    // ---- controls: the stick (drag it), the button, the arrow keys and space
    let stickDrag = null;
    stick.addEventListener('pointerdown', e => { try { stick.setPointerCapture(e.pointerId); } catch {} stickDrag = { x: e.clientX }; Kit.audio(); });
    stick.addEventListener('pointermove', e => {
      if (!stickDrag) return;
      const k = clamp((e.clientX - stickDrag.x) / 40, -1, 1);
      claw.vx = k * 36; stick.style.setProperty('--tilt', (k * 24).toFixed(1) + 'deg');
    });
    const stickUp = () => { stickDrag = null; claw.vx = 0; stick.style.setProperty('--tilt', '0deg'); };
    stick.addEventListener('pointerup', stickUp); stick.addEventListener('pointercancel', stickUp);
    grab.onclick = go;
    const keys = new Set();
    root.addEventListener('keydown', e => {
      if (!Kit.visible(root)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); keys.add(e.key); claw.vx = (keys.has('ArrowRight') - keys.has('ArrowLeft')) * 36; stick.style.setProperty('--tilt', (Math.sign(claw.vx) * 24) + 'deg'); }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (pending) door.onclick(); else go(); }
    });
    root.addEventListener('keyup', e => { keys.delete(e.key); claw.vx = (keys.has('ArrowRight') - keys.has('ArrowLeft')) * 36; if (!keys.size) stick.style.setProperty('--tilt', '0deg'); });
    function coins() {
      coinsEl.replaceChildren(...Array.from({ length: COINS }, (_, k) => el('i', k < S.left ? 'on' : '')));
      grab.disabled = S.left <= 0 && claw.state === 'idle';
      dbg.el.hidden = !Kit.DEBUG || S.left > 0;
    }

    // ---- layout and drawing
    let W = 0, H = 0, phone = false, mx = 0, my = 0, mw = 0, mh = 0, u = 1;
    function layout() {
      ({ W, H, phone } = P.measure());
      mh = phone ? Math.min(H - 170, (W - 36) * 1.4) : Math.min(H - 150, 660); mw = mh / 1.4; u = mw / 100;
      mx = phone ? (W - mw) / 2 : Math.max(30, W * 0.36 - mw / 2); my = phone ? 96 : 104;
      Object.assign(box.style, { left: mx + 'px', top: my + 'px', width: mw + 'px', height: mh + 'px' });
      const at = (x, y, w, h, e) => Object.assign(e.style, { left: x * u + 'px', top: y * u + 'px', width: w * u + 'px', height: h * u + 'px' });
      at(52, 103, 16, 22, stick); at(74, 104, 18, 18, grab); at(30, 106, 16, 6, coinsEl); at(9, 96, 18, 13, door);
      grab.style.fontSize = 5 * u + 'px';
      status.el.style.cssText = phone ? `left:16px;right:16px;top:${Math.min(H - 30, my + mh + 12)}px` : `left:${mx}px;width:${mw}px;top:${my + mh + 14}px`;
      if (card && !phone) card.place(Math.min(W - card.w / 2 - 30, mx + mw + (W - mx - mw) / 2), my + mh * 0.42, card.w, card.h);
      draw();
    }
    function draw() {
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(mw * dpr), h = Math.round(mh * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext('2d'), k = w / 100;
      g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, 100, 140);
      const ink = pal.ink, body = pal.c[0], trim = pal.c[1], lw = 1.1;
      g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = ink;
      // cabinet: an arched top, the body, a darker panel for the controls
      g.fillStyle = body; g.beginPath(); g.moveTo(2, 139); g.lineTo(2, 16); g.quadraticCurveTo(2, 2, 16, 2); g.lineTo(84, 2); g.quadraticCurveTo(98, 2, 98, 16); g.lineTo(98, 139); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = U.shade(body, 0.86); g.beginPath(); g.roundRect(4, 95, 92, 42, 3); g.fill(); g.stroke();
      // the marquee: an arch of light over the name
      g.fillStyle = trim; g.beginPath(); g.moveTo(14, 16); g.quadraticCurveTo(50, 1, 86, 16); g.lineTo(86, 18); g.lineTo(14, 18); g.closePath(); g.fill(); g.stroke();
      U.drawCentered(g, 50, 12.2, '抓邮票', U.font('phrase_cjk', 6), ink);
      for (let i = 0; i < 9; i++) { const t = i / 8, x = 14 + t * 72, y = 16 - Math.sin(t * Math.PI) * 7.6; g.fillStyle = '#FFF4C2'; g.beginPath(); g.arc(x, y + 0.2, 0.9, 0, TAU); g.fill(); }
      // the glass: a pale field, the chute behind its low wall, the rail
      g.fillStyle = '#EEF3F1'; g.beginPath(); g.roundRect(GL.x0, GL.y0, GL.x1 - GL.x0, GL.y1 - GL.y0 + 3, 2.5); g.fill();
      g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(GL.x0, GL.y1 - 1, GL.x1 - GL.x0, 4);
      g.fillStyle = U.shade(body, 0.62); g.fillRect(GL.x0, WALL_TOP, CHUTE - GL.x0, GL.y1 + 3 - WALL_TOP);
      U.drawCentered(g, (GL.x0 + CHUTE) / 2, WALL_TOP + 8, '出口', U.font('cjk_small', 3), '#F4EEDF');
      g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(CHUTE - 0.8, WALL_TOP, 1.6, GL.y1 + 3 - WALL_TOP);
      g.fillStyle = ink; g.fillRect(GL.x0 + 2, RAIL - 1, GL.x1 - GL.x0 - 4, 1.4);
      // capsules
      for (const c of caps) drawCap(g, c);
      // the claw: carriage, cable, head, three prongs opening out
      const cx = claw.x, top = RAIL + 0.4, by = RAIL + 4 + claw.drop;
      g.fillStyle = trim; g.beginPath(); g.roundRect(cx - 4.5, top - 2.2, 9, 4.4, 1.2); g.fill(); g.stroke();
      g.strokeStyle = '#8e8a84'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(cx, top + 2); g.lineTo(cx, by); g.stroke();
      g.strokeStyle = ink; g.lineWidth = lw; g.fillStyle = '#C8C6C2';
      g.beginPath(); g.roundRect(cx - 3.2, by - 1, 6.4, 3.6, 1.2); g.fill(); g.stroke();
      g.lineWidth = 1.3; g.lineCap = 'round';
      const o = claw.open;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 2.6, by + 2.4); g.quadraticCurveTo(cx + s * (4 + o * 4), by + 6, cx + s * (1.2 + o * 3.2), by + CLAW_H); g.stroke(); }
      g.beginPath(); g.moveTo(cx, by + 2.6); g.lineTo(cx, by + CLAW_H - 0.6 + o * 0.4); g.stroke();
      // glare on the glass, two slanting bands
      g.save(); g.beginPath(); g.roundRect(GL.x0, GL.y0, GL.x1 - GL.x0, GL.y1 - GL.y0 + 3, 2.5); g.clip();
      g.fillStyle = 'rgba(255,255,255,.22)';
      for (const [a, b] of [[62, 70], [74, 77]]) { g.beginPath(); g.moveTo(a, GL.y0); g.lineTo(b, GL.y0); g.lineTo(b - 30, GL.y1 + 3); g.lineTo(a - 30, GL.y1 + 3); g.fill(); }
      g.restore();
      g.lineWidth = lw; g.strokeStyle = ink; g.beginPath(); g.roundRect(GL.x0, GL.y0, GL.x1 - GL.x0, GL.y1 - GL.y0 + 3, 2.5); g.stroke();
      // the coin slot
      g.fillStyle = ink; g.beginPath(); g.roundRect(34, 100, 8, 3, 1); g.fill();
      U.drawCentered(g, 38, 116, `${S.left} / ${COINS}`, U.font('caps', 3.4), '#F4EEDF');
    }
    function drawCap(g, c) {
      g.save(); g.translate(c.x, c.y); g.rotate(c.a);
      g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
      if (c.thumb) { g.save(); g.beginPath(); g.arc(0, 0, R * 0.92, Math.PI, TAU); g.clip(); g.rotate(-0.3); g.drawImage(c.thumb, -R * 0.55, -R * 0.95, R * 1.1, R * 1.38); g.restore(); }
      g.beginPath(); g.arc(0, 0, R, 0, Math.PI); g.closePath(); g.fillStyle = c.col; g.fill();
      g.strokeStyle = pal.ink; g.lineWidth = 0.9; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(-R, 0); g.lineTo(R, 0); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(-R * 0.4, -R * 0.5, R * 0.28, R * 0.14, -0.6, 0, TAU); g.fill();
      g.restore();
    }

    // ---- the clock: physics and the claw while the page is on show
    Kit.loop(root, ms => { const dt = Math.min(1 / 30, ms / 1000); stepClaw(dt); physics(dt); draw(); });
    // the stamps inside are drawn small, a few at a time once the page is up
    let thumbing = null;
    const thumbs = () => thumbing || (thumbing = (async () => {
      for (const c of caps.slice()) {
        if (c.thumb) continue;
        await deps.loadLeaflet(c.st.phrase).catch(() => null);
        c.thumb = deps.makeFront(c.st, 0.07, { thumb: true });
        await Kit.wait(20);
      }
    })().finally(() => { thumbing = null; }));

    layout(); coins();
    status.set(S.left ? `今天有 ${S.left} 个币 · 推摇杆，按「抓」` : '今天的币用完了 · 明天再来');
    const ready = thumbs();
    setInterval(() => { if (Kit.visible(root) && caps.some(c => !c.thumb)) thumbs(); }, 1500);
    return P.api({ ready: Promise.race([ready, Kit.wait(1500)]), anchor: () => door.getBoundingClientRect(), source: () => (card && card.ready ? card.front : null) });
  }
  Pages.define('claw', mount);
})();
