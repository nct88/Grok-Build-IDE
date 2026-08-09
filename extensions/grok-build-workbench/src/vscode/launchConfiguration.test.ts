import { describe, expect, it } from "vitest";
import { buildGrokLaunchArguments } from "./launchConfiguration.js";

describe("buildGrokLaunchArguments", () => {
  it("keeps extra arguments and omits blank optional settings", () => {
    expect(
      buildGrokLaunchArguments({
        extraArguments: ["--no-leader"],
        model: "  ",
        reasoningEffort: "",
      }),
    ).toEqual(["--no-leader"]);
  });

  it("adds configured model and reasoning effort before the agent command", () => {
    expect(
      buildGrokLaunchArguments({
        extraArguments: ["--no-leader"],
        model: " grok-4.5 ",
        reasoningEffort: " high ",
      }),
    ).toEqual([
      "--no-leader",
      "--model",
      "grok-4.5",
      "--reasoning-effort",
      "high",
    ]);
  });

  it("enables Grok always-approve only for full access", () => {
    expect(
      buildGrokLaunchArguments({
        extraArguments: [],
        model: "",
        reasoningEffort: "",
        permissionMode: "full",
      }),
    ).toEqual(["--always-approve"]);
  });

  it("uses Grok's native auto permission mode", () => {
    expect(
      buildGrokLaunchArguments({
        extraArguments: [],
        model: "",
        reasoningEffort: "",
        permissionMode: "auto",
      }),
    ).toEqual(["--permission-mode", "auto"]);
  });

  it("maps acceptEdits, plan, and dontAsk permission modes", () => {
    expect(
      buildGrokLaunchArguments({
        extraArguments: [],
        model: "",
        reasoningEffort: "",
        permissionMode: "acceptEdits",
      }),
    ).toEqual(["--permission-mode", "acceptEdits"]);
    expect(
      buildGrokLaunchArguments({
        extraArguments: [],
        model: "",
        reasoningEffort: "",
        permissionMode: "plan",
      }),
    ).toEqual(["--permission-mode", "plan"]);
    expect(
      buildGrokLaunchArguments({
        extraArguments: [],
        model: "",
        reasoningEffort: "",
        permissionMode: "dontAsk",
      }),
    ).toEqual(["--permission-mode", "dontAsk"]);
  });

  it("adds sandbox, tools policy, worktree, memory, and rules flags", () => {
    expect(
      buildGrokLaunchArguments({
        extraArguments: [],
        model: "",
        reasoningEffort: "",
        sandbox: "workspace",
        tools: "read,edit",
        deniedTools: "bash",
        worktree: "feat-x",
        worktreeRef: "main",
        experimentalMemory: true,
        disableWebSearch: true,
        rules: "Be concise",
        maxTurns: 12,
      }),
    ).toEqual([
      "--sandbox",
      "workspace",
      "--tools",
      "read,edit",
      "--disallowed-tools",
      "bash",
      "--worktree",
      "feat-x",
      "--worktree-ref",
      "main",
      "--experimental-memory",
      "--disable-web-search",
      "--rules",
      "Be concise",
      "--max-turns",
      "12",
    ]);
  });

  it("preserves explicit sandbox-off and supports an automatically named worktree", () => {
    expect(
      buildGrokLaunchArguments({
        extraArguments: [],
        model: "",
        reasoningEffort: "",
        sandbox: "off",
        worktree: "__auto__",
        worktreeRef: "main",
      }),
    ).toEqual(["--sandbox", "off", "--worktree", "--worktree-ref", "main"]);
  });
});
