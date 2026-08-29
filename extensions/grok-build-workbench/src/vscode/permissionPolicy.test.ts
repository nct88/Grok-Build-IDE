import { describe, expect, it } from "vitest";
import { selectAutomaticPermissionOption } from "./permissionPolicy.js";

const options = [
  { optionId: "once", name: "Allow once", kind: "allow_once" as const },
  { optionId: "always", name: "Always allow", kind: "allow_always" as const },
  { optionId: "reject", name: "Reject", kind: "reject_once" as const },
];

describe("permission policy", () => {
  it("keeps every Ask request interactive", () => {
    expect(selectAutomaticPermissionOption("ask", "read", options)).toBeUndefined();
  });

  it("auto-approves safe reads but still asks for edits and commands", () => {
    expect(selectAutomaticPermissionOption("auto", "read", options)?.optionId).toBe("once");
    expect(selectAutomaticPermissionOption("auto", "edit", options)).toBeUndefined();
    expect(selectAutomaticPermissionOption("auto", "execute", options)).toBeUndefined();
  });

  it("acceptEdits auto-approves edits but not execute", () => {
    expect(selectAutomaticPermissionOption("acceptEdits", "edit", options)?.optionId).toBe("once");
    expect(selectAutomaticPermissionOption("acceptEdits", "execute", options)).toBeUndefined();
  });

  it("plan mode never auto-approves", () => {
    expect(selectAutomaticPermissionOption("plan", "read", options)).toBeUndefined();
  });

  it("full prefers allow-always, while dontAsk keeps the CLI deny-by-default policy", () => {
    expect(selectAutomaticPermissionOption("full", "execute", options)?.optionId).toBe("always");
    expect(selectAutomaticPermissionOption("dontAsk", "execute", options)).toBeUndefined();
    expect(
      selectAutomaticPermissionOption("full", "delete", [options[2]!]),
    ).toBeUndefined();
  });

  it("never auto-approves a PreToolUse hook ask, including full access", () => {
    expect(
      selectAutomaticPermissionOption("full", "execute", options, {
        toolCall: { kind: "execute" },
        _meta: { hookName: "PreToolUse", decision: "ask" },
      }),
    ).toBeUndefined();
  });
});
