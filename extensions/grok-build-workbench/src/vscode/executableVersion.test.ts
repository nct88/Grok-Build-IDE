import { describe, expect, it } from "vitest";
import { parseGrokVersion } from "./executableVersion.js";

describe("parseGrokVersion", () => {
  it("extracts the Grok CLI semantic version", () => {
    expect(parseGrokVersion("grok 1.0.3 (1a29d5bc12)\n")).toBe("1.0.3");
  });

  it("accepts prerelease versions", () => {
    expect(parseGrokVersion("Grok 1.1.0-rc.2 (abc)")).toBe("1.1.0-rc.2");
  });

  it("does not infer a version from unrelated output", () => {
    expect(parseGrokVersion("command not found")).toBeUndefined();
  });
});
