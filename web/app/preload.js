// Everything the app will ever need is fetched, decoded and drawn while the loading screen (web/loader.js) is up:
// fonts, artwork, emblem masks, the home's stamps, the stage, and every page mounted. Nothing loads later.
const Preload = (() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // a breath between heavy steps, so the loading screen's bar and slots get painted
  // (a task boundary is enough: the browser paints there whenever a frame is due, without waiting a whole frame)
  let breathAt = 0;
  const breath = () => new Promise(r => setTimeout(() => { breathAt = performance.now(); r(); }, 0));
  const pace = () => (performance.now() - breathAt > 45 ? breath() : null);   // a breath only once 45 ms of work piled up

  async function run() {
    const { state, useOpening } = App;
    const termsAll = Terms.load();
    const fontsIn = (Loader.active ? Loader.fonts() : Promise.resolve()).then(() => Assets.loadFonts()).then(() => Loader.step('fonts', 1));
    const artIn = (async () => {
      await Promise.all([Assets.loadPalettes(), Assets.loadEmblems()]);
      Loader.step('art', 0.4);
      const words = Assets.emblems.filter(e => e.status === 'ready');
      await Promise.all([termsAll, ...words.map(e => Assets.loadLeaflet(e.phrase).catch(() => null))]);
      Loader.step('art', 1);
    })();
    // the emblems' ink masks and die-cut outlines, cut while the fonts are still coming: every stamp and page draws
    // from these caches afterwards
    const masksIn = artIn.then(async () => {
      if (!useOpening) return;
      const icons = Terms.LIST.map(([k]) => Terms.icon(k)).filter(Boolean);
      const inks = Assets.words();
      for (const [i, e] of [...inks, ...icons].entries()) {
        Print.channelMasks(e);
        if (i < inks.length) { Print.silhouette(e, 0.028); Print.silhouette(e, 0.05); }
        Loader.step('masks', (i + 1) / (inks.length + icons.length));
        await pace();
      }
    });
    await Promise.all([fontsIn, masksIn]);
    if (!useOpening) return;
    const inks = Assets.words();

    // the day's stamps (the home sheets); today's is one of them, and the studio starts from it too
    App.homePlans = Home.plan(state.date, inks, Assets.palettes);
    Object.assign(state, App.homePlans[Home.FEATURES.findIndex(f => f.key === 'today')]);
    Stage.setDailyMessage(await Stage.getDailyMessage(state.date));
    document.getElementById('opening-date').textContent = state.date.replace(/-/g, '.');
    Stage.flip.setAttribute('aria-label', '轻点揭示今日短句，双击翻面；左键拖动平面旋转，按住滚轮拖动空间翻转');
    Stage.flip.title = '轻点揭示今日短句；双击翻面；拖动可旋转邮票';
    Loader.blanks(Stamp.blank(0.12, 1));
    let n = 0;
    await App.homeView.fill(App.homePlans, { date: state.date, term: Terms.of(state.date).name, breath: pace,
      // drawn at least at the collage tray's 0.36, so its scraps (and the post tray's thumbnails) come from these same prints
      render: (st, sc) => Press.makeFront(st, Math.max(sc, 0.36)),
      onEach: (i, cv) => { Loader.step('stamps', ++n / App.homePlans.length); Loader.stamp(i, cv); } });

    // the studio and today's stamp (today's waits unprinted for the curtain, then prints)
    if (App.view === 'today') Stage.hold();
    Stage.syncInputs(); Stage.drawSheet(); Stage.refreshLeaflet({ draw: false });
    await Stage.rendered();
    Loader.step('studio', 1);
    await breath();

    // every page, mounted out of sight so that opening one is only the flight
    document.body.classList.add('preloading');
    const keys = Pages.keys();
    for (const [i, key] of keys.entries()) {
      const t0 = performance.now();
      try { Router.ensureLayer(key); await Promise.race([Promise.resolve(Router.layers.get(key).ready), wait(8000)]); } catch (e) { console.error(e); }
      Loader.times['page:' + key] = Math.round(performance.now() - t0);
      Loader.step('pages', (i + 1) / keys.length);
      await breath();
    }
    document.body.classList.remove('preloading');
  }
  return { run };
})();
