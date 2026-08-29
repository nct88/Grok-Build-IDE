import type * as acp from "@agentclientprotocol/sdk";
import type { PermissionMode } from "../acp/types.js";

const AUTO_SAFE_TOOL_KINDS = new Set(["read", "search", "think", "fetch"]);
const EDIT_TOOL_KINDS = new Set(["edit", "write", "delete", "move"]);

function hookAskText(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) return "[circular]";
        seen.add(item);
      }
      return item;
    });
  } catch {
    return String(value ?? "");
  }
}

/** A PreToolUse { decision: "ask" } must remain an interactive ACP card. */
export function isHookAskRequest(request: unknown): boolean {
  const text = hookAskText(request);
  return /pre[ _-]?tool[ _-]?use/i.test(text) && /\bask\b/i.test(text);
}

export function selectAutomaticPermissionOption(
  mode: PermissionMode,
  toolKind: string | undefined,
  options: acp.PermissionOption[],
  request?: unknown,
): acp.PermissionOption | undefined {
  if (isHookAskRequest(request)) {
    return undefined;
  }
  const mayApprove =
    mode === "full" ||
    (mode === "auto" && toolKind !== undefined && AUTO_SAFE_TOOL_KINDS.has(toolKind)) ||
    (mode === "acceptEdits" &&
      toolKind !== undefined &&
      (AUTO_SAFE_TOOL_KINDS.has(toolKind) || EDIT_TOOL_KINDS.has(toolKind)));

  // Plan mode never auto-approves tool execution from the client side.
  if (mode === "plan" || mode === "ask" || !mayApprove) {
    return undefined;
  }

  const allowed = options.filter((option) => option.kind.startsWith("allow_"));
  return (
    (mode === "full"
      ? allowed.find((option) => option.kind === "allow_always")
      : undefined) ??
    allowed.find((option) => option.kind === "allow_once") ??
    allowed[0]
  );
}
