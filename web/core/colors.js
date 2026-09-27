// 撞色色板: every palette is four clashing spot inks + one key ink, each traced to a source in pop / graphic history.
// Layouts take the four inks as roles A (ground) B (clash) C (highlight) D (fourth); `shift` rotates the roles.
const Colors = (() => {
  const PALETTES = [
    { name: 'Shot Marilyn', cn: '玛丽莲', note: 'Warhol《Shot Marilyns》1964：土耳其蓝底、桃粉脸、柠檬黄发、朱红唇', c: ['#12B5B0', '#FF5FA2', '#FFD400', '#FF3B1F'], ink: '#1B1633' },
    { name: 'Klein × Hermès', cn: '克莱因蓝 × 爱马仕橙', note: '互补色对撞：国际克莱因蓝 IKB × 爱马仕橙，樱草黄与蜜桃粉压阵', c: ['#002FA7', '#FF6A00', '#FFE14D', '#FFB3C6'], ink: '#0B0B24' },
    { name: 'Whaam!', cn: '惠姆！', note: 'Lichtenstein《Whaam!》1963：红黄蓝三原色 + 黑色勾线 + 天蓝网点', c: ['#FFD500', '#E4002B', '#0A4DB3', '#8FD0F5'], ink: '#111111' },
    { name: 'Casa Gilardi', cn: '巴拉甘', note: 'Barragán 吉拉迪之家 1976：玫红墙、琥珀黄、紫、橙', c: ['#E8559B', '#FFB000', '#6B3FA0', '#FF6B2C'], ink: '#2A1233' },
    { name: 'Bigger Splash', cn: '霍克尼泳池', note: 'Hockney《A Bigger Splash》1967：泳池蓝、粉墙、沙黄、棕榈绿', c: ['#2E9BD6', '#F6B6C8', '#F2D06B', '#1F8A5B'], ink: '#15283A' },
    { name: 'Memphis', cn: '孟菲斯', note: 'Sottsass / Memphis 1981：薄荷、珊瑚、钴蓝、柠檬黄 + 黑色波浪线', c: ['#7FD8BE', '#FF7F6B', '#1D4ED8', '#FFD93B'], ink: '#111111' },
    { name: 'In the Mood', cn: '王家卫', note: '《花样年华》红配绿：墨绿、正红、琥珀、旗袍粉', c: ['#0B5D3B', '#D7102C', '#F2A900', '#F59AB5'], ink: '#1A0E0E' },
    { name: 'Tiffany Cherry', cn: '蒂芙尼 × 樱桃', note: '蒂芙尼蓝撞樱桃红，奶酪黄和婴儿粉垫底', c: ['#0ABAB5', '#E3173E', '#FFD27A', '#FFC6D3'], ink: '#101820' },
    { name: 'Cut-Outs', cn: '马蒂斯剪纸', note: 'Matisse 晚年剪纸：钴蓝、洋红、柠檬黄、绿', c: ['#1E3FA8', '#D5287B', '#FFE23F', '#1E9E5A'], ink: '#101010' },
    { name: 'Dopamine', cn: '多巴胺', note: '橙 × 粉 × 青柠 × 紫罗兰，四个高饱和互相打架', c: ['#FF7A1A', '#FF5FA2', '#B6F03C', '#7A4DFF'], ink: '#161616' },
    { name: 'Acid Lime', cn: '荧光', note: '酸性青柠撞电紫、荧光粉、电光青，70 年代丝网印', c: ['#C6F432', '#7B2CF5', '#FF2E88', '#23D5E8'], ink: '#111111' },
    { name: 'Purple Gold', cn: '紫 × 金', note: '紫与黄是色环上最响的一对互补色', c: ['#5B2A86', '#FDB927', '#FF6FA8', '#3FD0C9'], ink: '#170B24' },
    { name: 'Nihon Buyo', cn: '田中一光', note: '田中一光《日本舞踊》1981：朱、赭黄、青绿、靛', c: ['#E8452C', '#F2B233', '#1F8A8A', '#283A7E'], ink: '#1A1512' },
    { name: 'City Pop', cn: '永井博', note: '永井博 City Pop 唱片封面：天蓝、泳池粉、落日黄、棕榈绿', c: ['#3FB6E8', '#FF8FB1', '#FFD34E', '#15735A'], ink: '#0E2340' },
    { name: 'Campbell', cn: '金宝汤', note: 'Warhol《32 个金宝汤罐》1962：番茄红、金、奶白 + 藏青', c: ['#C8102E', '#D9A521', '#F3EEE3', '#1F3A93'], ink: '#141414' },
    { name: 'Barbie Kelly', cn: '芭比粉 × 凯利绿', note: '粉配绿，最甜也最冲的一对互补色', c: ['#FF4FA0', '#00A86B', '#FFE45C', '#FFD1E3'], ink: '#1A1A1A' },
  ];

  /** the four spot inks, rotated by `shift` */
  const roles = (pal, shift = 0) => { const k = ((shift % 4) + 4) % 4; return [...pal.c.slice(k), ...pal.c.slice(0, k)]; };

  /** first candidate that reads on `bg` (contrast >= min), else the strongest one */
  function readable(bg, cands, min = 2.2) {
    return cands.find(c => U.contrast(c, bg) >= min) || cands.slice().sort((a, b) => U.contrast(b, bg) - U.contrast(a, bg))[0];
  }
  /** a candidate that reads on every background in `bgs` (maximises the worst contrast) */
  function readableOn(bgs, cands, min = 2.2) {
    const worst = c => Math.min(...bgs.map(b => U.contrast(c, b)));
    return cands.find(c => worst(c) >= min) || cands.slice().sort((a, b) => worst(b) - worst(a))[0];
  }
  /** a clash: the candidate that differs most in hue while still separating in value a little */
  function clash(bg, cands) {
    const hue = h => { const [r, g, b] = U.hexToRgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
    const hb = hue(bg), score = c => { const dh = Math.abs(hue(c) - hb); return Math.min(dh, 360 - dh) / 180 + Math.min(1, (U.contrast(c, bg) - 1) / 2); };
    return cands.slice().sort((a, b) => score(b) - score(a))[0];
  }

  return { PALETTES, roles, readable, readableOn, clash };
})();
