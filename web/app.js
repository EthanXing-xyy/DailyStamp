// 每日一枚 studio: state, UI, stamp render pipeline, leaflets, export, the 32-stamp sheet
(async function () {
  const $ = id => document.getElementById(id);
  const front = $('front'), back = $('back'), flip = $('flip');
  const edges = [...flip.querySelectorAll('.edge')];
  const frontLight = flip.querySelector('.front-light'), backLight = flip.querySelector('.back-light');
  const PREVIEW = 0.75;                                   // preview stamps render at 900 x 1125
  const EXPORT = 2;                                       // downloads: 2400 x 3000 stamp on a desk
  const localDate = () => {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const state = {
    phrase: '周一', en: 'monday', no: 1, date: localDate(),
    palette: 'Shot Marilyn', layout: 'gen', seed: Math.floor(Math.random() * 1e9), shift: 0, emblem: 'auto', misregister: true, grain: true, side: 'front',
  };
  const params = new URLSearchParams(location.search);
  const useOpening = !params.has('gallery') && params.get('sheet') !== 'demo' && ![...params.keys()].some(k => k in state);
  if (!useOpening) document.body.classList.remove('daily-opening');
  // no params: the app. Its pages (the home sheets, today's stamp, the studio) live in location.hash
  let view = useOpening ? (location.hash.slice(1) || 'home') : 'studio';
  // the other functions live in layers of their own (web/pages.js): a section each, with its way home
  for (const key of Pages.keys()) {
    const sec = document.createElement('section'); sec.className = 'layer'; sec.id = 'layer-' + key;
    sec.innerHTML = '<a class="to-home" href="#">← 首页</a>'; document.body.prepend(sec);
  }
  if (!['home', 'today', 'studio', ...Pages.keys()].includes(view)) view = 'home';
  if (Pages.has(view)) { document.body.classList.add('daily-layer'); $('layer-' + view).classList.add('on'); }
  if (useOpening) document.body.classList.add('app-mode');
  if (view === 'home') document.body.classList.add('daily-home');
  if (view === 'studio') document.body.classList.remove('daily-opening');
  // the landing title fades in once its own face is in, instead of swapping glyphs from a fallback font
  document.fonts.load('40px "DC Phrase"', '每日一枚').catch(() => {}).then(() => document.body.classList.add('daily-head'));
  const DAILY_MESSAGES = [
    '今天也可以从一件小事开始。',
    '慢一点，仍然是在往前走。',
    '先照顾好自己，再处理世界。',
    '留一点力气，给今天的好事。',
    '你可以按自己的节奏来。',
    '不必急着把一切想明白。',
    '认真生活的人，也可以休息。',
    '今天有今天自己的光。',
    '先做眼前这一小步就好。',
    '允许今天和想象中不一样。',
    '把注意力放回喜欢的事物上。',
    '你已经走过了许多普通的一天。',
  ];
  // Keep the message source in one place so it can later be replaced with an LLM request.
  async function getDailyMessage(date) {
    const [y, m, d] = date.split('-').map(Number);
    const day = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    return DAILY_MESSAGES[day % DAILY_MESSAGES.length];
  }
  let dailyMessage = '';
  function revealOpening() {
    if (!useOpening || !document.body.classList.contains('daily-printed') || document.body.classList.contains('daily-revealed')) return;
    $('opening-message').textContent = dailyMessage;
    $('opening-enter').tabIndex = 0;
    $('opening-enter').removeAttribute('aria-hidden');
    document.body.classList.add('daily-revealed');
  }
  $('opening-enter').onclick = () => {
    history.replaceState(history.state, '', '#studio'); view = 'studio';
    document.body.classList.remove('daily-opening', 'daily-ready', 'daily-printed', 'daily-revealed');
    flip.setAttribute('aria-label', '左键拖动平面旋转，按住滚轮拖动空间翻转，轻点或双击翻面');
    flip.title = '左键拖动平面旋转；按住滚轮拖动空间翻转；轻点或双击翻面';
  };

  let palettes = [], emblems = [];
  const leaflets = new Map();                             // phrase -> leaflet json ({status})
  const palByName = name => palettes.find(p => p.name === (name || state.palette)) || palettes[0];

  // ---------- data
  async function loadPalettes() { palettes = Colors.PALETTES; }
  async function loadEmblems() {
    const list = await (await fetch('/api/emblems')).json();
    const known = new Map(emblems.map(e => [e.id, e]));
    emblems = list.map(e => known.get(e.id) && known.get(e.id).status === e.status ? known.get(e.id) : e);
    const cut = await fetch('/emblems/cut/index.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}));
    await Promise.all(emblems.filter(e => e.status === 'ready' && !e.img).map(async e => {
      // loaded, not decoded: with its masks cut ahead of time the drawing itself is hardly drawn, and 24 decoded 1024 px
      // images held at once are ~100 MB a phone can't spare (the browser decodes one when it's drawn)
      const img = new Image(); img.src = '/' + e.file + '?v=' + encodeURIComponent(e.created);
      try { await new Promise((ok, no) => { img.onload = ok; img.onerror = no; }); e.img = img; } catch {}
      const c = cut[e.id];                                 // its masks cut ahead of time, if cut from this very drawing
      if (e.img && c && c.from === e.created) {
        await Print.loadCut(e, '/emblems/cut/' + encodeURIComponent(e.id), c.grows, e.created);
        if (c.thumb) e.thumb = `/emblems/cut/${encodeURIComponent(e.id)}.t.png?v=${encodeURIComponent(e.created)}`;   // the silk-screen picker's
      }
    }));
  }
  // the Chinese faces come as subsets (fonts/sub/fonts.css): asking for a text loads just the faces that hold it
  async function loadFonts(text = '每日一枚 DAILY 09') {
    const fams = ['DC Brand', 'DC Phrase', 'DC Black', 'DC Caps', 'DC CapsMed', 'DC Cjk', 'DC CjkMed'];
    await Promise.all(fams.map(f => document.fonts.load(`40px "${f}"`, text || ' ').catch(() => {})));
  }
  async function loadLeaflet(phrase) {
    phrase = phrase.trim(); if (!phrase) return null;
    const have = leaflets.get(phrase);
    if (have && have.status === 'ready') return have;
    const r = await (await fetch('/api/leaflet?phrase=' + encodeURIComponent(phrase))).json();
    leaflets.set(phrase, r);
    return r;
  }

  const emblemFor = st => {
    if (st.emblem === 'none') return null;
    if (String(st.emblem).startsWith('term:')) return Terms.icon(st.emblem.slice(5));   // the solar-term issues
    if (st.emblem === 'auto') return emblems.find(e => e.status === 'ready' && e.phrase === st.phrase.trim()) || null;
    return emblems.find(e => e.id === st.emblem && e.status === 'ready') || null;
  };
  const leafletFor = st => { const l = leaflets.get(st.phrase.trim()); return l && l.status === 'ready' ? l : null; };
  const specOf = st => {
    const l = leafletFor(st) || Leaflet.fallback(st.phrase.trim(), st.en.trim());
    // the price tag on the stamp's corner comes with the leaflet (older leaflets without one borrow the placeholder's)
    return { phrase: st.phrase.trim() || '…', en: st.en.trim(), no: st.no, date: st.date, slogan: l.slogan };
  };
  const optsOf = (st, scale) => ({ scale, layout: st.layout, seed: st.seed, shift: st.shift, misregister: st.misregister, grain: st.grain });

  // extra.emblem hands in an emblem object directly (the solar-term pages print with a term icon).
  // A plain front is drawn once: the home, the post tray, the collage tray and the album all ask for the same stamps, so
  // the biggest copy drawn so far is kept and a smaller ask gets it scaled down. Callers always get a canvas of their own.
  const fronts = new Map();
  const copyAt = (src, scale) => {
    const c = U.canvas(Math.round(Stamp.BW * scale), Math.round(Stamp.BH * scale)), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
    c.layout = src.layout; c.embossMask = src.embossMask;
    return c;
  };
  function makeFront(st, scale, extra = {}) {
    const { emblem, ...rest } = extra;
    const spec = specOf(st), em = emblem !== undefined ? emblem : emblemFor(st);
    const key = emblem === undefined && !Object.keys(rest).length &&
      JSON.stringify([spec, st.palette, em ? em.id : null, optsOf(st, 0)]);
    const have = key && fronts.get(key);
    if (have && have.scale >= scale - 1e-9) return copyAt(have.cv, scale);
    const out = Stamp.renderFront(spec, palByName(st.palette), em, { ...optsOf(st, scale), ...rest });
    if (key) {
      fronts.delete(key); fronts.set(key, { scale, cv: out });
      // about 60 MB of kept stamps at most, the oldest go first
      let px = 0; for (const f of fronts.values()) px += f.cv.width * f.cv.height;
      for (const [k, f] of fronts) { if (px <= 15e6 || fronts.size <= 1) break; px -= f.cv.width * f.cv.height; fronts.delete(k); }
      return copyAt(out, scale);
    }
    return out;
  }
  const collectToday = () => Album.add({ id: 'today:' + state.date, kind: 'today', date: state.date, st: { ...state, side: 'front' } }, { keep: true });
  function makeBack(st, scale, fr) {
    const l = leafletFor(st) || Leaflet.fallback(st.phrase.trim(), st.en.trim());
    return Stamp.renderBack(specOf(st), palByName(st.palette), l, { ...optsOf(st, scale), embossFrom: fr && fr.embossMask });
  }

  // Axes handles circular rotation and drag inertia; CSS keeps the existing printed faces in 3D.
  const rotation = new eg.Axes({
    yaw: { range: [0, 360], circular: true },
    pitch: { range: [0, 360], circular: true },
    roll: { range: [0, 360], circular: true },
  }, { deceleration: 0.0018 });
  // Windows 8 style touch feedback on the landing stamp (U.presser): it sinks and tips toward the finger
  const TILT = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 7;
  const presser = U.presser(() => updateRotation({ pos: rotation.get() })), press = presser.now;
  const updateRotation = ({ pos }) => {
    const pushed = press.d > 1e-3;
    const tx = -press.y * TILT * press.d, ty = press.x * TILT * press.d;
    const sc = 1 - 0.035 * press.d * (1 - 0.55 * Math.min(1, Math.hypot(press.x, press.y)));
    flip.style.transform = (pushed ? `rotateY(${ty.toFixed(2)}deg) rotateX(${tx.toFixed(2)}deg) scale(${sc.toFixed(4)}) ` : '') +
      `rotateZ(${pos.roll}deg) rotateX(${pos.pitch}deg) rotateY(${pos.yaw}deg)`;
    state.side = Math.cos(pos.pitch * Math.PI / 180) * Math.cos(pos.yaw * Math.PI / 180) < 0 ? 'back' : 'front';
    const yaw = pos.yaw * Math.PI / 180, pitch = pos.pitch * Math.PI / 180, roll = pos.roll * Math.PI / 180;
    let nx = Math.cos(roll) * Math.sin(yaw) + Math.sin(roll) * Math.sin(pitch) * Math.cos(yaw);
    let ny = Math.sin(roll) * Math.sin(yaw) - Math.cos(roll) * Math.sin(pitch) * Math.cos(yaw);
    let nz = Math.cos(pitch) * Math.cos(yaw);
    if (pushed) {                                          // the press tips the face, so the light moves with it
      const a = tx * Math.PI / 180, b = ty * Math.PI / 180;
      const y1 = ny * Math.cos(a) - nz * Math.sin(a), z1 = ny * Math.sin(a) + nz * Math.cos(a);
      [nx, ny, nz] = [nx * Math.cos(b) + z1 * Math.sin(b), y1, -nx * Math.sin(b) + z1 * Math.cos(b)];
    }
    const light = nx * -0.38 + ny * -0.5 + nz * 0.78;
    flip.style.setProperty('--front-bright', (0.64 + 0.39 * Math.max(0, light)).toFixed(3));
    flip.style.setProperty('--back-bright', (0.64 + 0.39 * Math.max(0, -light)).toFixed(3));
    flip.style.setProperty('--edge-bright', (0.78 + 0.25 * (Math.abs(nx) + Math.abs(ny)) / Math.SQRT2).toFixed(3));
    const shine = (x, y, z) => (0.24 * Math.pow(Math.max(0, x * -0.20 + y * -0.27 + z * 0.94), 12)).toFixed(3);
    flip.style.setProperty('--front-shine', shine(nx, ny, nz));
    flip.style.setProperty('--back-shine', shine(-nx, -ny, -nz));
    frontLight.style.setProperty('--shine-x', `${30 - nx * 55}%`);
    frontLight.style.setProperty('--shine-y', `${25 - ny * 55}%`);
    backLight.style.setProperty('--shine-x', `${30 + nx * 55}%`);
    backLight.style.setProperty('--shine-y', `${25 + ny * 55}%`);
  };
  rotation.on('change', updateRotation);
  updateRotation({ pos: rotation.get() });
  const rimRoll = new eg.Axes.RotatePanInput(flip, {
    inputType: ['mouse'], inputButton: ['left'], scale: [0.35, 0.35], preventClickOnDrag: true,
  });
  const centerRoll = new eg.Axes.PanInput(flip, {
    inputType: ['mouse'], inputButton: ['left'], scale: [0.225, 0], preventClickOnDrag: true,
  });
  rotation.connect('roll', rimRoll).connect('roll', centerRoll);
  centerRoll.disable();
  rotation.connect(['yaw', 'pitch'], new eg.Axes.PanInput(flip, {
    inputType: ['mouse'], inputButton: ['middle'], scale: [0.225, -0.225], preventClickOnDrag: true,
  }));
  rotation.connect(['yaw', 'pitch'], new eg.Axes.PanInput(flip, {
    inputType: ['touch'], scale: [0.225, -0.225], preventClickOnDrag: true,
  }));
  flip.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
  flip.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

  const landing = () => useOpening && document.body.classList.contains('daily-opening');
  let down = null, dragged = false, yawBefore = 0;
  flip.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY }; dragged = false;
    if (landing() && (e.pointerType !== 'mouse' || e.button === 0)) presser.down(presser.point(flip, e.clientX, e.clientY));
    if (e.pointerType === 'mouse' && e.button === 0) {
      const r = flip.getBoundingClientRect();
      const nearCenter = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) < Math.min(r.width, r.height) * 0.16;
      if (nearCenter) { rimRoll.disable(); centerRoll.enable(); }
      else { centerRoll.disable(); rimRoll.enable(); }
    }
  });
  window.addEventListener('pointermove', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) dragged = true;
    if (down && presser.held) {                            // the tilt follows the finger; a drag lets go of the press
      if (dragged) presser.release(); else presser.aim(presser.point(flip, e.clientX, e.clientY));
    }
  });
  window.addEventListener('pointerup', () => { down = null; presser.release(); });
  window.addEventListener('pointercancel', () => { down = null; dragged = true; presser.release(); });
  const turnOver = () => rotation.setTo({ yaw: rotation.get().yaw + 180 }, 650);
  flip.addEventListener('click', e => {
    if (dragged) return;
    // a double click turns over from wherever the stamp lay before its first click (that click may already be turning it)
    if (e.detail <= 1) yawBefore = rotation.get().yaw;
    if (e.detail >= 2) rotation.setTo({ yaw: Math.round((yawBefore + 180) / 180) * 180, pitch: 0 }, 650);
    else if (useOpening && document.body.classList.contains('daily-opening')) revealOpening();
    else turnOver();
  });
  flip.addEventListener('keydown', e => {
    const steps = { ArrowLeft: { yaw: -15 }, ArrowRight: { yaw: 15 }, ArrowUp: { pitch: -15 }, ArrowDown: { pitch: 15 }, q: { roll: -15 }, e: { roll: 15 } };
    if (steps[e.key]) { e.preventDefault(); rotation.setBy(steps[e.key], 180); }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (landing()) { if (!e.repeat) { presser.down(); presser.release(); } revealOpening(); } else turnOver();
    }
  });

  // ---------- render
  const put = (cv, src) => { cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); };
  // A thin continuous rim follows the perforations; filled copies would look like stacked stamps.
  function dressEdges(fr) {
    const mask = document.createElement('canvas');
    mask.width = Math.round(fr.width / 2); mask.height = Math.round(fr.height / 2);
    const mg = mask.getContext('2d');
    mg.drawImage(fr, 0, 0, mask.width, mask.height);
    const pixels = mg.getImageData(0, 0, mask.width, mask.height).data;
    const rim = document.createElement('canvas');
    rim.width = mask.width; rim.height = mask.height;
    const rg = rim.getContext('2d'), image = rg.createImageData(rim.width, rim.height);
    for (let y = 0; y < rim.height; y++) for (let x = 0; x < rim.width; x++) {
      const p = (y * rim.width + x) * 4, alpha = pixels[p + 3];
      if (!alpha) continue;
      const inner = Math.min(
        x ? pixels[p - 1] : 0, x + 1 < rim.width ? pixels[p + 7] : 0,
        y ? pixels[p - rim.width * 4 + 3] : 0, y + 1 < rim.height ? pixels[p + rim.width * 4 + 3] : 0);
      image.data[p] = 226; image.data[p + 1] = 220; image.data[p + 2] = 207;
      image.data[p + 3] = alpha - inner;
    }
    rg.putImageData(image, 0, 0);
    for (const edge of edges) {
      edge.width = rim.width; edge.height = rim.height;
      edge.getContext('2d').drawImage(rim, 0, 0);
    }
    mg.globalCompositeOperation = 'source-in';
    mg.fillStyle = '#fff'; mg.fillRect(0, 0, mask.width, mask.height);
    const maskUrl = `url("${mask.toDataURL('image/png')}")`;
    for (const light of [frontLight, backLight]) {
      light.style.maskImage = maskUrl;
      light.style.webkitMaskImage = maskUrl;
    }
  }

  // An unprinted stamp goes on the desk at once (paper needs no fonts or artwork), so nothing pops in once they load.
  const blankSheet = Stamp.blank(PREVIEW, 1);
  put(front, blankSheet); put(back, blankSheet); dressEdges(blankSheet);

  // One stamp prints onto its blank sheet plate by plate (colour, key, postmark, type), each seeping in with smoothstep
  // over D ms and starting while the one before is two-thirds in. Same length and easing for all, so an earlier plate is
  // always at least as solid as a later one (each snapshot contains the ones before). Used by the landing and the home.
  function printIn(cv, st, { D = 900, debug = null, onDone = () => {} } = {}) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const ease = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
    const AT = [0, D * 2 / 3, D * 4 / 3, D * 2];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, END = reduce ? 300 : AT[3] + D;
    const frame = t => {
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
      g.drawImage(st.blank, 0, 0);
      if (reduce) { g.globalAlpha = ease(t / 300); g.drawImage(st.final, 0, 0); return; }
      const a = AT.map(s => ease((t - s) / D)), p = st.pmAt;
      if (a[0] > 0) { g.globalAlpha = a[0]; g.drawImage(st.art, 0, 0); }
      if (a[1] > 0) { g.globalAlpha = a[1]; g.drawImage(st.key, 0, 0); }
      if (a[2] > 0) {                                                   // the postmark settles from a touch larger
        const sc = 1.03 - 0.03 * a[2];
        g.save(); g.globalAlpha = a[2]; g.globalCompositeOperation = p.blend;
        g.translate(p.x, p.y); g.scale(sc, sc); g.translate(-p.x, -p.y); g.drawImage(st.pmLayer, 0, 0); g.restore();
      }
      if (a[3] > 0) { g.globalAlpha = a[3]; g.drawImage(st.final, 0, 0); }
    };
    const done = () => { frame(END); onDone(); };
    if (debug !== null) { frame(debug); if (debug >= END) done(); return; }
    const t0 = performance.now();
    const tick = now => { const t = now - t0; if (t >= END) return done(); frame(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  // Landing page: the first stamp prints onto the blank sheet already on the desk.
  let pressFirst = false, pressing = false, pressMissed = false;
  const pressDebug = params.has('pressdebug') ? +params.get('pressdebug') : null;   // freeze at <ms> (screenshots)
  function pressIn(st) {
    pressing = true;
    printIn(front, st, { debug: pressDebug, onDone: () => {
      dressEdges(st.final); pressing = false;
      document.body.classList.add('daily-printed');
      collectToday();
      if (pressMissed) { pressMissed = false; render(); }
    } });
  }

  const renderWaiters = [];                               // resolved when the queued render has drawn
  const rendered = () => new Promise(r => renderWaiters.push(r));
  let pending = false, dirty = false, holdFront = false;   // holdFront: today's stamp waits unprinted under the loading screen
  function render() {
    if (pending) { dirty = true; return; }
    pending = true;
    requestAnimationFrame(() => {
      const t0 = performance.now();
      const press = pressFirst; pressFirst = false;
      const fr = makeFront(state, PREVIEW, press ? { stages: true } : {}), bk = makeBack(state, PREVIEW, fr);
      put(back, bk);
      if (press) pressIn(fr.stages);
      else if (holdFront) {}
      else if (pressing) pressMissed = true;                           // don't cut into the printing; redraw after
      else { put(front, fr); dressEdges(fr); }
      if (!$('stage')) return;                                         // the review helpers (?gallery) swapped the page out
      const pal = palByName(), desk = Stamp.deskColor(pal), lightDesk = U.lum(desk) > 0.35;
      $('stage').style.setProperty('--desk', desk);
      $('stage').style.setProperty('--desk-ink', lightDesk ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.5)');
      $('stage').style.setProperty('--opening-ink', lightDesk ? 'rgba(20,18,17,.76)' : 'rgba(255,255,255,.84)');
      const e = emblemFor(state), l = leafletFor(state);
      const lay = Layouts.NAMES.find(n => n.key === fr.layout);
      $('stage-note').textContent = `${lay ? lay.cn : ''} · ${state.palette} · ${e ? '徽章 ' + (e.concept || e.phrase) : '程序徽章'} · ${l ? l.name : '说明书样稿'} · ${Math.round(performance.now() - t0)} ms`;
      pending = false;
      if (dirty) { dirty = false; render(); } else renderWaiters.splice(0).forEach(f => f());
    });
  }
  // ---------- leaflet status (leaflets are written ahead of time; the app never calls a model)
  async function refreshLeaflet({ draw = true } = {}) {
    const phrase = state.phrase.trim();
    const l = await loadLeaflet(phrase);
    if (phrase !== state.phrase.trim()) return;
    $('leaf-status').textContent = l && l.status === 'ready' ? `「${l.name}」· 存在 leaflets/` : '还没有正式说明书，背面先用样稿';
    if (draw) render();
  }

  // ---------- UI: inputs
  let phraseTimer = null;
  const bind = (id, key, fn = v => v) => $(id).addEventListener('input', e => {
    state[key] = fn(e.target.value);
    if (key === 'phrase') { if (state.emblem !== 'auto') state.emblem = 'auto'; drawEmblems(); clearTimeout(phraseTimer); phraseTimer = setTimeout(refreshLeaflet, 350); }
    if (key === 'phrase' || key === 'en') loadFonts(state[key]).then(render);
    if (key === 'phrase' || key === 'no') drawLayouts();
    render();
  });
  bind('phrase', 'phrase'); bind('en', 'en'); bind('no', 'no', v => Math.max(1, parseInt(v) || 1)); bind('date', 'date');
  for (const [id, key] of [['misreg', 'misregister'], ['grain', 'grain']])
    $(id).addEventListener('change', e => { state[key] = e.target.checked; render(); });

  // palettes
  function drawPalettes() {
    $('palettes').innerHTML = palettes.map(p => `<button class="sw" data-name="${p.name}" title="${p.cn} · ${p.name} — ${p.note}" aria-pressed="${p.name === state.palette}">${p.c.map(c => `<i style="background:${c}"></i>`).join('')}<b style="background:${p.ink}"></b></button>`).join('');
    $('palettes').querySelectorAll('.sw').forEach(b => b.onclick = () => { state.palette = b.dataset.name; drawPalettes(); drawEmblems(); render(); });
    const p = palByName(); $('pal-note').textContent = `${p.cn} · ${p.note}`;
  }
  $('pal-shift').onclick = () => { state.shift = (state.shift + 1) % 4; drawEmblems(); render(); };

  // layouts
  function drawLayouts() {
    $('layouts').innerHTML = Layouts.NAMES.map(n => `<button data-k="${n.key}" aria-pressed="${state.layout === n.key}"${n.key === 'gen' ? ' title="按设计规则随机排版，每一枚都不一样；点“再生成”换一版"' : ''}>${n.cn}</button>`).join('');
    $('layouts').querySelectorAll('button').forEach(b => b.onclick = () => { state.layout = b.dataset.k; drawLayouts(); render(); });
  }
  $('lay-random').onclick = () => { state.layout = 'gen'; state.seed = Math.floor(Math.random() * 1e9); drawLayouts(); render(); };

  $('pal-random').onclick = () => { const others = palettes.filter(p => p.name !== state.palette); state.palette = others[Math.floor(Math.random() * others.length)].name; drawPalettes(); drawEmblems(); render(); };

  // emblems
  function emblemThumb(e, pal, size = 128) {
    const cv = U.canvas(size, size), g = cv.getContext('2d');
    g.fillStyle = Stamp.PAPER; g.fillRect(0, 0, size, size);
    if (e) {
      const [mInk, mAcc, mBand] = Print.channelMasks(e);
      const c = Colors.roles(pal, state.shift), o = size * 0.12, s = Math.round(size * 0.76);
      // each plate is tinted at thumbnail size, not at the emblem's 1024 px
      const tint = (m, col) => { const t = U.canvas(s, s), tg = t.getContext('2d'); tg.drawImage(m, 0, 0, s, s); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = col; tg.fillRect(0, 0, s, s); return t; };
      g.fillStyle = c[0]; g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fill();
      g.drawImage(tint(Print.silhouette(e, 0.028), Stamp.PAPER), o, o);
      for (const [m, col] of [[mBand, c[1]], [mAcc, c[2]], [mInk, pal.ink]]) g.drawImage(tint(m, col), o, o);
    }
    return cv;
  }
  function drawEmblems() {
    const pal = palByName(), cur = emblemFor(state);
    const box = $('emblems'); box.innerHTML = '';
    const none = document.createElement('button'); none.className = 'em none'; none.textContent = '编号'; none.title = '程序徽章（放射线 + 编号）';
    none.setAttribute('aria-pressed', state.emblem === 'none' || (state.emblem === 'auto' && !cur));
    none.onclick = () => { state.emblem = 'none'; drawEmblems(); render(); };
    box.appendChild(none);
    for (const e of emblems) {
      const b = document.createElement('button');
      if (e.status !== 'ready') { b.className = 'em pending'; b.textContent = e.status === 'failed' ? '失败' : '画中…'; b.title = e.phrase; box.appendChild(b); continue; }
      b.className = 'em'; b.title = `${e.phrase}${e.concept ? ' — ' + e.concept : ''}`;
      b.setAttribute('aria-pressed', !!cur && cur.id === e.id);
      b.appendChild(emblemThumb(e, pal));
      const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = e.phrase; b.appendChild(tag);
      b.onclick = () => { state.emblem = e.id; drawEmblems(); render(); };
      box.appendChild(b);
    }
  }

  // ---------- export
  const download = (canvas, name) => canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png');
  const fname = () => `${state.date}-${state.phrase.trim() || 'stamp'}-${state.palette.replace(/\s+/g, '')}`;
  const deskShot = (st, side) => {
    const fr = makeFront(st, EXPORT), img = side === 'back' ? makeBack(st, EXPORT, fr) : fr;
    return Stamp.onDesk(img, palByName(st.palette), 3000, 3600, { rot: side === 'back' ? 0.012 : -0.012 });
  };
  const busy = async (btn, label, fn) => { const t = btn.textContent; btn.disabled = true; btn.textContent = label; await new Promise(r => setTimeout(r, 30)); try { await fn(); } finally { btn.disabled = false; btn.textContent = t; } };
  $('dl-front').onclick = () => busy($('dl-front'), '渲染中…', () => download(deskShot(state, 'front'), fname() + '-front.png'));
  $('dl-back').onclick = () => busy($('dl-back'), '渲染中…', () => download(deskShot(state, 'back'), fname() + '-back.png'));
  $('save').onclick = () => busy($('save'), '渲染中…', async () => {
    const e = emblemFor(state), l = leafletFor(state);
    const meta = { no: state.no, date: state.date, phrase: state.phrase.trim(), en: state.en.trim(), palette: state.palette,
      emblem: e ? 'library:' + e.id : 'fallback', emblem_concept: e ? e.concept : '', leaflet: l || null };
    const r = await (await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: state.date, phrase: state.phrase.trim(), front: deskShot(state, 'front').toDataURL('image/png'), back: deskShot(state, 'back').toDataURL('image/png'), meta }) })).json();
    $('stage-note').textContent = r.folder ? `已保存 → ${r.folder}` : (r.error || '保存失败');
  });

  // ---------- the sheet (localStorage)
  const KEY = 'dc-sheet';
  const loadSheet = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const saveSheet = items => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { $('stage-note').textContent = '整版存不下了（localStorage 已满）'; } };
  function drawSheet() {
    const items = loadSheet(), box = $('wall-items'); box.innerHTML = '';
    $('sheet-count').textContent = `${items.length} / 32`;
    if (!items.length) { box.innerHTML = '<span class="empty">整版还是空白。满意了就“贴进整版”，32 枚凑成一整版，像 Warhol 的 32 罐汤。</span>'; return; }
    items.forEach((it, i) => {
      const img = new Image(); img.src = it.thumb; img.title = `${it.state.phrase} · ${it.state.palette}（点击载入，Shift+点击撕掉）`;
      img.onclick = ev => { if (ev.shiftKey) { items.splice(i, 1); saveSheet(items); drawSheet(); return; } Object.assign(state, it.state, { side: 'front' }); syncInputs(); refreshLeaflet(); };
      box.appendChild(img);
    });
  }
  function syncInputs() {
    $('phrase').value = state.phrase; $('en').value = state.en; $('no').value = state.no; $('date').value = state.date;
    $('misreg').checked = state.misregister; $('grain').checked = state.grain;
    drawPalettes(); drawLayouts(); drawEmblems(); render();
  }
  $('to-sheet').onclick = () => {
    const items = loadSheet();
    if (items.length >= 32) { $('stage-note').textContent = '整版已经贴满 32 枚，先导出或撕掉几枚'; return; }
    const t = makeFront(state, 0.2), c = U.canvas(t.width, t.height);
    c.getContext('2d').drawImage(t, 0, 0);
    items.push({ state: { ...state, side: 'front' }, thumb: c.toDataURL('image/png') });
    Album.add({ id: 'studio:' + Date.now(), kind: 'studio', date: state.date, st: { ...state, side: 'front' } });
    saveSheet(items); drawSheet();
  };
  $('sheet-clear').onclick = () => { if (confirm('把整版上的邮票全部撕掉？')) { saveSheet([]); drawSheet(); } };
  $('sheet-export').onclick = () => busy($('sheet-export'), '印刷中…', async () => {
    const items = loadSheet(); if (!items.length) return;
    await Promise.all(items.map(it => loadLeaflet(it.state.phrase)));
    const list = items.map(it => ({ spec: specOf(it.state), pal: palByName(it.state.palette), emblem: emblemFor(it.state), opts: optsOf(it.state) }));
    const sheet = await Sheet.render(list, 0.5, n => { $('stage-note').textContent = `印刷整版 ${n} / ${items.length}`; });
    const W = Math.round(sheet.width * 1.12), H = Math.round(sheet.height * 1.16);
    const desk = Stamp.onDesk(sheet, { wall: '#1f1f21' }, W, H, { desk: '#1f1f21', rot: -0.006 });
    download(desk, `daily-stamp-sheet-${items.length}.png`);
    $('stage-note').textContent = `整版已导出，${items.length} 枚`;
  });

  // ---------- pages: tapping the stamp in the middle of the home carousel flies it onto its page; back flies it home
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const homeView = useOpening ? Home.mount($('home'), { onOpen: sl => openPage(sl) }) : null;
  let moving = false;
  const sameStamp = st => !!st && Object.keys(st).every(k => k === 'side' || st[k] === state[k]);
  // pages in layers of their own: mounted the first time they are opened, stamps fly in and out of them
  const layers = new Map();
  const layerDeps = () => ({ date: state.date, words: emblems.filter(e => e.status === 'ready' && e.img), emblems, palettes, homePlans,
    makeFront, makeBack, printIn, loadLeaflet, album: Album });
  function ensureLayer(key) {
    if (!layers.has(key)) layers.set(key, Pages.mount(key, $('layer-' + key), layerDeps()));
    return layers.get(key);
  }
  function showLayer(key) {
    document.body.classList.add('daily-layer');
    document.querySelectorAll('.layer').forEach(sec => sec.classList.toggle('on', sec.id === 'layer-' + key));
    const L = ensureLayer(key);
    if (L.enter) L.enter();
    $('layer-' + key).tabIndex = 0; $('layer-' + key).focus({ preventScroll: true });   // arrow keys go to the page
    return L;
  }
  function hideLayer(key) {
    document.body.classList.remove('daily-layer');
    document.querySelectorAll('.layer.on').forEach(sec => sec.classList.remove('on'));
    const L = layers.get(key); if (L && L.leave) L.leave();
  }
  async function openLayer(sl, push) {
    if (moving) return; moving = true;
    try {
      const from = sl.btn.getBoundingClientRect();
      if (push) history.pushState({ home: true }, '', '#' + sl.key);
      view = sl.key;
      const L = showLayer(sl.key);                           // laid out under the home, which fades off it
      const flying = Home.fly(sl.printed || sl.cv, from, L.anchor());
      sl.btn.style.visibility = 'hidden';
      const home = $('home'), fade = home.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: 160, easing: 'ease', fill: 'forwards' });
      const f = await flying; await L.ready;
      document.body.classList.remove('daily-home'); fade.cancel();
      sl.btn.style.visibility = '';
      // a page that takes this very stamp has it (or what it became) right under the copy: the copy just hands over
      const kept = L.receive && sl.st ? await L.receive(sl.st) : undefined;
      await f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: kept === undefined ? 600 : kept || 250, easing: 'ease', fill: 'forwards' }).finished;
      f.remove();
    } finally { moving = false; }
  }
  async function openPage(sl, { push = true } = {}) {
    if (Pages.has(sl.key)) return openLayer(sl, push);
    if (moving) return; moving = true;
    try {
      const from = sl.btn.getBoundingClientRect();
      if (push) history.pushState({ home: true }, '', '#' + sl.key);
      view = sl.key;
      rotation.setTo({ yaw: 0, pitch: 0, roll: 0 }, 0);
      document.body.classList.toggle('daily-opening', sl.key === 'today');   // lay the page out under the sheets
      document.body.classList.add('flip-wait');
      const flying = Home.fly(sl.printed || sl.cv, from, flip.getBoundingClientRect());
      sl.btn.style.visibility = 'hidden';
      const home = $('home'), fade = home.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: 160, easing: 'ease', fill: 'forwards' });
      // the page's own stamp renders while the copy is in the air (the flight runs on the compositor)
      let ready = Promise.resolve();
      if (!sameStamp(sl.st)) { await wait(40); Object.assign(state, sl.st); ready = rendered(); syncInputs(); refreshLeaflet(); }
      const f = await flying; await ready;
      document.body.classList.remove('daily-home'); fade.cancel();
      sl.btn.style.visibility = '';
      if (sl.key === 'today') { document.body.classList.add('daily-printed'); collectToday(); }
      document.body.classList.remove('flip-wait');          // the real stamp fades in under the copy, then the copy goes
      await wait(350);
      await f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' }).finished;
      f.remove();
    } finally { moving = false; }
  }
  async function goHome() {
    if (view === 'home' || !homeView || moving) return;
    moving = true;
    try {
      homeView.show();
      const r = rotation.get();
      if (r.pitch % 360 || r.roll % 360 || r.yaw % 360) { rotation.setTo({ yaw: r.yaw > 180 ? 360 : 0, pitch: 0, roll: 0 }, 400); await wait(430); }
      // it goes back into the slot it came from; a stamp changed in the studio takes the studio's slot
      const fromLayer = Pages.has(view) ? view : null, L = fromLayer && ensureLayer(fromLayer);
      let sl = fromLayer ? homeView.find(fromLayer) : homeView.slots.find(x => x.st && sameStamp(x.st));
      if (L && L.source && L.source()) {                    // what the page made (a torn stamp, a prescription...) takes its slot
        const src = L.source(), c = U.canvas(Math.round(Stamp.BW * homeView.scale), Math.round(Stamp.BH * homeView.scale));
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); sl.printed = c;
      }
      if (!sl) {
        sl = homeView.find('studio'); sl.st = { ...state, side: 'front' };
        const k = homeView.scale / PREVIEW, c = U.canvas(Math.round(front.width * k), Math.round(front.height * k));
        c.getContext('2d').drawImage(front, 0, 0, c.width, c.height); sl.printed = c;
      }
      const from = L ? L.anchor() : flip.getBoundingClientRect(), home = $('home');
      view = 'home';
      home.style.opacity = '0'; document.body.classList.add('daily-home');
      homeView.reveal(sl);
      const to = sl.btn.getBoundingClientRect();
      sl.btn.style.visibility = 'hidden';
      const flying = Home.fly(L ? (sl.printed || sl.cv) : front, from, to, { lift: false });
      document.body.classList.add('flip-wait');
      home.style.opacity = '';
      home.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease' });
      const f = await flying;
      if (sl.printed && sl.cv.width) sl.cv.getContext('2d').drawImage(sl.printed, 0, 0, sl.cv.width, sl.cv.height);
      sl.btn.style.visibility = ''; f.remove();
      document.body.classList.remove('flip-wait');
      if (fromLayer) hideLayer(fromLayer);
    } finally { moving = false; }
  }
  document.querySelectorAll('.to-home').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    if (history.state && history.state.home) history.back();
    else { history.replaceState(null, '', location.pathname + location.search); goHome(); }
  }));
  window.addEventListener('popstate', () => {
    const key = location.hash.slice(1);
    if (!key || key === 'home') return goHome();
    const sl = view === 'home' && homeView && homeView.find(key);
    if (sl && sl.live) openPage(sl, { push: false });
  });
  let homePlans = null;

  // ---------- boot (URL params override defaults: ?palette=Brillo&phrase=周一&en=monday&no=3&side=back)
  for (const [k, v] of params) {
    if (!(k in state)) continue;
    state[k] = (k === 'no' || k === 'shift' || k === 'seed') ? Math.max(0, parseInt(v) || 0) : (k === 'misregister' || k === 'grain') ? v !== '0' : v;
  }
  rotation.setTo({ yaw: state.side === 'back' ? 180 : 0, pitch: 0, roll: 0 }, 0);
  $('stage-note').textContent = '加载字体与素材…';
  const review = params.has('gallery') || params.get('sheet') === 'demo';
  if (!useOpening || review) Loader.skip();
  // a breath between heavy steps, so the loading screen's bar and slots get painted
  // (a task boundary is enough: the browser paints there whenever a frame is due, without waiting a whole frame)
  let breathAt = 0;
  const breath = () => new Promise(r => setTimeout(() => { breathAt = performance.now(); r(); }, 0));
  const pace = () => (performance.now() - breathAt > 45 ? breath() : null);   // a breath only once 45 ms of work piled up

  // Everything the app will ever need is fetched, decoded and drawn while the loading screen (web/loader.js) is up:
  // fonts, artwork, emblem masks, the home's eleven stamps, the studio, and every page mounted. Nothing loads later.
  async function preload() {
    const termsAll = Terms.load();
    const fontsIn = (Loader.active ? Loader.fonts() : Promise.resolve()).then(() => loadFonts()).then(() => Loader.step('fonts', 1));
    const artIn = (async () => {
      await Promise.all([loadPalettes(), loadEmblems()]);
      Loader.step('art', 0.4);
      const words = emblems.filter(e => e.status === 'ready');
      await Promise.all([termsAll, ...words.map(e => loadLeaflet(e.phrase).catch(() => null))]);
      Loader.step('art', 1);
    })();
    // the emblems' ink masks and die-cut outlines, cut while the fonts are still coming: every stamp and page draws
    // from these caches afterwards
    const masksIn = artIn.then(async () => {
      if (!useOpening) return;
      const icons = Terms.LIST.map(([k]) => Terms.icon(k)).filter(Boolean);
      const inks = emblems.filter(e => e.status === 'ready' && e.img);
      for (const [i, e] of [...inks, ...icons].entries()) {
        Print.channelMasks(e);
        if (i < inks.length) { Print.silhouette(e, 0.028); Print.silhouette(e, 0.05); }
        Loader.step('masks', (i + 1) / (inks.length + icons.length));
        await pace();
      }
    });
    await Promise.all([fontsIn, masksIn]);
    if (!useOpening) return;
    const inks = emblems.filter(e => e.status === 'ready' && e.img);

    // the day's stamps (the home sheets); today's stamp and the studio's are two of them
    homePlans = Home.plan(state.date, inks, palettes);
    Object.assign(state, homePlans[Home.FEATURES.findIndex(f => f.key === (view === 'studio' ? 'studio' : 'today'))]);
    dailyMessage = await getDailyMessage(state.date);
    $('opening-date').textContent = state.date.replace(/-/g, '.');
    flip.setAttribute('aria-label', '轻点揭示今日短句，双击翻面；左键拖动平面旋转，按住滚轮拖动空间翻转');
    flip.title = '轻点揭示今日短句；双击翻面；拖动可旋转邮票';
    Loader.blanks(Stamp.blank(0.12, 1));
    let n = 0;
    await homeView.fill(homePlans, { date: state.date, term: Terms.of(state.date).name, breath: pace,
      // drawn at least at the collage tray's 0.36, so its scraps (and the post tray's thumbnails) come from these same prints
      render: (st, sc) => makeFront(st, Math.max(sc, 0.36)),
      onEach: (i, cv) => { Loader.step('stamps', ++n / homePlans.length); Loader.stamp(i, cv); } });

    // the studio and today's stamp (today's waits unprinted for the curtain, then prints)
    holdFront = view === 'today';
    syncInputs(); drawSheet(); refreshLeaflet({ draw: false });
    await rendered();
    Loader.step('studio', 1);
    await breath();

    // every page, mounted out of sight so that opening one is only the flight
    document.body.classList.add('preloading');
    const keys = Pages.keys();
    for (const [i, key] of keys.entries()) {
      const t0 = performance.now();
      try { ensureLayer(key); await Promise.race([Promise.resolve(layers.get(key).ready), wait(8000)]); } catch (e) { console.error(e); }
      Loader.times['page:' + key] = Math.round(performance.now() - t0);
      Loader.step('pages', (i + 1) / keys.length);
      await breath();
    }
    document.body.classList.remove('preloading');
  }
  // a stuck download doesn't keep the curtain down: after 25 s the app opens and the rest carries on behind it
  await Promise.race([preload().catch(e => console.error(e)), wait(25000)]);
  document.body.classList.remove('preloading');

  if (useOpening) {
    // printed: the loading screen waits for a tap on its 进入邮局 button before opening the app
    let term = ''; try { term = Terms.of(state.date).name; } catch {}
    await Loader.ready({ date: state.date, term });
    document.body.classList.add('daily-ready');
    if (Pages.has(view)) showLayer(view);
    if (view === 'home') homeView.show();
    if (holdFront) { holdFront = false; pressFirst = true; render(); }
    await Loader.finish();
  } else {
    syncInputs(); drawSheet(); refreshLeaflet();
  }
  if (new URLSearchParams(location.search).get('sheet') === 'demo') {
    // screenshot helper: fill the sheet with every library word
    const words = emblems.filter(e => e.status === 'ready');
    await Promise.all(words.map(e => loadLeaflet(e.phrase)));
    const list = Array.from({ length: 16 }, (_, i) => { const e = words[i % words.length]; const st = { ...state, phrase: e.phrase, en: e.en || '', emblem: 'auto', no: i + 1, palette: palettes[(i * 5) % palettes.length].name, layout: 'gen', seed: 1000 + i * 7, shift: i % 4 }; return { spec: specOf(st), pal: palByName(st.palette), emblem: emblemFor(st), opts: optsOf(st) }; });
    const sheet = await Sheet.render(list, 0.25);
    const desk = Stamp.onDesk(sheet, { wall: '#1f1f21' }, Math.round(sheet.width * 1.12), Math.round(sheet.height * 1.16), { desk: '#1f1f21', rot: 0 });
    document.body.innerHTML = ''; document.body.style.display = 'block'; desk.style.width = '100%'; document.body.appendChild(desk);
  }
  if (new URLSearchParams(location.search).has('gallery')) {
    // review helper: six stamps side by side (?gallery=<first seed>[&layout=<name>|tpl], tpl cycles the templates)
    const tpl = new URLSearchParams(location.search).get('layout'), wq = new URLSearchParams(location.search).get('word');   // &word= forces a phrase (e.g. one with no emblem yet)
    const base = parseInt(new URLSearchParams(location.search).get('gallery')) || 1, words = emblems.filter(e => e.status === 'ready');
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:18px;background:#d9d5cc';
    for (let i = 0; i < 6; i++) {
      const e = words[(base + i) % words.length], st = { ...state, phrase: wq || e.phrase, en: wq ? '' : e.en || '', emblem: 'auto', no: base + i, layout: tpl === 'tpl' ? Layouts.NAMES[1 + (base + i) % (Layouts.NAMES.length - 1)].key : tpl || 'gen', seed: base * 131 + i, palette: palettes[(base + i * 3) % palettes.length].name };
      await loadLeaflet(st.phrase);
      const cv = makeFront(st, 0.4); cv.style.width = '100%'; grid.appendChild(cv);
    }
    document.body.innerHTML = ''; document.body.style.display = 'block'; document.body.appendChild(grid);
  }
})();
