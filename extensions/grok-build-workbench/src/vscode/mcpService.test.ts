import { describe, expect, it } from "vitest";
import { parseMcpList } from "./mcpService.js";

describe("parseMcpList", () => {
  it("returns empty for the no-servers message", () => {
    expect(parseMcpList("No MCP servers configured. Run `grok mcp add --help` to get started.")).toEqual([]);
  });

  it("parses bullet and columnar layouts", () => {
    expect(
      parseMcpList(`MCP servers
• github (enabled) — npx server
sentry  disabled  https://example.com`),
    ).toEqual([
      { name: "github", enabled: true, detail: "npx server" },
      { name: "sentry", enabled: false, detail: "disabled · https://example.com" },
    ]);
  });
});
