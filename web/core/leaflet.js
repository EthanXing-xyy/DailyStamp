// Placeholder leaflet so the back of a stamp is never empty while codex has not written the real one yet.
const Leaflet = (() => {
  function fallback(phrase, en) {
    const p = phrase || '情绪';
    return {
      phrase: p, en: en || '', status: 'fallback',
      name: (p.length > 4 ? p.slice(0, 4) : p) + '缓释片',
      ingredients: [[p, 46], ['咖啡因', 21], ['拖延', 16], ['自我说服', 11], ['其他', 6]],
      appearance: '白色圆片，一面刻有日期，另一面空白。',
      indications: `用于今日突发的「${p}」及其伴随的沉默。`,
      dosage: '起床后温水送服一片，睡前如仍有症状可再服一片。',
      adverse: '少数人出现短暂发呆、反复刷新手机，停药后自行消失。',
      contra: '对明天仍抱有过高期待者慎用。',
      cautions: '本说明书为样稿，正式说明书由 codex 撰写后自动替换。',
      storage: '遮光，密封，置于心里不太显眼的地方。',
      slogan: 'ONE A DAY',
    };
  }
  return { fallback };
})();
