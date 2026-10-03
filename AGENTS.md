# 每日一枚 · Daily Stamp

波普风网页小应用：正面是带齿孔的邮票，背面是一本正经的“情绪药品说明书”。首页是 24 个功能的转盘（`web/app/features.js`）。Python 命令行在开发时用本机 `codex` 预生成素材，并负责本地服务、打包和部署。目前处于调试阶段，已上线给几个朋友用。

## 目录

- `dailystamp.py`、`dailystamp/`：命令行入口和开发工具（`server.py`、`build.py`、`words.py` 词库等）
- `web/`：前端，分 `core/` `shell/` `pages/<key>.js+.css` `app/` `css/` `fonts/` `vendor/`
- `emblems/` `leaflets/` `terms/` `posters/` `backdrops/` `scene/` `kraft/`：codex 生成的素材，入库
- `dist/`：打包产物，不入库
- `.ai/`：临时文件（截图、试验脚本、候选图），不入库，可以整个删

## 常用命令

```
python dailystamp.py serve [--lan] [--keep] [--port N] [--no-browser]
python dailystamp.py fonts        # 改了中文文案后必须跑
python dailystamp.py build
python dailystamp.py deploy [cloudflare|netlify]
```

生成素材的其他子命令见 `README.md`。自己测试时换一个端口：`serve --port 8767 --no-browser`。依赖是 Python 3.10+、Pillow、numpy、scipy、fontTools。没有自动化测试。

## 规矩

- 只在本目录工作。`H:\Popart\daily-stamp` 已封存，不改也不提交。
- 应用运行时绝不调用任何模型。codex 只在开发时生成素材，一次只跑一个 codex 任务。
- 手机和桌面走同一套代码，任何改动两边都要生效。布局只按宽高比或高度分支。手机只支持竖屏。
- 每个限量功能都要有一个风格一致的重置按钮，放在 `Kit.DEBUG` 下。
- LAN 服务退出后只报告，不要自行重启。
- 新美术先向我要参考图，把 codex 出的几个候选放在 `.ai/` 里给我挑，我点头之前不进项目。不要自己猜风格。
- 元素不要突然出现，慢慢淡入。会动的东西上不用实时的 CSS filter、mask、blend，先烘成位图。
- 静止的图层落在整数像素上。动画过程中不重画正在显示的 canvas。
- 加功能按 `README.md` 里“加一个功能”的 5 步来。
- 交互保持克制，不引入新字体。

## 容易踩的坑

- 每次启动服务会清空浏览器里的使用记录（`web/boot.js`），加 `--keep` 才保留。
- 改了 `/api` 路径要重启服务。
- 测 iOS 内存用 Playwright WebKit，不用 Chrome。
- `build` 只在 `dist/` 里有 `.dailystamp-build` 标记时才清空它。
- `web/fonts/*.ttf` 是商用字体，不入库。
- 提交信息用英文，沿用现有风格，例如 `Home: the type sits on whole px`。
