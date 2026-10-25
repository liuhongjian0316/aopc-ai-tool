# 宠物素材包（pet pack）

本目录放置**动画素材包**。`dsh/` 为从 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 仓库导入的官方素材（webm 动画 106 个 + 表情包 + 点击音效），按其仓库声明仅限**非商用**；使用请保留本说明与 NOTICE.md 的出处链接。

## 目录约定

```
packs/<包名>/
├── webm/              # VP9-alpha 透明动画（文件名去扩展名 = 动画名，中文直用）
├── memes/             # （可选）碎碎念随机配图 png，键名见 <包名>-config.json 的 memes
├── sound/             # （可选）音效（click-duck.wav = 点击音）
└── mov/               # （可选）macOS HEVC-with-Alpha 版本，缺省自动退 .webm
```

宠物条目在配置里写 `"pack": "<包名>"` 即启用视频包；包里缺某个动画文件时自动回落内置程序化渲染。
包级条目覆盖（animations / memes / workStatusTexts 等）写 `packs/<包名>-config.json`。
`dsh-config.json` 即从 dsh-pet 的 `assets/config.jsonc` 提取的动作池/文案/表情包映射。

## 重新导入 / 更新

```bash
node scripts/sync-dsh-pack.mjs /path/to/dsh-pet/assets
```
