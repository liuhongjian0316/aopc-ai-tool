// @ts-nocheck —— 由 JS 迁移（tools/store/ssh/figma/notify/openpencil 为动态工具实现，类型逐步收紧；入口 src/server.ts 全量检查）
/**
 * SSH/SCP/Rsync 封装：只依赖系统 ssh/scp/rsync 命令（macOS/Linux 自带），零 npm 依赖。
 * 安全约定：
 *  - 仅密钥认证（identity file / ssh-agent），BatchMode 禁止交互式密码提示，杜绝明文密码；
 *  - StrictHostKeyChecking=accept-new：新主机自动记录指纹，指纹变更仍会拒绝（防中间人）；
 *  - 所有远端命令经 execFile 数组传参执行，不做字符串拼接 shell。
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * 从环境变量取 SSH 目标（插件清单 userConfig → env 注入）。
 * overrides：环境级覆盖 {host, port, user}（来自档案 envs[].sshHost/sshPort/sshUser），空值回落全局。
 */
export function sshConfig(overrides = {}) {
  const cfg = {
    host: overrides.host || process.env.WUDI_SSH_HOST || "",
    port: overrides.port || process.env.WUDI_SSH_PORT || "22",
    user: overrides.user || process.env.WUDI_SSH_USER || "root",
    identity: process.env.WUDI_SSH_IDENTITY || "",
    timeoutSec: Number(process.env.WUDI_SSH_TIMEOUT_SEC || "15"),
  };
  if (!cfg.host) {
    throw new Error(
      "未配置 SSH 目标。请在 AOPC 插件设置里填写 wudi-coding 的 sshHost / sshUser（可选 sshPort、sshIdentityPath），然后重开会话使 MCP server 重新加载。"
    );
  }
  return cfg;
}

function baseArgs(cfg) {
  const args = [
    "-o", "BatchMode=yes",
    "-o", `ConnectTimeout=${Math.min(cfg.timeoutSec, 30)}`,
    "-o", "StrictHostKeyChecking=accept-new",
    "-p", String(cfg.port),
  ];
  if (cfg.identity) {
    if (!existsSync(cfg.identity)) {
      throw new Error(`SSH 密钥文件不存在：${cfg.identity}`);
    }
    args.push("-i", cfg.identity);
  }
  args.push(`${cfg.user}@${cfg.host}`);
  return args;
}

function run(file, args, { timeoutMs = 120_000, maxBuffer = 32 * 1024 * 1024 } = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(file, args, { timeout: timeoutMs, maxBuffer, encoding: "utf-8" }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(
          `${file} 退出码 ${err.killed ? "（超时被杀）" : err.code ?? "?"}：${String(stderr || err.message).slice(0, 2000)}`
        );
        e.code = err.code;
        e.killed = err.killed;
        reject(e);
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

/** 远端执行一条命令，返回 {stdout, stderr}。命令必须是单条 shell 命令字符串（在远端 sh 中执行）。 */
export async function sshRun(command, { timeoutMs = 120_000, overrides = {} } = {}) {
  const cfg = sshConfig(overrides);
  const args = [...baseArgs(cfg), command];
  return run("ssh", args, { timeoutMs });
}

/**
 * 本地执行（构建/打包等），shell 语义（支持 &&、环境变量展开）。
 * 返回 {stdout, stderr}；失败时抛错并截断输出。
 */
export function localRun(command, { cwd, timeoutMs = 600_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      "/bin/sh",
      ["-c", command],
      { cwd, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, encoding: "utf-8" },
      (err, stdout, stderr) => {
        if (err) {
          const e = new Error(
            `本地命令退出码 ${err.killed ? "（超时被杀）" : err.code ?? "?"}：${command}\n${String(stderr || err.message).slice(0, 2000)}`
          );
          e.code = err.code;
          reject(e);
          return;
        }
        resolvePromise({ stdout, stderr });
      }
    );
  });
}

/** 上传单个本地文件到远端路径。优先 rsync（增量），不可用回退 scp。 */
export async function uploadFile(localPath, remotePath, { timeoutMs = 30 * 60_000, overrides = {} } = {}) {
  const cfg = sshConfig(overrides);
  const dest = `${cfg.user}@${cfg.host}`;
  const sshOption = `ssh -o BatchMode=yes -o ConnectTimeout=${Math.min(cfg.timeoutSec, 30)} -o StrictHostKeyChecking=accept-new${cfg.identity ? ` -i ${cfg.identity}` : ""} -p ${cfg.port}`;
  try {
    const rsyncArgs = ["-az", "--quiet", "-e", sshOption, localPath, `${dest}:${remotePath}`];
    return await run("rsync", rsyncArgs, { timeoutMs });
  } catch {
    // rsync 不存在或失败，回退 scp
    const scpArgs = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-P", String(cfg.port)];
    if (cfg.identity) scpArgs.push("-i", cfg.identity);
    scpArgs.push(localPath, `${dest}:${remotePath}`);
    return run("scp", scpArgs, { timeoutMs });
  }
}

/** SSH 连通性测试：远端 echo 一次，返回 {ok, latencyMs, banner}。 */
export async function sshPing(overrides = {}) {
  const cfg = sshConfig(overrides);
  const started = Date.now();
  const { stdout } = await sshRun("echo wudi-ping-ok", { timeoutMs: cfg.timeoutSec * 1000 + 5_000, overrides });
  return { ok: stdout.includes("wudi-ping-ok"), latencyMs: Date.now() - started, host: cfg.host };
}
