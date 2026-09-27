// The app's functions, in the home carousel's order: the one list everything else reads (the carousel, each page's
// number and name, the loading screen's slots). Adding a function = a line here + web/pages/<key>.js (+ .css).
const Features = (() => {
  const LIST = [
    { key: 'today', cn: '今日一枚', en: 'TODAY' },
    { key: 'tear', cn: '撕一张', en: 'TEAR ONE OFF' },
    { key: 'terms', cn: '节气历', en: 'SOLAR TERMS' },
    { key: 'album', cn: '集邮册', en: 'ALBUM' },
    { key: 'post', cn: '寄一张', en: 'POST ONE' },
    { key: 'studio', cn: '工作室', en: 'STUDIO' },
    { key: 'pharmacy', cn: '情绪药房', en: 'MOOD PHARMACY' },
    { key: 'cancel', cn: '盖戳', en: 'CANCEL' },
    { key: 'silkscreen', cn: '丝网印刷机', en: 'SILKSCREEN' },
    { key: 'collage', cn: '拼贴机', en: 'COLLAGE' },
    { key: 'later', cn: '时光信', en: 'LETTER FOR LATER' },
  ];
  const byKey = key => LIST.find(f => f.key === key) || null;
  /** its number on the carousel, from 1 */
  const no = key => LIST.findIndex(f => f.key === key) + 1;
  return { LIST, byKey, no };
})();
