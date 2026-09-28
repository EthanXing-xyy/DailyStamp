// The loading screen: the door of a small post office. It stays up until the home is in (fonts, artwork, every one
// of the home's stamps, today's stamp), so nothing on it loads, janks or pops in after it; each page is built when it
// is first opened. On cream paper, the title, the date and
// what the press is doing up top; at the foot of the screen a bicycle with a basket of letters leans by a red door, an
// old pillar box stands beside it and a calico cat sits by the wheel (scene/, drawn once by codex: dailystamp/scene.py).
// While the press works a letter flies from the basket into the box every few seconds by itself (a tap sends one at
// once), and the bell rings; the cat sits still, part of the picture. The hanging sign shows
// how far the loading has got. When all is in the sign reads 营业中, the lamps come on inside (the door's glass glows
// warm), a postmark (date and solar term) strikes the title once and a line at the foot fades up in the subtitle's type
// (轻触进门 · TAP TO ENTER). The app opens only on a tap, anywhere but the toys, and the door swings open onto the lit
// post office (the stamp cabinet, the counter, the clerk) before the iris closes on it. The user turned down a red
// button (a web widget on a painting), a pencilled note with an arrow at the door (a tutorial's gesture), and a line
// in another typeface or a 推 plate on the door (out of place, 土). Everything moves softly and once:
// the user found a screen of bobbing, springing parts cheap, rows of stamps dull, and two drawn post offices (cut paper
// with a street lamp; a painting replayed stroke by stroke) ugly, before choosing this picture themselves.
// Every string shown here lives in this file or index.html: `python dailystamp.py fonts` cuts the loader's tiny fonts from them.
// Digits and signs for the date and count: 0123456789 . / % →
// The postmark can carry any solar term, so their names are listed here for the font cut:
// 立春雨水惊蛰春分清明谷雨立夏小满芒种夏至小暑大暑立秋处暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒
const Loader = (() => {
  const root = document.getElementById('loader');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // how much of the progress each step is worth, and what the status line says meanwhile
  const STEPS = { fonts: 18, art: 6, masks: 18, stamps: 26, studio: 6 };   // roughly by time taken
  const SAY = { fonts: '上墨', art: '制版', masks: '晒版', stamps: '印刷', studio: '调色', done: '出版' };
  const done = Object.fromEntries(Object.keys(STEPS).map(k => [k, 0]));
  const total = Object.values(STEPS).reduce((a, b) => a + b, 0);
  let shown = 0, active = !!root, say = '', lastKey = '';

  const $ = sel => root && root.querySelector(sel);
  const all = typeof Features !== 'undefined' ? Features.LIST.length : 24;
  const count = $('.ld-count'), status = $('.ld-say');
  let printed = 0;
  // ?ldhold=0.4 keeps the screen at that much done, for looking at it (1 = all in, waiting for the tap)
  const hold = (() => { const v = new URLSearchParams(location.search).get('ldhold'); return v == null ? null : Math.max(0, Math.min(1, +v || 0)); })();
  const bar = $('.ld-row'), go = $('.ld-go'), mark = $('.ld-mark'), pct = $('.ld-pct');

  // today's date on the subtitle, from the start (the app's own date only comes in with ready())
  const pad = n => String(n).padStart(2, '0'), now = new Date(), dateEl = $('.ld-date');
  if (dateEl) dateEl.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;

  function paint() {
    if (!root) return;
    let p = 0;
    for (const k in STEPS) p += STEPS[k] * done[k];
    p = Math.max(shown, Math.min(1, p / total)); shown = p;
    if (hold != null) p = hold;
    if (count) count.textContent = `${Math.round(p * 100)}%`;
    if (pct) pct.textContent = `${Math.round(p * 100)}%`;
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }
  function talk(text) {
    if (!status || text === say) return;
    const word = text.split(' ')[0], same = word === say.split(' ')[0];   // the stamp count ticks over without a fade
    say = text;
    const i = text.indexOf(' ');                                           // the count sets in the caps face
    if (i < 0) status.textContent = text;
    else { const n = document.createElement('span'); n.textContent = text.slice(i + 1); status.replaceChildren(text.slice(0, i), n); }
    if (!reduce && !same) status.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  }

  /** how far a step has got (0..1); the status line names the step being worked on */
  const times = {};                                       // when each step began and ended (ms), for tuning
  function step(key, frac = 1, note) {
    const t = Math.round(performance.now()), tk = times[key] || (times[key] = [t, null]);
    if (frac >= 1 && tk[1] == null) tk[1] = t;
    done[key] = Math.max(done[key], Math.min(1, frac));
    if (note) talk(note); else if (key !== lastKey && key !== 'stamps') talk(SAY[key] || say);
    lastKey = key;
    paint();
  }
  /** a stamp came off the press: only counted here (the home shows them) */
  function stamp(i, src) {
    if (!src) return;
    printed++;
    talk(`${SAY.stamps} ${pad(Math.min(printed, all))} / ${pad(all)}`);
  }
  function blanks() {}

  // ---- the door of the post office (scene/index.json: the picture, where things are in it as fractions [x, y, w, h],
  // the cat and the letter). It is sized to the room left under the type; everything in it is placed in %.
  const scene = $('.ld-scene'), main = $('.ld-main');
  let pic = null, letterTimer = 0, busy = false;
  const kit = f => { if (typeof Kit !== 'undefined') try { Kit.audio(); f(Kit); } catch {} };
  const put = (el, [x, y, w, h]) => { if (el) Object.assign(el.style, { left: x * 100 + '%', top: y * 100 + '%', width: w * 100 + '%', height: h * 100 + '%' }); };
  const grow = ([x, y, w, h], k) => [x - w * k / 2, y - h * k / 2, w * (1 + k), h * (1 + k)];
  function size() {
    if (!scene || !pic) return;
    // what's drawn must fit whole; the picture's own margins are empty paper and may run past the screen's edges
    const W = innerWidth, H = innerHeight, ar = pic.w / pic.h, [cx, cy, cw, ch] = pic.spots.content;
    const top = main ? main.getBoundingClientRect().bottom + Math.max(16, H * 0.02) : H * 0.4;
    const foot = Math.max(H * 0.03, 12, go ? H - go.getBoundingClientRect().top + Math.max(8, H * 0.012) : 0);   // clear of the way in
    const room = Math.max(H * 0.25, H - top - foot);
    const w = Math.min(W * 0.94 / cw, room / ch * ar, 1080 / cw), h = w / ar;
    // centred on what's drawn, a little below the middle of the room left under the type
    const x = W / 2 - (cx + cw / 2) * w, y = top + Math.max(0, room - ch * h) * 0.58 - cy * h;
    Object.assign(scene.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    signOn(w, h);
    // the door's thickness and the eye's distance, in step with its size (a door is ~1/16 as thick as it is wide; a
    // fixed distance looked from far off on a phone's small door, so it only narrowed like a card)
    const door = $('.ld-door'), dw = pic.spots.door[2] * w;
    if (door) {
      const t = (dw * 0.062).toFixed(1);
      door.style.setProperty('--dt', t + 'px'); door.style.setProperty('--dtn', -t + 'px'); door.style.setProperty('--dp', (dw * 3.2).toFixed(0) + 'px');
    }
  }
  // the type on the sign lies on its board, which hangs a little askew: a box the board's size, sheared and turned onto
  // it (the parallelogram through the middles of the board's four sides; its corners are measured in scene.py). A
  // plain 2D matrix, which every browser draws the same way.
  function signOn(w, h) {
    const el = $('.ld-sign'); if (!el) return;
    const [p0, p1, p2, p3] = pic.spots.sign.map(([x, y]) => [x * w, y * h]);
    const ex = [(p1[0] + p2[0] - p0[0] - p3[0]) / 2, (p1[1] + p2[1] - p0[1] - p3[1]) / 2];   // left side to right side
    const ey = [(p3[0] + p2[0] - p0[0] - p1[0]) / 2, (p3[1] + p2[1] - p0[1] - p1[1]) / 2];   // top to bottom
    const cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4, cy = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
    const bw = Math.hypot(...ex), bh = Math.hypot(...ey);
    const m = [ex[0] / bw, ex[1] / bw, ey[0] / bh, ey[1] / bh, cx - (ex[0] + ey[0]) / 2, cy - (ex[1] + ey[1]) / 2];
    Object.assign(el.style, { width: bw + 'px', height: bh + 'px', fontSize: Math.max(8, bh * 0.36) + 'px', transform: `matrix(${m.join(',')})` });
  }
  function idleLetter() {                                 // a letter goes into the box a little after the last one
    clearTimeout(letterTimer);
    letterTimer = setTimeout(async () => { if (!active) return; await post(true); idleLetter(); }, 2000 + Math.random() * 1000);
  }
  async function tapLetter() { clearTimeout(letterTimer); await post(); if (active) idleLetter(); }
  /** a letter from the basket, over the door and down into the pillar box (by itself: sound, but no buzz on a phone) */
  async function post(auto = false) {
    if (busy || !pic || !pic.letter) return;
    busy = true;
    const el = $('.ld-letter'), sp = pic.spots, W = scene.clientWidth, H = scene.clientHeight;
    const lw = sp.slot[2] * 0.82 * W, lh = lw * pic.letter.h / pic.letter.w;
    const [bx, by, bw] = sp.basket, [sx, sy, sw] = sp.slot;
    const x0 = (bx + bw / 2) * W - lw / 2, y0 = by * H - lh * 0.6;
    const x1 = (sx + sw / 2) * W - lw / 2, y1 = sy * H - lh;         // its bottom edge on the slot
    const peak = Math.min(y0, y1) - H * 0.12;
    Object.assign(el.style, { left: 0, top: 0, width: lw + 'px', height: lh + 'px' });
    kit(k => k.rustle(0.03, 0.15));
    const fly = el.animate(reduce ? [{ opacity: 0, transform: `translate(${x1}px, ${y1}px)` }, { opacity: 1, transform: `translate(${x1}px, ${y1}px)` }] : [
      { opacity: 0, transform: `translate(${x0}px, ${y0}px) rotate(-10deg)` },
      { opacity: 1, transform: `translate(${x0}px, ${y0 - H * 0.04}px) rotate(-8deg)`, offset: 0.15 },
      { opacity: 1, transform: `translate(${(x0 + x1) / 2}px, ${peak}px) rotate(4deg)`, offset: 0.6 },
      { opacity: 1, transform: `translate(${x1}px, ${y1}px) rotate(0deg)` }],
      { duration: reduce ? 300 : 1100, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'forwards' });
    await fly.finished.catch(() => {});
    // into the slot: it goes down by its own height, and its frame (.ld-mail) ends at the slot line, so it vanishes there
    const drop = el.animate([
      { transform: `translate(${x1}px, ${y1}px)`, opacity: 1 },
      { transform: `translate(${x1}px, ${y1 + lh}px)`, opacity: 1 }],
      { duration: reduce ? 200 : 380, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    await drop.finished.catch(() => {});
    kit(k => k.thump(0.2, auto));
    el.getAnimations().forEach(an => an.cancel()); el.style.opacity = 0;
    busy = false;
  }
  /** the bicycle bell: two thin rings spread from it and fade */
  function ring() {
    kit(k => k.bell && k.bell());
    if (reduce) return;
    root.querySelectorAll('.ld-ring').forEach((r, i) => r.animate(
      [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 0.7, transform: 'scale(.9)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.5)' }],
      { duration: 700, delay: i * 180, easing: 'ease-out' }));
  }
  /** the door swings in (resolves when it has) */
  let swung = Promise.resolve();
  function openDoor() {
    if (!scene || !pic) return Promise.resolve();
    root.classList.add('opening');
    return new Promise(res => setTimeout(res, reduce ? 400 : 750));
  }
  const frames = n => new Promise(r => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r()); f(); });
  if (scene) (async () => {
    try {
      const e = await (await fetch('scene/index.json')).json();
      if (!e.cover || !e.spots || !e.spots.door) return scene.remove();
      pic = e;
      const img = $('.ld-cover'), v = `?v=${e.v}`, waits = [];
      const load = (im, src) => { im.src = src; waits.push(im.decode ? im.decode().catch(() => {}) : Promise.resolve()); };
      load(img, e.cover + v);
      if (e.paper) root.style.setProperty('--paper', e.paper);
      const sp = e.spots;
      put($('.ld-room'), sp.door); put($('.ld-door'), sp.door);
      if (e.room) {                                        // the lit room behind it, decoded before the scene shows
        const src = e.room.file + `?v=${e.roomv}`;
        load(new Image(), src); $('.ld-room').style.backgroundImage = `url("${src}")`;
      }
      const door = $('.ld-door-face'), [dx, dy, dw, dh] = sp.door;   // the door's face: its part of the picture
      Object.assign(door.style, { backgroundImage: `url("${e.cover + v}")`, backgroundSize: `${100 / dw}% ${100 / dh}%`,
        backgroundPosition: `${dx / (1 - dw) * 100}% ${dy / (1 - dh) * 100}%` });
      if (e.glass && sp.glass) {                          // the glass, lit from inside when the post office opens (in the door, so it turns with it)
        const [gx, gy, gw, gh] = sp.glass, lamp = $('.ld-lamp'), mask = `url("${e.glass.file}?v=${e.glass.v}")`;
        put(lamp, [(gx - dx) / dw, (gy - dy) / dh, gw / dw, gh / dh]);
        lamp.style.webkitMaskImage = mask; lamp.style.maskImage = mask;
        put($('.ld-bloom'), grow(sp.glass, 0.9));
      }
      put($('.ld-glow'), [dx - dw * 0.7, dy + dh * 0.82, dw * 2.4, dh * 0.34]);
      // the cat: its first pose only, sitting still on its spot as part of the picture (the user asked it not to move)
      const cat = $('.ld-cat'), [cx, cy, ch] = sp.cat;
      if (cat && e.cat && e.cat.length) {
        const c = e.cat[0], k = ch / c.h;                           // picture heights per sprite pixel
        put(cat, [cx - 0.2, cy - ch * 1.2, 0.4, ch * 1.2]);
        const im = document.createElement('img'); im.alt = '';
        Object.assign(im.style, { width: c.w * k * e.h / e.w / 0.4 * 100 + '%', height: c.h * k / (ch * 1.2) * 100 + '%' });
        load(im, c.file + `?v=${e.catv}`); cat.append(im);
      }
      if (e.letter) { const l = $('.ld-letter'); l.src = e.letter.file + `?v=${e.catv}`; put($('.ld-mail'), [0, 0, 1, sp.slot[1]]); }
      const [bx, by] = sp.bell, r = 0.05;
      const rings = root.querySelectorAll('.ld-ring');
      rings.forEach((el, i) => put(el, [bx - r * (0.6 + i * 0.4) * e.h / e.w, by - r * (0.6 + i * 0.4), r * (1.2 + i * 0.8) * e.h / e.w, r * (1.2 + i * 0.8)]));
      put($('.ld-hit-bell'), [bx - 0.05 * e.h / e.w, by - 0.06, 0.1 * e.h / e.w, 0.12]);
      $('.ld-hit-bell').addEventListener('click', ring);
      put($('.ld-hit-basket'), grow(sp.basket, 0.2)); put($('.ld-hit-box'), grow(sp.box, 0.15));
      $('.ld-hit-basket').addEventListener('click', tapLetter); $('.ld-hit-box').addEventListener('click', tapLetter);
      put($('.ld-hit-door'), sp.door);
      $('.ld-hit-door').addEventListener('click', () => { if (go && !go.disabled) go.click(); });
      size(); addEventListener('resize', () => { if (active) size(); });
      await Promise.all(waits);
      size(); scene.classList.add('on');
      if (e.letter) idleLetter();
    } catch { if (scene) scene.remove(); pic = null; }
  })();

  /** the web fonts the app will use, fetched with their bytes counted (then they're in the cache for the page) */
  async function fonts() {
    const urls = [];
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch { continue; }
      for (const r of rules) {
        if (!(r instanceof CSSFontFaceRule) || !r.style.getPropertyValue('unicode-range')) continue;
        const m = /url\("?([^")]+)"?\)/.exec(r.style.getPropertyValue('src'));
        if (m && /\.woff2(\?|$)/.test(m[1])) urls.push(new URL(m[1], sh.href || location.href).href);   // the subsets, not the full faces
      }
    }
    if (!urls.length) return;
    const got = new Array(urls.length).fill(0), size = new Array(urls.length).fill(0);
    const tick = () => { const all = size.reduce((a, b) => a + b, 0); if (all) step('fonts', 0.95 * got.reduce((a, b) => a + b, 0) / all); };
    await Promise.all(urls.map(async (u, i) => {
      try {
        const r = await fetch(u);
        size[i] = +r.headers.get('Content-Length') || 500000;
        if (!r.body) { await r.arrayBuffer(); got[i] = size[i]; tick(); return; }
        const rd = r.body.getReader();
        for (;;) { const { done: end, value } = await rd.read(); if (end) break; got[i] += value.length; tick(); }
        got[i] = size[i]; tick();
      } catch { got[i] = size[i]; }
    }));
  }

  /** everything is in: the status line fades, the postmark (date, solar term) strikes the title and the way in fades
   *  up. Resolves on its tap (or Enter / Space), which is also the gesture that lets sound play. */
  function ready({ date, term } = {}) {
    if (!active || !go) return Promise.resolve();
    if (hold != null && hold < 1) return new Promise(() => {});
    for (const k in STEPS) done[k] = 1; paint(); talk(SAY.done);
    if (mark) {
      const [, , m, d] = /(\d+)-(\d+)-(\d+)/.exec(date || '') || [];
      const sp = mark.querySelectorAll('span'), b = mark.querySelector('b');
      if (m && b) b.textContent = `${pad(+m)}.${pad(+d)}`;
      if (term && sp[1]) sp[1].textContent = term;
    }
    root.classList.add('ready'); root.setAttribute('aria-busy', 'false');
    go.disabled = false;
    setTimeout(() => { try { go.focus({ preventScroll: true }); } catch {} }, 1600);
    // the whole screen takes the tap, but for the toys in the picture: the bell, the basket and the pillar box
    root.addEventListener('click', e => { if (!go.disabled && !e.target.closest('.ld-hit-bell, .ld-hit-basket, .ld-hit-box')) go.click(); });
    return new Promise(res => go.addEventListener('click', async () => {
      go.disabled = true; go.classList.add('down');
      kit(k => k.thump(0.7));
      clearTimeout(letterTimer);
      // the door swings in on the compositor, so the app gets ready behind it meanwhile (the home shown under the
      // loading screen, its looping animations made, its first frames drawn): two frames on, once the swing is
      // running. finish() closes the iris once the door is open and the main thread is quiet again
      swung = openDoor();
      await frames(2);
      res();
    }, { once: true }));
  }

  /** the curtain: an iris closes on the print shop (on the open door, or the button) and opens on the app underneath */
  function finish() {
    if (!active) return Promise.resolve();
    for (const k in STEPS) done[k] = 1; paint(); talk(SAY.done);
    const pressed = go && go.classList.contains('down');
    document.body.classList.add('loaded');                  // the home's frames start now, under the loading screen
    return new Promise(res => setTimeout(async () => {
      await swung; await frames(2);                         // the door open, the home's first frames done
      active = false;
      const doorEl = pic && $('.ld-door'), W = innerWidth, H = innerHeight;
      const b = pressed ? (doorEl ? doorEl.getBoundingClientRect() : go.getBoundingClientRect()) : null;
      const x = b ? b.left + b.width / 2 : W / 2, y = b ? b.top + b.height / 2 : H / 2, R = Math.ceil(Math.hypot(Math.max(x, W - x), Math.max(y, H - y)));
      const at = `${x.toFixed(0)}px ${y.toFixed(0)}px`;
      const out = reduce ? root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' })
        : root.animate([{ clipPath: `circle(${R}px at ${at})` }, { clipPath: `circle(0px at ${at})` }],
          { duration: 720, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      await out.finished.catch(() => {});
      clearTimeout(letterTimer);
      root.remove(); res();
    }, reduce ? 150 : pressed ? 60 : 380));
  }
  /** the debugging views (?gallery, ?sheet=demo, studio params) don't wait for it */
  function skip() { active = false; clearTimeout(letterTimer); if (root) root.remove(); document.body.classList.add('loaded'); }

  // 手机只竖着看（用户 2026-09-27 定的）。转屏卡片先注释掉留着，哪天要横屏了把这段和 index.html 里的 #rotate 解开即可。
  /*
  // ---- a phone held upright: ask for landscape (Android can lock it from a tap; iOS has to be turned by hand)
  const rot = document.getElementById('rotate');
  const upright = matchMedia('(pointer: coarse) and (orientation: portrait) and (max-width: 600px)');
  let portraitOk = false;
  try { portraitOk = sessionStorage.getItem('ds-portrait') === '1'; } catch {}
  function rotateCard() {
    if (!rot) return;
    const want = upright.matches && !portraitOk;
    rot.classList.toggle('on', want);
    rot.setAttribute('aria-hidden', String(!want));
  }
  if (rot) {
    rot.querySelector('.rt-card').addEventListener('click', async () => {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        await screen.orientation.lock('landscape');
      } catch {
        rot.querySelector('.rt-say').textContent = '请关掉竖排方向锁定，再把手机横过来';
      }
    });
    rot.querySelector('.rt-portrait').addEventListener('click', e => {
      e.stopPropagation();
      portraitOk = true; try { sessionStorage.setItem('ds-portrait', '1'); } catch {}
      rotateCard();
    });
    upright.addEventListener('change', rotateCard);
    rotateCard();
  }
  */

  paint();
  return { step, stamp, blanks, fonts, ready, finish, skip, times, get active() { return active; } };
})();
