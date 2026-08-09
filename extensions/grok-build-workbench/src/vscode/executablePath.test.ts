import { describe, expect, it, vi } from "vitest";
import { resolveGrokExecutable } from "./executablePath.js";

describe("resolveGrokExecutable", () => {
  it("uses the standard per-user Grok install on Windows when available", () => {
    const exists = vi.fn(() => true);

    expect(resolveGrokExecutable("grok", "win32", "C:\\Users\\demo", exists)).toBe(
      "C:\\Users\\demo\\.grok\\bin\\grok.exe",
    );
    expect(exists).toHaveBeenCalledWith("C:\\Users\\demo\\.grok\\bin\\grok.exe");
  });

  it("preserves an explicitly configured executable", () => {
    const exists = vi.fn(() => true);

    expect(resolveGrokExecutable("D:\\tools\\grok.exe", "win32", "C:\\Users\\demo", exists)).toBe(
      "D:\\tools\\grok.exe",
    );
    expect(exists).not.toHaveBeenCalled();
  });

  it("falls back to PATH when the standard Windows install is absent", () => {
    expect(resolveGrokExecutable("", "win32", "C:\\Users\\demo", () => false)).toBe("grok");
  });

  it("uses PATH on non-Windows platforms", () => {
    expect(resolveGrokExecutable("grok", "linux", "/home/demo", () => true)).toBe("grok");
  });
});
