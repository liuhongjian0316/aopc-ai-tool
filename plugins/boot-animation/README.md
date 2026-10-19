# boot-animation

自定义 AOPC 启动画面插件：AOPC 桌面端每次启动时全屏播放一段视频或 HTML 动画，播完（或点击/按键跳过）后进入主界面。

## 原理

AOPC 桌面本体在创建主窗口前会扫描**已启用插件**的安装目录，查找约定资源：

```
<插件目录>/boot-animation/boot.mp4 | boot.webm | boot.gif | boot.html
```

找到即通过 `aopc-media` 协议授权后注入启动壳（index.html）：视频用全屏 `<video>`（cover 填充、自动连声音播放），HTML 用全屏 sandbox `<iframe>`（时长读页内 `<meta name="aopc-splash-duration-ms">`，默认 5s，上限 20s）。未找到或解析失败时回落默认启动 logo，任何情况都不会卡在启动画面。

## 使用

安装本插件后三种方式设置动画：

1. **直接替换文件**：把你的 mp4/webm/gif/html 改名为 `boot.mp4` 等放入本插件安装目录的 `boot-animation/`（缓存目录见 `aopc plugins list` 输出）；
2. **斜杠命令**：会话内 `/boot-anim use /path/to/anim.mp4`（支持 `status` / `clear`）；
3. **Agent 工具**：对话里说"把 /path/to/anim.mp4 设成我的启动动画"，Agent 调用 `set_boot_animation` 工具完成。

重启 AOPC 生效。

## 建议

- 视频 1080p、10 秒以内、≤50MB、H.264 + faststart（moov 前置）；
- HTML 页自包含（不引外链），需要控制时长时在页内加 `<meta name="aopc-splash-duration-ms" content="4000">`；
- 播放期间点击或按任意键跳过；最长播放时长受插件设置控制。

## License

MIT
