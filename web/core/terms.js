// The 24 solar terms (节气): which one a date falls in, and their icons (channel masks drawn once by codex, in terms/).
const Terms = (() => {
  // from 立春 (sun at 315°); keys match dailystamp/terms.py
  const LIST = [['01-lichun', '立春'], ['02-yushui', '雨水'], ['03-jingzhe', '惊蛰'], ['04-chunfen', '春分'], ['05-qingming', '清明'], ['06-guyu', '谷雨'],
    ['07-lixia', '立夏'], ['08-xiaoman', '小满'], ['09-mangzhong', '芒种'], ['10-xiazhi', '夏至'], ['11-xiaoshu', '小暑'], ['12-dashu', '大暑'],
    ['13-liqiu', '立秋'], ['14-chushu', '处暑'], ['15-bailu', '白露'], ['16-qiufen', '秋分'], ['17-hanlu', '寒露'], ['18-shuangjiang', '霜降'],
    ['19-lidong', '立冬'], ['20-xiaoxue', '小雪'], ['21-daxue', '大雪'], ['22-dongzhi', '冬至'], ['23-xiaohan', '小寒'], ['24-dahan', '大寒']];
  const icons = new Map();

  // apparent solar longitude in degrees (Meeus, low precision: well under a day's error for term boundaries)
  function sunLon(ms) {
    const rad = Math.PI / 180, T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T, M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    const lon = L0 + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * rad);
    return ((lon % 360) + 360) % 360;
  }
  /** the term a 'YYYY-MM-DD' date belongs to: the last one that began on or before that day (Beijing time) */
  function of(date) {
    const [y, m, d] = (date || new Date().toISOString().slice(0, 10)).split('-').map(Number);
    const k = Math.floor(sunLon(Date.UTC(y, m - 1, d, 15, 59)) / 15);   // 23:59 in UTC+8; k = 0 is 春分
    const [key, name] = LIST[(k + 3) % 24];
    return { key, name, icon: icons.get(key) || null };
  }
  // load() starts every icon and resolves when all are in; ready(key) resolves as soon as that one icon is (or isn't) there
  const waits = new Map();
  let indexed = null, all = null;
  function load() {
    if (all) return all;
    indexed = fetch('/terms/index.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => []);
    const cut = fetch('/terms/cut/index.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}));
    all = indexed.then(list => Promise.all(list.map(t => {
      const p = (async () => {
        const img = new Image(); img.src = '/' + t.file + '?v=' + t.v;
        try { await new Promise((ok, no) => { img.onload = ok; img.onerror = no; }); } catch { return; }   // decoded when drawn
        const icon = { id: 'term:' + t.key, img }, c = (await cut)[t.key];
        if (c && c.from === t.v) await Print.loadCut(icon, '/terms/cut/' + t.key, c.grows, t.v);   // masks cut ahead of time
        icons.set(t.key, icon);
      })();
      waits.set(t.key, p);
      return p;
    }))).then(() => {});
    return all;
  }
  async function ready(key) {
    load();
    await indexed;
    await (waits.get(key) || null);
  }
  const icon = key => icons.get(key) || null;
  return { LIST, of, load, ready, icon };
})();
