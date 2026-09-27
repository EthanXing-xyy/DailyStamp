// The loading screen: the post office at dusk. It stays up until everything is in (fonts, artwork, every one of the
// home's stamps, every page), so nothing loads, janks or pops in after it. Ink-blue paper; along the bottom the post
// office, a street lamp and a pillar box, cut out of darker paper (scene/, drawn once by codex: dailystamp/scene.py).
// The only warm colour is light: the lamp comes up with the loading, and a few of the home's real stamps seep into the
// shop window as they come off the press. Above, the title, the date, what the press is doing and how far it has got.
// When all is in, the windows light, a postmark (date and solar term) strikes the title once and the way in
// (进入邮局 →) fades up where the status was; the app opens only on its tap, the iris closing on the button. One thing
// moves at a time and nothing bounces: the user found a screen of bobbing, springing parts on a Ben-Day field cheap,
// and the later rows of twenty-four stamps in neat ranks dull.
// Every string shown here lives in this file or index.html: `python dailystamp.py fonts` cuts the loader's tiny fonts from them.
// Digits and signs for the date and count: 0123456789 . / % →
// The postmark can carry any solar term, so their names are listed here for the font cut:
// 立春雨水惊蛰春分清明谷雨立夏小满芒种夏至小暑大暑立秋处暑白露秋分寒露霜降立冬小雪大雪冬至小寒大寒
const Loader = (() => {
  const root = document.getElementById('loader');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // how much of the progress each step is worth, and what the status line says meanwhile
  const STEPS = { fonts: 18, art: 6, masks: 18, stamps: 26, studio: 6, pages: 26 };   // roughly by time taken
  const SAY = { fonts: '上墨', art: '制版', masks: '晒版', stamps: '印刷', studio: '调色', pages: '装订', done: '出版' };
  const done = Object.fromEntries(Object.keys(STEPS).map(k => [k, 0]));
  const total = Object.values(STEPS).reduce((a, b) => a + b, 0);
  let shown = 0, active = !!root, say = '', lastKey = '';

  const $ = sel => root && root.querySelector(sel);
  // the shop window holds the first three stamps off the press
  const SHOW = 3, all = typeof Features !== 'undefined' ? Features.LIST.length : 24;
  const row = $('.ld-slots');
  if (row && !row.children.length) for (let i = 0; i < SHOW; i++) row.append(document.createElement('i'));
  if (row) for (const s of row.children) s.className = 'ld-slot';
  const count = $('.ld-count'), status = $('.ld-say'), slots = root ? [...root.querySelectorAll('.ld-slot')] : [];
  let printed = 0;
  // ?ldhold=0.4 keeps the screen at that much done, for looking at it (1 = all in, waiting for the tap)
  const hold = (() => { const v = new URLSearchParams(location.search).get('ldhold'); return v == null ? null : Math.max(0, Math.min(1, +v || 0)); })();
  const bar = $('.ld-row'), go = $('.ld-go'), mark = $('.ld-mark');

  // today's date on the subtitle, from the start (the app's own date only comes in with ready())
  const pad = n => String(n).padStart(2, '0'), now = new Date(), dateEl = $('.ld-date');
  if (dateEl) dateEl.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;

  function paint() {
    if (!root) return;
    let p = 0;
    for (const k in STEPS) p += STEPS[k] * done[k];
    p = Math.max(shown, Math.min(1, p / total)); shown = p;
    if (hold != null) p = hold;
    root.style.setProperty('--p', p.toFixed(3));           // the lamp comes up with it
    if (count) count.textContent = `${Math.round(p * 100)}%`;
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
  // a slot's canvas, as big as the biggest the slot gets on this screen (it is small: a stamp in a shop window)
  function sheet(s, cls, src) {
    const cv = document.createElement('canvas'), w = Math.round(Math.max(s.clientWidth, 48) * Math.min(3, devicePixelRatio || 1) * 1.25);
    cv.width = w; cv.height = Math.round(w * src.height / src.width); cv.className = cls;
    const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, cv.width, cv.height);
    return cv;
  }
  /** a stamp came off the press: the first few seep onto the blanks in the shop window, the rest are only counted */
  function stamp(i, src) {
    if (!src) return;
    const s = slots[printed++];
    if (s && !s.querySelector('canvas.ink')) { s.append(sheet(s, 'ink', src)); s.classList.add('in'); }
    talk(`${SAY.stamps} ${pad(Math.min(printed, all))} / ${pad(all)}`);
  }
  /** blank sheets in the window before anything is printed */
  function blanks(src) {
    for (const s of slots) if (!s.querySelector('canvas.blank')) s.prepend(sheet(s, 'blank', src));
  }

  // ---- the scene: the pictures and where their glass is come from scene/index.json; everything is placed in px from
  // the screen's size, the house standing on the swell of the ground, the lamp to its left, the pillar box to its right
  const scene = $('.ld-scene'), part = {};
  const px = (el, x, y, w, h) => { if (el) Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); };
  // where each stamp stands in the window: across (0..1), up or down (of the pane's height), its turn, its size
  const STAND = [[0.5, 0.03, -3, 1], [0.19, -0.02, 6, 0.9], [0.81, 0.01, -7, 0.94]];
  function place() {
    if (!scene || !part.house) return;
    const W = innerWidth, H = innerHeight, up = W <= H, { house, lamp, mailbox } = part;
    // the ground: a wide swell whose top is a little right of the middle
    const gy = H - H * (up ? 0.115 : 0.105), gw = W * 2.4, gh = H * 0.5, gx = W * 0.56;
    px($('.ld-ground'), gx - gw / 2, gy, gw, gh);
    const drop = x => gh / 2 * (1 - Math.sqrt(Math.max(0, 1 - ((x - gx) / (gw / 2)) ** 2)));   // how far the swell has fallen at x
    const ha = house.w / house.h, hh = Math.min(H * (up ? 0.37 : 0.43), W * (up ? 0.7 : 0.4) / ha), hw = hh * ha;
    const hx = W * (up ? 0.58 : 0.55) - hw / 2, hy = gy + hh * 0.015 - hh;
    px($('.ld-house'), hx, hy, hw, hh);
    const pane = house.panes[0];
    if (pane && row) {
      const [a, b, c, d] = pane, pw = c * hw, ph = d * hh;
      px(row, a * hw, b * hh, pw, ph);
      const sh = Math.min(ph * 0.72, pw * 0.44);
      slots.forEach((s, i) => {
        const k = STAND[i][3], h = sh * k, w = h * 0.8;
        Object.assign(s.style, { width: w + 'px', left: STAND[i][0] * pw - w / 2 + 'px', top: ph * (0.53 + STAND[i][1]) - h / 2 + 'px',
          transform: `rotate(${STAND[i][2]}deg)`, zIndex: String(5 - i) });
      });
    }
    const sign = $('.ld-sign');
    if (sign) {
      sign.style.display = house.sign ? '' : 'none';
      if (house.sign) { const [a, b, c, d] = house.sign; px(sign, a * hw, b * hh, c * hw, d * hh); sign.style.fontSize = Math.max(9, d * hh * 0.62) + 'px'; }
    }
    if (lamp) {
      const lh = hh * (up ? 1.2 : 1.22), lw = lh * lamp.w / lamp.h;
      const cx = up ? Math.max(lw * 0.42, hx - lw * 0.5) : hx - hw * 0.34, lx = cx - lw / 2, ly = gy + drop(cx) + lh * 0.012 - lh;
      const el = $('.ld-lamp'); px(el, lx, ly, lw, lh); el.style.transform = lamp.flip ? 'scaleX(-1)' : '';
      const g = lamp.panes[0] || [0.4, 0.1, 0.2, 0.1];
      let ax = g[0] + g[2] / 2; if (lamp.flip) ax = 1 - ax;
      const ex = lx + ax * lw, ey = ly + (g[1] + g[3] / 2) * lh, r = lh * (up ? 0.74 : 0.8);
      px($('.ld-halo'), ex - r, ey - r, r * 2, r * 2);
      const pwid = lh * 1.1, phei = lh * 0.13;
      px($('.ld-pool'), ex - pwid / 2, gy + drop(ex) + phei * 0.1 - phei / 2 + phei * 0.4, pwid, phei);
    }
    if (mailbox) {
      const mh = hh * 0.36, mw = mh * mailbox.w / mailbox.h;
      const cx = up ? Math.min(W - mw * 0.4, hx + hw + mw * 0.3) : hx + hw + hw * 0.2;
      px($('.ld-box'), cx - mw / 2, gy + drop(cx) + mh * 0.02 - mh, mw, mh);
    }
  }
  if (scene) (async () => {
    try {
      const list = await (await fetch('scene/index.json')).json();
      for (const e of list) part[e.key] = e;
      if (!part.house) return;
      const url = (e, f) => `${f}?v=${e.v}`, waits = [];
      const set = (sel, e) => {
        const box = $(sel); if (!box || !e) { if (box) box.style.display = 'none'; return; }
        const img = box.querySelector('img'); img.src = url(e, e.file); waits.push(img.decode ? img.decode().catch(() => {}) : Promise.resolve());
        for (const el of box.querySelectorAll('.ld-glass, .ld-lit')) {
          if (!e.win) { el.style.display = 'none'; continue; }
          el.style.webkitMaskImage = el.style.maskImage = `url("${url(e, e.win)}")`;
        }
        if (e.win) waits.push(new Promise(res => { const m = new Image(); m.onload = m.onerror = res; m.src = url(e, e.win); }));
      };
      set('.ld-house', part.house); set('.ld-lamp', part.lamp); set('.ld-box', part.mailbox);
      place();
      addEventListener('resize', () => { if (active) place(); });
      await Promise.all(waits);
      scene.classList.add('on');
    } catch {}
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
    return new Promise(res => go.addEventListener('click', () => {
      go.disabled = true; go.classList.add('down');
      if (typeof Kit !== 'undefined') try { Kit.audio(); Kit.thump(0.7); } catch {}
      res();
    }, { once: true }));
  }

  /** the curtain: an iris closes on the print shop (on the button, once it was pressed) and opens on the app underneath */
  function finish() {
    if (!active) return Promise.resolve();
    step('pages', 1); for (const k in STEPS) done[k] = 1; paint(); talk(SAY.done);
    const pressed = go && go.classList.contains('down');
    return new Promise(res => setTimeout(async () => {
      active = false;
      const W = innerWidth, H = innerHeight, b = pressed ? go.getBoundingClientRect() : null;
      const x = b ? b.left + b.width / 2 : W / 2, y = b ? b.top + b.height / 2 : H / 2, R = Math.ceil(Math.hypot(Math.max(x, W - x), Math.max(y, H - y)));
      const at = `${x.toFixed(0)}px ${y.toFixed(0)}px`;
      const out = reduce ? root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' })
        : root.animate([{ clipPath: `circle(${R}px at ${at})` }, { clipPath: `circle(0px at ${at})` }],
          { duration: 720, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      document.body.classList.add('loaded');
      await out.finished.catch(() => {});
      root.remove(); res();
    }, reduce ? 150 : pressed ? 160 : 380));
  }
  /** the debugging views (?gallery, ?sheet=demo, studio params) don't wait for it */
  function skip() { active = false; if (root) root.remove(); document.body.classList.add('loaded'); }

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
