import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { normalizeInspectSkills } from "./slashCatalog.js";

describe("normalizeInspectSkills", () => {
  it("keeps only user-invocable skills under workspace or GROK_HOME", () => {
    const workspaceRoot = "H:\\proj";
    const grokHome = "H:\\Users\\me\\.grok";
    const commands = normalizeInspectSkills(
      {
        skills: [
          {
            name: "review-pr",
            userInvocable: true,
            description: "Review the current pull request carefully.",
            source: { type: "workspace", path: join(workspaceRoot, ".grok", "skills", "review-pr") },
          },
          {
            name: "remember-me",
            userInvocable: true,
            description: "Save a note.",
            source: { type: "user", path: join(grokHome, "skills", "remember-me") },
          },
          {
            name: "bundled",
            userInvocable: true,
            description: "Bundled skill from marketplace cache.",
            source: { type: "cache", path: join(grokHome, "marketplace-cache", "bundled") },
          },
          {
            name: "hidden",
            userInvocable: false,
            description: "Not invocable.",
            source: { type: "workspace", path: join(workspaceRoot, ".grok", "skills", "hidden") },
          },
        ],
      },
      { workspaceRoot, grokHome },
    );

    expect(commands.map((command) => command.id)).toEqual(["remember-me", "review-pr"]);
    expect(commands[1]?.label).toBe("/review-pr");
    expect(commands[1]?.hint).toBe("Review the current pull request carefully.");
  });

  it("fails closed when inspect payload is missing", () => {
    expect(normalizeInspectSkills(null, { workspaceRoot: "H:\\proj" })).toEqual([]);
    expect(normalizeInspectSkills({}, { workspaceRoot: "H:\\proj" })).toEqual([]);
  });
});
