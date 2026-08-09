import { describe, expect, it } from "vitest";
import { normalizeSafeExternalUrl } from "./externalUrlPolicy.js";

describe("normalizeSafeExternalUrl", () => {
  it("accepts HTTPS and optionally plain HTTP", () => {
    expect(normalizeSafeExternalUrl("https://grok.com/account/usage")).toBe("https://grok.com/account/usage");
    expect(normalizeSafeExternalUrl("http://localhost:3000", { allowHttp: true })).toBe("http://localhost:3000/");
  });

  it("rejects non-web schemes and embedded credentials", () => {
    expect(normalizeSafeExternalUrl("file:///C:/Windows/System32", { allowHttp: true })).toBeNull();
    expect(normalizeSafeExternalUrl("https://user:password@example.com/private")).toBeNull();
    expect(normalizeSafeExternalUrl("http://user@example.com", { allowHttp: true })).toBeNull();
  });
});
