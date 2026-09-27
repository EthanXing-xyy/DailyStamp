// The loading screen: a print shop that stays up until everything is in (fonts, artwork, the home's eleven stamps,
// every page), so nothing loads, janks or pops in after it. Paper and ink only: a fine-grained paper sheet, the title, a
// line with the date, and eleven perforated blanks that the home's real stamps seep onto as they come off the press;
// they are the only colour on it. Under them, what the press is doing and how far it has got. When all is in, a
// postmark (date and solar term) strikes the title once and the way in (进入邮局 →) fades up where the status was; the
// app opens only on its tap, the iris closing on the button. One thing moves at a time and nothing bounces: the user
// found a screen of bobbing, springing parts on a Ben-Day field cheap.
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
  // one blank per function on the home (web/app/features.js), which the home's stamps seep onto as they are printed
  const row = $('.ld-slots');
  if (row && !row.children.length) for (let i = 0; i < (typeof Features !== 'undefined' ? Features.LIST.length : 11); i++) row.append(document.createElement('i'));
  if (row) for (const s of row.children) s.className = 'ld-slot';
  const count = $('.ld-count'), status = $('.ld-say'), slots = root ? [...root.querySelectorAll('.ld-slot')] : [];
  const bar = $('.ld-row'), go = $('.ld-go'), mark = $('.ld-mark');

  // today's date on the subtitle, from the start (the app's own date only comes in with ready())
  const pad = n => String(n).padStart(2, '0'), now = new Date(), dateEl = $('.ld-date');
  if (dateEl) dateEl.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;

  function paint() {
    if (!root) return;
    let p = 0;
    for (const k in STEPS) p += STEPS[k] * done[k];
    p = Math.max(shown, Math.min(1, p / total)); shown = p;
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
  /** a stamp came off the press: it seeps onto the blank in slot i */
  function stamp(i, src) {
    const s = slots[i]; if (!s || !src) return;
    let cv = s.querySelector('canvas.ink');
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'ink'; s.append(cv); }
    const w = Math.round(s.clientWidth * Math.min(2, devicePixelRatio || 1)) || 60, h = Math.round(w * src.height / src.width);
    cv.width = w; cv.height = h; cv.getContext('2d').drawImage(src, 0, 0, w, h);
    s.classList.add('in');
    talk(`${SAY.stamps} ${pad(slots.filter(x => x.classList.contains('in')).length)} / ${pad(slots.length)}`);
  }
  /** blank sheets for the slots before anything is printed */
  function blanks(src) {
    for (const s of slots) if (!s.querySelector('canvas.blank')) {
      const cv = document.createElement('canvas'), w = Math.round(s.clientWidth * Math.min(2, devicePixelRatio || 1)) || 60;
      const h = Math.round(w * src.height / src.width);
      cv.width = w; cv.height = h; cv.getContext('2d').drawImage(src, 0, 0, w, h); cv.className = 'blank'; s.prepend(cv);
    }
  }

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
    for (const k in STEPS) done[k] = 1; paint(); talk(SAY.done);
    if (mark) {
      const [, , m, d] = /(\d+)-(\d+)-(\d+)/.exec(date || '') || [];
      const sp = mark.querySelectorAll('span'), b = mark.querySelector('b');
      if (m && b) b.textContent = `${pad(+m)}.${pad(+d)}`;
      if (term && sp[1]) sp[1].textContent = term;
    }
    root.classList.add('ready'); root.setAttribute('aria-busy', 'false');
    go.disabled = false;
    setTimeout(() => { try { go.focus({ preventScroll: true }); } catch {} }, 950);
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
