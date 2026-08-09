import { cliOptions, runGrokCli, stripAnsi } from "./cliRunner.js";

export interface WorktreeInfo {
  name: string;
  path: string;
  detail: string;
}

export function parseWorktreeList(output: string): WorktreeInfo[] {
  const text = stripAnsi(output).trim();
  if (!text || /no worktrees/i.test(text)) {
    return [];
  }
  const items: WorktreeInfo[] = [];
  for (const line of text.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
    if (/^name\b|^worktree/i.test(line)) {
      continue;
    }
    const columns = line.split(/\s{2,}|\t+/).map((part) => part.trim()).filter(Boolean);
    if (columns.length === 0) {
      continue;
    }
    items.push({
      name: columns[0]!,
      path: columns[1] ?? "",
      detail: columns.slice(1).join(" · ") || line,
    });
  }
  return items;
}

export async function listWorktrees(options: {
  executable: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<WorktreeInfo[]> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["worktree", "list"],
    cwd: options.cwd,
    environment: options.environment,
  }));
  return parseWorktreeList(result.stdout || result.stderr);
}

export async function removeWorktree(options: {
  executable: string;
  name: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["worktree", "rm", options.name],
    cwd: options.cwd,
    environment: options.environment,
  }));
  const output = (result.stdout || result.stderr).trim();
  if ((result.code ?? 1) !== 0) {
    throw new Error(output || `Failed to remove worktree ${options.name}`);
  }
  return output;
}
