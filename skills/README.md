# skills/ — 技能收录说明

AOPC 中技能（Skill）随插件分发：每个技能是插件 `skills/<skill-name>/SKILL.md` 下的一个目录，
插件清单声明 `"skills": "skills"` 后由插件发现机制加载。因此本目录不是技能的运行时位置，
而是收录说明与模板约定。

## 新增技能的约定

1. 为技能新建（或复用）一个纯技能型插件目录 `plugins/<plugin-name>/`：

   ```text
   plugins/<plugin-name>/
   ├── .aopc-plugin/plugin.json   # {"name": "...", "version": "...", "skills": "skills"}
   ├── skills/
   │   └── <skill-name>/
   │       ├── SKILL.md           # frontmatter 必需 name、description
   │       └── scripts/           # 技能自带脚本（可选）
   └── README.md
   ```

2. 在 `.claude-plugin/marketplace.json` 的 `plugins` 数组追加条目：

   ```json
   {
     "name": "<plugin-name>",
     "source": "./plugins/<plugin-name>",
     "description": "……"
   }
   ```

3. 技能内引用脚本用相对路径（`scripts/xxx.mjs`），技能加载时会提供技能目录上下文；
   不要硬编码 `~/.aopc/...` 安装缓存路径。

4. 提交前执行 `aopc plugins validate plugins/<plugin-name>` 校验。
