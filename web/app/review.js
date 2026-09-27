// Review views for screenshots, never part of the app: ?sheet=demo fills the 32-stamp sheet with library words;
// ?gallery=<first seed>[&layout=<name>|tpl][&word=<phrase>] lays six stamps side by side (tpl cycles the templates,
// word forces a phrase, e.g. one with no emblem yet).
const Review = (() => {
  async function run() {
    const q = App.params, { state } = App, { palettes, specOf, palByName, emblemFor, optsOf, loadLeaflet } = Assets;
    const words = Assets.emblems.filter(e => e.status === 'ready');
    if (q.get('sheet') === 'demo') {
      await Promise.all(words.map(e => loadLeaflet(e.phrase)));
      const list = Array.from({ length: 16 }, (_, i) => { const e = words[i % words.length]; const st = { ...state, phrase: e.phrase, en: e.en || '', emblem: 'auto', no: i + 1, palette: palettes[(i * 5) % palettes.length].name, layout: 'gen', seed: 1000 + i * 7, shift: i % 4 }; return { spec: specOf(st), pal: palByName(st.palette), emblem: emblemFor(st), opts: optsOf(st) }; });
      const sheet = await Sheet.render(list, 0.25);
      const desk = Stamp.onDesk(sheet, { wall: '#1f1f21' }, Math.round(sheet.width * 1.12), Math.round(sheet.height * 1.16), { desk: '#1f1f21', rot: 0 });
      document.body.innerHTML = ''; document.body.style.display = 'block'; desk.style.width = '100%'; document.body.appendChild(desk);
    }
    if (q.has('gallery')) {
      const tpl = q.get('layout'), wq = q.get('word');
      const base = parseInt(q.get('gallery')) || 1;
      const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:18px;padding:18px;background:#d9d5cc';
      for (let i = 0; i < 6; i++) {
        const e = words[(base + i) % words.length], st = { ...state, phrase: wq || e.phrase, en: wq ? '' : e.en || '', emblem: 'auto', no: base + i, layout: tpl === 'tpl' ? Layouts.NAMES[1 + (base + i) % (Layouts.NAMES.length - 1)].key : tpl || 'gen', seed: base * 131 + i, palette: palettes[(base + i * 3) % palettes.length].name };
        await loadLeaflet(st.phrase);
        const cv = Press.makeFront(st, 0.4); cv.style.width = '100%'; grid.appendChild(cv);
      }
      document.body.innerHTML = ''; document.body.style.display = 'block'; document.body.appendChild(grid);
    }
  }
  return { run };
})();
