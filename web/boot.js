// While the app is being tried out, every server start is a clean slate: the first time a browser opens it after the
// server (re)started, whatever it kept from before is cleared — 集邮册 (IndexedDB), 撕一张, 时光信, 盖戳, 月度小版张, 刻章,
// the claw's coins, the sheet (localStorage ds-*, and dc-* from the old name, which context.js would otherwise move back).
// The server writes its start id over __BOOT__ (server.py); `serve --keep` leaves it out, and so does any other server.
(() => {
  const boot = '__BOOT__';
  if (boot.startsWith('__')) return;
  try {
    if (localStorage.getItem('ds-boot') === boot) return;
    for (const S of [localStorage, sessionStorage]) for (const k of Object.keys(S)) if (/^d[sc]-/.test(k)) S.removeItem(k);
    indexedDB.deleteDatabase('dailystamp');           // album.js opens it later; that open waits for this to finish
    indexedDB.deleteDatabase('dailycan');
    localStorage.setItem('ds-boot', boot);
  } catch (e) { /* storage off: nothing was kept */ }
})();
