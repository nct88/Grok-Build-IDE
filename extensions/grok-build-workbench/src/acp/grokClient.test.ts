import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type * as acp from "@agentclientprotocol/sdk";
import { GrokClient } from "./grokClient.js";
import type { GrokEvent, GrokHost } from "./types.js";

class TestHost implements GrokHost {
  permissionRequests = 0;

  async requestPermission(
    request: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    this.permissionRequests += 1;
    return {
      outcome: {
        outcome: "selected",
        optionId: request.options[0]?.optionId ?? "allow-once",
      },
    };
  }

  async readTextFile(
    request: acp.ReadTextFileRequest,
  ): Promise<acp.ReadTextFileResponse> {
    return { content: await readFile(request.path, "utf8") };
  }

  async writeTextFile(
    request: acp.WriteTextFileRequest,
  ): Promise<acp.WriteTextFileResponse> {
    await writeFile(request.path, request.content, "utf8");
    return {};
  }

  async selectAuthMethod(
    methods: acp.AuthMethod[],
  ): Promise<acp.AuthMethod | undefined> {
    return methods[0];
  }
}

describe("GrokClient ACP integration", () => {
  const clients: GrokClient[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.stop()));
  });

  async function createClient(): Promise<{
    client: GrokClient;
    events: GrokEvent[];
    host: TestHost;
  }> {
    const cwd = await mkdtemp(path.join(tmpdir(), "grok-workbench-test-"));
    const fixture = path.resolve(process.cwd(), "test", "fixtures", "mock-agent.mjs");
    const host = new TestHost();
    const client = new GrokClient(
      {
        executable: process.execPath,
        arguments: [fixture],
        cwd,
        requestTimeoutMs: 5_000,
        reasoningEffort: "high",
      },
      host,
    );
    const events: GrokEvent[] = [];
    client.onEvent((event) => events.push(event));
    clients.push(client);
    return { client, events, host };
  }

  it("initializes, creates a session, streams a prompt, and handles permission", async () => {
    const { client, events, host } = await createClient();
    await client.start();
    await client.prompt("hello mock agent");

    expect(client.connectionState).toBe("connected");
    expect(client.sessionId).toBe("mock-session");
    expect(host.permissionRequests).toBe(1);
    expect(events).toContainEqual({
      type: "runtime",
      protocolVersion: 1,
      agentName: "mock-grok-build",
      agentVersion: "0.0.0-test",
    });
    expect(events).toContainEqual({ type: "session", sessionId: "mock-session" });
    // Mock agent stores `_meta`; Grok CLI 1.0.5 reads reasoning effort here.
    expect(events).toContainEqual({
      type: "usage",
      used: 1200,
      size: 12000,
    });
    expect(events).toContainEqual({
      type: "token_usage",
      totalTokens: 1400,
      inputTokens: 900,
      outputTokens: 400,
      thoughtTokens: 100,
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "session_config",
        options: expect.arrayContaining([
          expect.objectContaining({ id: "model", category: "model" }),
        ]),
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "tool_update",
        toolCallId: "tool-1",
        diffs: expect.arrayContaining([
          expect.objectContaining({ newText: "const answer = 42;\n" }),
        ]),
      }),
    );
    expect(events).toContainEqual({
      type: "assistant_delta",
      messageId: "assistant-1",
      text: "Mock response from Grok Build.",
    });
    expect(events).toContainEqual({ type: "turn_complete", stopReason: "end_turn" });
  });

  it("changes an ACP-advertised session model without restarting", async () => {
    const { client, events } = await createClient();
    await client.start();
    await client.setSessionConfigOption("model", "grok-test-deep");

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "session_config",
        options: expect.arrayContaining([
          expect.objectContaining({
            id: "model",
            currentValue: "grok-test-deep",
          }),
        ]),
      }),
    );
  });

  it("changes the ACP session mode and reports the active mode", async () => {
    const { client, events } = await createClient();
    await client.start();
    await client.setSessionMode("plan");

    expect(events).toContainEqual({ type: "current_mode", currentModeId: "plan" });
  });

  it("sends attached files as ACP resource links", async () => {
    const { client, events } = await createClient();
    await client.start();
    await client.prompt("attachment-check", [
      { uri: "file:///H:/projects/grok-code/README.md", name: "README.md" },
    ]);

    expect(events).toContainEqual({
      type: "assistant_delta",
      messageId: "attachment-response",
      text: "README.md:file:///H:/projects/grok-code/README.md",
    });
  });

  it("cancels an active prompt without killing the session", async () => {
    const { client, events } = await createClient();
    await client.start();
    const prompt = client.prompt("wait-for-cancel");
    await waitFor(() => client.connectionState === "running");
    await client.cancel();
    await prompt;

    expect(client.connectionState).toBe("connected");
    expect(events).toContainEqual({ type: "turn_complete", stopReason: "cancelled" });
  });

  it("reports an actionable error when the configured executable is missing", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "grok-workbench-missing-"));
    const client = new GrokClient(
      {
        executable: "definitely-missing-grok-build-executable",
        cwd,
        requestTimeoutMs: 1_000,
      },
      new TestHost(),
    );
    const events: GrokEvent[] = [];
    client.onEvent((event) => events.push(event));
    clients.push(client);

    await expect(client.start()).rejects.toThrow();

    expect(client.connectionState).toBe("error");
    expect(events).toContainEqual({
      type: "error",
      message:
        "Cannot start 'definitely-missing-grok-build-executable'. Install Grok Build (irm https://x.ai/cli/install.ps1 | iex) or set grokBuild.executablePath.",
    });
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("Condition was not reached before timeout.");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
