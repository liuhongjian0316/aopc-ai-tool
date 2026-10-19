---
description: 查看/设置/清除 AOPC 自定义启动画面
argument-hint: [status | use <本地动画文件路径> | clear]
---

本命令管理 AOPC 自定义启动画面。动画资源约定在插件目录的 `boot-animation/` 下（boot.mp4/boot.webm/boot.gif/boot.html），重启 AOPC 后生效。

## 执行方式（按优先级）

**方式一（首选）**：如果你的工具列表里有本插件的 `set_boot_animation` / `clear_boot_animation` / `get_status` MCP 工具，直接调用它们完成对应操作（`use <路径>` 对应 `set_boot_animation`，参数 `source` 传文件绝对路径），然后把结果转述给用户，**不要**再执行下面的脚本。

**方式二（MCP 工具不可用时）**：用 Bash 终端工具执行下面的脚本（先定位插件根，再执行子命令）：

```bash
# 定位插件根：环境变量 → 市场缓存（版本号取最高）→ 本地目录
plugin_root="${AOPC_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-}}"
if [ -z "$plugin_root" ]; then
  plugin_root="$(ls -d "$HOME"/.aopc/cli/plugins/cache/*/boot-animation/*/ 2>/dev/null | sort -V | tail -1)"
  plugin_root="${plugin_root%/}"
fi
if [ -z "$plugin_root" ] || [ ! -d "$plugin_root" ]; then
  plugin_root="$HOME/.aopc/plugins-local/boot-animation"
fi
if [ ! -d "$plugin_root" ]; then
  echo "✗ 未找到 boot-animation 插件目录，请确认插件已安装并启用"
  exit 1
fi

sub="${1:-status}"
case "$sub" in
  status)
    echo "=== 启动画面状态（插件根：$plugin_root）==="
    if [ -d "$plugin_root/boot-animation" ] && ls "$plugin_root/boot-animation"/boot.* >/dev/null 2>&1; then
      ls -lh "$plugin_root/boot-animation"/boot.*
    else
      echo "未设置启动画面（AOPC 将使用默认启动 logo）"
    fi
    echo "支持格式：boot.mp4 / boot.webm / boot.gif / boot.html"
    ;;
  use)
    src="${2:-}"
    if [ -z "$src" ]; then echo "✗ 用法：/boot-anim use <本地 mp4/webm/gif/html 文件>"; exit 2; fi
    case "$src" in
      /*) ;; *) src="$PWD/$src" ;;
    esac
    if [ ! -f "$src" ]; then echo "✗ 文件不存在：$src"; exit 2; fi
    ext="${src##*.}"
    ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
    case "$ext" in mp4|webm|gif|html) ;; *) echo "✗ 不支持的格式：.$ext（只允许 mp4/webm/gif/html）"; exit 2 ;; esac
    mkdir -p "$plugin_root/boot-animation" || { echo "✗ 创建目录失败：$plugin_root/boot-animation"; exit 1; }
    rm -f "$plugin_root/boot-animation"/boot.* || exit 1
    cp "$src" "$plugin_root/boot-animation/boot.$ext" || { echo "✗ 复制失败"; exit 1; }
    if [ ! -f "$plugin_root/boot-animation/boot.$ext" ]; then echo "✗ 复制后未找到目标文件，设置失败"; exit 1; fi
    echo "✓ 已设置启动画面：$(basename "$src") → $plugin_root/boot-animation/boot.$ext"
    echo "重启 AOPC 后生效；启动时全屏播放，点击/按键可跳过。"
    ;;
  clear)
    rm -rf "$plugin_root/boot-animation" && echo "✓ 已清除启动画面；重启 AOPC 后回落默认启动 logo。" \
      || echo "✗ 清除失败"
    ;;
  *)
    echo "用法：/boot-anim [status | use <本地文件绝对路径> | clear]"
    exit 2
    ;;
esac
```

## 执行规范

1. `$ARGUMENTS` 整体传入脚本：第一个词是子命令，第二个词是文件路径（路径建议让用户提供**绝对路径**；相对路径脚本会按当前目录补全）。
2. **任何一行报错都必须原样告诉用户设置失败**，不要把 "✓ 已设置" 当作成功——只有目标文件确实出现在 `boot-animation/` 下才算成功。
3. 动画文件建议 1080p、10 秒以内、≤50MB；播放时静音自动播，点击/按键跳过，20 秒强制兜底。
4. `use` 的文件路径包含空格时，先让用户确认完整路径再执行。
