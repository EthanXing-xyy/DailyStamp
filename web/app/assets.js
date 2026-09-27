// What the stamps are made of, fetched once: palettes, the emblem library (with its pre-cut plates), leaflets, fonts;
// and how a stamp state turns into what the renderer wants (spec, palette, emblem, options).
const Assets = (() => {
  let palettes = [], emblems = [];
  const leaflets = new Map();                             // phrase -> leaflet json ({status})
  const palByName = name => palettes.find(p => p.name === name) || palettes[0];

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
        if (c.mini) {                                      // the studio's emblem buttons (Print.miniMasks)
          const m = new Image(); m.src = `/emblems/cut/${encodeURIComponent(e.id)}.m.png?v=${encodeURIComponent(e.created)}`;
          try { await new Promise((ok, no) => { m.onload = ok; m.onerror = no; }); e.mini = m; } catch {}
        }
      }
    }));
  }
  // the Chinese faces come as subsets (fonts/sub/fonts.css): asking for a text loads just the faces that hold it
  async function loadFonts(text = '每日一枚 DAILY 09') {
    const fams = ['DS Brand', 'DS Phrase', 'DS Black', 'DS Caps', 'DS CapsMed', 'DS Cjk', 'DS CjkMed'];
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
  /** library words with a drawing, as the pages deal them */
  const words = () => emblems.filter(e => e.status === 'ready' && e.img);

  return {
    get palettes() { return palettes; }, get emblems() { return emblems; },
    palByName, loadPalettes, loadEmblems, loadFonts, loadLeaflet, emblemFor, leafletFor, specOf, optsOf, words,
  };
})();
