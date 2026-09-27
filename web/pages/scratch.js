// 刮刮乐: a pop scratch ticket from 每日邮政. Six windows under a silver coat, a small stamp in each; scratch them off
// with a finger. Three of the same word wins: the three shine and the prize stamp is printed plate by plate. Three
// tickets a day (localStorage ds-scratch); about one in three wins.
(() => {
  const TAU = Math.PI * 2, KEY = 'ds-scratch', PER_DAY = 3, COLS = 3, ROWS = 2;
  const FORCE = /[?&]scratchwin/.test(location.search);    // test: every ticket wins

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'scratch', () => layout());
    const status = P.status;
    const ticket = el('div', 'sc-ticket'), bg = el('canvas', 'sc-bg'), wins = el('div', 'sc-wins'), coat = el('canvas', 'sc-coat');
    const acts = el('div', 'sc-acts'), veil = el('div', 'sc-veil');
    ticket.append(bg, wins, coat); root.append(ticket, acts, veil);
    const bNext = Kit.button(acts, '再来一张'); bNext.style.setProperty('--swash', '#ff5fa2'); bNext.hidden = true;
    const dbg = Kit.debugRow(root);

    // ---- the day's tickets
    const load = () => { try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r && r.date === date ? r : { date, used: 0 }; } catch (e) { return { date, used: 0 }; } };
    const save = r => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) { /* private mode */ } };
    let book = load();
    dbg.add('补满三张', () => { book = { date, used: 0 }; save(book); status.flash('补满了 · 今天还有 3 张'); if (!cur || cur.done) { bNext.hidden = false; } });

    /** a ticket's six stamps, from this visit's home stamps: a win puts one of them in three windows, a loss never more
     *  than two of any */
    function deal(no) {
      const rnd = Print.rng(Kit.hash('scratch|' + date + '|' + no + '|' + Kit.visit)), [a, b, c, d] = Kit.visitStamps(deps, 'scratch|' + date + '|' + no, 4);
      const win = rnd() < 0.34 || FORCE, cells = win ? [a, a, a, b, c, d] : [a, a, b, b, c, d];
      for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
      return { no, win, cells, pal: deps.palettes[Math.floor(rnd() * deps.palettes.length)] };
    }

    // ---- layout: the ticket upright, windows in a 3 x 2 grid on its lower part
    let W = 0, H = 0, phone = false, tw = 0, th = 0, tx = 0, ty = 0;
    const dpr = () => Math.min(2, devicePixelRatio || 1);
    const winRect = i => {                                  // in ticket px
      const c = i % COLS, r = Math.floor(i / COLS), gx = tw * 0.07, top = th * 0.36, ww = (tw - gx * 2 - (COLS - 1) * tw * 0.04) / COLS, wh = ww * 1.25;
      return { x: gx + c * (ww + tw * 0.04), y: top + r * (wh + th * 0.035), w: ww, h: wh };
    };
    function layout() {
      ({ W, H, phone } = P.measure());
      th = phone ? Math.min(H - 190, (W - 36) / 0.72) : Math.min(H - 190, 640); tw = th * 0.72;
      tx = W / 2 - tw / 2; ty = phone ? 96 : 100;
      Object.assign(ticket.style, { left: tx + 'px', top: ty + 'px', width: tw + 'px', height: th + 'px' });
      acts.style.cssText = `left:0;right:0;top:${ty + th + 12}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${phone ? H - 30 : ty + th + 58}px`;
      if (cur) paint();
    }

    // ---- painting: the ticket's print, the stamps in their windows, the silver over them
    let cur = null, grid = null;                           // grid: per window, which of its 10 x 12 cells are scratched
    const GX = 10, GY = 12;
    function paintBg() {
      const k = dpr(), w = Math.round(tw * k), h = Math.round(th * k), pal = cur.pal, g = (bg.width = w, bg.height = h, bg.getContext('2d'));
      const [a, b, c, d] = pal.c;
      g.fillStyle = a; g.fillRect(0, 0, w, h);
      // a sunburst of two inks behind the title
      g.save(); g.translate(w / 2, h * 0.16);
      for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? b : a; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, w, i * TAU / 24, (i + 1) * TAU / 24); g.closePath(); g.fill(); }
      g.restore();
      // the lower part: a field in the fourth ink cut on a slant
      g.fillStyle = d; g.beginPath(); g.moveTo(0, h * 0.34); g.lineTo(w, h * 0.29); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
      U.grain(g, w, h, 0.2, 4);
      const ink = pal.ink, s = k;
      g.save(); g.shadowColor = ink; g.shadowOffsetX = 4 * s; g.shadowOffsetY = 4 * s;
      U.drawMixed(g, w / 2, h * 0.13, '刮刮乐', 'caps', 'phrase_cjk', Math.round(tw * 0.17 * s), '#F4EEDF', 6 * s, 1, 'center');
      g.restore();
      // the rules on a strip of tape stuck across the rays
      const L = { s: 1, ink, paper: '#F4EEDF', TP: g, TK: g, K: g }, fr = Layouts.label(L, w / 2, h * 0.25, w * 0.8, h * 0.15, 'tape', '#F4EEDF', Print.rng(cur.no + 5));
      Layouts.inLabel(L, g, w / 2, h * 0.25, fr, c => {
        U.drawTracked(c, 0, -h * 0.017, 'SCRATCH & WIN · 每日邮政', U.font('caps_med', Math.round(tw * 0.028 * s)), ink, 4 * s, 'center');
        U.drawMixed(c, 0, h * 0.017, '刮出三枚相同的邮票 即中奖', 'caps', 'cjk_small_med', Math.round(tw * 0.036 * s), ink, 3 * s, 1, 'center');
      });
      U.drawTracked(g, w * 0.07, h * 0.955, `NO.${String(Kit.hash(date) % 9000 + cur.no).padStart(5, '0')}`, U.font('caps', Math.round(tw * 0.03 * s)), ink, 3 * s, 'left');
      U.drawTracked(g, w * 0.93, h * 0.955, `${date.replace(/-/g, '.')} · 当日有效`, U.font('cjk_small', Math.round(tw * 0.028 * s)), ink, 2 * s, 'right');
    }
    function paintWins() {
      wins.replaceChildren();
      cur.els = cur.cells.map((st, i) => {
        const r = winRect(i), cv = el('canvas', 'sc-win');
        Object.assign(cv.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
        Kit.put(cv, deps.makeFront(st, clamp(r.h * dpr() / Stamp.BH, 0.12, 0.3)));
        wins.append(cv); return cv;
      });
    }
    function paintCoat() {
      const k = dpr(), w = Math.round(tw * k), h = Math.round(th * k), g = (coat.width = w, coat.height = h, coat.getContext('2d'));
      for (let i = 0; i < 6; i++) {
        const r = winRect(i), x = (r.x - 3) * k, y = (r.y - 3) * k, ww = (r.w + 6) * k, hh = (r.h + 6) * k;
        const sil = g.createLinearGradient(x, y, x + ww, y + hh);
        sil.addColorStop(0, '#d9d9de'); sil.addColorStop(0.45, '#f4f4f7'); sil.addColorStop(0.55, '#b9b9c0'); sil.addColorStop(1, '#cfcfd5');
        g.fillStyle = sil; g.beginPath(); g.roundRect(x, y, ww, hh, 6 * k); g.fill();
        g.save(); g.translate(x + ww / 2, y + hh / 2); g.rotate(-0.5);
        U.drawMixed(g, 0, -hh * 0.07, '刮开', 'caps', 'phrase_cjk', Math.round(ww * 0.2), 'rgba(90,90,100,.55)', 2 * k, 1, 'center');
        U.drawMixed(g, 0, hh * 0.11, '有奖', 'caps', 'phrase_cjk', Math.round(ww * 0.2), 'rgba(90,90,100,.55)', 2 * k, 1, 'center');
        g.restore();
      }
      // what was already scratched stays scratched
      g.globalCompositeOperation = 'destination-out';
      grid.forEach((cells, i) => { const r = winRect(i); cells.forEach((v, j) => { if (v) { g.fillRect((r.x + (j % GX) * r.w / GX) * k - 1, (r.y + Math.floor(j / GX) * r.h / GY) * k - 1, r.w / GX * k + 2, r.h / GY * k + 2); } }); });
      g.globalCompositeOperation = 'source-over';
    }
    function paint() { paintBg(); paintWins(); paintCoat(); }
    function newTicket() {
      cur = deal(book.used + 1); cur.done = false; cur.open = new Array(6).fill(false);
      grid = Array.from({ length: 6 }, () => new Array(GX * GY).fill(0));
      paint();
      ticket.animate([{ opacity: 0, transform: 'translateY(24px) rotate(-2deg)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.25,.8,.3,1)' });
      status.set(`今天第 ${book.used + 1} / ${PER_DAY} 张 · 用手指刮开银色涂层`);
    }

    // ---- scratching: the finger wipes the silver away and marks the cells it crossed
    let last = null;
    function scrape(x, y) {
      const k = dpr(), g = coat.getContext('2d'), R = tw * 0.045;
      g.globalCompositeOperation = 'destination-out'; g.lineCap = 'round'; g.lineWidth = R * 2 * k;
      g.beginPath(); g.moveTo((last ? last.x : x) * k, (last ? last.y : y) * k); g.lineTo(x * k, y * k); g.stroke();
      g.globalCompositeOperation = 'source-over';
      const steps = last ? Math.ceil(Math.hypot(x - last.x, y - last.y) / (R * 0.5)) : 1;
      for (let s = 0; s <= steps; s++) {
        const px = last ? last.x + (x - last.x) * s / steps : x, py = last ? last.y + (y - last.y) * s / steps : y;
        for (let i = 0; i < 6; i++) {
          const r = winRect(i); if (px < r.x - R || px > r.x + r.w + R || py < r.y - R || py > r.y + r.h + R) continue;
          for (let j = 0; j < GX * GY; j++) {
            const cx = r.x + (j % GX + 0.5) * r.w / GX, cy = r.y + (Math.floor(j / GX) + 0.5) * r.h / GY;
            if ((cx - px) ** 2 + (cy - py) ** 2 < R * R) grid[i][j] = 1;
          }
        }
      }
      last = { x, y };
      if (Math.random() < 0.35) Kit.rustle(0.025, 0.05);
      if (Math.random() < 0.15) Kit.buzz(2);
      for (let i = 0; i < 6; i++) if (!cur.open[i] && grid[i].reduce((a, b) => a + b, 0) / grid[i].length > 0.55) reveal(i);
    }
    /** a window mostly scratched: the rest of its silver falls away */
    function reveal(i) {
      cur.open[i] = true;
      const r = winRect(i), k = dpr(), g = coat.getContext('2d'), t0 = performance.now();
      const step = t => {
        const a = Math.min(1, (t - t0) / 420);
        g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.25 + a * 0.75;
        g.fillRect((r.x - 4) * k, (r.y - 4) * k, (r.w + 8) * k, (r.h + 8) * k); g.restore();
        if (a < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      grid[i].fill(1);
      if (cur.open.every(Boolean)) finish();
    }
    let drawing = false;
    const at = e => { const b = coat.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    coat.addEventListener('pointerdown', e => { if (!cur || cur.done) return; Kit.audio(); drawing = true; last = null; coat.setPointerCapture(e.pointerId); const p = at(e); scrape(p.x, p.y); });
    coat.addEventListener('pointermove', e => { if (!drawing) return; const p = at(e); scrape(p.x, p.y); });
    const up = () => { drawing = false; last = null; };
    coat.addEventListener('pointerup', up); coat.addEventListener('pointercancel', up);

    // ---- the result
    let prize = null;
    async function finish() {
      if (cur.done) return; cur.done = true;
      book.used++; save(book);
      const counts = new Map(); cur.cells.forEach((st, i) => counts.set(st.phrase, [...(counts.get(st.phrase) || []), i]));
      const hit = [...counts.values()].find(v => v.length >= 3);
      await Kit.wait(500);
      if (!hit) {
        status.set(book.used < PER_DAY ? `差一点 · 今天还剩 ${PER_DAY - book.used} 张` : '差一点 · 今天的三张刮完了 · 明天再来');
        bNext.hidden = book.used >= PER_DAY;
        return;
      }
      // the three shine, one after another, then the prize prints
      for (const i of hit) {
        cur.els[i].animate([{ filter: 'brightness(1)', transform: 'scale(1)' }, { filter: 'brightness(1.35)', transform: 'scale(1.08)' }, { filter: 'brightness(1)', transform: 'scale(1)' }],
          { duration: 520, easing: 'ease-in-out' });
        Kit.thump(0.25); await Kit.wait(260);
      }
      await Kit.wait(400);
      const st = { ...cur.cells[hit[0]] };                       // the very stamp, printed big
      const h = Math.min(H * 0.5, th * 0.7, 330), c = Kit.card(root, deps, { cls: 'sc-prize' });
      c.place(W / 2, ty + th / 2, h * 0.8, h); c.turn(1, true); Kit.put(c.front, Stamp.blank(c.scale(), 8));
      veil.classList.add('on');
      c.box.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
      prize = c;
      status.set(`中奖了 · 「${st.phrase}」× 3`);
      await c.printCopy(st);
      deps.album.add({ id: `scratch:${date}:${cur.no}:${Kit.visit}`, kind: 'scratch', date, st }, { keep: true });
      status.set(`中奖了 · 「${st.phrase}」收进了集邮册 · 点它翻面`);
      bNext.hidden = book.used >= PER_DAY;
    }
    function dropPrize() {
      const c = prize; prize = null; veil.classList.remove('on');
      if (c) c.box.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(30px)' }], { duration: 360, easing: 'ease-in', fill: 'forwards' }).finished.then(() => c.box.remove());
    }
    veil.addEventListener('click', () => { if (prize && prize.ready) dropPrize(); });
    bNext.onclick = () => { if (book.used >= PER_DAY) return status.flash('今天的三张刮完了'); dropPrize(); bNext.hidden = true; newTicket(); };

    layout();
    status.set('刮刮乐 · 每天三张');
    return P.api({
      ready: Promise.resolve(),
      // the ticket is printed the first time the page is opened, not while the app loads
      enter() {
        book = load();
        if (!cur) { if (book.used < PER_DAY) newTicket(); else { status.set('今天的三张刮完了 · 明天再来'); cur = deal(book.used); cur.done = true; cur.open = new Array(6).fill(true); grid = Array.from({ length: 6 }, () => new Array(GX * GY).fill(1)); paint(); } }
      },
      leave() { if (prize && prize.ready) dropPrize(); },
      anchor: () => { const r = ticket.getBoundingClientRect(), h = Math.min(r.height * 0.5, 260); return new DOMRect(r.left + r.width / 2 - h * 0.4, r.top + r.height * 0.34, h * 0.8, h); },
      source: () => (prize && prize.ready ? prize.front : null),
    });
  }
  Pages.define('scratch', mount);
})();
