import { describe, expect, it } from "vitest";
import { parseExtensionReference } from "./extensionLink.js";

describe("parseExtensionReference", () => {
  it("accepts publisher.name, marketplace itemName, Open VSX, and product protocol", () => {
    expect(parseExtensionReference("ms-python.python")).toBe("ms-python.python");
    expect(
      parseExtensionReference("https://marketplace.visualstudio.com/items?itemName=ms-python.python"),
    ).toBe("ms-python.python");
    expect(parseExtensionReference("https://open-vsx.org/extension/ms-python/python")).toBe("ms-python.python");
    expect(parseExtensionReference("grok-build-ide:extension/ms-python.python")).toBe("ms-python.python");
  });

  it("rejects unrelated text", () => {
    expect(parseExtensionReference("not an extension")).toBeUndefined();
    expect(parseExtensionReference("")).toBeUndefined();
  });
});
