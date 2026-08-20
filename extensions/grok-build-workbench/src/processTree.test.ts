import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { terminateProcessTree } from "./processTree.js";

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Condition was not reached before timeout.");
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

describe("terminateProcessTree", () => {
  it("is a no-op for a process that already exited", async () => {
    const child = spawn(process.execPath, ["-e", "process.exit(0)"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    await expect(terminateProcessTree(child, true)).resolves.toBeUndefined();
  });

  it("kills a spawned child and its grandchild", async () => {
    const child = spawn(
      process.execPath,
      [
        "-e",
        `
          const { spawn } = require("node:child_process");
          const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
            stdio: "ignore",
            windowsHide: true,
          });
          grandchild.unref();
          process.stdout.write(String(grandchild.pid));
          setInterval(() => {}, 1000);
        `,
      ],
      { stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
    );

    const grandchildPid = await new Promise<number>((resolve, reject) => {
      let stdout = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        const pid = Number(stdout.trim());
        if (Number.isInteger(pid) && pid > 0) {
          resolve(pid);
        }
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        reject(new Error(`tree parent exited before reporting grandchild (${code})`));
      });
    });

    expect(pidAlive(child.pid!)).toBe(true);
    expect(pidAlive(grandchildPid)).toBe(true);

    await terminateProcessTree(child, true);
    await waitUntil(() => !pidAlive(child.pid!) && !pidAlive(grandchildPid));

    expect(pidAlive(child.pid!)).toBe(false);
    expect(pidAlive(grandchildPid)).toBe(false);
  });
});
