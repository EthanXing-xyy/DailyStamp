<div align="center">

# Daily Stamp · 每日一枚

**One pop-art stamp a day. Loud clashing colour on the front, a deadpan "mood medicine leaflet" on the back.**

[中文](README.md) · English · [Live demo](https://daily-stamp.netlify.app)

![The home: a wheel of old stamps on kraft paper](docs/screenshots/home-desktop.jpg)

</div>

Daily Stamp is a small front-end-only web app that works on phones and desktops. Its interface is in Chinese.

- The home is an endless wheel of stamps. Each stamp opens one of 24 features.
- The stamps are printed in the browser: 96 mood words, 16 clashing palettes and 10 layouts, dealt afresh on every visit.
- Turn a stamp over and you get a "mood medicine leaflet": ingredients, indications, adverse reactions, contraindications, all of it.
- The app never calls a model at runtime and has no back end. The build is a plain static site.

Live demo: <https://daily-stamp.netlify.app> (mirror: <https://daily-stamp.daily-stamp-2.workers.dev>).
The first load takes a while, because all 24 stamps of the home are printed behind the loading screen.

## Contents

- [Screenshots](#screenshots)
- [Art direction: quiet paper, loud stamps](#art-direction-quiet-paper-loud-stamps)
- [Interaction: why the stamp wheel feels smooth](#interaction-why-the-stamp-wheel-feels-smooth)
- [The 24 features](#the-24-features)
- [Run it locally](#run-it-locally)
- [Development](#development)
- [License](#license)

## Screenshots

**The wheel on the home** (left: swiping, then a tap sends the stamp flying to its page; middle: the other set of pictures; right: the loading screen with its door open)

<p align="center">
  <img src="docs/screenshots/home-swipe.gif" width="30%" alt="Swiping the wheel on a phone and opening a stamp">
  &nbsp;
  <img src="docs/screenshots/home-phone.jpg" width="30%" alt="The home on a phone, with the village post office pictures">
  &nbsp;
  <img src="docs/screenshots/loading-phone.jpg" width="30%" alt="The loading screen on a phone, door open">
</p>

**The loading screen**: the door of a small post office. The hanging sign shows progress. When printing is done, a tap swings the door in.

![The loading screen](docs/screenshots/loading.jpg)

**The front and the back of a stamp**

![Today's stamp: its front, and the mood medicine leaflet on its back](docs/screenshots/stamp-front-back.jpg)

**Six stamps from the same press**

![Six generated stamps](docs/screenshots/stamps.jpg)

**The studio**: pick the word, layout, palette and emblem yourself, then print one and keep it.

![The studio](docs/screenshots/studio.jpg)

**A few of the feature pages**: solar terms, mood pharmacy, claw machine, post one, cancel.

![Five feature pages](docs/screenshots/pages.jpg)

## Art direction: quiet paper, loud stamps

The whole app follows one visual idea: **everything around the stamps is quiet, matte and mostly empty, and only the stamps are loud.**
Kraft paper, a cream wall and a grey desk all step back. Saturated, clashing colour appears only on that small piece of perforated paper.

### The front of a stamp: pop

Stamps are drawn on a canvas, not stored as pictures, and they are drawn the way a silkscreen is printed.

- **16 clashing palettes** (`web/core/colors.js`). Each is four spot inks plus one key ink, and each is traced to a source:
  Warhol's *Shot Marilyns* and Campbell's soup cans, Lichtenstein's *Whaam!*, Hockney's pool, Barragán's Casa Gilardi,
  the Memphis group, Matisse's late cut-outs, Ikko Tanaka's *Nihon Buyo*, Hiroshi Nagai's City Pop covers,
  the red and green of *In the Mood for Love*, and more. The four inks take the roles of ground, clash, highlight and fourth colour,
  and the roles rotate, so one palette prints four different ways.
- **10 layouts** (`web/core/layouts.js`): rays, quad, comic, square-in-square, big type, Memphis, polka dots, diagonal split and halftone,
  plus a generative layout that composes itself anew every time. Each one is a different pop idiom.
- **A pattern library** (`web/core/pattern.js`): rays, Ben-Day screens, stripes, checkers, Kusama-style polka dots, comic bursts,
  speech bubbles, and Memphis squiggles, zigzags and confetti.
- **Two plates.** Every layout draws onto two plates: a colour plate (all the spot inks) and a key plate (the black line work).
  The press prints the key plate slightly out of register and lays paper grain over the result, so a stamp looks printed rather than like vectors on a screen.
- **Emblems.** Each of the 96 words has an emblem, and each emblem is a visual pun on its word
  ("牛马", a workhorse, is an ox wearing an office ID badge; "班味", office funk, is a limp necktie giving off stink lines).
  An emblem is stored as a colourless three-channel mask (dark ink, magenta, cyan) and tinted in the browser with the current palette,
  so any emblem works with any palette. A die-cut white outline is grown around it, like a sticker.
- Each stamp also carries the day's postmark and the icon of the current solar term. All 24 solar terms have one.

### The back of a stamp: a mood medicine leaflet

The back is laid out like a drug package insert: a coloured header, an OTC mark, an ingredients bar, appearance, indications, dosage,
adverse reactions, contraindications, storage, an approval number and a barcode.
The text is deadpan. "Overtime sustained-release tablets", for example, contain 35% unread mail, 25% cold dinner, 15% elevator glow, and so on.
There is one leaflet per word, written ahead of time and stored in `leaflets/`.

### The home: kraft paper, small gouache pictures, old stamps

- **The desk is a sheet of crumpled kraft paper** with a few small gouache pictures on it, in the manner of a quiet picture book.
  There are two sets, and each visit picks one: "the postman's round" (a postman on a bicycle, a boy running after him, a cat,
  a pillar box, a street lamp and a bench, a pigeon carrying a letter) and "the village post office" (the post office, a mail van,
  a child posting a letter, a hot-air balloon and a biplane).
  The pictures are printed on the paper: when they are composited, the paper's relief shows through the paint.
- **The stamps are old.** Every stamp on the home looks as if it has been handled for years. The paper has yellowed, the ink has faded and turned grainy,
  and each stamp has two or three kinds of wear at random (crumpling, a fold, a water stain, skinned patches).
  It no longer lies flat either: a lifted corner, a curled edge, a turned-over corner, a half-open fold, a bow or a wave.
  All of this is prepared as 12 "ageing kits" that do not depend on what is printed. They are dealt to the 24 stamps like cards,
  with a new deal on every visit, so neighbouring stamps never age alike.
  Only the home shows aged stamps. When you open one, it turns new again on its flight to the page, and it ages again as it flies home.
- **The type is printed.** Every word on the home looks rubber-stamped onto the kraft: the ink is not quite solid, there are missed specks,
  the edges are rough, and the paper's colour shows through.
- **The pictures make way for the stamps.** The app first works out every place a stamp can pass as the wheel turns.
  Pictures are drawn only where no stamp ever passes, as large as that room allows. On a screen too small for one, it is left out rather than squeezed in.

### The loading screen: the door of a small post office

On cream paper, a bicycle with a basket of letters leans by a red door, next to an old pillar box and a calico cat.
It is drawn like an illustration in a literary magazine: flat matte colour, dry and grainy edges, a lot of empty paper, faceless figures.

- The hanging sign shows how far the press has got (inking, plate-making, exposing, printing, colour-matching, publishing).
  Every few seconds a letter flies from the basket into the pillar box.
- When everything is printed the sign reads 营业中 (open), a postmark with the day's date strikes the title, and the lamps inside come on slowly.
- A tap swings the door in onto the lit post office: the stamp cabinet, the counter, the clerk. A second tap closes an iris on it, and the home appears.

### A few rules

- Nothing pops in. Everything fades in slowly.
- Interaction stays restrained. Each thing moves softly, and once.
- No web widgets are added to the picture just to prompt the user. The way in is not a button, it is the door itself.
- The typefaces are a fixed few. Features do not bring new ones.

## Interaction: why the stamp wheel feels smooth

The wheel on the home is the most polished part of the app. This section covers its shape, its feel, its details and its performance, in that order,
and ends with how it got there. The code is all in `web/shell/home.js`, under 600 lines, with no animation library.

### Shape: a big wheel whose hub is below the screen

The stamps are not laid out in a straight row. They ride the rim of a big wheel whose hub sits far below the screen
(its radius is 2 to 2.9 times the screen's width), so the further a stamp is from the middle, the lower, the more tipped and the smaller it is.

- The middle stamp is the largest and its neighbours shrink in turn. The outermost pair is cut in half by the screen's edge.
  That half is deliberate: it tells you there is more to the side.
- A desktop shows five stamps, an ultrawide screen seven, a phone three. The layout branches only on the screen's aspect ratio. Phones and desktops run the same code.
- The wheel has no end. The 24 stamps join into a ring.

### Feel: one number chasing another

The wheel's whole state is two numbers: `pos` (where it is now, fractional) and `to` (where it is going). On every frame `pos` moves a little toward `to`:

```js
pos += (to - pos) * (1 - Math.exp(-dt / 110));
```

This is exponential easing by time rather than by frame, so it feels the same at 60 Hz and 120 Hz, and with or without dropped frames.
Every kind of input does just one thing: it changes `to`.

- **Dragging.** While a finger is down, `pos` follows it directly, pixel for pixel. A mouse drag is geared down to 0.3,
  because a hand on a mouse sweeps much further than it means to.
- **Flicking.** On release, the velocity is taken from the last 6 samples, the position is projected 220 ms ahead, and the result snaps to the nearest whole stamp.
  One flick passes at most 3 stamps, so the wheel never spins away and never rests between two stamps.
- **Wheel.** A mouse wheel notch moves one stamp. A trackpad gesture moves one stamp, and the gesture ends when its events stop, so inertial scrolling does not skip several.
- **Keyboard.** The left and right arrows move one stamp. Enter or Space opens the middle one.
- **Tapping.** Tap a stamp at the side and it comes to the middle. Tap the middle one and it opens.

### Details

- **Stamps lean as the wheel turns.** The lean follows the turning speed, up to 6 degrees, and rights itself when the wheel stops.
- **Stamps float.** Each one bobs, wanders in a slow figure of eight, turns, and tips toward the light. The five motions run on their own periods
  (about 6.2, 8.3, 7.1, 5.5 and 9.9 s) and every stamp has its own phases, so they never move in step.
  The shadow stays on the desk: the higher a stamp floats, the fainter and further away its shadow is.
- **A press has weight.** Hold the middle stamp and it tips toward your finger and sinks slightly (the feedback of a Windows 8 tile), and its shadow tightens.
- **Opening is a flight.** The stamp first lifts off the desk with a slight turn, then flies to its place on the feature page, turning from old to new on the way.
  Going back is the reverse: it flies to its slot on the wheel, settles, and ages again. The browser's back button takes the same route.
- **The title changes letter by letter.** When the wheel moves on, the old name drifts up and fades one letter at a time, and the new name rises one letter at a time from below its baseline.

### Performance: nothing is repainted while the wheel turns

The smoothness comes down to one sentence: **while the wheel turns, each frame only changes the position and opacity of layers, and paints nothing.**
Everything that needs painting has been painted ahead of time.

- The home's 24 stamps, their ageing and every word are all printed behind the loading screen. That is what the loading screen is for: once you are in, nothing loads, janks or pops in.
- Shadows are bitmaps drawn once (at a quarter of the size), not CSS blurs computed per frame.
- The desk (the kraft and its pictures) is painted once into a single canvas when the layout is known. It is never repainted while the wheel turns.
- Type is bitmaps printed once. Nothing that moves has a live CSS filter, mask or blend on it.
- A stamp that has left the screen is taken off the page.
- A style is written only when its value has actually changed.
- The frame loop runs only while something is moving. When only the floating moves, it drops to 30 poses a second.
- The pixel work of ageing runs in a Web Worker, so the main thread never waits for it.
- Layers at rest sit on whole pixels.
- Memory: there is one canvas per stamp. A feature page is built the first time it is opened, and only the six most recently opened are kept.

### How it got there

The wheel's form comes from the carousel on the index of [jfa-awards.snp.agency](https://jfa-awards.snp.agency): a large item in the middle,
and smaller neighbours cut off by the screen's edge. After that it was changed item by item on real phones.
The steps below are in rough order, and most of them can be found in the commit history.

1. **Shadows.** At first each stamp's shadow was a live blur, and frames dropped as soon as the wheel moved. Shadows became bitmaps drawn once per size.
2. **The desk.** The first desk changed colour with the stamp in the middle, so passing a stamp meant tinting it again. That was removed. The desk is painted once.
3. **Type.** The printed type on the kraft was first built from a CSS filter, a mask and a blend on live text. It looked right,
   but all of it was worked out again for every frame the page drew, which was too much for a phone.
   Now each word is printed into a small bitmap at load time, and the page only moves bitmaps.
4. **Floating.** The floating was first a set of looping CSS animations. On an iPhone they stood still whenever nothing else on the page was changing,
   and only woke when the wheel was turned. Now the frame loop poses each stamp.
5. **Holding the float during a swipe.** With the frame loop posing them, swiping on an iPhone became less smooth than before,
   because every other frame had to pose all the stamps. So while a finger is on the wheel, or the wheel is turning fast, the floating holds, and so does its clock.
   When the wheel slows, the stamps carry on floating from where they stopped, with no visible seam.
6. **Whole pixels.** As the title rose and came to rest, an iPhone showed it slip sideways a little. The centred position had a fraction of a pixel in it,
   and the text was rounded one way while it moved on a layer of its own and another way once it settled back onto the page.
   Now the centring itself lands on a whole pixel.
7. **Memory.** An iPhone reloads a page when its memory runs high. Each stamp used to have two canvases and now has one.
   The studio's emblem buttons used to decode the large plates of 64 words and now use small pre-cut pictures.

## The 24 features

| | | | |
|---|---|---|---|
| 01 Today 今日一枚 | 02 Tear one off 撕一张 | 03 Soak off 泡票 | 04 Loupe & grade 放大镜鉴定 |
| 05 Album 集邮册 | 06 Monthly sheet 月度小版张 | 07 Solar terms 节气历 | 08 Post one 寄一张 |
| 09 Letter for later 时光信 | 10 Cancel 盖戳 | 11 Seal carving 刻章 | 12 Mood pharmacy 情绪药房 |
| 13 Claw machine 抓娃娃机 | 14 Photo booth 邮票大头贴 | 15 Silkscreen 丝网印刷机 | 16 Copy machine 复印机 |
| 17 Collage 拼贴机 | 18 Music box 八音盒 | 19 Receipt printer 小票打印机 | 20 Button badge 徽章机 |
| 21 Paper cut 剪纸窗花 | 22 Kaleidoscope 万花筒 | 23 Split-flap 翻牌显示屏 | 24 Scratch card 刮刮乐 |

There is one list of features, `web/app/features.js`. The wheel, the page numbers and the loading screen all read from it. The studio opens from "Today".

## Run it locally

You need Python 3.10 or later, with Pillow, numpy, scipy and fontTools.

```
pip install pillow numpy scipy fonttools
python dailystamp.py serve          # opens http://127.0.0.1:8765
python dailystamp.py serve --lan    # phones and tablets on the same WiFi can open it too; the LAN address is printed at start
python dailystamp.py serve --keep   # keep what browsers have stored
```

- While the app is being debugged, every server start is a reset: the first time each browser opens the app after a restart,
  its album, torn stamps, letters and so on are cleared (`web/boot.js`). Add `--keep` to keep them.
- On Windows, double-click `lan-start.bat` to start the LAN server in the background and `lan-stop.bat` to stop it.
- **Fonts.** The repository contains ready-made subsets of the Chinese fonts (`web/fonts/sub/`). The original files of the two Latin faces
  (DIN Next, Arial Black) are not included, and without them the small Latin type falls back to a system font. To match the live site exactly,
  put font files you are licensed to use into `web/fonts/`. The file names are in `web/css/base.css` and `dailystamp/webfonts.py`.

URL parameters, for screenshots and debugging:

- `?homeseed=7` pins the home's deal for this visit.
- `?gallery=1` shows 6 generated stamps at once. Add `&layout=tpl` to cycle through the layouts.
- `?phrase=咖啡因&palette=Whaam!&seed=42&side=back` opens the studio directly.
- `?sheet=demo` shows a full sheet.
- `?fps` shows the frame rate in a corner, which is handy on a phone.

## Development

### Build and deploy

```
python dailystamp.py build                       # a static copy of the site in dist/
python dailystamp.py deploy [cloudflare|netlify] # build, then upload
```

### Where the artwork comes from

The app never calls a model at runtime. All artwork was drawn at development time with the local `codex` CLI, then cut by Python scripts and committed:

```
python dailystamp.py words [word…] [--redo]      # draw the words in dailystamp/words.py that have no emblem yet, then their leaflets
python dailystamp.py emblem "躺平" --idea "…"     # add one emblem to the library
python dailystamp.py leaflets [word…]            # write missing leaflets (stamp backs)
python dailystamp.py terms | posters | backdrops  # solar-term icons / the posters of "tear one off" / cut-paper backdrops
python dailystamp.py scene | kraft | agekits      # the loading screen's picture / the home's kraft and pictures / the ageing kits
python dailystamp.py masks [--force]             # pre-cut the ink plates and outlines of emblems and solar-term icons
python dailystamp.py fonts                       # rebuild the web font subsets after any text change
```

Run only one codex image job at a time. Parallel runs pick up each other's images.

### Layout of the repository

```
dailystamp.py            command-line entry (table-driven subcommands)
dailystamp/              development tools and the local server
  server.py build.py     static files and /api; build and deploy
  library.py words.py    the emblem library; the word list, its cabinets and each word's fixed motif
  emblem.py leaflet.py   codex draws emblems and writes leaflets
  scene.py kraft.py agekit.py   the loading screen's picture; the home's kraft, pictures and type ink; the ageing kits
  cutmasks.py webfonts.py       pre-cut plates; web font subsets
web/
  index.html loader.js   the page and the loading screen
  core/                  the stamp engine: palettes, patterns, layouts, stamp, sheet, solar terms. It only draws and never touches app state
  shell/                 the wheel (home), the desk, the printed type, ageing, the page framework, shared parts (kit), album storage
  pages/<key>.js/.css    one pair of files per feature
  app/                   the feature list, shared state, the press, today's stamp and the studio, the router (flies stamps between the home and the pages), preloading
emblems/ leaflets/ terms/ posters/ scene/ kraft/ backdrops/   generated artwork
docs/screenshots/        the screenshots on this page
```

### Adding a feature

1. Add a line `{ key, cn, en }` to `web/app/features.js`. The wheel, the page numbers and the loading screen's slots follow.
2. Create `web/pages/<key>.js`: `Pages.define(key, (root, deps) => …)`. Start with `Kit.page(root, key, layout)` to get the header, the status line and the screen size,
   and return `P.api({ ready, anchor, source, receive?, enter?, leave? })`.
3. Create `web/pages/<key>.css` and link both files in `index.html`.
4. If the feature is limited to a number of uses, give it a debug reset button with `Kit.debugRow(root).add('…', fn)`.
5. After changing any Chinese text, run `python dailystamp.py fonts`.

## License

- **Code** (`dailystamp.py`, `dailystamp/`, and the JS, CSS and HTML in `web/`): [MIT](LICENSE).
- **Artwork and text** (`emblems/`, `leaflets/`, `terms/`, `posters/`, `scene/`, `kraft/`, `backdrops/`, `docs/screenshots/`, and the copy inside the app):
  [CC BY-NC 4.0](LICENSE-ART.md). You may share and adapt it with attribution, but not for commercial use.
- **Third parties.** [egjs Axes](https://github.com/naver/egjs-axes) in `web/vendor/` is MIT-licensed.
  The fonts in `web/fonts/` belong to their foundries and are not covered by the two licenses above.

The form of the wheel is after [jfa-awards.snp.agency](https://jfa-awards.snp.agency).
