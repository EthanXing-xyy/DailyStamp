// 每日一枚 · boot. The app's parts, in load order:
//   features.js  the functions, in the carousel's order        context.js  shared state, URL params, the view on screen
//   assets.js    palettes, emblems, leaflets, fonts             press.js    stamp state -> printed canvas, plate by plate
//   stage.js     today's stamp and the studio                   router.js   flying between the home and every view
//   preload.js   everything loaded under the loading screen     review.js   ?gallery and ?sheet=demo
// This file wires them up and opens the app once the loading screen is tapped.
(async function () {
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const { state, params, useOpening } = App;
  if (!useOpening) document.body.classList.remove('daily-opening');

  // no params: the app. Its views (the home, today's stamp, the studio, the pages) live in location.hash
  App.view = useOpening ? (location.hash.slice(1) || 'home') : 'studio';
  // what a page gets handed when it is mounted (web/shell/pages.js)
  Router.init(() => ({ date: state.date, words: Assets.words(), emblems: Assets.emblems, palettes: Assets.palettes, homePlans: App.homePlans,
    makeFront: Press.makeFront, makeBack: Press.makeBack, printIn: Press.printIn, loadLeaflet: Assets.loadLeaflet, album: Album }));
  if (!Router.known(App.view)) App.view = 'home';
  const view = App.view;
  if (Pages.has(view)) { document.body.classList.add('daily-layer'); $('layer-' + view).classList.add('on'); }
  if (useOpening) document.body.classList.add('app-mode');
  if (view === 'home') document.body.classList.add('daily-home');
  if (view === 'studio') document.body.classList.remove('daily-opening');
  // the landing title fades in once its own face is in, instead of swapping glyphs from a fallback font
  document.fonts.load('40px "DS Phrase"', '每日一枚').catch(() => {}).then(() => document.body.classList.add('daily-head'));

  // tapping the stamp in the middle of the home carousel flies it onto its page; back flies it home
  App.homeView = useOpening ? Home.mount($('home'), { onOpen: sl => Router.open(sl) }) : null;

  // URL params override the studio's stamp: ?palette=Brillo&phrase=周一&en=monday&no=3&side=back
  for (const [k, v] of params) {
    if (!(k in state)) continue;
    state[k] = (k === 'no' || k === 'shift' || k === 'seed') ? Math.max(0, parseInt(v) || 0) : (k === 'misregister' || k === 'grain') ? v !== '0' : v;
  }
  Stage.rotation.setTo({ yaw: state.side === 'back' ? 180 : 0, pitch: 0, roll: 0 }, 0);
  $('stage-note').textContent = '加载字体与素材…';
  if (!useOpening || App.review) Loader.skip();

  // a stuck download doesn't keep the curtain down: after 25 s the app opens and the rest carries on behind it
  await Promise.race([Preload.run().catch(e => console.error(e)), wait(25000)]);
  document.body.classList.remove('preloading');

  if (useOpening) {
    // printed: the loading screen waits for a tap on its 进入邮局 button before opening the app
    let term = ''; try { term = Terms.of(state.date).name; } catch {}
    await Loader.ready({ date: state.date, term });
    document.body.classList.add('daily-ready');
    if (Pages.has(view)) Router.showLayer(view);
    if (view === 'home') App.homeView.show();
    Stage.release();
    await Loader.finish();
  } else {
    Stage.syncInputs(); Stage.drawSheet(); Stage.refreshLeaflet();
  }
  await Review.run();
})();
