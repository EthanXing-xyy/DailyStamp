// 翻牌显示屏: a station's split-flap board for 每日邮政's mail runs. Six runs, each a library word: when it leaves, where
// it goes (the word), the drug it carries (its leaflet's name), the platform and how it is doing. Coming in, every flap
// clatters round to its letter, a column at a time. Tap a run and its stamp slides out of the ticket slot under the
// board, printed plate by plate; tap the stamp to turn it over for the leaflet. The clock in the corner flips each minute.
(() => {
  const SPIN = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';          // what a flap turns through on its way, besides the board's own letters
  const STATES = [['检票中', 1], ['准点', 2], ['准点', 2], ['延误', 3], ['准点', 2], ['待发', 0]];   // [text, palette ink]

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'flap', () => layout());
    const status = P.status;
    const board = el('div', 'fp-board'), top = el('div', 'fp-top'), cols = el('div', 'fp-cols'), rowsEl = el('div', 'fp-rows');
    const slot = el('div', 'fp-slot'), veil = el('div', 'fp-veil');
    board.append(top, cols, rowsEl); root.append(board, slot, veil);
    const day = Print.rng(Kit.hash('flap' + date + Kit.visit));
    const pal = deps.palettes[Math.floor(day() * deps.palettes.length)];
    board.style.setProperty('--body', pal.ink);
    const hot = pal.c.slice().sort((a, b) => U.contrast(b, '#1d1d22') - U.contrast(a, '#1d1d22'));
    board.style.setProperty('--hot', hot[0]);

    // ---- the runs: a stamp each (the first one is the stamp that flew in, once one has)
    const two = Kit.two, now = new Date();
    let t = Math.ceil((now.getHours() * 60 + now.getMinutes() + 4) / 10) * 10;
    const picks = Kit.visitStamps(deps, 'flap', STATES.length);
    const runs = STATES.map((s, i) => {
      const st = picks[i];
      const at = t; t += 10 + Math.floor(day() * 5) * 5;
      return { st, time: `${two(Math.floor(at / 60) % 24)}:${two(at % 60)}`, plat: `${1 + Math.floor(day() * 9)}${'ABCD'[Math.floor(day() * 4)]}`, state: s[0], ink: s[1] };
    });
    const drugOf = st => { const l = Assets.leafletFor(st); return (l && l.name) || st.phrase + '缓释片'; };

    // ---- flaps: two static halves and two leaves; a turn folds the top leaf down, then the bottom one
    function cell(parent) {
      const c = el('span', 'fp-c'), parts = ['u', 'd', 'fu', 'fd'].map(k => { const p = el('span', k), b = el('b'); p.append(b); c.append(p); return b; });
      parent.append(c);
      return { el: c, parts, ch: ' ', leaves: [c.children[2], c.children[3]] };
    }
    const show = (c, ch) => { c.ch = ch; for (const b of c.parts) b.textContent = ch; };
    let lastTick = 0;
    const tick = () => { const n = performance.now(); if (n - lastTick > 34) { lastTick = n; Kit.crackle(); } };
    async function turn(c, next, T) {
      const [u, d, fu, fd] = c.parts, [lu, ld] = c.leaves;
      u.textContent = next; fu.textContent = c.ch; fd.textContent = next; d.textContent = c.ch;
      lu.style.visibility = ld.style.visibility = 'visible';
      await lu.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: T, easing: 'ease-in' }).finished;
      lu.style.visibility = 'hidden';
      await ld.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: T, easing: 'ease-out' }).finished;
      ld.style.visibility = 'hidden'; d.textContent = next; c.ch = next; tick();
    }
    /** turn a flap round to `ch`, through a few others first (a flap never jumps straight there) */
    async function spinTo(c, ch, laps, pool, T = 42) {
      if (c.spinning) c.spinning.cancel = true;
      const me = { cancel: false }; c.spinning = me;
      for (let i = 0; i < laps && !me.cancel; i++) await turn(c, pool[Math.floor(Math.random() * pool.length)], T);
      if (!me.cancel && c.ch !== ch) await turn(c, ch, T + 12);
      if (c.spinning === me) c.spinning = null;
    }
    const pad = (s, n) => { const a = [...s].slice(0, n); while (a.length < n) a.push(' '); return a; };

    // ---- the board: the clock top right, column heads, six rows
    top.innerHTML = '<span class="fp-name"><b>每日邮政 · 邮班时刻</b><i>DAILY POST DEPARTURES</i></span>';
    const clock = el('span', 'fp-clock'); top.append(clock);
    const clockCells = Array.from({ length: 5 }, () => cell(clock));
    const COLS = [['time', 5, '时刻', 'TIME'], ['to', 4, '开往', 'TO'], ['drug', 6, '药品', 'CARGO'], ['plat', 2, '站台', 'PLAT'], ['state', 3, '状态', 'STATUS']];
    const rows = runs.map((r, i) => {
      const b = el('button', 'fp-row'); b.type = 'button';
      const lamp = el('i', 'fp-lamp'); b.append(lamp);
      const groups = Object.fromEntries(COLS.map(([k, n]) => { const g = el('span', 'fp-g fp-' + k); b.append(g); return [k, Array.from({ length: n }, () => cell(g))]; }));
      b.onclick = () => issue(i);
      rowsEl.append(b);
      return { el: b, lamp, groups };
    });
    const heads = COLS.map(([k, , cn, en]) => { const h = el('span', 'fp-h fp-' + k, `<b>${cn}</b><i>${en}</i>`); cols.append(h); return h; });
    const textOf = (r, k) => ({ time: r.time, to: U.hasCjk(r.st.phrase) ? r.st.phrase : r.st.phrase.toUpperCase(), drug: drugOf(r.st), plat: r.plat, state: r.state })[k];
    function inkRow(i) { rows[i].groups.state.forEach(c => c.el.style.setProperty('--ch-ink', runs[i].ink ? pal.c[runs[i].ink] : '')); }
    runs.forEach((_, i) => inkRow(i));

    let phone = false, W = 0, H = 0, bx = 0, by = 0, bw = 0, bh = 0, card = { x: 0, y: 0, h: 0, over: false };
    function layout() {
      ({ W, H, phone } = P.measure());
      const shown = phone ? ['time', 'to', 'state'] : COLS.map(c => c[0]);
      root.classList.toggle('fp-narrow', phone);
      const nCells = COLS.filter(c => shown.includes(c[0])).reduce((a, c) => a + c[1], 0), gaps = shown.length - 1;
      bw = phone ? W - 20 : Math.min(W * 0.6, 860);
      const gap = phone ? 2 : 3, gGap = phone ? 10 : 16, padX = phone ? 12 : 22, lampW = phone ? 12 : 18;
      let cw = (bw - 2 * padX - lampW - gaps * gGap - (nCells - gaps - 1) * gap) / nCells;
      cw = Math.min(cw, (H - 300) / 6 / 1.42);
      const ch = cw * 1.42;
      bw = 2 * padX + lampW + gaps * gGap + (nCells - gaps - 1) * gap + nCells * cw;
      board.style.setProperty('--cw', cw.toFixed(2) + 'px'); board.style.setProperty('--ch', ch.toFixed(2) + 'px');
      board.style.setProperty('--gap', gap + 'px'); board.style.setProperty('--ggap', gGap + 'px'); board.style.setProperty('--padx', padX + 'px'); board.style.setProperty('--lamp', lampW + 'px');
      bx = phone ? (W - bw) / 2 : Math.max(24, W * 0.05); by = phone ? 96 : 104;
      Object.assign(board.style, { left: bx + 'px', top: by + 'px', width: bw + 'px' });
      bh = board.getBoundingClientRect().height || ch * 6 + 140;
      // the ticket slot sits under the board (a desk's room beside it); the stamp comes out of it
      if (phone) {
        const room = H - (by + bh) - 64;
        card.over = room < 150;
        card.h = card.over ? Math.min(H * 0.5, 330) : Math.min(room, 280); card.x = W / 2; card.y = card.over ? H * 0.48 : by + bh + 26 + card.h / 2;
      } else {
        card.over = false; card.h = Math.min(H * 0.62, 440); card.x = (bx + bw + W) / 2; card.y = by + Math.min(bh, card.h + 60) / 2 + 20;
      }
      if (!phone) { const mid = Math.max(104, (H - bh) / 2 - 10); board.style.top = mid + 'px'; by = mid; card.y = by + bh / 2; }
      Object.assign(slot.style, card.over ? { display: 'none' } : { display: '', left: card.x - card.h * 0.46 + 'px', top: card.y - card.h / 2 - 12 + 'px', width: card.h * 0.92 + 'px' });
      if (cur) cur.place(card.x, card.y, card.h * 0.8, card.h);
      status.el.style.cssText = phone ? `left:16px;right:16px;top:${H - 30}px` : `left:${bx}px;width:${bw}px;top:${by + bh + 18}px`;
    }

    // ---- the clatter: every flap spins round, a column at a time from the left
    const poolOf = () => [...new Set([...SPIN, ...runs.flatMap(r => COLS.map(([k]) => [...textOf(r, k)]).flat())].filter(c => c.trim()))];
    let clattered = 0;
    async function clatter(delay = 0) {
      const my = ++clattered, pool = poolOf();
      await Kit.wait(delay);
      if (my !== clattered) return;
      const jobs = [];
      rows.forEach((row, i) => {
        let col = 0;
        for (const [k, n] of COLS) {
          const chars = pad(textOf(runs[i], k), n);
          row.groups[k].forEach((c, j) => {
            const at = (col + j) * 38 + i * 60;
            jobs.push(Kit.wait(at).then(() => spinTo(c, chars[j], 3 + Math.floor(Math.random() * 6), pool)));
          });
          col += n;
        }
      });
      setClock(true);
      await Promise.all(jobs);
    }
    let clockT = 0;
    function setClock(spin) {
      const d = new Date(), s = `${two(d.getHours())}:${two(d.getMinutes())}`;
      clockCells.forEach((c, j) => { if (c.ch !== s[j]) spinTo(c, s[j], spin ? 2 + j : 0, SPIN.slice(0, 10)); });
    }
    function runClock() { clearTimeout(clockT); setClock(false); clockT = setTimeout(runClock, 60000 - Date.now() % 60000 + 50); }

    // ---- a run's stamp out of the slot
    let cur = null, busy = false, pick = -1;
    async function clearCard() {
      const c = cur; cur = null; veil.classList.remove('on');
      if (!c) return;
      await c.box.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(26px)' }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished;
      c.box.remove();
    }
    async function issue(i, landed = false) {
      if (busy) return; busy = true;
      Kit.audio();
      rows.forEach((r, k) => r.el.classList.toggle('on', k === i)); pick = i;
      await clearCard();
      const r = runs[i], st = r.st, c = Kit.card(root, deps, { cls: 'fp-ticket' });
      c.place(card.x, card.y, card.h * 0.8, card.h); c.turn(1, true); cur = c;
      if (card.over) veil.classList.add('on');
      if (landed) { const sc = Math.min(c.scale(), 0.36); c.show(deps.makeFront(st, sc), deps.makeBack(st, sc, null)); c.st = st; }
      else {
        Kit.put(c.front, Stamp.blank(c.scale(), 3 + i));
        Kit.rustle(0.05, 0.4);
        c.box.animate([{ opacity: 0, transform: 'translateY(-36px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.25,.8,.3,1)' });
        await Kit.wait(380);
        await c.printCopy(st);
      }
      deps.album.add({ id: `flap:${date}:${st.phrase}:${st.seed}`, kind: 'flap', date, st }, { keep: true });
      r.state = '已出票'; r.ink = 3; inkRow(i);
      const pool = poolOf(), chars = pad(r.state, 3);
      rows[i].groups.state.forEach((cc, j) => spinTo(cc, chars[j], 3 + j * 2, pool));
      status.set(`${r.time} 开往「${st.phrase}」· 已出票 · 点邮票翻面`);
      busy = false;
    }
    veil.addEventListener('click', () => { if (!busy) { clearCard(); rows.forEach(r => r.el.classList.remove('on')); } });

    layout();
    runs.forEach((r, i) => { let col = 0; for (const [k, n] of COLS) { const cs = pad(textOf(r, k), n); rows[i].groups[k].forEach((c, j) => show(c, cs[j])); col += n; } });
    const d0 = new Date(), s0 = `${two(d0.getHours())}:${two(d0.getMinutes())}`; clockCells.forEach((c, j) => show(c, s0[j]));
    status.set('点一班邮车 · 出票口给你一枚');
    return P.api({
      ready: Promise.resolve(),
      enter() { requestAnimationFrame(() => { layout(); }); clatter(650); runClock(); },
      leave() { clearTimeout(clockT); clattered++; },
      anchor: () => new DOMRect(card.x - card.h * 0.4, card.y - card.h / 2, card.h * 0.8, card.h),
      // the stamp that flew in takes the first run
      receive(st) {
        if (cur && cur.st && cur.st.seed === st.seed) return 250;
        runs[0].st = st; pick = 0;
        const pool = poolOf();
        for (const [k, n] of COLS) { const cs = pad(textOf(runs[0], k), n); rows[0].groups[k].forEach((c, j) => spinTo(c, cs[j], 2 + j, pool)); }
        issue(0, true);
        return 250;
      },
      source: () => (cur && cur.ready ? cur.front : null),
    });
  }
  Pages.define('flap', mount);
})();
