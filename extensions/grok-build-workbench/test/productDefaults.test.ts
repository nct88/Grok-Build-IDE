import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readJson(relativeUrl: string): Record<string, any> {
  return JSON.parse(readFileSync(new URL(relativeUrl, import.meta.url), "utf8"));
}

describe("Grok Build IDE fresh-install defaults", () => {
  it("starts in the IDE surface and keeps agent-first mode opt-in", () => {
    const manifest = readJson("../package.json");
    const properties = manifest.contributes.configuration.properties;

    expect(properties["grokBuild.defaultProduct"].default).toBe("grok-build-ide");
    expect(properties["grokBuild.agentFirstLayout"].default).toBe(false);
  });

  it("keeps files.hotExit in the portable profile, not extension defaults", () => {
    const manifest = readJson("../package.json");
    const profile = readJson("../../../build/grok/portable-profile/settings.json");

    expect(manifest.contributes.configurationDefaults["files.hotExit"]).toBeUndefined();
    expect(profile["files.hotExit"]).toBe("onExitAndWindowClose");
  });

  it("uses IDE defaults before persisted product state is available", () => {
    const layoutSource = readFileSync(
      new URL("../src/vscode/layoutModeService.ts", import.meta.url),
      "utf8",
    );
    const chatSource = readFileSync(
      new URL("../src/vscode/chatViewProvider.ts", import.meta.url),
      "utf8",
    );

    expect(layoutSource).toContain('private product: GrokProductId = "grok-build-ide"');
    expect(layoutSource).toContain('.get<string>("defaultProduct", "grok-build-ide")');
    expect(layoutSource).toContain('.get<boolean>("agentFirstLayout", false)');
    expect(chatSource).not.toContain('currentProduct ?? "grok-build"');
    expect(chatSource).toContain('currentProduct ?? "grok-build-ide"');
    expect(chatSource).toContain('class="product-${initialProduct}"');
  });
});
