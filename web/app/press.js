// The press: a stamp state printed to a canvas (front with its plates, back with its leaflet), and the seep-in that
// prints a stamp onto its blank sheet plate by plate. Every page prints through these.
const Press = (() => {
  const { specOf, emblemFor, leafletFor, optsOf, palByName } = Assets;

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
  function makeBack(st, scale, fr) {
    const l = leafletFor(st) || Leaflet.fallback(st.phrase.trim(), st.en.trim());
    return Stamp.renderBack(specOf(st), palByName(st.palette), l, { ...optsOf(st, scale), embossFrom: fr && fr.embossMask });
  }

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

  return { makeFront, makeBack, printIn };
})();
