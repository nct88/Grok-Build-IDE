import { Readable, Writable } from "node:stream";
import path from "node:path";
import * as acp from "@agentclientprotocol/sdk";

const SESSION_ID = "mock-session";

class MockAgent {
  constructor(connection) {
    this.connection = connection;
    this.cancelTurn = undefined;
    this.cwd = process.cwd();
    this.model = "grok-test-fast";
  }

  async initialize(request) {
    return {
      protocolVersion: request.protocolVersion,
      agentCapabilities: {
        loadSession: false,
        promptCapabilities: { image: false, audio: false, embeddedContext: false },
      },
      authMethods: [],
      agentInfo: { name: "mock-grok-build", version: "0.0.0-test" },
    };
  }

  async authenticate() {
    return {};
  }

  async newSession(request) {
    this.cwd = request.cwd;
    return {
      sessionId: SESSION_ID,
      modes: {
        currentModeId: "code",
        availableModes: [
          { id: "code", name: "Code" },
          { id: "plan", name: "Plan" },
        ],
      },
      configOptions: this.configOptions(),
    };
  }

  async loadSession() {
    return {};
  }

  async setSessionMode() {
    return {};
  }

  async setSessionConfigOption(request) {
    if (request.configId === "model") this.model = request.value;
    return { configOptions: this.configOptions() };
  }

  async prompt(request) {
    const prompt = request.prompt
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("");
    const resources = request.prompt.filter((item) => item.type === "resource_link");

    if (prompt.includes("attachment-check")) {
      await this.connection.sessionUpdate({
        sessionId: SESSION_ID,
        update: {
          sessionUpdate: "agent_message_chunk",
          messageId: "attachment-response",
          content: {
            type: "text",
            text: resources.map((item) => `${item.name}:${item.uri}`).join("|"),
          },
        },
      });
      return { stopReason: "end_turn" };
    }

    if (prompt.includes("wait-for-cancel")) {
      await new Promise((resolve) => {
        this.cancelTurn = resolve;
      });
      this.cancelTurn = undefined;
      return { stopReason: "cancelled" };
    }

    await this.connection.sessionUpdate({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "agent_thought_chunk",
        messageId: "thought-1",
        content: { type: "text", text: "Checking workspace. " },
      },
    });
    await this.connection.sessionUpdate({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "plan",
        entries: [{ content: "Inspect files", priority: "high", status: "in_progress" }],
      },
    });
    await this.connection.sessionUpdate({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "tool-1",
        title: "Read workspace file",
        kind: "read",
        status: "pending",
        locations: [{ path: path.join(this.cwd, "sample.ts"), line: 2 }],
      },
    });

    await this.connection.requestPermission({
      sessionId: SESSION_ID,
      toolCall: {
        toolCallId: "tool-1",
        title: "Read workspace file",
        status: "pending",
        kind: "read",
        locations: [{ path: path.join(this.cwd, "sample.ts"), line: 2 }],
      },
      options: [
        { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
        { optionId: "reject-once", name: "Reject", kind: "reject_once" },
      ],
    });

    await this.connection.sessionUpdate({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "tool-1",
        status: "completed",
        kind: "edit",
        locations: [{ path: path.join(this.cwd, "sample.ts"), line: 2 }],
        content: [
          {
            type: "diff",
            path: path.join(this.cwd, "sample.ts"),
            oldText: "const answer = 1;\n",
            newText: "const answer = 42;\n",
          },
        ],
      },
    });
    await this.connection.sessionUpdate({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "usage_update",
        used: 1200,
        size: 12000,
      },
    });
    await this.connection.sessionUpdate({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "agent_message_chunk",
        messageId: "assistant-1",
        content: { type: "text", text: "Mock response from Grok Build." },
      },
    });
    return {
      stopReason: "end_turn",
      usage: { totalTokens: 1400, inputTokens: 900, outputTokens: 400, thoughtTokens: 100 },
    };
  }

  async cancel() {
    this.cancelTurn?.();
  }

  configOptions() {
    return [
      {
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: this.model,
        options: [
          { value: "grok-test-fast", name: "Grok Test Fast" },
          { value: "grok-test-deep", name: "Grok Test Deep" },
        ],
      },
      {
        id: "reasoning",
        name: "Reasoning effort",
        category: "thought_level",
        type: "select",
        currentValue: "high",
        options: [
          { value: "low", name: "Low" },
          { value: "high", name: "High" },
        ],
      },
    ];
  }
}

const output = Writable.toWeb(process.stdout);
const input = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(output, input);
const connection = new acp.AgentSideConnection(
  (agentConnection) => new MockAgent(agentConnection),
  stream,
);

await connection.closed;
