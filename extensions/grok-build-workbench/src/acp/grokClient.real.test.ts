import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type * as acp from "@agentclientprotocol/sdk";
import { GrokClient } from "./grokClient.js";
import type { GrokEvent, GrokHost } from "./types.js";

class ReadOnlySmokeHost implements GrokHost {
  async requestPermission(
    request: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const reject = request.options.find((option) => /reject|deny/i.test(option.kind));
    return reject
      ? { outcome: { outcome: "selected", optionId: reject.optionId } }
      : { outcome: { outcome: "cancelled" } };
  }

  async readTextFile(request: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    return { content: await readFile(request.path, "utf8") };
  }

  async writeTextFile(): Promise<acp.WriteTextFileResponse> {
    throw new Error("Real Grok smoke test is read-only.");
  }

  async selectAuthMethod(methods: acp.AuthMethod[]): Promise<acp.AuthMethod | undefined> {
    return methods[0];
  }
}

const runRealSmoke = process.env.GROK_REAL_E2E === "1";

describe.skipIf(!runRealSmoke)("GrokClient real Grok Build smoke", () => {
  const clients: GrokClient[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.stop()));
  });

  it("completes an authenticated ACP turn with the required CLI version", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "grok-build-real-smoke-"));
    const events: GrokEvent[] = [];
    const client = new GrokClient(
      {
        executable: process.env.GROK_EXECUTABLE || "grok",
        arguments: [
          "--max-turns", "1",
          "--permission-mode", "plan",
          "--disable-web-search",
          "--no-memory",
        ],
        cwd,
        requestTimeoutMs: 90_000,
        enableTerminal: false,
        clientVersion: "1.0.8-real-smoke",
        ...(process.env.GROK_VERIFIED_CLI_VERSION
          ? { agentVersionHint: process.env.GROK_VERIFIED_CLI_VERSION }
          : {}),
      },
      new ReadOnlySmokeHost(),
    );
    client.onEvent((event) => events.push(event));
    clients.push(client);

    await client.start();
    await client.prompt(
      "Reply with exactly ACP_1_0_3_OK. Do not call tools and do not inspect files.",
    );

    const runtime = events.find(
      (event): event is Extract<GrokEvent, { type: "runtime" }> => event.type === "runtime",
    );
    const response = events
      .filter(
        (event): event is Extract<GrokEvent, { type: "assistant_delta" }> =>
          event.type === "assistant_delta",
      )
      .map((event) => event.text)
      .join("");
    expect(runtime?.protocolVersion).toBe(1);
    expect(runtime?.agentName).toMatch(/Grok Build/i);
    expect(process.env.GROK_VERIFIED_CLI_VERSION).toBe(
      process.env.GROK_EXPECTED_VERSION || "1.0.3",
    );
    expect(runtime?.agentVersion).toBe(process.env.GROK_EXPECTED_VERSION || "1.0.3");
    expect(response).toContain("ACP_1_0_3_OK");
    expect(events).toContainEqual({ type: "turn_complete", stopReason: "end_turn" });
  }, 100_000);
});
