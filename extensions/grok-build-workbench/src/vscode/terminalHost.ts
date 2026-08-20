import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import type * as acp from "@agentclientprotocol/sdk";
import { terminateProcessTree } from "../processTree.js";

interface ManagedTerminal {
  id: string;
  process: ChildProcess;
  output: string;
  exitCode: number | null;
  signal: string | null;
  maxOutputBytes: number;
  exitWaiters: Array<(value: acp.WaitForTerminalExitResponse) => void>;
}

export interface ResolvedTerminalSpawn {
  command: string;
  args: string[];
}

/**
 * ACP agents often put the full shell line in `command` with empty `args`.
 * Node's spawn with shell:false treats that whole string as an executable path,
 * which yields ENOENT for `echo hello`, PowerShell one-liners, etc.
 */
export function resolveTerminalSpawn(
  command: string,
  args: readonly string[] | undefined,
  platform = process.platform,
  comspec = process.env.ComSpec,
): ResolvedTerminalSpawn {
  const providedArgs = args ?? [];
  if (providedArgs.length > 0) {
    return { command, args: [...providedArgs] };
  }

  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error("Terminal command must not be empty.");
  }

  if (platform === "win32") {
    return {
      command: comspec && comspec.trim() ? comspec : "cmd.exe",
      args: ["/d", "/s", "/c", trimmed],
    };
  }

  return {
    command: "/bin/sh",
    args: ["-c", trimmed],
  };
}

function exitStatus(
  exitCode: number | null,
  signal: string | null,
): acp.TerminalExitStatus {
  return {
    exitCode,
    signal,
  };
}

/**
 * Minimal ACP reverse-terminal host using Node child processes.
 * Output is truncated from the front when maxOutputBytes is exceeded.
 */
export class TerminalHost {
  private readonly terminals = new Map<string, ManagedTerminal>();

  async createTerminal(
    request: acp.CreateTerminalRequest,
  ): Promise<acp.CreateTerminalResponse> {
    const id = randomUUID();
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const item of request.env ?? []) {
      env[item.name] = item.value;
    }

    const resolved = resolveTerminalSpawn(request.command, request.args);
    const child = spawn(resolved.command, resolved.args, {
      cwd: request.cwd ?? undefined,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });

    const managed: ManagedTerminal = {
      id,
      process: child,
      output: "",
      exitCode: null,
      signal: null,
      maxOutputBytes: request.outputByteLimit ?? 64_000,
      exitWaiters: [],
    };

    const append = (chunk: string) => {
      managed.output = `${managed.output}${chunk}`;
      if (managed.output.length > managed.maxOutputBytes) {
        managed.output = managed.output.slice(-managed.maxOutputBytes);
      }
    };

    const finish = (exitCode: number | null, signal: string | null) => {
      if (managed.exitCode !== null || managed.signal) {
        return;
      }
      managed.exitCode = exitCode;
      managed.signal = signal;
      const status = exitStatus(exitCode, signal);
      for (const waiter of managed.exitWaiters) {
        waiter(status);
      }
      managed.exitWaiters = [];
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.once("error", (error) => {
      append(`\n${error.message}`);
      finish(1, null);
    });
    child.once("exit", (code, signal) => {
      finish(code, signal);
    });

    this.terminals.set(id, managed);
    return { terminalId: id };
  }

  async terminalOutput(
    request: acp.TerminalOutputRequest,
  ): Promise<acp.TerminalOutputResponse> {
    const terminal = this.require(request.terminalId);
    return {
      output: terminal.output,
      truncated: terminal.output.length >= terminal.maxOutputBytes,
      exitStatus:
        terminal.exitCode !== null || terminal.signal
          ? exitStatus(terminal.exitCode, terminal.signal)
          : null,
    };
  }

  async releaseTerminal(request: acp.ReleaseTerminalRequest): Promise<void> {
    const terminal = this.terminals.get(request.terminalId);
    if (!terminal) {
      return;
    }
    if (terminal.exitCode === null && terminal.signal === null) {
      void terminateProcessTree(terminal.process, true);
    }
    this.terminals.delete(request.terminalId);
  }

  async waitForExit(
    request: acp.WaitForTerminalExitRequest,
  ): Promise<acp.WaitForTerminalExitResponse> {
    const terminal = this.require(request.terminalId);
    if (terminal.exitCode !== null || terminal.signal) {
      return exitStatus(terminal.exitCode, terminal.signal);
    }
    return new Promise((resolve) => {
      terminal.exitWaiters.push(resolve);
    });
  }

  async killTerminal(request: acp.KillTerminalRequest): Promise<void> {
    const terminal = this.terminals.get(request.terminalId);
    if (!terminal) {
      return;
    }
    if (terminal.exitCode === null && terminal.signal === null) {
      void terminateProcessTree(terminal.process, true);
    }
  }

  dispose(): void {
    for (const terminal of this.terminals.values()) {
      if (terminal.exitCode === null && terminal.signal === null) {
        void terminateProcessTree(terminal.process, true);
      }
    }
    this.terminals.clear();
  }

  private require(terminalId: string): ManagedTerminal {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Unknown terminal: ${terminalId}`);
    }
    return terminal;
  }
}
