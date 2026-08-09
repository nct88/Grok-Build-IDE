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

  it("dontAsk and full prefer allow-always and never select reject", () => {
    expect(selectAutomaticPermissionOption("full", "execute", options)?.optionId).toBe("always");
    expect(selectAutomaticPermissionOption("dontAsk", "execute", options)?.optionId).toBe("always");
    expect(
      selectAutomaticPermissionOption("full", "delete", [options[2]!]),
    ).toBeUndefined();
  });
});
