---
name: wudi-deploy
description: SSH 服务器 + Docker 部署方法论与流水线：build → package → upload → remote → verify 五阶段执行、软链回滚、健康检查与故障排查。当用户要部署、上线、发布、回滚、看部署状态，或 /wudi-deploy 进入部署域时使用。
---

# SSH + Docker 部署

目标模型：自有服务器，`releases/<时间戳>` 目录 + `current` 软链原子切换，Docker Compose 编排，健康检查收口。

## 第零步：项目档案

没有 `.wudi/project.json` 就先建档（有 `wudi_project_init` MCP 工具就用工具；没有就按问答收集后手写）。必须收集：

```json
{
  "name": "项目名",
  "techStack": "如 go / node / vite-spa / docker-compose",
  "build": "本地构建命令，如 npm run build",
  "package": "产物说明：目录或 docker 镜像 tar",
  "deployRoot": "/srv/myapp",
  "remoteScript": "远端切换后执行的命令，如 docker compose up -d",
  "healthCheck": { "url": "http://host:port/healthz", "expect": 200 }
}
```

SSH 目标（host/port/user/identity）来自插件 userConfig，不写进项目档案、不进 git。

## 五阶段流水线

每阶段成功才进下一阶段；任何阶段失败：立即停止 → 报告卡在哪个阶段 + 原始报错 → 给修复建议 → 确认线上是否受影响（前三阶段失败不影响线上）。

1. **build**：本地执行构建命令。失败先看是不是依赖没装（lock 文件变了要重装）。
2. **package**：产物打包 —— 静态站/单二进制打 tar；Docker 项目 `docker save` 出镜像 tar。包名带时间戳：`<name>-<yyyymmdd-hhmmss>.tar.gz`。排除 `node_modules`、`.env`、`.git`。
3. **upload**：`rsync -avz --delete`（或 `scp`）到服务器 `<deployRoot>/releases/<时间戳>/`。先传包再解压，不直接 rsync 散文件到线上目录。
4. **remote**：远端执行（`ssh <target> "..."` 或 MCP 工具）：
   - 有 `deploy.package`（镜像 tar）→ `docker load` + `docker compose up -d`
   - 纯文件产物 → 写好 `.env`（服务器侧生成，不在包里）→ 执行项目档案的 `remoteScript`
   - Nginx 托管静态产物 → 切软链 `ln -sfn <releases/新> <deployRoot>/current` + `nginx -s reload`
5. **verify**：健康检查 URL 重试 3 次（间隔 5s），期望状态码 200；失败立即进入回滚决策。

执行路径选择：有 `wudi_deploy` / `wudi_rollback` 等 MCP 工具一律用工具（自动留历史、面板可见）；工具不可用（插件未装 MCP 层）才用 bash 手动执行，并提醒用户手动记录本次部署。

## 回滚

- 软链模式：`ln -sfn <releases/上一个> <deployRoot>/current` + 重启/ reload + 健康检查。
- 镜像模式：`docker tag` 回上一版镜像 + `up -d`。
- 回滚后必须健康检查通过，并在汇报中说明「当前线上 = 哪个时间戳的版本」。
- 数据库迁移不可自动回滚：迁移前先备份（`pg_dump`/`mysqldump`），回滚涉及迁移时停下问用户。

## 故障排查（verify 失败时按序查）

1. 服务进程：`docker ps -a` / `systemctl status` —— 起没起、有没有重启循环
2. 日志：`docker logs --tail 100 <容器>` / `journalctl -u <服务> -n 100`
3. 端口：`ss -tlnp | grep <port>` —— 被谁占了
4. 反代：`tail -50 /var/log/nginx/error.log`，Nginx 配置 `nginx -t` 语法检查
5. 配置：服务器侧 `.env` 是否齐全（对照项目档案的环境变量清单）
6. 磁盘/内存：`df -h`、`free -m` —— 磁盘满是静默失败高发原因

## 红线

- 不在命令行明文传密码（用 identity file / ssh-agent）；密钥、`.env` 不进日志、不进包、不进 git。
- 生产部署前必须得到用户明确确认（除非用户本次会话已授权自动部署）。
- 不删远端旧版本目录以外的任何东西；清理旧 releases（保留最近 5 个）要先列出再确认。
- 健康检查不通过不许说「部署完成」；要么修复，要么回滚，要么明确说明带病上线由用户拍板。
