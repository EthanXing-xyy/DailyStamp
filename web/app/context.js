// What the whole app shares: the stamp on the studio's desk (state), how it was opened (URL params), and where it is
// (view: 'home', 'today', 'studio' or a page key). Other app/ files read and set these; nothing else holds them.
const App = (() => {
  // what this browser kept under the old names (dc-*, from when this was 每日一罐) moves to ds-* once
  for (const store of ['localStorage', 'sessionStorage']) {
    try {
      const S = window[store];
      for (const k of Object.keys(S)) if (k.startsWith('dc-')) { const n = 'ds-' + k.slice(3); if (S.getItem(n) === null) S.setItem(n, S.getItem(k)); S.removeItem(k); }
    } catch (e) { /* storage off: nothing to move */ }
  }
  const localDate = () => {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const state = {
    phrase: '周一', en: 'monday', no: 1, date: localDate(),
    palette: 'Shot Marilyn', layout: 'gen', seed: Math.floor(Math.random() * 1e9), shift: 0, emblem: 'auto', misregister: true, grain: true, side: 'front',
  };
  const params = new URLSearchParams(location.search);
  // no params: the app (home, pages, today's stamp); stamp params (?phrase=…) open the bare studio; ?gallery / ?sheet=demo
  // are review views (web/app/review.js)
  const useOpening = !params.has('gallery') && params.get('sheet') !== 'demo' && ![...params.keys()].some(k => k in state);
  const review = params.has('gallery') || params.get('sheet') === 'demo';
  return {
    state, params, useOpening, review, localDate,
    view: 'home',          // what is on screen
    homeView: null,        // the carousel (web/shell/home.js), in the app only
    homePlans: null,       // this visit's stamps, one per function
  };
})();
