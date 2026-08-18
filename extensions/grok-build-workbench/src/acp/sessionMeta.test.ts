import { describe, expect, it } from "vitest";
import { normalizeReasoningEffort, sessionRequestMeta } from "./sessionMeta.js";

describe("normalizeReasoningEffort", () => {
  it("accepts CLI 1.0.5 effort values", () => {
    expect(normalizeReasoningEffort("low")).toBe("low");
    expect(normalizeReasoningEffort("MEDIUM")).toBe("medium");
    expect(normalizeReasoningEffort(" extra-high ")).toBe("xhigh");
    expect(normalizeReasoningEffort("xhigh")).toBe("xhigh");
  });

  it("rejects unknown or empty values", () => {
    expect(normalizeReasoningEffort("")).toBe("");
    expect(normalizeReasoningEffort("Default effort")).toBe("");
    expect(normalizeReasoningEffort("turbo")).toBe("");
  });
});

describe("sessionRequestMeta", () => {
  it("sends both camelCase and snake_case keys for Grok CLI 1.0.5", () => {
    expect(sessionRequestMeta({ reasoningEffort: "high" })).toEqual({
      reasoningEffort: "high",
      reasoning_effort: "high",
    });
  });

  it("omits _meta when effort is unset", () => {
    expect(sessionRequestMeta({ reasoningEffort: "" })).toBeUndefined();
    expect(sessionRequestMeta({})).toBeUndefined();
  });
});
