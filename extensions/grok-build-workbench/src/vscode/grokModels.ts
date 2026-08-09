import { spawn } from "node:child_process";

export interface GrokModelCatalog {
  defaultModel?: string;
  models: string[];
}

const ANSI_ESCAPE = /\x1B\[[0-?]*[ -/]*[@-~]/g;

export function parseGrokModels(output: string): GrokModelCatalog {
  const lines = output.replace(ANSI_ESCAPE, "").split(/\r?\n/);
  const defaultModel = lines
    .map((line) => /^Default model:\s*(\S+)/i.exec(line)?.[1])
    .find((value): value is string => Boolean(value));
  const marker = lines.findIndex((line) => /^Available models:\s*$/i.test(line.trim()));
  const models = marker < 0
    ? []
    : lines
        .slice(marker + 1)
        .map((line) => /^\s*\*?\s*([^\s(]+)(?:\s+\(default\))?\s*$/.exec(line)?.[1])
        .filter((value): value is string => Boolean(value));
  return {
    ...(defaultModel ? { defaultModel } : {}),
    models: [...new Set(models)],
  };
}

export async function discoverGrokModels(options: {
  executable: string;
  cwd: string;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<GrokModelCatalog> {
  return new Promise((resolve) => {
    const child = spawn(options.executable, ["models"], {
      cwd: options.cwd,
      env: { ...process.env, ...options.environment },
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 10_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-100_000);
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolve({ models: [] });
    });
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(parseGrokModels(stdout));
    });
  });
}
