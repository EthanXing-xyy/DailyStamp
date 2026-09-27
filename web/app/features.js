// The app's functions, in the home carousel's order (the studio is not one of them: it opens from today's stamp): the one list everything else reads (the carousel, each page's
// number and name, the loading screen's slots). Adding a function = a line here + web/pages/<key>.js (+ .css).
const Features = (() => {
  const LIST = [
    { key: 'today', cn: '今日一枚', en: 'TODAY' },
    { key: 'tear', cn: '撕一张', en: 'TEAR ONE OFF' },
    { key: 'soak', cn: '泡票', en: 'SOAK OFF' },
    { key: 'loupe', cn: '放大镜鉴定', en: 'LOUPE & GRADE' },
    { key: 'album', cn: '集邮册', en: 'ALBUM' },
    { key: 'month', cn: '月度小版张', en: 'MONTHLY SHEET' },
    { key: 'terms', cn: '节气历', en: 'SOLAR TERMS' },
    { key: 'post', cn: '寄一张', en: 'POST ONE' },
    { key: 'later', cn: '时光信', en: 'LETTER FOR LATER' },
    { key: 'cancel', cn: '盖戳', en: 'CANCEL' },
    { key: 'seal', cn: '刻章', en: 'SEAL CARVING' },
    { key: 'pharmacy', cn: '情绪药房', en: 'MOOD PHARMACY' },
    { key: 'claw', cn: '抓娃娃机', en: 'CLAW MACHINE' },
    { key: 'booth', cn: '邮票大头贴', en: 'PHOTO BOOTH' },
    { key: 'silkscreen', cn: '丝网印刷机', en: 'SILKSCREEN' },
    { key: 'xerox', cn: '复印机', en: 'COPY MACHINE' },
    { key: 'collage', cn: '拼贴机', en: 'COLLAGE' },
    { key: 'musicbox', cn: '八音盒', en: 'MUSIC BOX' },
    { key: 'receipt', cn: '小票打印机', en: 'RECEIPT PRINTER' },
    { key: 'badge', cn: '徽章机', en: 'BUTTON BADGE' },
    { key: 'papercut', cn: '剪纸窗花', en: 'PAPER CUT' },
    { key: 'kaleido', cn: '万花筒', en: 'KALEIDOSCOPE' },
    { key: 'flap', cn: '翻牌显示屏', en: 'SPLIT-FLAP' },
    { key: 'scratch', cn: '刮刮乐', en: 'SCRATCH CARD' },
  ];
  const byKey = key => LIST.find(f => f.key === key) || null;
  /** its number on the carousel, from 1 */
  const no = key => LIST.findIndex(f => f.key === key) + 1;
  return { LIST, byKey, no };
})();
