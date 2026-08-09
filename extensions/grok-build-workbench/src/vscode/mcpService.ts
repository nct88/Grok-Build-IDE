import { cliOptions, runGrokCli, stripAnsi } from "./cliRunner.js";

export interface McpServerInfo {
  name: string;
  enabled: boolean;
  detail: string;
}

/**
 * Parses `grok mcp list` human output into server rows.
 * Handles empty state and common list layouts.
 */
export function parseMcpList(output: string): McpServerInfo[] {
  const text = stripAnsi(output).trim();
  if (!text || /no mcp servers/i.test(text)) {
    return [];
  }

  const servers: McpServerInfo[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^name\b/i.test(line) || /^mcp servers/i.test(line)) {
      continue;
    }
    // Examples:
    // "github  enabled  npx -y @model..."
    // "• sentry (disabled) — https://..."
    const bullet = /^[•*-]?\s*([^\s(]+)(?:\s*\(([^)]+)\))?(?:\s*[—:-]\s*(.+))?$/.exec(line);
    if (bullet) {
      const status = (bullet[2] ?? "").toLowerCase();
      servers.push({
        name: bullet[1]!,
        enabled: !/disabled|off|false/.test(status),
        detail: bullet[3]?.trim() || line,
      });
      continue;
    }
    const columns = line.split(/\s{2,}|\t+/).map((part) => part.trim()).filter(Boolean);
    if (columns.length >= 1 && !/^(name|server)$/i.test(columns[0]!)) {
      const status = (columns[1] ?? "enabled").toLowerCase();
      servers.push({
        name: columns[0]!,
        enabled: !/disabled|off|false/.test(status),
        detail: columns.slice(1).join(" · ") || line,
      });
    }
  }
  return servers;
}

export async function listMcpServers(options: {
  executable: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<McpServerInfo[]> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["mcp", "list"],
    cwd: options.cwd,
    environment: options.environment,
  }));
  return parseMcpList(result.stdout || result.stderr);
}

export async function runMcpCommand(options: {
  executable: string;
  args: string[];
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["mcp", ...options.args],
    cwd: options.cwd,
    environment: options.environment,
  }));
  const output = (result.stdout || result.stderr).trim();
  if ((result.code ?? 1) !== 0) {
    throw new Error(output || `mcp ${options.args.join(" ")} failed`);
  }
  return output;
}
