// 波普图案库: rays, Ben-Day screens, stripes, checkers, rings, Kusama polka dots, comic bursts, speech bubbles,
// Memphis squiggles / zigzags / confetti. All coordinates are canvas pixels (callers scale).
const Pattern = (() => {
  const TAU = Math.PI * 2;

  function clipRect(g, x, y, w, h) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); }

  /** sunburst: every other wedge of `n` in `color` */
  function rays(g, cx, cy, n, color, R, rot = 0) {
    g.fillStyle = color;
    for (let i = 0; i < n; i += 2) {
      const a0 = rot + i * TAU / n, a1 = a0 + TAU / n;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath(); g.fill();
    }
  }

  /** Ben-Day screen inside a rect. ramp: {x0,y0,x1,y1,from,to} scales the dot radius along a line */
  function dots(g, x, y, w, h, color, cell, r, angle = Math.PI / 4, ramp = null) {
    clipRect(g, x, y, w, h); g.fillStyle = color;
    const cx = x + w / 2, cy = y + h / 2, ca = Math.cos(angle), sa = Math.sin(angle), n = Math.ceil(Math.hypot(w, h) / 2 / cell) + 1;
    let rl = 0, rx = 0, ry = 0;
    if (ramp) { rx = ramp.x1 - ramp.x0; ry = ramp.y1 - ramp.y0; rl = rx * rx + ry * ry || 1; }
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const lx = i * cell, ly = j * cell, px = cx + lx * ca - ly * sa, py = cy + lx * sa + ly * ca;
      if (px < x - cell || px > x + w + cell || py < y - cell || py > y + h + cell) continue;
      let rr = r;
      if (ramp) { const t = U.clamp(((px - ramp.x0) * rx + (py - ramp.y0) * ry) / rl, 0, 1); rr = r * (ramp.from + (ramp.to - ramp.from) * t); }
      if (rr < 0.35) continue;
      g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
    }
    g.restore();
  }

  function stripes(g, x, y, w, h, color, width, gap, angle = -Math.PI / 4) {
    clipRect(g, x, y, w, h); g.fillStyle = color;
    g.translate(x + w / 2, y + h / 2); g.rotate(angle);
    const L = Math.hypot(w, h);
    for (let t = -L; t < L; t += width + gap) g.fillRect(t, -L, width, 2 * L);
    g.restore();
  }

  function checker(g, x, y, w, h, cell, color) {
    clipRect(g, x, y, w, h); g.fillStyle = color;
    for (let j = 0; j * cell < h; j++) for (let i = j % 2; i * cell < w; i += 2) g.fillRect(x + i * cell, y + j * cell, cell, cell);
    g.restore();
  }

  function rings(g, cx, cy, step, colors, Rmax) {
    let i = 0;
    for (let r = Rmax; r > 0; r -= step, i++) { g.fillStyle = colors[i % colors.length]; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); }
  }

  /** Kusama: irregular polka dots that avoid each other and the `avoid` rects [x0,y0,x1,y1] */
  function polka(g, x, y, w, h, color, rnd, n, rmin, rmax, avoid = []) {
    const placed = [];
    clipRect(g, x, y, w, h); g.fillStyle = color;
    for (let tries = 0; placed.length < n && tries < n * 60; tries++) {
      const r = rmin + (rmax - rmin) * Math.pow(rnd(), 1.6), px = x + rnd() * w, py = y + rnd() * h;
      if (placed.some(p => Math.hypot(p[0] - px, p[1] - py) < p[2] + r + rmin * 0.7)) continue;
      if (avoid.some(a => px + r > a[0] && px - r < a[2] && py + r > a[1] && py - r < a[3])) continue;
      placed.push([px, py, r]);
      g.beginPath(); g.ellipse(px, py, r * (0.92 + rnd() * 0.16), r * (0.92 + rnd() * 0.16), rnd() * Math.PI, 0, TAU); g.fill();
    }
    g.restore();
    return placed;
  }

  /** points of a comic explosion (jagged, irregular) */
  function burstPts(cx, cy, r0, r1, n, rnd) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i + (rnd() - 0.5) * 0.5) * Math.PI / n - Math.PI / 2;
      const r = i % 2 ? r0 * (0.86 + rnd() * 0.22) : r1 * (0.78 + rnd() * 0.36);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }
  function starPts(cx, cy, r0, r1, n, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r0 : r1; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  }
  function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }

  /** speech bubble: an ellipse with a wedge tail toward (tx, ty) */
  function bubble(g, x0, y0, x1, y1, tx, ty) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    const a = Math.atan2(ty - cy, tx - cx), spread = 0.2;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, a + spread, a - spread + TAU);
    g.lineTo(tx, ty); g.closePath();
  }

  function squiggle(g, x, y, len, amp, waves, angle, width, color) {
    g.save(); g.translate(x, y); g.rotate(angle); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); for (let t = 0; t <= 1.0001; t += 0.01) { const px = t * len, py = Math.sin(t * waves * TAU) * amp; t ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke(); g.restore();
  }
  function zigzag(g, x, y, len, amp, n, angle, width, color) {
    g.save(); g.translate(x, y); g.rotate(angle); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(0, 0); for (let i = 1; i <= n * 2; i++) g.lineTo(len * i / (n * 2), i % 2 ? -amp : amp);
    g.stroke(); g.restore();
  }
  function triangle(g, cx, cy, r, rot, color) {
    g.fillStyle = color; poly(g, [0, 1, 2].map(k => [cx + Math.cos(rot + k * TAU / 3) * r, cy + Math.sin(rot + k * TAU / 3) * r])); g.fill();
  }
  function sparkle(g, cx, cy, r, color) {
    g.fillStyle = color; g.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 - Math.PI / 2, b = a + Math.PI / 4;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.lineTo(cx + Math.cos(b) * r * 0.22, cy + Math.sin(b) * r * 0.22);
    }
    g.closePath(); g.fill();
  }
  /** a dot grid patch (Memphis "sprinkles") */
  function grid(g, x, y, w, h, cell, r, color) {
    g.fillStyle = color;
    for (let py = y + cell / 2; py < y + h; py += cell) for (let px = x + cell / 2; px < x + w; px += cell) { g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill(); }
  }

  // ---- soft variants: nothing is ever sliced. Each dot / cell / stripe run is drawn whole or not at all, and a
  // caller-supplied field decides: k(x, y) scales a dot (0..1) so screens fade out like a halftone ramp,
  // ok(x, y, r) says whether an element of radius r may sit there.

  /** Ben-Day screen whose dots shrink to nothing where k() falls off */
  function dotsSoft(g, x, y, w, h, color, cell, r, angle, k) {
    g.fillStyle = color;
    const cx = x + w / 2, cy = y + h / 2, ca = Math.cos(angle), sa = Math.sin(angle), n = Math.ceil(Math.hypot(w, h) / 2 / cell) + 1;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const lx = i * cell, ly = j * cell, px = cx + lx * ca - ly * sa, py = cy + lx * sa + ly * ca;
      if (px < x || px > x + w || py < y || py > y + h) continue;
      const rr = r * k(px, py);
      if (rr < Math.max(0.6, r * 0.12)) continue;
      g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill();
    }
  }
  function polkaSoft(g, x, y, w, h, color, rnd, n, rmin, rmax, ok) {
    const placed = [];
    g.fillStyle = color;
    for (let tries = 0; placed.length < n && tries < n * 80; tries++) {
      const r = rmin + (rmax - rmin) * Math.pow(rnd(), 1.6), px = x + rnd() * w, py = y + rnd() * h;
      if (placed.some(p => Math.hypot(p[0] - px, p[1] - py) < p[2] + r + rmin * 0.7) || !ok(px, py, r)) continue;
      placed.push([px, py, r]);
      g.beginPath(); g.ellipse(px, py, r * (0.92 + rnd() * 0.16), r * (0.92 + rnd() * 0.16), rnd() * Math.PI, 0, TAU); g.fill();
    }
    return placed;
  }
  /** checkerboard anchored at (ox, oy) so the grid lands on the region's inner edges; cells near type are dropped whole */
  function checkerSoft(g, x, y, w, h, cell, color, ox, oy, ok) {
    clipRect(g, x, y, w, h); g.fillStyle = color;
    const i0 = Math.floor((x - ox) / cell), i1 = Math.ceil((x + w - ox) / cell), j0 = Math.floor((y - oy) / cell), j1 = Math.ceil((y + h - oy) / cell);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      if ((i + j) & 1) continue;
      const px = ox + i * cell, py = oy + j * cell;
      if (ok(px + cell / 2, py + cell / 2, cell * 0.72)) g.fillRect(px, py, cell, cell);
    }
    g.restore();
  }
  /** stripes as round-capped runs that stop short of anything ok() refuses */
  function stripesSoft(g, x, y, w, h, color, width, gap, angle, ok) {
    clipRect(g, x, y, w, h); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round';
    const cx = x + w / 2, cy = y + h / 2, L = Math.hypot(w, h) / 2 + width, ca = Math.cos(angle), sa = Math.sin(angle), step = Math.max(2, width / 4);
    const inR = (px, py) => px > x - width && px < x + w + width && py > y - width && py < y + h + width;
    for (let t = -L; t < L; t += width + gap) {
      let run = null;
      const flush = () => { if (run && Math.hypot(run[2] - run[0], run[3] - run[1]) > width * 0.8) { g.beginPath(); g.moveTo(run[0], run[1]); g.lineTo(run[2], run[3]); g.stroke(); } run = null; };
      for (let u = -L; u <= L; u += step) {
        // the stripe runs along (-sa, ca) and sits at offset t across it
        const px = cx + t * ca - u * sa, py = cy + t * sa + u * ca;
        if (inR(px, py) && ok(px, py, width / 2 + step)) { if (run) { run[2] = px; run[3] = py; } else run = [px, py, px, py]; }
        else flush();
      }
      flush();
    }
    g.restore();
  }

  return { rays, dots, stripes, checker, rings, polka, burstPts, starPts, poly, bubble, squiggle, zigzag, triangle, sparkle, grid, clipRect,
    dotsSoft, polkaSoft, checkerSoft, stripesSoft };
})();
