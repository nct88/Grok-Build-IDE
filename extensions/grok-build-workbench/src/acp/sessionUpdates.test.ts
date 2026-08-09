import { describe, expect, it } from "vitest";
import { normalizeSessionUpdate } from "./sessionUpdates.js";

describe("normalizeSessionUpdate", () => {
  it("normalizes streamed assistant text", () => {
    expect(
      normalizeSessionUpdate({
        sessionId: "s1",
        update: {
          sessionUpdate: "agent_message_chunk",
          messageId: "m1",
          content: { type: "text", text: "hello" },
        },
      }),
    ).toEqual({ type: "assistant_delta", messageId: "m1", text: "hello" });
  });

  it("ignores non-text message chunks", () => {
    expect(
      normalizeSessionUpdate({
        sessionId: "s1",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "resource_link", uri: "file:///tmp/a", name: "a" },
        },
      }),
    ).toBeUndefined();
  });

  it("normalizes tool progress", () => {
    expect(
      normalizeSessionUpdate({
        sessionId: "s1",
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: "tool-1",
          status: "completed",
        },
      }),
    ).toEqual({ type: "tool_update", toolCallId: "tool-1", status: "completed" });
  });

  it("preserves ACP file locations and diff content for editor follow mode", () => {
    expect(
      normalizeSessionUpdate({
        sessionId: "s1",
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: "tool-edit",
          kind: "edit",
          status: "completed",
          locations: [{ path: "C:\\work\\app.ts", line: 7 }],
          content: [
            {
              type: "diff",
              path: "C:\\work\\app.ts",
              oldText: "old",
              newText: "new",
            },
          ],
        },
      }),
    ).toEqual({
      type: "tool_update",
      toolCallId: "tool-edit",
      kind: "edit",
      status: "completed",
      locations: [{ path: "C:\\work\\app.ts", line: 7 }],
      diffs: [{ path: "C:\\work\\app.ts", oldText: "old", newText: "new" }],
    });
  });

  it("normalizes context-window usage without calling it account quota", () => {
    expect(
      normalizeSessionUpdate({
        sessionId: "s1",
        update: { sessionUpdate: "usage_update", used: 1250, size: 10000 },
      }),
    ).toEqual({ type: "usage", used: 1250, size: 10000 });
  });
});
