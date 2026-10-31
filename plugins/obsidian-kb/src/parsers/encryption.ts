/**
 * Encryption support for vaults encrypted with Obsidian plugins
 * Supports: age, gpg, openssl, custom command
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export interface EncryptionConfig {
  enabled: boolean;
  method: "age" | "gpg" | "openssl" | "custom";
  keyPath?: string;
  passphraseEnv?: string;
  customCommand?: string;
}

/**
 * Decrypt an encrypted file. Returns the decrypted content.
 * If encryption is not enabled, returns raw content.
 */
export async function decryptFile(
  filePath: string,
  config: EncryptionConfig
): Promise<string> {
  if (!config.enabled) {
    return readFile(filePath, "utf-8");
  }

  const tmpOut = join(tmpdir(), `obsidian-decrypt-${randomBytes(8).toString("hex")}.tmp`);

  try {
    switch (config.method) {
      case "age": {
        const args = ["--decrypt"];
        if (config.keyPath) {
          args.push("--identity", config.keyPath);
        }
        args.push(filePath, "-o", tmpOut);
        await execFileAsync("age", args);
        break;
      }

      case "gpg": {
        const env: Record<string, string> = {};
        if (config.passphraseEnv) {
          const pass = process.env[config.passphraseEnv];
          if (pass) {
            env.GPG_PASSPHRASE = pass;
          }
        }
        await execFileAsync("gpg", [
          "--decrypt",
          "--batch",
          "--yes",
          ...(config.keyPath ? ["--keyring", config.keyPath] : []),
          "--output", tmpOut,
          filePath
        ], { env: { ...process.env, ...env } });
        break;
      }

      case "openssl": {
        const env: Record<string, string> = {};
        if (config.passphraseEnv) {
          const pass = process.env[config.passphraseEnv];
          if (pass) {
            env.PASSPHRASE = pass;
          }
        }
        await execFileAsync("openssl", [
          "enc", "-d", "-aes-256-cbc", "-md", "sha256",
          "-in", filePath, "-out", tmpOut, "-pass", "env:PASSPHRASE"
        ], { env: { ...process.env, ...env } });
        break;
      }

      case "custom": {
        if (!config.customCommand) {
          throw new Error("Custom encryption method requires a customCommand");
        }
        const command = config.customCommand
          .replace("{input}", filePath)
          .replace("{output}", tmpOut);
        await execFileAsync("/bin/sh", ["-c", command]);
        break;
      }

      default:
        throw new Error(`Unsupported encryption method: ${config.method}`);
    }

    const content = await readFile(tmpOut, "utf-8");
    await unlink(tmpOut).catch(() => {});
    return content;
  } catch (err) {
    await unlink(tmpOut).catch(() => {});
    throw new Error(`Decryption failed (${config.method}): ${err instanceof Error ? err.message : String(err)}`);
  }
}
