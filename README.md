# 每日一罐 · Daily Can

一天一罐，把当天的一个情绪词"浓缩"进一只罐头。致敬 Warhol《32 个金宝汤罐》（1962）：
同一套标签语法，反复出现，变化只发生在色彩、词语和徽章上。攒够 32 罐拼成一面墙。

## 网页工作台：每日一枚（推荐）

```
python dailycan.py serve          # 打开 http://127.0.0.1:8765
python dailycan.py serve --lan    # 同一 WiFi 下的手机、平板也能打开，启动时打印局域网地址
```

局域网常驻：双击 `lan-start.bat` 在后台启动（日志写进 `serve.log`），双击 `lan-stop.bat` 关闭。
防火墙已加入站规则“DailyCan LAN 8765”，只放行 TCP 8765，且只允许本地子网访问。

一天一枚邮票。齿孔和白纸边是原研哉式的克制，印面是满版的波普。

- **正面**：四边齿孔真的打穿，一圈白纸边，里面整块满版印刷。默认版式是**生成**：每次随机排版，每一枚都不一样，点"再生成"换一版，随机种子跟着邮票存进整版。随机只负责做选择，下面这些设计规则负责约束：
  - 25 单位网格加安全边距，位置对齐网格。
  - 徽章和情绪词一主一次，不同时做大，放在上下、左右或对角两侧保持平衡。
  - 底色、结构色、点缀色按 60-30-10 分配；情绪词的颜色和它底下实际印出来的颜色拉开色相。
  - 面值、发行方、英文、小字逐个找空位，互不重叠，也不压情绪词和徽章主体。邮戳同样避让。
  - 底纹会自动裁掉文字下方的区域。
- 另外保留 9 个固定模板，每个是一个波普语汇：放射、四联（Warhol 玛丽莲四格）、漫画（Lichtenstein）、方中方（Albers）、巨字（Robert Indiana）、孟菲斯、圆点（草间弥生）、斜切（田中一光）、网点（徽章放大成 Ben-Day 网点）。
- **分层印刷**：图案层（色版 + 黑线稿版）→ 邮戳 → 文字层（色版 + 黑版）。所有图案都在底层，任何东西都不会盖住文字。
- **撞色**：16 套四色撞色板，每套注明出处：玛丽莲、克莱因蓝 × 爱马仕橙、Whaam!、巴拉甘、霍克尼泳池、孟菲斯、王家卫红配绿、蒂芙尼 × 樱桃、马蒂斯剪纸、多巴胺、荧光、紫 × 金、田中一光、永井博、金宝汤、芭比粉 × 凯利绿。"换色序"轮换四个颜色谁做底、谁做图。字色按对比度和色相差自动挑。
- **印刷感**：彩色版和黑色线稿版分两版印，默认套色错位，丝网油墨的深浅斑驳，纸纤维颗粒，可选邮戳。面值 = 情绪浓度，"80分"既是邮资也是分数。
- **背面**：一本正经的"情绪药品说明书"：成分条形图、性状、适应症、用法用量、不良反应、禁忌、有效期至当日 23:59、批号、条形码。页眉下印正面四色色标，成分条用同一套撞色。左键拖动邮票可在平面内旋转，按住鼠标滚轮拖动可在空间中翻转，轻点或双击邮票都能翻面；触屏可拖动翻转。不带参数打开时先进开场页：桌上先放一张空白齿孔纸，素材到齐后按彩色版、线稿版、邮戳、文字的顺序逐版印上。
- **整版**：代替原来的"墙"。8 × 4 共 32 枚，对应 Warhol《32 个金宝汤罐》，相邻邮票共用齿孔，边纸印版铭、套色十字线、色标和全张面值。没贴的格子保持空白。

只有两样东西要 codex 生成，而且每个词只生成一次：
- **徽章**（`emblems/`）：三通道蒙版，任何配色都是浏览器里重新上色，1–3 分钟。
- **说明书**（`leaflets/`）：纯文本 JSON，十几秒。没写好之前背面先用样稿。
- **节气图标**（`terms/`）：面值角印的是发行日所属的节气（按日期算太阳黄经），24 个图标 codex 只画一次，也是三通道蒙版。没画好的节气先只印名字。

"让 codex 画徽章 + 写说明书"两样一起提交。按钮：下载正面 / 背面 PNG（3000×3600，平放在桌面上的俯拍效果），存入 `cans/日期-词/`（front.png、back.png、meta.json），贴进整版（存在浏览器里，攒够导出整版 PNG）。

URL 参数可直接定位（`?gallery=1` 一次看 6 枚生成结果）：`/?layout=gen&seed=42&palette=Whaam!&shift=1&phrase=咖啡因&en=caffeine&no=12&side=back`。

## 命令行

```
python dailycan.py emblem "躺平" --en "lying down"            # 只给库里添一个徽章
python dailycan.py import-cans                                # 把旧 cans/ 里的徽章收进库
python dailycan.py leaflets --jobs 4                          # 给徽章库里每个词补写背面说明书
python dailycan.py terms                                      # 画齐 24 个节气图标（加 key 可重画，如 16-qiufen）
python dailycan.py masks                                      # 预切徽章 / 节气图标的色版与轮廓（新徽章会自动切；--force 全部重切）
python dailycan.py fonts                                      # 改了文案或说明书后重做网页字体子集（23 MB → 约 2.7 MB）
python dailycan.py add "摆烂" --en "bai lan · lying flat"      # 今天这罐，codex 画徽章
python dailycan.py add "周一" --en "monday" --no-ai             # 不调 codex，用程序徽章
python dailycan.py add "Monday" --palette "Ruscha Sunset"      # 指定配色
python dailycan.py rebuild                                     # 重建 site/ 与 wall.png
python dailycan.py rerender                                    # 改了代码后全部重画（复用已生成的徽章）
python dailycan.py palettes                                    # 列出 12 套配色
python dailycan.py demo --ai --jobs 4                          # 8 罐样例，4 个 codex 并行
```

## 产出（命令行旧版：罐头）

命令行的 `add` / `demo` / `rerender` 仍是最初的罐头版本，网页版已改成邮票。每罐一个目录 `cans/YYYY-MM-DD-词/`：

| 文件 | 说明 |
|---|---|
| `can.png` | 1800×2400 成品，罐身、金属盖、投影、平涂背景墙 |
| `label.png` | 3800×1500 展开标签，比例按真实周长算，可打印后贴到真罐头上 |
| `emblem.png` | 徽章，已压成三色（ink / accent / band），透明底 |
| `emblem_raw.png` | codex 原图，缓存用，删掉就会重新生成 |
| `meta.json` | 编号、日期、词、配色、徽章概念 |

徽章库 `emblems/`：每个词一组 `<id>.png`（三通道蒙版）、`<id>.raw.png`（codex 原图）、`<id>.json`（词、概念、时间），`index.json` 是汇总。

`site/index.html` 是静态画廊，Shelf / Wall 两种排布，深浅主题，点开看展开标签。`site/wall.png` 是 4 列的 Warhol 网格拼图。

## 审美系统

- **标签语法**：上带行楷品牌 + DIN 小字副题；中缝奖章；下场粗黑宋情绪词 + 英文小字 + 细线 + 净含量小字。
- **配色**：12 套，每套锚定一件波普作品（Campbell、Shot Marilyns、Whaam!、Electric Chair、Memphis、Mao、Cow Wallpaper、Brillo、Banana、Flowers……）。按编号轮换，也可指定。
- **印刷感**：三层分色（底色/副色/墨色）套色错位、墨边微渗、纸张颗粒、标签边缘 Ben-Day 网点渐变、侧边微缩文字。
- **徽章**：codex 按情绪词自己想一个物件（例：摆烂 → 漏气的充气火烈鸟），画成黑描边 + 品红 + 青的丝网风，再按当天配色映射为 ink / accent / band 三色。没有 codex 时退回到编号 + 放射线的程序徽章。

## 依赖

Python 3.10+，Pillow，numpy。徽章生成需要本机 `codex` CLI 已登录且启用 `image_generation`。
网页版把用到的字体复制在 `web/fonts/`，命令行版从 `C:\Windows\Fonts` 读取（华文行楷、方正粗黑宋、DIN Next、HarmonyOS Sans、Arial Black），缺哪个会自动退到下一候选；也可以把字体放进 `fonts/` 目录优先使用。
