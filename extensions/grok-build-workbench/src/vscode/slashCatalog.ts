import { execFile } from "node:child_process";
import { relative, resolve } from "node:path";
import { homedir } from "node:os";

const MAX_HINT_LENGTH = 96;

export interface SlashSkillCommand {
  id: string;
  label: string;
  hint: string;
  description: string;
  insert: string;
  kind: "skill";
  source: string;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function pathInside(candidate: string, root: string): boolean {
  if (!candidate || !root) {
    return false;
  }
  const value = relative(resolve(root), resolve(candidate));
  return value === "" || (!value.startsWith("..") && !value.includes(":"));
}

function skillSource(skill: Record<string, unknown>): { type: string; path: string } {
  const source = skill.source;
  if (source && typeof source === "object") {
    const record = source as { type?: string; path?: string };
    return {
      type: String(record.type || "").toLowerCase(),
      path: String(record.path || ""),
    };
  }
  const text = String(source || "");
  const type = text.match(/(?:^|[{@;\s])type=([^;}\s]+)/i)?.[1] || "";
  const sourcePath = text.match(/(?:^|[{@;\s])path=([^;}]+?)(?=;\s*\w+=|}$|$)/i)?.[1] || "";
  return { type: type.toLowerCase(), path: sourcePath.trim() };
}

function hintFromDescription(description: string): string {
  const compact = String(description || "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Local Grok skill";
  }
  const firstSentence = compact.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || compact;
  if (firstSentence.length <= MAX_HINT_LENGTH) {
    return firstSentence;
  }
  return `${firstSentence.slice(0, MAX_HINT_LENGTH - 1).trimEnd()}…`;
}

/** Keep only invocable skills stored in this workspace or GROK_HOME/skills. */
export function normalizeInspectSkills(
  inspect: { skills?: Array<Record<string, unknown>> } | null | undefined,
  options: { workspaceRoot?: string; grokHome?: string } = {},
): SlashSkillCommand[] {
  const workspaceRoot = options.workspaceRoot ? resolve(options.workspaceRoot) : "";
  const grokHome = options.grokHome ? resolve(options.grokHome) : "";
  const localRoots = [
    workspaceRoot && resolve(workspaceRoot, ".grok", "skills"),
    grokHome && resolve(grokHome, "skills"),
  ].filter(Boolean) as string[];
  const seen = new Set<string>();
  const commands: SlashSkillCommand[] = [];

  for (const skill of Array.isArray(inspect?.skills) ? inspect.skills : []) {
    if (skill?.userInvocable !== true) {
      continue;
    }
    const id = String(skill.name || "").trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id) || seen.has(id)) {
      continue;
    }
    const source = skillSource(skill);
    if (!source.path || !localRoots.some((root) => pathInside(source.path, root))) {
      continue;
    }
    seen.add(id);
    commands.push({
      id,
      label: `/${id}`,
      hint: hintFromDescription(String(skill.description || "")),
      description: String(skill.description || "").replace(/\s+/g, " ").trim(),
      insert: `/${id} `,
      kind: "skill",
      source: source.type || "local",
    });
  }

  return commands.sort((a, b) => a.id.localeCompare(b.id));
}

function inspectGrok(options: {
  executable: string;
  cwd: string;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<Record<string, unknown> | null> {
  return new Promise((resolveInspect) => {
    execFile(
      options.executable,
      ["inspect", "--json"],
      {
        cwd: options.cwd,
        env: { ...process.env, ...options.environment },
        timeout: options.timeoutMs ?? 10_000,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          resolveInspect(null);
          return;
        }
        try {
          resolveInspect(JSON.parse(stripBom(String(stdout))) as Record<string, unknown>);
        } catch {
          resolveInspect(null);
        }
      },
    );
  });
}

export async function loadLocalSlashCommands(options: {
  executable: string;
  workspaceRoot?: string;
  grokHome?: string;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): Promise<SlashSkillCommand[]> {
  const workspaceRoot = options.workspaceRoot ? resolve(options.workspaceRoot) : "";
  const grokHome = options.grokHome ? resolve(options.grokHome) : resolve(homedir(), ".grok");
  const cwd = workspaceRoot || grokHome;
  if (!cwd) {
    return [];
  }
  const inspect = await inspectGrok({
    executable: options.executable,
    cwd,
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
  });
  return normalizeInspectSkills(inspect, { workspaceRoot, grokHome });
}
