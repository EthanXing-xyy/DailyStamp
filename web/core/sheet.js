// 整版: a full pane of 32 stamps (8 x 4, like Warhol's 32 Campbell's Soup Cans), shared perforations, printed selvage.
const Sheet = (() => {
  const COLS = 8, ROWS = 4;

  /** items: [{spec, pal, emblem, opts}] (up to 32); returns the sheet canvas (paper with punched holes, transparent outside) */
  async function render(items, sc = 0.3, onProgress) {
    const cw = Stamp.BW * sc, ch = Stamp.BH * sc, M = 300 * sc;
    const W = Math.round(COLS * cw + 2 * M), H = Math.round(ROWS * ch + 2 * M);
    const out = Stamp.paper(W, H, sc, 99), g = out.getContext('2d');
    const X = v => v * sc;

    for (let i = 0; i < Math.min(items.length, COLS * ROWS); i++) {
      const it = items[i];
      const st = Stamp.renderFront(it.spec, it.pal, it.emblem, { ...it.opts, scale: sc, noPerf: true, grain: false });
      g.drawImage(st, Math.round(M + (i % COLS) * cw), Math.round(M + Math.floor(i / COLS) * ch));
      if (onProgress) onProgress(i + 1);
      await new Promise(r => setTimeout(r, 0));
    }

    // selvage print
    const ink = '#1d1d1f';
    U.drawMixed(g, M, M * 0.42, '每日邮政 · 每日一枚 · 第一辑', 'caps', 'cjk_small', Math.round(40 * sc), ink, 6 * sc, 1, 'left');
    U.drawTracked(g, M, M * 0.66, `DAILY POST · ONE MOOD A DAY · FULL SHEET OF ${COLS * ROWS}`, U.font('caps_med', Math.round(22 * sc)), ink, 8 * sc, 'left');
    U.drawMixed(g, W - M, M * 0.42, `${items.length} / ${COLS * ROWS} 枚`, 'caps', 'cjk_small', Math.round(40 * sc), ink, 4 * sc, 1, 'right');
    U.drawMixed(g, W - M, M * 0.66, `全张 ${new Set(items.map(it => it.spec.phrase)).size} 种情绪`, 'caps_med', 'cjk_small_med', Math.round(24 * sc), ink, 4 * sc, 1, 'right');
    // row / column numbers
    for (let r = 0; r < ROWS; r++) U.drawCentered(g, M * 0.55, M + (r + 0.5) * ch, String(r + 1), U.font('caps_med', Math.round(30 * sc)), ink);
    for (let c = 0; c < COLS; c++) U.drawCentered(g, M + (c + 0.5) * cw, H - M * 0.5, String(c + 1), U.font('caps_med', Math.round(30 * sc)), ink);
    // registration crosshairs, mid-side
    const cross = (x, y) => {
      g.save(); g.strokeStyle = ink; g.lineWidth = Math.max(1, 2 * sc);
      g.beginPath(); g.arc(x, y, X(34), 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x - X(56), y); g.lineTo(x + X(56), y); g.moveTo(x, y - X(56)); g.lineTo(x, y + X(56)); g.stroke();
      g.restore();
    };
    cross(W / 2, M * 0.5); cross(W - M * 0.5, H / 2); cross(M * 0.2 + X(40), H - M * 0.5);
    // colour bar: every spot ink on the pane, then process CMYK
    const inksUsed = [...new Set(items.flatMap(it => [...it.pal.c, it.pal.ink]))].slice(0, 16);
    const bar = [...inksUsed, '#00AEEF', '#EC008C', '#FFF200', '#111111'];
    const sq = X(46);
    bar.forEach((c, i) => {
      const x = W - M - (bar.length - i) * (sq + X(10)), y = H - M * 0.5 - sq / 2;
      g.fillStyle = c; g.fillRect(x, y, sq, sq);
    });
    // tint ramp of the first spot ink (screen percentages), a printer's control strip
    if (inksUsed[0]) [100, 75, 50, 25, 10].forEach((p, i) => {
      g.save(); g.globalAlpha = p / 100; g.fillStyle = inksUsed[0];
      g.fillRect(M * 0.2 + X(130) + i * (sq + X(8)), H - M * 0.5 - sq / 2, sq, sq); g.restore();
    });

    U.grain(g, W, H, 0.2, 9);

    // shared perforations along every grid line (full holes, the selvage keeps the pane in one piece)
    g.save(); g.globalCompositeOperation = 'destination-out';
    const rnd = Print.rng(7), r0 = 13 * sc, pitch = 46 * sc;
    const line = (x0, y0, x1, y1) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / pitch);
      for (let i = 0; i <= n; i++) { const t = i / n; g.beginPath(); g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 * (0.95 + rnd() * 0.1), 0, Math.PI * 2); g.fill(); }
    };
    // lines run a little into the selvage, as on real panes
    const ext = X(90);
    for (let c = 0; c <= COLS; c++) line(M + c * cw, M - ext, M + c * cw, H - M + ext);
    for (let r = 0; r <= ROWS; r++) line(M - ext, M + r * ch, W - M + ext, M + r * ch);
    g.restore();
    return out;
  }

  return { COLS, ROWS, render };
})();
