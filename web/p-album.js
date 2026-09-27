// 集邮册: a stockbook. Everything the app has handed you is in it by itself, filed by date: one page per solar term
// (more pages when a term has more), each stamp in its own clear mount, a little askew. Turn pages by dragging the
// corner or tapping the page edge; tap a stamp to take it out and turn it over.
(() => {
  const PER = 6;                                          // mounts per page (2 x 3)

  function mount(root, deps) {
    const { el, clamp, TAU } = Kit;
    Kit.head(root, 4, 'ALBUM', '集邮册');
    const book = el('div', 'album-book'), status = Kit.status(root);
    const veil = el('div', 'album-veil');
    root.append(book, veil);
    root.tabIndex = 0;

    // ---- which term a day belongs to, and when that term began (walk back to its first day)
    const termStart = date => { const k = Terms.of(date).key; let d = date; for (let i = 0; i < 20; i++) { const p = Kit.addDays(d, -1); if (Terms.of(p).key !== k) break; d = p; } return d; };
    const nameOf = key => (Terms.LIST.find(t => t[0] === key) || [key, key])[1];

    // ---- pages: [{term key, start, end, items, no, of}]
    let pages = [], spread = 0, single = false;
    async function load() {
      // stamps torn before the album existed come in from 撕一张's own record
      try {
        const t = JSON.parse(localStorage.getItem('dc-tear') || 'null');
        if (t && t.torn) for (const x of t.torn) if (x.st) await deps.album.add({ id: `tear:${t.pane}:${x.cell}`, kind: 'tear', date: x.date, st: x.st }, { keep: true });
      } catch (e) { /* nothing to bring in */ }
      const all = (await deps.album.all()).sort((a, b) => (a.date + a.added).localeCompare(b.date + b.added) || a.added - b.added);
      const groups = new Map();
      for (const e of all) { const s = termStart(e.date); if (!groups.has(s)) groups.set(s, []); groups.get(s).push(e); }
      const nowStart = termStart(deps.date);
      if (!groups.has(nowStart)) groups.set(nowStart, []);
      pages = [];
      for (const [start, items] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const key = Terms.of(start).key, n = Math.max(1, Math.ceil(items.length / PER));
        let end = start; for (let i = 0; i < 20; i++) { const nx = Kit.addDays(end, 1); if (Terms.of(nx).key !== key) break; end = nx; }
        for (let p = 0; p < n; p++) pages.push({ key, start, end, items: items.slice(p * PER, (p + 1) * PER), no: p + 1, of: n, now: start === nowStart });
      }
      const at = pages.findIndex(p => p.now);
      spread = single ? at : Math.floor(at / 2);
      status.set(`共 ${all.length} 枚 · ${new Set(all.map(e => termStart(e.date))).size} 个节气`);
    }

    // ---- thumbnails, cached by entry id
    const thumbs = new Map();
    async function thumb(e, h) {
      const k = e.id + '@' + Math.round(h);
      if (thumbs.has(k)) return thumbs.get(k);
      let out = null;
      const sc = clamp(h * Math.min(2, devicePixelRatio || 1) / Stamp.BH, 0.12, 0.5);
      if (Kit.thumbs[e.kind]) out = await Kit.thumbs[e.kind](e, sc, deps);
      else if (e.image) { const img = await Kit.imageOf(e.image); if (img) { out = U.canvas(img.naturalWidth, img.naturalHeight); out.getContext('2d').drawImage(img, 0, 0); } }
      else if (e.st) {
        await deps.loadLeaflet(e.st.phrase);
        const fr = deps.makeFront(e.st, sc, { stages: true });
        if (e.marks && Kit.drawMarks) { Kit.drawMarks(fr.stages.final.getContext('2d'), e.marks, sc, e.st); }
        out = fr.stages;
      }
      thumbs.set(k, out);
      return out;
    }

    // ---- one page as DOM: a header with the term, then the mounts
    let pw = 0, ph = 0;
    function pageEl(pg, side) {
      const p = el('div', 'album-page ' + side);
      if (!pg) { p.classList.add('blank'); return p; }
      const head = el('div', 'album-page-head'), ic = el('canvas');
      const e = Terms.icon(pg.key);
      const s = Math.round(pw * 0.1 * Math.min(2, devicePixelRatio || 1)); ic.width = ic.height = s;
      if (e) { const g = ic.getContext('2d'), [key, acc] = Print.channelMasks(e); g.drawImage(Print.tinted(acc, '#E8B04A', s), 0, 0, s, s); g.drawImage(Print.tinted(key, '#EDE6D6', s), 0, 0, s, s); }
      const f = d => `${+d.slice(5, 7)}.${+d.slice(8, 10)}`;
      head.append(ic, el('div', '', `<b>${nameOf(pg.key)}${pg.of > 1 ? ` · ${pg.no}` : ''}</b><span>${pg.start.slice(0, 4)} · ${f(pg.start)} — ${f(pg.end)}</span>`));
      p.append(head);
      const grid = el('div', 'album-grid');
      p.append(grid);
      if (!pg.items.length) grid.append(el('p', 'album-empty', '这一页还空着'));
      pg.items.forEach((it, i) => {
        const rnd = Print.rng(Kit.hash(it.id));
        const m = el('button', 'album-mount'), cv = el('canvas');
        m.type = 'button'; m.append(cv);
        m.style.setProperty('--r', ((rnd() - 0.5) * 5).toFixed(2) + 'deg');
        m.style.setProperty('--dx', ((rnd() - 0.5) * 8).toFixed(1) + 'px');
        m.style.setProperty('--dy', ((rnd() - 0.5) * 8).toFixed(1) + 'px');
        m.addEventListener('click', ev => { ev.stopPropagation(); if (!turning) takeOut(it, m); });
        grid.append(m);
        m._item = it;
      });
      return p;
    }
    // stamps come into their mounts plate by plate, a little one after another
    async function fill(p) {
      const ms = [...p.querySelectorAll('.album-mount')];
      for (const [i, m] of ms.entries()) {
        const it = m._item, cv = m.querySelector('canvas'), h = m.clientHeight || ph * 0.24;
        const t = await thumb(it, h);
        if (!t || !m.isConnected) continue;
        if (t.blank) {                                      // a stamp state: print it in
          Kit.put(cv, t.blank);
          deps.printIn(cv, t, { D: 420 });
        } else { Kit.put(cv, t); cv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease' }); }
        m.classList.toggle('wide', t.width > t.height * 1.05 || (t.final && t.final.width > t.final.height * 1.05));
        await Kit.wait(90 + i * 10);
      }
    }

    // ---- the book: a spread (or one page on a phone) plus a turning leaf
    let turning = false;
    function layout() {
      const W = innerWidth, H = innerHeight;
      single = W < H * 1.05;
      ph = single ? Math.min(H - 190, (W - 36) / 0.74) : Math.min(H - 180, (W - 80) / 2 / 0.74);
      pw = ph * 0.74;
      Object.assign(book.style, { width: (single ? pw : pw * 2) + 'px', height: ph + 'px', left: (W - (single ? pw : pw * 2)) / 2 + 'px', top: Math.max(96, (H - ph) / 2 + 20) + 'px' });
      book.style.setProperty('--pw', pw + 'px');
      root.classList.toggle('album-single', single);
      status.el.style.cssText = `left:16px;right:16px;top:${Math.max(96, (H - ph) / 2 + 20) + ph + 14}px`;
    }
    function show() {
      book.innerHTML = '';
      const L = single ? pages[spread] : pages[spread * 2], R = single ? null : pages[spread * 2 + 1];
      const lp = pageEl(L, single ? 'solo' : 'left'); book.append(lp); fill(lp);
      if (!single) { const rp = pageEl(R, 'right'); book.append(rp); fill(rp); }
      book.append(el('div', 'album-spine'));
    }
    const count = () => single ? pages.length : Math.ceil(pages.length / 2);
    async function turn(dir) {
      const n = spread + dir;
      if (turning || n < 0 || n >= count()) return;
      turning = true; Kit.audio(); Kit.rustle(0.05, 0.3);
      const leaf = el('div', 'album-leaf' + (single ? ' solo' : ''));
      const cur = single ? [pages[spread]] : [pages[spread * 2], pages[spread * 2 + 1]];
      const nxt = single ? [pages[n]] : [pages[n * 2], pages[n * 2 + 1]];
      // the leaf pivots on the spine: its front shows on the right (at 0°), its back on the left (at -180°)
      let fp, bp, up, hide;
      if (single) { fp = dir > 0 ? cur[0] : nxt[0]; bp = null; up = dir > 0 ? nxt[0] : cur[0]; hide = '.album-page.solo'; }
      else if (dir > 0) { fp = cur[1]; bp = nxt[0]; up = nxt[1]; hide = '.album-page.right'; }
      else { fp = nxt[1]; bp = cur[0]; up = nxt[0]; hide = '.album-page.left'; }
      const front = pageEl(fp, 'leaf-front'), back = pageEl(bp, 'leaf-back');
      leaf.append(front, back);
      const under = pageEl(up, single ? 'solo under' : (dir > 0 ? 'right under' : 'left under'));
      book.insertBefore(under, book.firstChild);
      const hid = book.querySelector(hide + ':not(.under)'); if (hid && !(single && dir < 0)) hid.style.visibility = 'hidden';
      book.append(leaf); fill(front); fill(back); fill(under);
      const a = leaf.animate(dir > 0 ? [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }] : [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }],
        { duration: Kit.reduce ? 10 : 900, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' });
      await a.finished;
      spread = n; show(); turning = false;
    }
    book.addEventListener('click', e => {
      if (turning || e.target.closest('.album-mount')) return;
      const r = book.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
      if (x > 0.62) turn(1); else if (x < 0.38) turn(-1);
    });
    let sx = null;
    book.addEventListener('pointerdown', e => { sx = e.clientX; });
    book.addEventListener('pointerup', e => { if (sx !== null && Math.abs(e.clientX - sx) > 50) turn(e.clientX < sx ? 1 : -1); sx = null; });
    root.addEventListener('keydown', e => {
      if (!Kit.visible(root)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
      if (e.key === 'Escape') putBack();
    });

    // ---- taking a stamp out of its mount: it lifts to the middle, big, and turns over
    let out = null;
    async function takeOut(it, m) {
      if (out) return putBack();
      const W = innerWidth, H = innerHeight, t = await thumb(it, 200);
      const wide = (t && (t.final || t).width > (t.final || t).height * 1.05);
      const h = wide ? Math.min(H * 0.62, W * 0.9 / 1.5) : Math.min(H * 0.66, W * 0.8 * 1.25), w = wide ? h * 1.5 : h * 0.8;
      veil.classList.add('on');
      const c = Kit.card(root, deps, { cls: 'album-out' + (wide ? ' wide' : '') }); c.place(W / 2, H / 2 + 10, w, h);
      const from = m.getBoundingClientRect();
      c.turn(1, true);
      c.box.animate([{ transform: `translate(${from.left + from.width / 2 - W / 2}px, ${from.top + from.height / 2 - H / 2 - 10}px) scale(${from.width / w})`, opacity: 0.3 },
        { transform: 'none', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.3,0,.2,1)' });
      out = c;
      if (it.st && !it.image && !Kit.thumbs[it.kind]) {
        Kit.put(c.front, Stamp.blank(c.scale(), 5));
        await c.print(it.st, { D: 600 });
        if (it.marks && Kit.drawMarks) Kit.drawMarks(c.front.getContext('2d'), it.marks, c.scale(), it.st);
      } else {
        const f = Kit.thumbs[it.kind] ? await Kit.thumbs[it.kind](it, c.scale(), deps) : t;
        const bk = it.back ? await Kit.imageOf(it.back) : null;
        const bc = bk ? (() => { const x = U.canvas(bk.naturalWidth, bk.naturalHeight); x.getContext('2d').drawImage(bk, 0, 0); return x; })() : null;
        c.show(f.final || f, bc || Kit.gum(c.scale(), 9));
        if (!bc) c.noFlip = true;
      }
    }
    function putBack() {
      if (!out) return;
      const c = out; out = null; veil.classList.remove('on');
      c.box.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.92)' }], { duration: 380, easing: 'ease', fill: 'forwards' }).finished.then(() => c.box.remove());
    }
    veil.addEventListener('click', putBack);

    let ready = null;
    const refresh = () => { ready = load().then(() => { layout(); show(); }); return ready; };
    addEventListener('resize', () => { if (!Kit.visible(root)) return; const was = single; layout(); if (was !== single) { const at = pages.findIndex(p => p.now); spread = single ? at : Math.floor(at / 2); } show(); });
    layout();
    refresh();
    return {
      get ready() { return ready; },
      enter() { if (pages.length) refresh(); },
      anchor: () => { const r = book.getBoundingClientRect(); const h = r.height * 0.5, w = h * 0.8; return new DOMRect(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h / 2, w, h); },
      source: () => null,
    };
  }
  Pages.define('album', mount);
})();
