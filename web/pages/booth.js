// 邮票大头贴: a photo booth that prints stamps. Step behind the curtain, press 开拍: three, two, one, a flash, four
// times over. Each shot is split into Warhol's plates and printed as a stamp in its own palette, a library word on it,
// and the strip of four slides out of the slot and develops. The camera is only opened for the shots and closed right
// after; photos never leave the browser. No camera (or no permission): pick a photo instead.
(() => {
  const TAU = Math.PI * 2, SHOTS = 4, FW = 480, FH = 600;

  function mount(root, deps) {
    const { el, clamp } = Kit, date = deps.date;
    const P = Kit.page(root, 'booth', () => layout());
    const status = P.status;
    const booth = el('div', 'bt-booth'), finder = el('div', 'bt-finder'), video = el('video', 'bt-video'), count = el('b', 'bt-count'), flash = el('i', 'bt-flash');
    const curtain = el('div', 'bt-curtain'), slot = el('div', 'bt-slot'), strip = el('canvas', 'bt-strip'), acts = el('div', 'bt-acts'), note = el('p', 'bt-note', '照片只在你的浏览器里处理，不会上传');
    const file = el('input'); file.type = 'file'; file.accept = 'image/*'; file.setAttribute('capture', 'user'); file.hidden = true;
    video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.autoplay = true;
    finder.append(video, count, flash); booth.append(curtain, finder); slot.append(strip);
    root.append(booth, slot, acts, note, file);
    const bShoot = Kit.button(acts, '开拍'), bPhoto = Kit.button(acts, '用照片'), bSave = Kit.button(acts, '存为图片');
    bShoot.style.setProperty('--swash', '#ff5fa2'); bPhoto.style.setProperty('--swash', '#23D5E8'); bSave.style.setProperty('--swash', '#ffb000'); bSave.hidden = true;
    const pal0 = deps.palettes[Kit.hash('booth' + date) % deps.palettes.length];
    curtain.style.setProperty('--curtain', pal0.c[1]); curtain.style.setProperty('--curtain2', U.shade(pal0.c[1], 0.8));

    // ---- layout: the booth with its viewfinder, the slot the strip comes out of
    let W = 0, H = 0, phone = false, fh = 0, fw = 0, sh = 0;
    function layout() {
      ({ W, H, phone } = P.measure());
      fh = phone ? Math.min(H * 0.46, (W - 90) * 1.25) : Math.min(H - 310, 500); fw = fh * 0.8;
      const bw = fw * 1.34, bh = fh * 1.2, bx = phone ? W / 2 - bw / 2 : W * 0.36 - bw / 2, by = phone ? 100 : 108;
      Object.assign(booth.style, { left: bx + 'px', top: by + 'px', width: bw + 'px', height: bh + 'px' });
      Object.assign(finder.style, { left: (bw - fw) / 2 + 'px', top: (bh - fh) / 2 + 'px', width: fw + 'px', height: fh + 'px' });
      const SR = 520 / (20 + SHOTS * ((520 - 40) * 1.25 + 14) + 180);   // the strip's width to its length
      sh = phone ? H - 150 : Math.min(H - 150, 760);
      const sw = sh * SR;
      Object.assign(slot.style, phone ? { left: W / 2 - sw / 2 + 'px', top: '96px', width: sw + 'px', height: sh + 'px' }
        : { left: bx + bw + Math.max(40, (W - bx - bw - sw) / 2 - 10) + 'px', top: '96px', width: sw + 'px', height: sh + 'px' });
      acts.style.cssText = `left:12px;right:12px;top:${phone ? by + bh + 12 : by + bh + 14}px;${phone ? '' : `width:${bw}px;left:${bx}px`}`;
      note.style.cssText = `left:16px;right:16px;top:${phone ? by + bh + 58 : by + bh + 60}px;${phone ? '' : `width:${bw}px;left:${bx}px;right:auto`}`;
      status.el.style.cssText = phone ? `left:16px;right:16px;top:${H - 30}px` : `left:${bx}px;width:${bw}px;top:${by + bh + 84}px`;
      note.style.display = !phone && by + bh + 84 > H - 40 ? 'none' : '';
    }

    // ---- one stamp from one shot: a Warhol screen print in its own palette, a word on it, perforated
    function printFrame(plates, k, seed) {
      const rnd = Print.rng(seed), pal = deps.palettes[(Kit.hash(date) + k * 5 + Math.floor(rnd() * 3)) % deps.palettes.length], c = Colors.roles(pal, k % 4);
      const out = Stamp.blank(0.4, 30 + k), g = out.getContext('2d'), s = 0.4, x0 = 52 * s, y0 = 52 * s, w = (1200 - 104) * s, h = (1500 - 104) * s;
      const field = U.canvas(Math.round(w), Math.round(h)), f = field.getContext('2d');
      f.fillStyle = c[0]; f.fillRect(0, 0, w, h);
      const size = Math.max(w, h), ox = (w - size) / 2, oy = (h - size) / 2 + size * 0.04;
      const off = () => [(rnd() - 0.5) * 2 * (2 + rnd() * 5) * s, (rnd() - 0.5) * 2 * (2 + rnd() * 5) * s];
      const plate = (m, col) => { const [dx, dy] = off(); f.drawImage(Print.tinted(m, col, size), ox + dx, oy + dy, size, size); };
      plate(plates.light, c[1]); plate(plates.mid, c[2]); plate(plates.accent, c[3]); plate(plates.key, pal.ink);
      U.grain(f, field.width, field.height, 0.24, 3 + k);
      g.drawImage(field, x0, y0);
      // the type prints last, on top: a library word big in a corner, the issue small in the other
      const words = deps.words, w0 = words.length ? words[Math.floor(rnd() * words.length)] : { phrase: '今天' };
      const word = U.hasCjk(w0.phrase) ? w0.phrase : w0.phrase.toUpperCase(), fs = Math.round(Math.min(150, 560 / Math.max(2, [...word].length)) * s);
      g.save(); g.shadowColor = pal.ink; g.shadowOffsetX = 5 * s; g.shadowOffsetY = 5 * s;
      U.drawMixed(g, x0 + w - 36 * s, y0 + h - fs * 0.7 - 24 * s, word, 'phrase_latin', 'phrase_cjk', fs, U.contrast(c[3], pal.ink) > 3 ? c[3] : '#F4EEDF', 4 * s, 1, 'right');
      g.restore();
      U.drawMixed(g, x0 + 30 * s, y0 + 46 * s, `每日邮政 · ${date.replace(/-/g, '.')}`, 'caps', 'cjk_small', Math.round(34 * s), pal.ink, 3 * s, 1, 'left');
      U.drawTracked(g, x0 + 30 * s, y0 + 86 * s, `PHOTO BOOTH · ${k + 1}/${SHOTS}`, U.font('caps_med', Math.round(22 * s)), pal.ink, 5 * s, 'left');
      return out;
    }
    // the strip: four stamps down a length of photo paper, the booth's name at the foot
    let frames = [];
    function makeStrip() {
      const sw = 520, pad = 20, fh2 = (sw - 2 * pad) * 1.25, H2 = pad + SHOTS * (fh2 + 14) + 180;
      const c = U.canvas(sw, Math.round(H2)), g = c.getContext('2d');
      g.drawImage(Stamp.paper(sw, c.height, 0.5, 41), 0, 0);
      frames.forEach((f, i) => g.drawImage(f, pad, pad + i * (fh2 + 14), sw - 2 * pad, fh2));
      U.drawMixed(g, sw / 2, c.height - 110, '邮票大头贴', 'caps', 'phrase_cjk', 40, '#1d1d1f', 8, 1, 'center');
      U.drawTracked(g, sw / 2, c.height - 62, `DAILY POST PHOTO BOOTH · ${date.replace(/-/g, '.')}`, U.font('caps_med', 15), 'rgba(29,29,31,.7)', 4, 'center');
      return c;
    }
    async function develop() {
      const c = makeStrip(); Kit.put(strip, c);
      slot.classList.add('on');
      strip.getAnimations().forEach(a => a.cancel());
      strip.animate([{ transform: 'translateY(-102%)' }, { transform: 'translateY(0)' }], { duration: 2200, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
      strip.animate([{ filter: 'grayscale(1) brightness(1.35) contrast(.6)' }, { filter: 'grayscale(.4) brightness(1.1) contrast(.85)', offset: 0.5 }, { filter: 'none' }],
        { duration: 3600, easing: 'ease-in-out', fill: 'both' });
      Kit.rustle(0.03, 1.2);
      await Kit.wait(2400);
      bSave.hidden = false;
      deps.album.add({ id: 'booth:' + Date.now(), kind: 'booth', date, image: await Kit.blobOf(c) });
      status.set('冲好了 · 收进了集邮册');
      return c;
    }

    // ---- shooting: the camera opens only for this, three-two-one and a flash, four times, then it closes
    let stream = null, shooting = false, stripCv = null;
    const stop = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } video.srcObject = null; finder.classList.remove('live'); };
    async function countdown() {
      for (const n of [3, 2, 1]) {
        count.textContent = n; count.getAnimations().forEach(a => a.cancel());
        count.animate([{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 1, transform: 'scale(1)', offset: 0.25 }, { opacity: 0, transform: 'scale(.94)' }], { duration: 760, easing: 'ease-out' });
        Kit.buzz(8); await Kit.wait(760);
      }
      count.textContent = '';
    }
    function grabFrame() {
      const vw = video.videoWidth || 640, vh = video.videoHeight || 480, c = U.canvas(vw, vh), g = c.getContext('2d');
      g.translate(vw, 0); g.scale(-1, 1); g.drawImage(video, 0, 0, vw, vh);   // as it looked on screen: mirrored
      flash.getAnimations().forEach(a => a.cancel());
      flash.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.2 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
      Kit.thump(0.15);
      return c;
    }
    bShoot.onclick = async () => {
      if (shooting) return;
      shooting = true; bShoot.disabled = true; bPhoto.disabled = true; bSave.hidden = true; slot.classList.remove('on');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 1200 } }, audio: false });
      } catch (e) {
        shooting = false; bShoot.disabled = false; bPhoto.disabled = false;
        return status.set('打不开摄像头 · 可以点「用照片」选一张');
      }
      video.srcObject = stream; finder.classList.add('live');
      await video.play().catch(() => {});
      await Kit.wait(600);
      frames = [];
      for (let k = 0; k < SHOTS; k++) {
        status.set(`第 ${k + 1} / ${SHOTS} 张 · 看镜头`);
        await countdown();
        const shot = grabFrame();
        frames.push(printFrame(Kit.photoPlates(shot, 360), k, Kit.hash(date + k + Date.now())));
        await Kit.wait(500);
      }
      stop();
      status.set('冲印中…');
      stripCv = await develop();
      shooting = false; bShoot.disabled = false; bPhoto.disabled = false;
    };
    bPhoto.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0]; file.value = ''; if (!f) return;
      const img = await Kit.imageOf(f); if (!img) return status.flash('这张图读不出来');
      shooting = true; bShoot.disabled = true; bPhoto.disabled = true; slot.classList.remove('on');
      const plates = Kit.photoPlates(img, 360);
      frames = Array.from({ length: SHOTS }, (_, k) => printFrame(plates, k, Kit.hash(date + k + f.name)));
      status.set('冲印中…');
      stripCv = await develop();
      shooting = false; bShoot.disabled = false; bPhoto.disabled = false;
    };
    slot.addEventListener('click', () => { if (phone && !shooting) slot.classList.remove('on'); });   // a phone's strip covers the booth: tap it away
    bSave.onclick = async () => { if (stripCv) await Kit.save([{ cv: stripCv, name: `photo-booth-${date}.png` }]); };

    layout();
    status.set('拉上帘子 · 按「开拍」连拍四张');
    return P.api({
      ready: Promise.resolve(),
      leave() { stop(); },
      anchor: () => finder.getBoundingClientRect(),
      source: () => (frames[0] && !shooting ? frames[0] : null),
    });
  }
  Pages.define('booth', mount);
})();
