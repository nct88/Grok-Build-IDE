import { execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function isAlive(child: ChildProcess): child is ChildProcess & { pid: number } {
  return child.pid !== undefined && child.exitCode === null && child.signalCode === null;
}

/**
 * Kill a spawned process and its descendants.
 * Windows `ChildProcess.kill()` only terminates the direct child, so leaked
 * `grok.exe` / tool grandchildren survive reconnects and freeze the IDE.
 */
export async function terminateProcessTree(
  child: ChildProcess,
  force = false,
): Promise<void> {
  if (!isAlive(child)) {
    return;
  }

  if (process.platform === "win32") {
    const args = force ? ["/T", "/F", "/PID", String(child.pid)] : ["/T", "/PID", String(child.pid)];
    try {
      await execFileAsync("taskkill", args, {
        windowsHide: true,
        timeout: 8_000,
      });
    } catch {
      try {
        child.kill();
      } catch {
        // already gone
      }
    }
    return;
  }

  try {
    child.kill(force ? "SIGKILL" : "SIGTERM");
  } catch {
    // already gone
  }
}
