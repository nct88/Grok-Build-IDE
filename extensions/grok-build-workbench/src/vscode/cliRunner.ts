import { spawn } from "node:child_process";
import { terminateProcessTree } from "../processTree.js";

export interface CliRunOptions {
  executable: string;
  args: string[];
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  input?: string;
}

export interface CliRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

const ANSI_ESCAPE = /\x1B\[[0-?]*[ -/]*[@-~]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, "");
}

/** Drop undefined optional fields for exactOptionalPropertyTypes. */
export function cliOptions(options: {
  executable: string;
  args: string[];
  cwd?: string | undefined;
  environment?: NodeJS.ProcessEnv | undefined;
  timeoutMs?: number | undefined;
  input?: string | undefined;
}): CliRunOptions {
  return {
    executable: options.executable,
    args: options.args,
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.environment ? { environment: options.environment } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.input !== undefined ? { input: options.input } : {}),
  };
}

export async function runGrokCli(options: CliRunOptions): Promise<CliRunResult> {
  return new Promise((resolve) => {
    const child = spawn(options.executable, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.environment },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      void terminateProcessTree(child, true);
    }, options.timeoutMs ?? 20_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-500_000);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-100_000);
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({
        code: 1,
        stdout: "",
        stderr: error.message,
      });
    });

    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr),
      });
    });

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}
