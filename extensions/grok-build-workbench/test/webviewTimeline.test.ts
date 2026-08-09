/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

interface ConversationTimeline {
  shouldStartNewSegment(
    hasActiveSegment: boolean,
    activeMessageId: string | undefined,
    incomingMessageId: string | undefined,
    activeSegmentIsTail: boolean,
  ): boolean;
  shouldStickToBottom(scrollHeight: number, scrollTop: number, clientHeight: number): boolean;
}

function loadTimeline(): ConversationTimeline {
  const sandbox: Record<string, object> = {};
  const source = readFileSync(new URL("../media/timeline.js", import.meta.url), "utf8");
  runInNewContext(source, sandbox);
  return sandbox.GrokConversationTimeline as ConversationTimeline;
}

describe("webview conversation timeline", () => {
  const timeline = loadTimeline();

  test("continues consecutive deltas in the current tail segment", () => {
    expect(timeline.shouldStartNewSegment(true, "assistant-1", "assistant-1", true)).toBe(false);
  });

  test("starts a new assistant segment after tool or edit activity", () => {
    expect(timeline.shouldStartNewSegment(true, "assistant-1", "assistant-1", false)).toBe(true);
  });

  test("starts a new segment for a different message", () => {
    expect(timeline.shouldStartNewSegment(true, "assistant-1", "assistant-2", true)).toBe(true);
  });

  test("sticks only when the reader is near the conversation bottom", () => {
    expect(timeline.shouldStickToBottom(1000, 552, 400)).toBe(true);
    expect(timeline.shouldStickToBottom(1000, 500, 400)).toBe(false);
  });
});
