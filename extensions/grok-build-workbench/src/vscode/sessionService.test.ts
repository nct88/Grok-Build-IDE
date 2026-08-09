import { describe, expect, it } from "vitest";
import {
  listLocalSessions,
  setSessionGeneratedTitle,
  titleFromUserMessageText,
} from "./sessionService.js";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("titleFromUserMessageText", () => {
  it("extracts <user_query> content", () => {
    expect(
      titleFromUserMessageText(
        "<user_info>meta</user_info>\n<user_query>\nPaste clipboard image fix\n</user_query>",
      ),
    ).toBe("Paste clipboard image fix");
  });

  it("skips synthetic scaffolding without user_query", () => {
    expect(titleFromUserMessageText("<system-reminder>\nskills...\n</system-reminder>")).toBeUndefined();
  });
});

describe("listLocalSessions", () => {
  it("reads summary.json folders under ~/.grok/sessions", async () => {
    const home = await mkdtemp(join(tmpdir(), "grok-sessions-"));
    const sessionDir = join(
      home,
      "sessions",
      encodeURIComponent("H:\\proj"),
      "abc-session-id",
    );
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "summary.json"),
      JSON.stringify({
        info: { id: "abc-session-id", cwd: "H:\\proj" },
        generated_title: "Fix login",
        updated_at: "2026-08-02T00:00:00Z",
        num_chat_messages: 4,
        current_model_id: "grok-4.5",
      }),
    );

    const sessions = await listLocalSessions({ grokHome: home, cwd: "H:\\proj" });
    expect(sessions).toEqual([
      {
        id: "abc-session-id",
        cwd: "H:\\proj",
        title: "Fix login",
        model: "grok-4.5",
        updatedAt: "2026-08-02T00:00:00Z",
        messageCount: 4,
      },
    ]);
  });

  it("falls back to first user_query in chat_history when no generated_title", async () => {
    const home = await mkdtemp(join(tmpdir(), "grok-sessions-"));
    const sessionDir = join(
      home,
      "sessions",
      encodeURIComponent("H:\\proj"),
      "def-session-id",
    );
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "summary.json"),
      JSON.stringify({
        info: { id: "def-session-id", cwd: "H:\\proj" },
        updated_at: "2026-08-04T00:00:00Z",
        num_chat_messages: 2,
      }),
    );
    await writeFile(
      join(sessionDir, "chat_history.jsonl"),
      [
        JSON.stringify({ type: "system", content: "You are Grok." }),
        JSON.stringify({
          type: "user",
          synthetic_reason: "system_reminder",
          content: [{ type: "text", text: "<system-reminder>skills</system-reminder>" }],
        }),
        JSON.stringify({
          type: "user",
          content: [
            {
              type: "text",
              text: "<user_query>\nĐổi tiêu đề sessions thành câu hỏi đầu tiên\n</user_query>",
            },
          ],
        }),
      ].join("\n"),
    );

    const sessions = await listLocalSessions({ grokHome: home, cwd: "H:\\proj" });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.title).toBe("Đổi tiêu đề sessions thành câu hỏi đầu tiên");
  });
});

describe("setSessionGeneratedTitle", () => {
  it("writes generated_title and listLocalSessions shows the new name", async () => {
    const home = await mkdtemp(join(tmpdir(), "grok-sessions-"));
    const sessionDir = join(
      home,
      "sessions",
      encodeURIComponent("H:\\proj"),
      "rename-session-id",
    );
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "summary.json"),
      JSON.stringify({
        info: { id: "rename-session-id", cwd: "H:\\proj" },
        session_summary: "old auto title",
        updated_at: "2026-08-04T12:00:00Z",
        num_chat_messages: 1,
      }),
    );

    const saved = await setSessionGeneratedTitle({
      sessionId: "rename-session-id",
      title: "  My custom name  ",
      grokHome: home,
    });
    expect(saved).toBe("My custom name");

    const raw = JSON.parse(await readFile(join(sessionDir, "summary.json"), "utf8")) as {
      generated_title?: string;
      session_summary?: string;
    };
    expect(raw.generated_title).toBe("My custom name");
    // session_summary was already set — leave it alone
    expect(raw.session_summary).toBe("old auto title");

    const sessions = await listLocalSessions({ grokHome: home, cwd: "H:\\proj" });
    expect(sessions[0]?.title).toBe("My custom name");
  });

  it("fills empty session_summary when renaming", async () => {
    const home = await mkdtemp(join(tmpdir(), "grok-sessions-"));
    const sessionDir = join(
      home,
      "sessions",
      encodeURIComponent("H:\\proj"),
      "empty-summary-id",
    );
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "summary.json"),
      JSON.stringify({
        info: { id: "empty-summary-id", cwd: "H:\\proj" },
        updated_at: "2026-08-04T12:00:00Z",
      }),
    );

    await setSessionGeneratedTitle({
      sessionId: "empty-summary-id",
      title: "Filled title",
      grokHome: home,
    });
    const raw = JSON.parse(await readFile(join(sessionDir, "summary.json"), "utf8")) as {
      generated_title?: string;
      session_summary?: string;
    };
    expect(raw.generated_title).toBe("Filled title");
    expect(raw.session_summary).toBe("Filled title");
  });

  it("rejects empty title and missing session", async () => {
    const home = await mkdtemp(join(tmpdir(), "grok-sessions-"));
    await expect(
      setSessionGeneratedTitle({ sessionId: "nope", title: "   ", grokHome: home }),
    ).rejects.toThrow(/empty/i);
    await expect(
      setSessionGeneratedTitle({ sessionId: "missing-id", title: "Ok", grokHome: home }),
    ).rejects.toThrow(/not found/i);
  });
});
