import { spawnSync } from "node:child_process";

const executable = process.env.GROK_EXECUTABLE || "grok";
const expectedVersion = process.env.GROK_EXPECTED_VERSION || "1.0.3";
const versionResult = spawnSync(executable, ["--version"], {
  encoding: "utf8",
  windowsHide: true,
});
const versionOutput = `${versionResult.stdout || ""}${versionResult.stderr || ""}`;
const versionMatch = versionOutput.match(/\bgrok\s+([0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?)/i);
if (versionResult.status !== 0 || versionMatch?.[1] !== expectedVersion) {
  console.error(`Expected Grok CLI ${expectedVersion}; received: ${versionOutput.trim() || "unavailable"}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", "run", "src/acp/grokClient.real.test.ts"],
  {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      GROK_REAL_E2E: "1",
      GROK_EXECUTABLE: executable,
      GROK_VERIFIED_CLI_VERSION: versionMatch[1],
    },
    stdio: "inherit",
    windowsHide: true,
  },
);

process.exit(result.status ?? 1);
