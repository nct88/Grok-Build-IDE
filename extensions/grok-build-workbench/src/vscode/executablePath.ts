import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Exists = (path: string) => boolean;

export function resolveGrokExecutable(
  configured: string,
  platform = process.platform,
  home = homedir(),
  exists: Exists = existsSync,
): string {
  const candidate = configured.trim() || "grok";
  if (candidate !== "grok" || platform !== "win32") {
    return candidate;
  }

  const userInstall = join(home, ".grok", "bin", "grok.exe");
  return exists(userInstall) ? userInstall : candidate;
}
