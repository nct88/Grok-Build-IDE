import { describe, expect, it } from "vitest";
import { parseGrokModels } from "./grokModels.js";

describe("parseGrokModels", () => {
  it("parses the official Grok models output and strips ANSI styling", () => {
    expect(
      parseGrokModels(
        "\u001b[2mstatus\u001b[0m\nDefault model: grok-4.5\n\nAvailable models:\n  * grok-4.5 (default)\n    grok-code-fast\n",
      ),
    ).toEqual({
      defaultModel: "grok-4.5",
      models: ["grok-4.5", "grok-code-fast"],
    });
  });
});
