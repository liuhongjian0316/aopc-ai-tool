---
description: 查看/设置/清除 AOPC 自定义启动画面
argument-hint: [status | use <本地文件绝对路径> | clear]
---

本命令管理 AOPC 自定义启动画面。插件根目录为 `${AOPC_PLUGIN_ROOT}`，动画资源约定在 `${AOPC_PLUGIN_ROOT}/boot-animation/`（boot.mp4/boot.webm/boot.gif/boot.html），重启 AOPC 后生效。请用 Bash 终端工具执行并把结果展示给用户：

```bash
case "$1" in
  "")
    echo "=== 启动画面状态 ==="
    if [ -d "${AOPC_PLUGIN_ROOT}/boot-animation" ]; then
      ls -lh "${AOPC_PLUGIN_ROOT}/boot-animation/" 2>/dev/null || echo "(目录为空)"
    else
      echo "未设置启动画面（AOPC 将使用默认启动 logo）"
    fi
    echo "支持格式：boot.mp4 / boot.webm / boot.gif / boot.html"
    ;;
  use)
    # $2 = 本地动画文件路径
    src="$2"
    if [ -z "$src" ]; then echo "用法：/boot-anim use <本地 mp4/webm/gif/html 文件>"; exit 2; fi
    if [ ! -f "$src" ]; then echo "文件不存在：$src"; exit 2; fi
    ext="${src##*.}"
    case "$ext" in mp4|webm|gif|html|MP4|WEBM|GIF|HTML) ;; *) echo "不支持的格式：.$ext（只允许 mp4/webm/gif/html）"; exit 2 ;; esac
    mkdir -p "${AOPC_PLUGIN_ROOT}/boot-animation"
    rm -f "${AOPC_PLUGIN_ROOT}/boot-animation"/boot.*
    cp "$src" "${AOPC_PLUGIN_ROOT}/boot-animation/boot.${ext}"
    echo "✓ 已设置启动画面：$(basename "$src") → ${AOPC_PLUGIN_ROOT}/boot-animation/boot.${ext}"
    echo "重启 AOPC 后生效；启动时全屏播放，点击/按键可跳过。"
    ;;
  clear)
    rm -rf "${AOPC_PLUGIN_ROOT}/boot-animation"
    echo "✓ 已清除启动画面；重启 AOPC 后回落默认启动 logo。"
    ;;
  *)
    echo "用法：/boot-anim [status | use <本地文件> | clear]"
    exit 2
    ;;
esac
```

执行规范：

1. `$ARGUMENTS` 以空格拆分后作为 `$1`（子命令）与 `$2`（文件路径）传入；为空时等价 `status`。
2. 只转述脚本输出，不要额外执行其他命令，不要读取或打印动画文件内容。
3. 动画文件建议 1080p、10 秒以内、≤50MB；播放时静音自动播，点击/按键可跳过，20 秒强制结束兜底。
4. 若用户想用 Agent 设置动画，可调用本插件的 `set_boot_animation` MCP 工具，效果相同。
