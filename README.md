# 每日一枚 · Daily Stamp

一天一枚波普邮票。齿孔和白纸边是原研哉式的克制，印面是满版的波普；背面是一本正经的「情绪药品说明书」。
首页是一圈邮票转盘，每一枚通往一个功能（撕一张、节气历、集邮册、寄一张、情绪药房、盖戳、丝网印刷机、拼贴机、时光信……），
功能清单只有一份：`web/app/features.js`。

## 运行

```
python dailystamp.py serve          # 打开 http://127.0.0.1:8765
python dailystamp.py serve --lan    # 同一 WiFi 下的手机、平板也能打开，启动时打印局域网地址
```

局域网常驻：双击 `lan-start.bat` 在后台启动（日志写进 `serve.log`），双击 `lan-stop.bat` 关闭。
防火墙入站规则名沿用 “DailyCan LAN 8765”，只放行 TCP 8765，且只允许本地子网访问。

URL 参数：`?gallery=1` 一次看 6 枚生成结果（`&layout=tpl` 轮换模板）；`?sheet=demo` 整版样张；
`?phrase=咖啡因&palette=Whaam!&seed=42&side=back` 直接打开工作室；`?homeseed=7` 固定首页发牌（截图用）。

## 命令行（只在开发时用，app 运行时从不调用模型）

```
python dailystamp.py words [词…] [--redo]        # 画 dailystamp/words.py 里还没有徽章的词，再补说明书
python dailystamp.py emblem "躺平" --idea "…"     # 往库里添一个徽章
python dailystamp.py leaflets [词…]              # 补写背面说明书
python dailystamp.py terms | posters | backdrops  # 节气图标 / 撕一张海报 / 首页剪纸底纹（加 key 可重画）
python dailystamp.py masks [--force]             # 预切徽章与节气图标的色版和轮廓
python dailystamp.py fonts                       # 改了文案或说明书后重做网页字体子集
```

codex 生图一次只跑一个：并行时会互相拿错图。

## 目录

```
dailystamp.py            命令行入口（表驱动的子命令）
dailystamp/              开发期工具与本地服务器
  server.py              静态文件 + /api/emblems、/api/leaflet，工作室导出写进 exports/
  library.py words.py    徽章库；词表、分柜和每个词固定的图案
  emblem.py leaflet.py   codex 画徽章、写说明书
  assetset.py            codex 一次画好的固定素材集（terms.py posters.py backdrops.py 各自只写条目、提示词和遮罩）
  cutmasks.py webfonts.py  预切色版；网页字体子集
web/
  index.html loader.js   页面与加载屏（加载屏的字另切一份小字体）
  core/                  邮票引擎：配色、底纹、版式、邮票、整版、节气。只画图，不碰 app 状态
  shell/                 首页转盘、页面框架（Pages）、公共件（Kit：页头、状态行、翻面卡、声音、调试按钮…）、集邮册存储
  pages/<key>.js/.css    每个功能一对文件
  app/                   features（功能清单）context（共享状态）assets press（印刷）stage（今日一枚与工作室）
                         router（首页与各页之间飞邮票）preload（加载屏下预载一切）review（?gallery）main（启动）
  css/                   基础、工作室、首页样式
emblems/ leaflets/ terms/ posters/ backdrops/   codex 生成的素材（三通道蒙版 + 预切色版）
exports/                 工作室「存入」的成品
```

### 加一个功能

1. `web/app/features.js` 加一行 `{ key, cn, en }`：首页转盘、页码、加载屏空位都会跟着变。
2. 新建 `web/pages/<key>.js`：`Pages.define(key, (root, deps) => …)`，开头用 `Kit.page(root, key, layout)` 拿到页头、状态行和屏幕尺寸，
   返回 `P.api({ ready, anchor, source, receive?, enter?, leave? })`。`deps` 里有词库、配色、`makeFront` / `printIn`、集邮册。
3. 新建 `web/pages/<key>.css`，在 `index.html` 里挂上两个文件。
4. 有次数限制的功能，用 `Kit.debugRow(root).add('…', fn)` 给一个调试恢复按钮（`Kit.DEBUG` 统一开关）。
5. 改了中文文案后跑一次 `python dailystamp.py fonts`。

## 依赖

Python 3.10+，Pillow，numpy，scipy，fontTools。徽章生成需要本机 `codex` CLI 已登录且启用 `image_generation`。
网页用到的字体复制在 `web/fonts/`（原始 TTF 不进 git）。
