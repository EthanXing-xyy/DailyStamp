// Navigation. Every place the home's stamps fly to is a view: the stage (today, studio) or a page in a layer of its own
// (web/pages/*.js). Opening one flies the tapped stamp from the carousel to the view's anchor; going home flies it
// back into its slot. The view's key lives in location.hash, so the browser's back button goes home too.
//
// A view is {enter(sl) -> DOMRect the stamp flies to, prepare(sl) -> Promise (runs during the flight),
//            landed(sl) -> Promise<keyframe options for the copy's fade>, back() -> {sl, src, from} for the way home, gone()}.
const Router = (() => {
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let moving = false, deps = null;
  const layers = new Map();                               // page key -> what its mount() returned

  // ---- pages in layers of their own: a section each, with its way home. A page is built the first time it is opened
  // and kept while it is one of the KEEP last opened; then the one opened longest ago is closed (whatever it hooked
  // outside its section undone by Kit.close, the section swapped for an empty one) and built afresh if it comes back
  const KEEP = 6, recent = [];                            // page keys, the last opened at the end
  const toHome = e => {
    e.preventDefault();
    if (history.state && history.state.home) history.back();
    else { history.replaceState(null, '', location.pathname + location.search); goHome(); }
  };
  function makeLayer(key) {
    const sec = document.createElement('section'); sec.className = 'layer'; sec.id = 'layer-' + key;
    sec.innerHTML = '<a class="to-home" href="#">← 首页</a>';
    sec.querySelector('.to-home').addEventListener('click', toHome);
    return sec;
  }
  function makeLayers() { for (const key of Pages.keys()) document.body.prepend(makeLayer(key)); }
  function ensureLayer(key) {
    if (!layers.has(key)) layers.set(key, Pages.mount(key, $('layer-' + key), deps()));
    return layers.get(key);
  }
  function showLayer(key) {
    document.body.classList.add('daily-layer');
    document.querySelectorAll('.layer').forEach(sec => sec.classList.toggle('on', sec.id === 'layer-' + key));
    const L = ensureLayer(key);
    const i = recent.indexOf(key); if (i >= 0) recent.splice(i, 1); recent.push(key);
    if (L.enter) L.enter();
    $('layer-' + key).tabIndex = 0; $('layer-' + key).focus({ preventScroll: true });   // arrow keys go to the page
    return L;
  }
  function closeLayer(key) {
    const L = layers.get(key), sec = $('layer-' + key);
    if (L && L.close) { try { L.close(); } catch (e) { console.error(e); } }
    Kit.close(sec); sec.replaceWith(makeLayer(key)); layers.delete(key);
  }
  const trim = () => { while (recent.length > KEEP && recent[0] !== App.view) closeLayer(recent.shift()); };
  function hideLayer(key) {
    document.body.classList.remove('daily-layer');
    document.querySelectorAll('.layer.on').forEach(sec => sec.classList.remove('on'));
    const L = layers.get(key); if (L && L.leave) L.leave();
  }

  const layerView = key => ({
    enter() { this.L = showLayer(key); return this.L.anchor(); },   // laid out under the home, which fades off it
    prepare() { return this.L.ready; },
    // a page that takes this very stamp has it (or what it became) right under the copy: the copy just hands over
    async landed(sl) { const kept = this.L.receive && sl.st ? await this.L.receive(sl.st) : undefined; return { duration: kept === undefined ? 600 : kept || 250, easing: 'ease' }; },
    back() {
      const L = ensureLayer(key), sl = App.homeView.find(key);
      if (L.source && L.source()) {                      // what the page made (a torn stamp, a prescription...) takes its slot
        const src = L.source(), c = U.canvas(Math.round(Stamp.BW * App.homeView.scale), Math.round(Stamp.BH * App.homeView.scale));
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); sl.printed = c;
      }
      return { sl, src: sl.printed || sl.cv, from: L.anchor() };
    },
    gone() { hideLayer(key); },
  });

  // ---- the stage (today's stamp, the studio)
  const sameStamp = st => !!st && Object.keys(st).every(k => k === 'side' || st[k] === App.state[k]);
  const stageView = key => ({
    enter(sl) {
      Stage.rotation.setTo({ yaw: 0, pitch: 0, roll: 0 }, 0);
      document.body.classList.toggle('daily-opening', key === 'today');   // lay the page out under the sheets
      document.body.classList.add('flip-wait');
      return Stage.flip.getBoundingClientRect();
    },
    // the page's own stamp renders while the copy is in the air (the flight runs on the compositor)
    async prepare(sl) {
      if (sameStamp(sl.st)) return;
      await wait(40); Object.assign(App.state, sl.st);
      const ready = Stage.rendered(); Stage.syncInputs(); Stage.refreshLeaflet();
      await ready;
    },
    async landed() {
      if (key === 'today') { document.body.classList.add('daily-printed'); Stage.collectToday(); }
      document.body.classList.remove('flip-wait');          // the real stamp fades in under the copy, then the copy goes
      await wait(350);
      return { duration: 250 };
    },
    async back() {
      const r = Stage.rotation.get();
      if (r.pitch % 360 || r.roll % 360 || r.yaw % 360) { Stage.rotation.setTo({ yaw: r.yaw > 180 ? 360 : 0, pitch: 0, roll: 0 }, 400); await wait(430); }
      // it goes back into the slot it came from; a stamp changed in the studio takes today's slot
      let sl = App.homeView.slots.find(x => x.st && sameStamp(x.st));
      if (!sl) {
        sl = App.homeView.find('today'); sl.st = { ...App.state, side: 'front' };
        const k = App.homeView.scale / Stage.PREVIEW, c = U.canvas(Math.round(Stage.front.width * k), Math.round(Stage.front.height * k));
        c.getContext('2d').drawImage(Stage.front, 0, 0, c.width, c.height); sl.printed = c;
      }
      return { sl, src: Stage.front, from: Stage.flip.getBoundingClientRect() };
    },
    gone() {},
  });
  const STAGE = ['today', 'studio'];
  const viewOf = key => STAGE.includes(key) ? stageView(key) : Pages.has(key) ? layerView(key) : null;
  const known = key => key === 'home' || !!viewOf(key);

  // ---- going there and back
  async function open(sl, { push = true } = {}) {
    const V = viewOf(sl.key);
    if (!V || moving) return; moving = true;
    try {
      const from = sl.btn.getBoundingClientRect();
      if (push) history.pushState({ home: true }, '', '#' + sl.key);
      App.view = sl.key;
      const t0 = performance.now(), flying = Home.fly(sl.printed || sl.cv, from, V.enter(sl));
      sl.btn.style.visibility = 'hidden';
      // the home fades off the view once the view is ready under it (a page built just now finishes during the flight)
      const home = $('home'), ready = Promise.resolve(V.prepare(sl));
      const fading = ready.then(() => home.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: Math.max(0, 160 - (performance.now() - t0)), easing: 'ease', fill: 'forwards' }));
      const f = await flying, fade = await fading; await fade.finished;
      document.body.classList.remove('daily-home'); fade.cancel();
      sl.btn.style.visibility = '';
      const out = await V.landed(sl);
      await f.animate([{ opacity: 1 }, { opacity: 0 }], { ...out, fill: 'forwards' }).finished;
      f.remove();
      trim();                                               // one page too many now: the one opened longest ago goes
    } finally { moving = false; }
  }
  async function goHome() {
    const hv = App.homeView;
    if (App.view === 'home' || !hv || moving) return;
    moving = true;
    try {
      hv.show();
      const V = viewOf(App.view), { sl, src, from } = await V.back();
      App.view = 'home';
      const home = $('home');
      home.style.opacity = '0'; document.body.classList.add('daily-home');
      hv.reveal(sl);
      const to = sl.btn.getBoundingClientRect();
      sl.btn.style.visibility = 'hidden';
      const flying = Home.fly(src, from, to, { lift: false });
      document.body.classList.add('flip-wait');
      home.style.opacity = '';
      home.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease' });
      const f = await flying;
      hv.repaint(sl);
      sl.btn.style.visibility = ''; f.remove();
      document.body.classList.remove('flip-wait');
      V.gone();
    } finally { moving = false; }
  }

  /** the pages' layers exist before anything is mounted; deps() hands a page what it needs (web/app/main.js) */
  function init(makeDeps) {
    deps = makeDeps;
    document.querySelectorAll('.to-home').forEach(a => a.addEventListener('click', toHome));   // the stage's own
    makeLayers();
    window.addEventListener('popstate', () => {
      const key = location.hash.slice(1);
      if (!key || key === 'home') return goHome();
      const sl = App.view === 'home' && App.homeView && App.homeView.find(key);
      if (sl && sl.live) open(sl, { push: false });
    });
  }

  return { init, open, goHome, known, ensureLayer, showLayer, layers };
})();
