import { cliOptions, runGrokCli, stripAnsi } from "./cliRunner.js";

export interface PluginInfo {
  name: string;
  enabled: boolean;
  detail: string;
}

export function parsePluginList(output: string): PluginInfo[] {
  const text = stripAnsi(output).trim();
  if (!text || /no plugins installed/i.test(text)) {
    return [];
  }
  const plugins: PluginInfo[] = [];
  for (const line of text.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
    if (/^name\b|^plugins/i.test(line)) {
      continue;
    }
    const match = /^[•*-]?\s*([^\s(]+)(?:\s*\(([^)]+)\))?(?:\s*[—:-]\s*(.+))?$/.exec(line);
    if (match) {
      const status = (match[2] ?? "").toLowerCase();
      plugins.push({
        name: match[1]!,
        enabled: !/disabled|off|false/.test(status),
        detail: match[3]?.trim() || line,
      });
      continue;
    }
    const columns = line.split(/\s{2,}|\t+/).map((part) => part.trim()).filter(Boolean);
    if (columns[0]) {
      plugins.push({
        name: columns[0],
        enabled: !/disabled|off|false/i.test(columns[1] ?? "enabled"),
        detail: columns.slice(1).join(" · ") || line,
      });
    }
  }
  return plugins;
}

export async function listPlugins(options: {
  executable: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<PluginInfo[]> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["plugin", "list"],
    cwd: options.cwd,
    environment: options.environment,
  }));
  return parsePluginList(result.stdout || result.stderr);
}

export async function runPluginCommand(options: {
  executable: string;
  args: string[];
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["plugin", ...options.args],
    cwd: options.cwd,
    environment: options.environment,
    timeoutMs: 120_000,
  }));
  const output = (result.stdout || result.stderr).trim();
  if ((result.code ?? 1) !== 0) {
    throw new Error(output || `plugin ${options.args.join(" ")} failed`);
  }
  return output;
}

export async function clearMemory(options: {
  executable: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["memory", "clear", "--workspace", "--yes"],
    cwd: options.cwd,
    environment: options.environment,
  }));
  const output = (result.stdout || result.stderr).trim();
  if ((result.code ?? 1) !== 0) {
    throw new Error(output || "Failed to clear memory");
  }
  return output || "Memory cleared";
}

export async function runLogin(options: {
  executable: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["login"],
    cwd: options.cwd,
    environment: options.environment,
    timeoutMs: 180_000,
  }));
  const output = (result.stdout || result.stderr).trim();
  if ((result.code ?? 1) !== 0) {
    throw new Error(output || "Login failed");
  }
  return output || "Login completed";
}

export async function runLogout(options: {
  executable: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["logout"],
    cwd: options.cwd,
    environment: options.environment,
  }));
  const output = (result.stdout || result.stderr).trim();
  if ((result.code ?? 1) !== 0) {
    throw new Error(output || "Logout failed");
  }
  return output || "Logged out";
}

export async function runDoctor(options: {
  executable: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["doctor"],
    cwd: options.cwd,
    environment: options.environment,
  }));
  return (result.stdout || result.stderr).trim() || "Doctor completed";
}
