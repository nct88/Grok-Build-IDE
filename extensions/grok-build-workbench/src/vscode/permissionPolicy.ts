import type * as acp from "@agentclientprotocol/sdk";
import type { PermissionMode } from "../acp/types.js";

const AUTO_SAFE_TOOL_KINDS = new Set(["read", "search", "think", "fetch"]);
const EDIT_TOOL_KINDS = new Set(["edit", "write", "delete", "move"]);

export function selectAutomaticPermissionOption(
  mode: PermissionMode,
  toolKind: string | undefined,
  options: acp.PermissionOption[],
): acp.PermissionOption | undefined {
  const mayApprove =
    mode === "full" ||
    mode === "dontAsk" ||
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
    (mode === "full" || mode === "dontAsk"
      ? allowed.find((option) => option.kind === "allow_always")
      : undefined) ??
    allowed.find((option) => option.kind === "allow_once") ??
    allowed[0]
  );
}
