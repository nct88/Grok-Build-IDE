import { describe, expect, it } from "vitest";
import {
  assertTerminalEnabled,
  resolveRuntimeSecurityPolicy,
} from "./runtimeSecurityPolicy.js";

describe("runtime security policy", () => {
  it.each([
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ])(
    "resolves trusted=%s requested=%s to terminal=%s",
    (workspaceTrusted, terminalRequested, terminalEnabled) => {
      expect(resolveRuntimeSecurityPolicy({ workspaceTrusted, terminalRequested })).toEqual({
        workspaceTrusted,
        terminalRequested,
        terminalEnabled,
      });
    },
  );

  it("rejects terminal calls after trust or the opt-in is removed", () => {
    expect(() =>
      assertTerminalEnabled(
        resolveRuntimeSecurityPolicy({ workspaceTrusted: false, terminalRequested: true }),
      ),
    ).toThrow("trusted workspace");
    expect(() =>
      assertTerminalEnabled(
        resolveRuntimeSecurityPolicy({ workspaceTrusted: true, terminalRequested: false }),
      ),
    ).toThrow("disabled in Settings");
  });
});
