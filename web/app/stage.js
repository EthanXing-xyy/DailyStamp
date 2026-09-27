// The stage: today's stamp and the studio share one stamp on a desk (#stage) that turns in 3D (egjs Axes), presses under
// a finger (Win8) and prints plate by plate. Today's is the landing page (a short line for the day, then the way into
// the studio); the studio adds the panel (word, layout, palette, emblem, printing), downloads and the 32-stamp sheet.
const Stage = (() => {
  const state = App.state, params = App.params, useOpening = App.useOpening;
  const { loadFonts, loadLeaflet, emblemFor, leafletFor, specOf, optsOf } = Assets;
  const { makeFront, makeBack, printIn } = Press;
  const palByName = name => Assets.palByName(name || state.palette);
  const $ = id => document.getElementById(id);
  const front = $('front'), back = $('back'), flip = $('flip');
  const edges = [...flip.querySelectorAll('.edge')];
  const frontLight = flip.querySelector('.front-light'), backLight = flip.querySelector('.back-light');
  const PREVIEW = 0.75;                                   // preview stamps render at 900 x 1125
  const EXPORT = 2;                                       // downloads: 2400 x 3000 stamp on a desk

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
    history.replaceState(history.state, '', '#studio'); App.view = 'studio';
    document.body.classList.remove('daily-opening', 'daily-ready', 'daily-printed', 'daily-revealed');
    flip.setAttribute('aria-label', '左键拖动平面旋转，按住滚轮拖动空间翻转，轻点或双击翻面');
    flip.title = '左键拖动平面旋转；按住滚轮拖动空间翻转；轻点或双击翻面';
  };

  const collectToday = () => Album.add({ id: 'today:' + state.date, kind: 'today', date: state.date, st: { ...state, side: 'front' } }, { keep: true });

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
    $('palettes').innerHTML = Assets.palettes.map(p => `<button class="sw" data-name="${p.name}" title="${p.cn} · ${p.name} — ${p.note}" aria-pressed="${p.name === state.palette}">${p.c.map(c => `<i style="background:${c}"></i>`).join('')}<b style="background:${p.ink}"></b></button>`).join('');
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

  $('pal-random').onclick = () => { const others = Assets.palettes.filter(p => p.name !== state.palette); state.palette = others[Math.floor(Math.random() * others.length)].name; drawPalettes(); drawEmblems(); render(); };

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
    for (const e of Assets.emblems) {
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
  const KEY = 'ds-sheet';
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
  return {
    front, flip, rotation, PREVIEW, render, rendered, syncInputs, drawSheet, refreshLeaflet, collectToday, getDailyMessage,
    setDailyMessage(m) { dailyMessage = m; },
    /** today's stamp waits unprinted (under the loading screen) until release(), which prints it plate by plate */
    hold() { holdFront = true; },
    release() { if (!holdFront) return; holdFront = false; pressFirst = true; render(); },
    get holding() { return holdFront; },
  };
})();
