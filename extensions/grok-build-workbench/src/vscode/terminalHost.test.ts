import { describe, expect, it } from "vitest";
import { resolveTerminalSpawn } from "./terminalHost.js";

describe("resolveTerminalSpawn", () => {
  it("keeps explicit command and args unchanged", () => {
    expect(
      resolveTerminalSpawn("node", ["-e", "console.log(1)"], "win32", "C:\\Windows\\System32\\cmd.exe"),
    ).toEqual({
      command: "node",
      args: ["-e", "console.log(1)"],
    });
  });

  it("wraps a bare Windows command line through ComSpec", () => {
    expect(
      resolveTerminalSpawn("echo hello", undefined, "win32", "C:\\Windows\\System32\\cmd.exe"),
    ).toEqual({
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "echo hello"],
    });
  });

  it("wraps full PowerShell one-liners that arrive without args", () => {
    const line =
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -Command "Write-Output \'ok\'"';
    expect(resolveTerminalSpawn(line, [], "win32", "C:\\Windows\\System32\\cmd.exe")).toEqual({
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", line],
    });
  });

  it("falls back to cmd.exe when ComSpec is missing", () => {
    expect(resolveTerminalSpawn("dir", [], "win32", "   ")).toEqual({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "dir"],
    });
  });

  it("wraps bare Unix command lines through /bin/sh", () => {
    expect(resolveTerminalSpawn("pwd; ls", undefined, "linux")).toEqual({
      command: "/bin/sh",
      args: ["-c", "pwd; ls"],
    });
  });

  it("rejects empty commands", () => {
    expect(() => resolveTerminalSpawn("   ", [], "win32")).toThrow(/empty/i);
  });
});
