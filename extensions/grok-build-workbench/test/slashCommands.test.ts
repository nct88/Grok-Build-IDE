import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

function loadSlash() {
  const sandbox: Record<string, object> = {};
  const source = readFileSync(new URL("../media/slashCommands.js", import.meta.url), "utf8");
  runInNewContext(source, sandbox);
  return sandbox.GrokSlashCommands as {
    resolveSlash: (text: string) => { kind: string; text?: string; action?: string };
    menuForInput: (value: string, caret: number) => { items: Array<{ id: string }> } | null;
    setRuntimeCommands: (items: Array<{ id: string; kind: string; hint?: string }>) => unknown;
  };
}

describe("slash commands", () => {
  const slash = loadSlash();

  test("expands recap and imagine prompts", () => {
    expect(slash.resolveSlash("/recap")).toMatchObject({ kind: "prompt" });
    expect(slash.resolveSlash("/imagine a red cube")).toMatchObject({ kind: "prompt" });
    expect(String(slash.resolveSlash("/imagine a red cube").text)).toContain("image_gen");
  });

  test("maps TUI actions without sending a prompt", () => {
    expect(slash.resolveSlash("/new")).toEqual({ kind: "ui", action: "new", arg: "" });
    expect(slash.resolveSlash("/session-info")).toMatchObject({ kind: "ui", action: "session-info" });
    expect(slash.resolveSlash("/effort high")).toMatchObject({ kind: "ui", action: "effort", arg: "high" });
  });

  test("filters the menu and prefers built-ins over skills", () => {
    slash.setRuntimeCommands([{ id: "review-pr", kind: "skill", hint: "Review a PR" }]);
    const menu = slash.menuForInput("/re", 3);
    expect(menu?.items.some((item) => item.id === "recap")).toBe(true);
    expect(menu?.items.some((item) => item.id === "review-pr")).toBe(true);
    expect(slash.resolveSlash("/review-pr login")).toMatchObject({ kind: "prompt" });
  });
});
