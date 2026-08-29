import type { PermissionMode } from "../acp/types.js";

export interface GrokLaunchSettings {
  extraArguments: string[];
  model: string;
  reasoningEffort: string;
  permissionMode?: PermissionMode;
  sandbox?: string;
  tools?: string;
  deniedTools?: string;
  worktree?: string;
  worktreeRef?: string;
  experimentalMemory?: boolean;
  disableWebSearch?: boolean;
  rules?: string;
  maxTurns?: number;
}

export function buildGrokLaunchArguments(settings: GrokLaunchSettings): string[] {
  const argumentsList = [...settings.extraArguments];
  const model = settings.model.trim();
  const reasoningEffort = settings.reasoningEffort.trim();
  const sandbox = settings.sandbox?.trim() ?? "";
  const tools = settings.tools?.trim() ?? "";
  const deniedTools = settings.deniedTools?.trim() ?? "";
  const worktree = settings.worktree?.trim() ?? "";
  const worktreeRef = settings.worktreeRef?.trim() ?? "";
  const rules = settings.rules?.trim() ?? "";

  if (model) {
    argumentsList.push("--model", model);
  }
  if (reasoningEffort) {
    argumentsList.push("--reasoning-effort", reasoningEffort);
  }

  // Prefer explicit CLI permission flags unless the user already set them.
  if (!argumentsList.includes("--permission-mode") && !argumentsList.includes("--always-approve")) {
    switch (settings.permissionMode) {
      case "auto":
        argumentsList.push("--permission-mode", "auto");
        break;
      case "acceptEdits":
        argumentsList.push("--permission-mode", "acceptEdits");
        break;
      case "plan":
        argumentsList.push("--permission-mode", "plan");
        break;
      case "dontAsk":
        argumentsList.push("--permission-mode", "dontAsk");
        break;
      case "full":
        argumentsList.push("--permission-mode", "bypassPermissions");
        break;
      case "ask":
      default:
        break;
    }
  }

  if (sandbox && !argumentsList.includes("--sandbox")) {
    argumentsList.push("--sandbox", sandbox);
  }
  if (tools && !argumentsList.includes("--tools")) {
    argumentsList.push("--tools", tools);
  }
  if (deniedTools && !argumentsList.includes("--deny") && !argumentsList.includes("--disallowed-tools")) {
    argumentsList.push("--disallowed-tools", deniedTools);
  }
  if (worktree) {
    if (!argumentsList.includes("--worktree") && !argumentsList.includes("-w")) {
      argumentsList.push("--worktree");
      if (worktree !== "__auto__") {
        argumentsList.push(worktree);
      }
    }
    if (worktreeRef && !argumentsList.includes("--worktree-ref") && !argumentsList.includes("--ref")) {
      argumentsList.push("--worktree-ref", worktreeRef);
    }
  }
  if (settings.experimentalMemory && !argumentsList.includes("--experimental-memory")) {
    argumentsList.push("--experimental-memory");
  }
  if (settings.disableWebSearch && !argumentsList.includes("--disable-web-search")) {
    argumentsList.push("--disable-web-search");
  }
  if (rules && !argumentsList.includes("--rules")) {
    argumentsList.push("--rules", rules);
  }
  if (
    typeof settings.maxTurns === "number" &&
    settings.maxTurns > 0 &&
    !argumentsList.includes("--max-turns")
  ) {
    argumentsList.push("--max-turns", String(settings.maxTurns));
  }

  return argumentsList;
}
