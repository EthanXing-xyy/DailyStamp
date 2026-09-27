// Colour + text helpers shared by label.js / vessel.js / app.js
const U = (() => {
  const hexToRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
  const lum = h => {
    const [r, g, b] = hexToRgb(h).map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const textOn = (bg, pal) => contrast(bg, pal.ink) >= contrast(bg, pal.paper) ? pal.ink : pal.paper;
  const shade = (h, k) => rgbToHex(hexToRgb(h).map(c => c * k));
  const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((c, i) => c * (1 - t) + hexToRgb(b)[i] * t));
  const clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;
  // OKLab / OKLCH (Björn Ottosson): hues and lightness that look even, for muting inks and blending between them
  const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const fromLin = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const oklab = h => {
    const [r, g, b] = hexToRgb(h).map(toLin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  };
  const fromOklab = ([L, A, B]) => {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3,
      s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
    return rgbToHex([4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(c => fromLin(Math.max(0, Math.min(1, c)))));
  };
  const oklch = h => { const [L, A, B] = oklab(h); return [L, Math.hypot(A, B), Math.atan2(B, A)]; };
  const fromOklch = (L, C, hue) => fromOklab([L, C * Math.cos(hue), C * Math.sin(hue)]);
  const mixOklab = (a, b, t) => { const p = oklab(a), q = oklab(b); return fromOklab(p.map((v, i) => v + (q[i] - v) * t)); };

  const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;
  const hasCjk = s => CJK.test(s);
  const splitRuns = s => {
    const runs = [];
    for (const ch of s) {
      const c = CJK.test(ch);
      if (runs.length && runs[runs.length - 1].cjk === c) runs[runs.length - 1].text += ch;
      else runs.push({ cjk: c, text: ch });
    }
    return runs;
  };

  const FAM = {
    brand_cjk: 'DS Brand', brand_latin: 'DS Brand', phrase_cjk: 'DS Phrase', phrase_latin: 'DS Black',
    caps: 'DS Caps', caps_med: 'DS CapsMed', cjk_small: 'DS Cjk', cjk_small_med: 'DS CjkMed',
  };
  const font = (role, size) => `${size}px "${FAM[role]}"`;

  function measure(ctx, text, fontStr, tracking = 0) {
    ctx.font = fontStr;
    let w = 0, asc = 0, desc = 0;
    if (tracking) {
      for (const ch of text) { const m = ctx.measureText(ch); w += m.width; asc = Math.max(asc, m.actualBoundingBoxAscent); desc = Math.max(desc, m.actualBoundingBoxDescent); }
      w += tracking * ([...text].length - 1);
    } else {
      const m = ctx.measureText(text); w = m.width; asc = m.actualBoundingBoxAscent; desc = m.actualBoundingBoxDescent;
    }
    return { w, h: asc + desc, asc, desc };
  }

  function fitFont(ctx, role, text, maxW, maxH, tracking = 0) {
    let lo = 8, hi = 1200, best = 8;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const m = measure(ctx, text, font(role, mid), tracking);
      if (m.w <= maxW && m.h <= maxH) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return best;
  }

  // draw text centred on (x, y) using the glyphs' real bounding box (like PIL anchor "mm")
  function drawCentered(ctx, x, y, text, fontStr, color) {
    ctx.font = fontStr; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(text);
    ctx.fillText(text, x, y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
  }

  function drawTracked(ctx, x, y, text, fontStr, color, tracking = 0, align = 'center') {
    if (!tracking) return drawCentered(ctx, x, y, text, fontStr, color);
    ctx.font = fontStr; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const chars = [...text];
    const widths = chars.map(c => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + tracking; });
    return total;
  }

  function drawMixed(ctx, x, y, text, latinRole, cjkRole, size, color, tracking = 0, cjkScale = 0.92, align = 'center') {
    const fl = font(latinRole, size), fc = font(cjkRole, Math.round(size * cjkScale));
    const runs = splitRuns(text).map(r => {
      ctx.font = r.cjk ? fc : fl;
      const chars = [...r.text];
      const widths = chars.map(c => ctx.measureText(c).width);
      return { f: ctx.font, chars, widths, w: widths.reduce((a, b) => a + b, 0) + tracking * chars.length };
    });
    const total = runs.reduce((a, r) => a + r.w, 0) - tracking;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const r of runs) { ctx.font = r.f; r.chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += r.widths[i] + tracking; }); }
    return total;
  }

  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // overlay-blended paper grain; cached per size
  const grainCache = new Map();
  function grain(ctx, w, h, alpha = 0.55, seed = 1) {
    const key = w + 'x' + h + ':' + seed;
    let g = grainCache.get(key);
    if (!g) {
      g = canvas(w, h);
      const id = g.getContext('2d').createImageData(w, h);
      let s = seed * 9301 + 49297;
      for (let i = 0; i < id.data.length; i += 4) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const v = 128 + ((s >> 8) % 41) - 20;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
      }
      g.getContext('2d').putImageData(id, 0, 0);
      grainCache.set(key, g);
      // stamps share a handful of sizes; one-off big ones (an export, a page's sheet) must not stay for good:
      // about 24 MB of grain at most, the oldest go first
      let px = 0; for (const c of grainCache.values()) px += c.width * c.height;
      for (const [k, c] of grainCache) { if (px <= 6e6 || grainCache.size <= 1) break; if (k === key) continue; px -= c.width * c.height; grainCache.delete(k); }
    } else { grainCache.delete(key); grainCache.set(key, g); }
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = alpha; ctx.drawImage(g, 0, 0); ctx.restore();
  }

  // Windows 8 style touch feedback: while held a stamp sinks a little and tips toward the finger, then springs back.
  // now.x/y is the finger in -1..1 of the element, now.d how far it is pushed in (0..1); apply(now) draws each frame.
  function presser(apply) {
    const now = { x: 0, y: 0, d: 0 }, to = { x: 0, y: 0, d: 0 };
    let raf = 0, last = 0, at = 0, hold = 0;
    const tick = t => {
      const dt = Math.min(64, t - (last || t)); last = t;
      const k = 1 - Math.exp(-dt / (to.d > now.d ? 45 : 130)), kxy = 1 - Math.exp(-dt / 60);
      now.d += (to.d - now.d) * k;
      now.x += (to.x - now.x) * kxy; now.y += (to.y - now.y) * kxy;
      const still = Math.abs(to.d - now.d) < 0.002 && Math.abs(to.x - now.x) + Math.abs(to.y - now.y) < 0.002;
      if (still) Object.assign(now, to);
      apply(now);
      raf = still ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
    return {
      now,
      get held() { return to.d > 0; },
      /** the finger's spot on el, clamped to -1..1 */
      point(el, cx, cy) {
        const r = el.getBoundingClientRect();
        return { x: clamp((cx - r.left) / r.width * 2 - 1, -1, 1), y: clamp((cy - r.top) / r.height * 2 - 1, -1, 1) };
      },
      down(p = { x: 0, y: 0 }) {
        clearTimeout(hold);
        if (now.d < 0.05) Object.assign(now, p);          // tip straight toward the finger, don't swing in from the middle
        Object.assign(to, p, { d: 1 }); at = performance.now(); kick();
      },
      aim(p) { Object.assign(to, p); kick(); },
      // even a quick tap is felt: it stays down until it has mostly sunk in
      release() {
        if (!to.d) return;
        clearTimeout(hold);
        hold = setTimeout(() => { to.d = 0; kick(); }, Math.max(0, 110 - (performance.now() - at)));
      },
    };
  }

  return { hexToRgb, rgbToHex, oklab, fromOklab, oklch, fromOklch, mixOklab, lum, contrast, textOn, shade, mix, clamp, hasCjk, splitRuns, font, measure, fitFont, drawCentered, drawTracked, drawMixed, canvas, grain, presser };
})();
