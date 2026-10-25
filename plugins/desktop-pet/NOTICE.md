# NOTICE

本插件（`plugins/desktop-pet`）是对 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（MIT License，© PC2005-cloud 仓库贡献者）的功能复刻与移植，面向 AOPC 插件体系重写。

- `shared/` 下的 `constants.ts`、`displays.ts`、`physics.ts`、`pickers.ts`、`work-status.ts`、`types.ts` **直接移植自 dsh-pet `src/shared/`**（MIT），保留原注释与语义，仅随本仓库构建为 `shared/dist/shared-core.mjs`。物理手感（弹簧跟手、甩抛初速估算、多屏空洞语义、Q 弹挤压、宠物互撞）与上游严格一致。
- 其余模块（Electron 运行壳、渲染引擎、MCP server、HTTP API）参考 dsh-pet 的行为语义重写，不复制上游代码。
- **动画素材**（`packs/dsh/webm/*.webm`、`packs/dsh/memes/*.png`、`packs/dsh/sound/click-duck.wav`、`assets/logo.png` 托盘图标）来自 dsh-pet 仓库 `assets/`，按其仓库声明的素材条款（**禁止商用**、二创须附原仓库链接）随本仓库分发，出处：https://github.com/PC2005-cloud/dsh-pet 。本插件整体仅用于个人/非商用场景；如需商用请移除 `packs/dsh/`（内置 `builtin` 程序化宠物包零素材依赖，可完全替代）。

dsh-pet 的 MIT 许可文本见其仓库 LICENSE；本插件自身代码以本仓库 LICENSE（MIT）发布。
