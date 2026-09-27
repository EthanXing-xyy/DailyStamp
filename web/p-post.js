// 寄一张: a two-sided postcard. The picture side repeats the chosen stamp four times in four palettes (Warhol's
// repetition with variation) over a two-ink diagonal ground; the message side takes your words in a brush hand, the
// addressee, and the stamp, which has to be cancelled before the card can go. Going = two PNGs, through the phone's
// share sheet or as downloads, and a copy in the album.
(() => {
  const EW = 1800, EH = 1200;                               // export size

  function mount(root, deps) {
    const { el, clamp } = Kit;
    Kit.head(root, 5, 'POST ONE', '寄一张');
    const status = Kit.status(root);
    const card = el('div', 'post-card'), inner = el('div', 'post-in');
    const back = el('div', 'post-face post-back'), front = el('div', 'post-face post-front');
    const backCv = el('canvas'), frontCv = el('canvas');
    const msg = el('textarea', 'post-msg'), to = el('textarea', 'post-to');
    msg.placeholder = '写点什么……'; msg.maxLength = 120; to.placeholder = '寄给谁'; to.maxLength = 30; to.rows = 2;
    back.append(backCv, msg, to); front.append(frontCv); inner.append(back, front); card.append(inner);
    const tools = el('div', 'post-tools'), tray = el('div', 'post-tray');
    const bFlip = Kit.button(tools, '翻面'), bCancel = Kit.button(tools, '盖戳'), bSend = Kit.button(tools, '寄出');
    bCancel.style.setProperty('--swash', '#26262b'); bSend.style.setProperty('--swash', '#ff6a00');
    root.append(card, tools, tray);

    let turns = 0, st = null, pickedKey = '', affixed = null, cancelled = null, W = 0, H = 0, cw = 0, chh = 0;
    const flip = () => { turns++; inner.style.transform = `rotateY(${turns * 180}deg)`; };
    bFlip.onclick = flip;

    function layout() {
      W = innerWidth; H = innerHeight;
      const phone = W < H, short = !phone && H < 560;          // short: a phone on its side, same layout, tighter
      const top = phone ? 112 : short ? 70 : 104, trayH = short ? Math.max(52, Math.round(H * 0.15)) : 0;
      cw = phone ? W - 24 : short ? Math.min(W * 0.62, (H - top - 50 - trayH - 28) * 1.5) : Math.min(W * 0.62, (H - 300) * 1.5); chh = cw / 1.5;
      Object.assign(card.style, { left: (W - cw) / 2 + 'px', top: top + 'px', width: cw + 'px', height: chh + 'px' });
      const toolsGap = short ? 6 : 14, trayGap = short ? 44 : 62;
      tools.style.cssText = `left:0;right:0;top:${top + chh + toolsGap}px`;
      const th = phone ? 96 : short ? trayH : Math.max(84, Math.min(120, H - (top + chh + 62) - 40));
      tray.style.cssText = `left:12px;right:12px;top:${top + chh + trayGap}px;height:${th}px`;
      status.el.style.cssText = `left:16px;right:16px;top:${Math.min(H - 24, top + chh + trayGap + (phone ? 110 : th) + (short ? 4 : 10))}px`;
      root.style.setProperty('--k', (cw / EW).toFixed(4));
      for (const cv of [backCv, frontCv]) { cv.style.width = '100%'; cv.style.height = '100%'; }
    }

    // ---- the message side: paper, a divider, the stamp spot (four corner ticks, no box), then the stamp and the mark
    const SX = EW - 60 - 300, SY = 60, SW = 300, SH = 375;
    let paper = null;
    function drawBack(forExport = false) {
      const c = forExport ? U.canvas(EW, EH) : backCv; c.width = EW; c.height = EH;
      const g = c.getContext('2d');
      if (!paper) { paper = Stamp.paper(EW, EH, 1.3, 71); const pg = paper.getContext('2d'); U.grain(pg, EW, EH, 0.18, 4); }
      g.drawImage(paper, 0, 0);
      const ink = '#2b2a33';
      g.strokeStyle = 'rgba(43,42,51,.55)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(EW * 0.56, 150); g.lineTo(EW * 0.56, EH - 90); g.stroke();
      U.drawTracked(g, 90, 110, 'POST CARD', U.font('caps', 40), ink, 12, 'left');
      U.drawMixed(g, 90, 150, '明信片 · 每日邮政', 'caps_med', 'cjk_small_med', 22, ink, 6, 1, 'left');
      if (!affixed) {
        g.strokeStyle = 'rgba(43,42,51,.5)'; g.lineWidth = 3; const t = 34;
        for (const [x, y, dx, dy] of [[SX, SY, 1, 1], [SX + SW, SY, -1, 1], [SX, SY + SH, 1, -1], [SX + SW, SY + SH, -1, -1]]) {
          g.beginPath(); g.moveTo(x + dx * t, y); g.lineTo(x, y); g.lineTo(x, y + dy * t); g.stroke();
        }
        U.drawCentered(g, SX + SW / 2, SY + SH / 2, '贴票处', U.font('cjk_small_med', 26), 'rgba(43,42,51,.4)');
      } else {
        g.save(); g.shadowColor = 'rgba(0,0,0,.22)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
        g.translate(SX + SW / 2, SY + SH / 2); g.rotate(0.03); g.drawImage(affixed, -SW / 2, -SH / 2, SW, SH); g.restore();
      }
      if (cancelled) Stamp.postmark(g, SX - 10, SY + SH * 0.62, 118, 1, { no: st.no, date: deps.date }, cancelled.rot, cancelled.seed);
      if (forExport) {                                      // the words, set in the brush hand the textareas show
        g.fillStyle = '#1f2a55';
        wrapText(g, msg.value, 100, 290, EW * 0.56 - 170, 88, U.font('brand_cjk', 64));
        wrapText(g, to.value ? '寄给  ' + to.value : '', EW * 0.56 + 70, SY + SH + 200, EW * 0.44 - 150, 84, U.font('brand_cjk', 58));
      }
      return c;
    }
    function wrapText(g, text, x, y, maxW, lh, font) {
      g.font = font; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      for (const para of String(text).split('\n')) {
        let line = '';
        for (const ch of para) { if (g.measureText(line + ch).width > maxW && line) { g.fillText(line, x, y); y += lh; line = ch; } else line += ch; }
        g.fillText(line, x, y); y += lh;
      }
    }

    // ---- the picture side: the stamp four times, each in another palette, on a diagonal two-ink ground
    function drawFront() {
      const c = frontCv; c.width = EW; c.height = EH;
      const g = c.getContext('2d');
      if (!st) { g.drawImage(Stamp.paper(EW, EH, 1.3, 72), 0, 0); U.drawCentered(g, EW / 2, EH / 2, '先选一枚邮票', U.font('cjk_small_med', 44), 'rgba(43,42,51,.45)'); return c; }
      const pal = deps.palettes.find(p => p.name === st.palette) || deps.palettes[0], rnd = Print.rng(Kit.hash(st.phrase + st.seed));
      const cols = Colors.roles(pal, 1);
      g.fillStyle = cols[0]; g.fillRect(0, 0, EW, EH);
      const a = (0.42 + rnd() * 0.25) * (rnd() < 0.5 ? 1 : -1);         // a decisive diagonal, never level
      g.save(); g.translate(EW / 2, EH / 2); g.rotate(a); g.fillStyle = cols[1]; g.fillRect(-EW * 1.5, 0, EW * 3, EH * 2); g.restore();
      const others = deps.palettes.filter(p => p.name !== st.palette), picks = [st.palette];
      while (picks.length < 4) { const p = others[Math.floor(rnd() * others.length)].name; if (!picks.includes(p)) picks.push(p); }
      const sw = EW * 0.9 / 4, sh = sw * 1.25, y = (EH - sh) / 2 - 20;
      picks.forEach((p, i) => {
        const s2 = { ...st, palette: p, shift: (st.shift + i) % 4 };
        const f = deps.makeFront(s2, sw / Stamp.BW);
        g.save(); g.translate(EW * 0.05 + sw * (i + 0.5), y + sh / 2); g.rotate((i % 2 ? 1 : -1) * (0.012 + rnd() * 0.02));
        g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 18; g.shadowOffsetY = 8; g.drawImage(f, -sw / 2 * 0.94, -sh / 2 * 0.94, sw * 0.94, sh * 0.94); g.restore();
      });
      U.drawTracked(g, EW - 70, EH - 60, 'GREETINGS FROM THE DAILY POST', U.font('caps', 24), pal.ink, 8, 'right');
      U.grain(g, EW, EH, 0.16, 6);
      return c;
    }

    // ---- choosing a stamp: today's and the album's latest
    async function fillTray() {
      tray.innerHTML = '';
      const seen = new Set(), list = [];
      for (const s of deps.homePlans || []) { const k = s.phrase + s.seed; if (!seen.has(k)) { seen.add(k); list.push(s); } }
      const al = (await deps.album.all()).filter(e => e.st && !e.marks).sort((a, b) => b.added - a.added).slice(0, 10);
      for (const e of al) { const k = e.st.phrase + e.st.seed; if (!seen.has(k)) { seen.add(k); list.push(e.st); } }
      for (const [i, s] of list.entries()) {
        const b = el('button', 'post-pick'), cv = el('canvas'); b.type = 'button'; b.append(cv); tray.append(b);
        b.dataset.key = s.phrase + s.seed; b.classList.toggle('on', b.dataset.key === pickedKey);
        b.onclick = () => pick(s, b);
        await Kit.wait(0);
        await deps.loadLeaflet(s.phrase);
        const f = deps.makeFront(s, 0.12);
        Kit.put(cv, f); cv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: i * 40, fill: 'backwards' });
      }
    }
    // the stamp spot on screen: where a picked stamp (or the one tapped on the home) lands
    function spot() {
      const r = card.getBoundingClientRect();
      return new DOMRect(r.left + SX / EW * r.width, r.top + SY / EH * r.height, SW / EW * r.width, SH / EH * r.height);
    }
    async function pick(s, b, { fly = true } = {}) {
      st = s; cancelled = null; pickedKey = s.phrase + s.seed;
      tray.querySelectorAll('.post-pick').forEach(x => x.classList.toggle('on', x.dataset.key === pickedKey));
      if (turns % 2) flip();                                   // show the message side to stick it on
      if (fly && b) {
        Kit.audio(); Kit.rustle(0.03, 0.15);
        const from = b.getBoundingClientRect(), sp = spot();
        const tx = sp.left + sp.width / 2, ty = sp.top + sp.height / 2, tw = sp.width;
        const fc = el('canvas', 'post-fly'); Kit.put(fc, b.querySelector('canvas')); root.append(fc);
        Object.assign(fc.style, { left: tx - tw / 2 + 'px', top: ty - tw * 0.625 + 'px', width: tw + 'px', height: tw * 1.25 + 'px' });
        await fc.animate([{ transform: `translate(${from.left + from.width / 2 - tx}px, ${from.top + from.height / 2 - ty}px) scale(${from.width / tw})` },
          { transform: 'translate(0,-14px) scale(1.06) rotate(-3deg)', offset: 0.7 }, { transform: 'rotate(1.7deg)' }],
          { duration: 700, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' }).finished;
        fc.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => fc.remove());
      }
      await deps.loadLeaflet(s.phrase);
      affixed = deps.makeFront(s, SW / Stamp.BW * 1.4);
      drawBack();
      if (fly) drawFront();
      else setTimeout(drawFront, 700);                       // the picture side is out of sight: drawn once the stamp has landed
      frontCv.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 700, easing: 'ease' });
      bCancel.disabled = false; bSend.disabled = true;
      status.set(`「${s.phrase}」贴好了 · 盖上邮戳才能寄出`);
    }
    bCancel.onclick = () => {
      if (!affixed) return status.flash('先从下面挑一枚邮票贴上');
      if (turns % 2) flip();
      Kit.audio(); Kit.thump(0.8);
      cancelled = { rot: -0.3 + Math.random() * 0.4, seed: Math.floor(Math.random() * 1e6) };
      const before = U.canvas(EW, EH); before.getContext('2d').drawImage(backCv, 0, 0);
      drawBack();
      backCv.animate([{ filter: 'brightness(1.04)' }, { filter: 'none' }], { duration: 220 });
      card.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(3px) scale(.995)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
      bSend.disabled = false; status.set('盖好了 · 写几句话就可以寄出');
    };
    bSend.onclick = async () => {
      if (!cancelled) return status.flash('还没盖邮戳');
      bSend.disabled = true;
      const b = drawBack(true), f = drawFront();
      const fImg = U.canvas(EW, EH); fImg.getContext('2d').drawImage(f, 0, 0);
      const name = `${deps.date}-${st.phrase}`;
      const how = await Kit.save([{ cv: fImg, name: `postcard-${name}-front.png` }, { cv: b, name: `postcard-${name}-back.png` }]);
      if (how !== 'cancelled') {
        deps.album.add({ id: 'post:' + Date.now(), kind: 'post', date: deps.date, image: await Kit.blobOf(fImg), back: await Kit.blobOf(b), meta: { to: to.value } });
        status.set(how === 'shared' ? '已经交给分享 · 也收进了集邮册' : '存好两张图片 · 也收进了集邮册');
      }
      bSend.disabled = false;
    };

    bCancel.disabled = true; bSend.disabled = true;
    layout();
    drawBack(); drawFront();
    status.set('从下面挑一枚邮票贴上');
    addEventListener('resize', layout);
    Kit.wait(1100).then(fillTray);                             // after the flight in: the tray fades in stamp by stamp
    return {
      ready: Promise.resolve(),
      anchor: spot,
      source: () => null,
      receive: s => pick(s, null, { fly: false }).then(() => 250),         // the stamp tapped on the home lands on the stamp spot and stays
    };
  }
  Pages.define('post', mount);
})();
