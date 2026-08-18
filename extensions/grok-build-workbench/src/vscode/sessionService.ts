import { createReadStream } from "node:fs";
import { open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { cliOptions, runGrokCli } from "./cliRunner.js";

export interface GrokSessionSummary {
  id: string;
  cwd: string;
  title: string;
  model?: string;
  updatedAt: string;
  messageCount: number;
  reasoningEffort?: string;
  lastTurnSummary?: string;
  lastRecap?: string;
  titleIsManual?: boolean;
}

export interface TranscriptMessage {
  role: "user" | "assistant" | "thought" | "system" | "other";
  text: string;
  messageId?: string;
  status?: string;
}

export interface GrokSessionInfoSnapshot {
  ok: boolean;
  title: string | null;
  authMethod: string;
  sessionId: string | null;
  workingDirectory: string | null;
  model: string | null;
  modelHash: string | null;
  apiBackend: string | null;
  sandbox: string | null;
  turns: number | null;
  reasoningEffort: string | null;
  lastTurnSummary: string | null;
  lastRecap: string | null;
  agentName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  context: {
    used: number | null;
    size: number | null;
    percent: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    cachedReadTokens: number | null;
    cacheCreationTokens: number | null;
    reasoningTokens: number | null;
    modelCalls: number | null;
    apiDurationMs: number | null;
    costUsd: number | null;
  };
}

interface SummaryJson {
  info?: { id?: string; cwd?: string };
  session_summary?: string;
  generated_title?: string;
  created_at?: string;
  updated_at?: string;
  last_active_at?: string;
  num_chat_messages?: number;
  num_messages?: number;
  current_model_id?: string;
  reasoning_effort?: string;
  last_turn_summary?: string;
  last_recap?: string;
  title_is_manual?: boolean;
  session_title?: string;
  sandbox_profile?: string;
  agent_name?: string;
}

interface SessionUsageJson {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedReadTokens?: number;
  cacheCreationTokens?: number;
  reasoningTokens?: number;
  modelCalls?: number;
  apiDurationMs?: number;
  costUsdTicks?: number;
  numTurns?: number;
}

interface ReasoningSummaryPart {
  type?: string;
  text?: string;
}

interface ChatHistoryLine {
  type?: string;
  role?: string;
  synthetic_reason?: string;
  id?: string;
  status?: string;
  content?: string | Array<{ type?: string; text?: string }>;
  summary?: ReasoningSummaryPart[] | null;
}

const TITLE_MAX_LEN = 72;
const USD_TICKS = 10_000_000_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const number = Number(value);
  return value !== null && value !== undefined && Number.isFinite(number) ? number : null;
}

function normalizePath(value: string): string {
  return value.replaceAll("/", "\\").toLowerCase();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateTitle(value: string, max = TITLE_MAX_LEN): string {
  const text = collapseWhitespace(value);
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function extractTextFromContent(content: ChatHistoryLine["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

/**
 * Grok CLI persists display-safe reasoning summaries separately from the
 * encrypted internal payload. Only summary_text is allowed into the webview.
 */
export function extractReasoningSummary(
  summary: ReasoningSummaryPart[] | null | undefined,
): string {
  if (!Array.isArray(summary)) {
    return "";
  }
  return summary
    .filter((part) => part?.type === "summary_text" && typeof part.text === "string")
    .map((part) => part.text!.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Prefer the first real user prompt (user_query or plain text), skip system scaffolding. */
export function titleFromUserMessageText(raw: string): string | undefined {
  const text = raw.trim();
  if (!text) {
    return undefined;
  }
  const queryMatch = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i);
  if (queryMatch?.[1]) {
    const title = truncateTitle(queryMatch[1]);
    return title || undefined;
  }
  // Skip synthetic context bags injected as "user" rows.
  if (
    text.includes("<system-reminder>") ||
    text.includes("<user_info>") ||
    text.includes("<git_status>") ||
    text.includes("<agent_skills>")
  ) {
    return undefined;
  }
  const title = truncateTitle(text);
  return title || undefined;
}

export async function readFirstUserPromptTitle(sessionDir: string): Promise<string | undefined> {
  const historyPath = join(sessionDir, "chat_history.jsonl");
  try {
    const stream = createReadStream(historyPath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        let row: ChatHistoryLine;
        try {
          row = JSON.parse(trimmed) as ChatHistoryLine;
        } catch {
          continue;
        }
        const isUser = row.type === "user" || row.role === "user";
        if (!isUser) {
          continue;
        }
        // Skip known synthetic user rows when marked.
        if (row.synthetic_reason && row.synthetic_reason !== "user") {
          // still allow rows that embed <user_query>
          const text = extractTextFromContent(row.content);
          const fromQuery = titleFromUserMessageText(text);
          if (fromQuery && text.includes("<user_query>")) {
            return fromQuery;
          }
          continue;
        }
        const title = titleFromUserMessageText(extractTextFromContent(row.content));
        if (title) {
          return title;
        }
      }
    } finally {
      rl.close();
      stream.destroy();
    }
  } catch {
    // Missing or unreadable history is fine; fall back to summary/id.
  }
  return undefined;
}

export async function resolveSessionTitle(options: {
  sessionDir: string;
  sessionId: string;
  generatedTitle?: string;
  sessionSummary?: string;
}): Promise<{ title: string; hasUserContent: boolean }> {
  const generated = options.generatedTitle?.trim();
  if (generated) {
    return { title: truncateTitle(generated), hasUserContent: true };
  }
  const summary = options.sessionSummary?.trim();
  if (summary) {
    return { title: truncateTitle(summary), hasUserContent: true };
  }
  const fromHistory = await readFirstUserPromptTitle(options.sessionDir);
  if (fromHistory) {
    return { title: fromHistory, hasUserContent: true };
  }
  return { title: "Untitled chat", hasUserContent: false };
}

export async function listLocalSessions(options: {
  cwd?: string;
  limit?: number;
  grokHome?: string;
}): Promise<GrokSessionSummary[]> {
  const root = join(options.grokHome ?? join(homedir(), ".grok"), "sessions");
  let cwdRoots: string[] = [];
  try {
    cwdRoots = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const sessions: GrokSessionSummary[] = [];
  for (const cwdRoot of cwdRoots) {
    const cwdPath = join(root, cwdRoot);
    let sessionDirs: string[] = [];
    try {
      sessionDirs = (await readdir(cwdPath, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      continue;
    }

    for (const sessionId of sessionDirs) {
      const sessionDir = join(cwdPath, sessionId);
      const summaryPath = join(sessionDir, "summary.json");
      try {
        const raw = await readFile(summaryPath, "utf8");
        const summary = JSON.parse(raw) as SummaryJson;
        const cwd = summary.info?.cwd ?? decodeURIComponent(cwdRoot);
        if (options.cwd && normalizePath(cwd) !== normalizePath(options.cwd)) {
          continue;
        }
        const id = summary.info?.id ?? sessionId;
        const { title, hasUserContent } = await resolveSessionTitle({
          sessionDir,
          sessionId: id,
          ...(summary.generated_title ? { generatedTitle: summary.generated_title } : {}),
          ...(summary.session_summary ? { sessionSummary: summary.session_summary } : {}),
        });
        const rawCount = summary.num_chat_messages ?? summary.num_messages ?? 0;
        sessions.push({
          id,
          cwd,
          title,
          ...(summary.current_model_id ? { model: summary.current_model_id } : {}),
          updatedAt:
            summary.last_active_at ??
            summary.updated_at ??
            summary.created_at ??
            new Date(0).toISOString(),
          messageCount: hasUserContent ? rawCount : 0,
          ...(summary.reasoning_effort ? { reasoningEffort: summary.reasoning_effort } : {}),
          ...(summary.last_turn_summary
            ? { lastTurnSummary: truncateTitle(summary.last_turn_summary, 140) }
            : {}),
          ...(summary.last_recap ? { lastRecap: truncateTitle(summary.last_recap, 400) } : {}),
          ...(summary.title_is_manual ? { titleIsManual: true } : {}),
        });
      } catch {
        // Ignore unreadable session folders.
      }
    }
  }

  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sessions.slice(0, options.limit ?? 40);
}

/**
 * Load user/assistant/thought turns from chat_history.jsonl for UI replay.
 * Matches Grok Build Desktop: reasoning uses display-safe summary_text only.
 */
export async function readSessionTranscript(options: {
  sessionId: string;
  grokHome?: string;
  limit?: number;
}): Promise<TranscriptMessage[]> {
  const sessionDir = await findSessionDirectory({
    sessionId: options.sessionId,
    ...(options.grokHome ? { grokHome: options.grokHome } : {}),
  });
  if (!sessionDir) {
    return [];
  }

  const historyPath = join(sessionDir, "chat_history.jsonl");
  const out: TranscriptMessage[] = [];
  const limit = Math.max(1, options.limit ?? 200);
  try {
    const stream = createReadStream(historyPath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        let row: ChatHistoryLine;
        try {
          row = JSON.parse(trimmed) as ChatHistoryLine;
        } catch {
          continue;
        }
        const type = (row.type || row.role || "").toLowerCase();
        if (type === "system") {
          continue;
        }
        if (type === "reasoning") {
          let text = extractReasoningSummary(row.summary).trim();
          if (!text) {
            continue;
          }
          if (text.length > 50_000) {
            text = `${text.slice(0, 50_000)}\n…`;
          }
          out.push({
            role: "thought",
            text,
            ...(row.id ? { messageId: row.id } : {}),
            ...(row.status ? { status: row.status } : {}),
          });
          continue;
        }
        if (row.synthetic_reason && row.synthetic_reason !== "user") {
          const syntheticText = extractTextFromContent(row.content);
          if (!syntheticText.includes("<user_query>")) {
            continue;
          }
        }

        let role: TranscriptMessage["role"];
        if (type === "user") {
          role = "user";
        } else if (type === "assistant" || type === "agent") {
          role = "assistant";
        } else {
          continue;
        }

        let text = extractTextFromContent(row.content).trim();
        if (!text) {
          continue;
        }
        const query = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i);
        if (query?.[1]) {
          text = query[1].trim();
        }
        if (text.includes("<system-reminder>") && text.length > 2_000) {
          continue;
        }
        if (text.length > 50_000) {
          text = `${text.slice(0, 50_000)}\n…`;
        }
        out.push({ role, text });
      }
    } finally {
      rl.close();
      stream.destroy();
    }
  } catch {
    return [];
  }
  if (out.length <= limit) {
    return out;
  }
  let start = out.length - limit;
  while (start > 0 && out[start]?.role !== "user") {
    start -= 1;
  }
  return out.slice(start);
}

export async function readSessionFlowMeta(options: {
  sessionId: string;
  grokHome?: string;
}): Promise<{ lastTurnSummary?: string; lastRecap?: string }> {
  const sessionDir = await findSessionDirectory({
    sessionId: options.sessionId,
    ...(options.grokHome ? { grokHome: options.grokHome } : {}),
  });
  if (!sessionDir) {
    return {};
  }
  try {
    const summary = JSON.parse(await readFile(join(sessionDir, "summary.json"), "utf8")) as SummaryJson;
    return {
      ...(summary.last_turn_summary
        ? { lastTurnSummary: truncateTitle(summary.last_turn_summary, 140) }
        : {}),
      ...(summary.last_recap ? { lastRecap: truncateTitle(summary.last_recap, 400) } : {}),
    };
  } catch {
    return {};
  }
}

async function readLatestSessionUsage(sessionDir: string): Promise<SessionUsageJson | null> {
  const updatesPath = join(sessionDir, "updates.jsonl");
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const fileStat = await stat(updatesPath);
    const maxTail = 2 * 1024 * 1024;
    const length = Math.min(fileStat.size, maxTail);
    const start = Math.max(0, fileStat.size - length);
    handle = await open(updatesPath, "r");
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    let raw = buffer.toString("utf8");
    if (start > 0) {
      const newline = raw.indexOf("\n");
      raw = newline >= 0 ? raw.slice(newline + 1) : "";
    }
    let latest: SessionUsageJson | null = null;
    for (const line of raw.split("\n")) {
      if (!line.includes("inputTokens") && !line.includes("totalTokens")) continue;
      try {
        const row = asRecord(JSON.parse(line));
        const params = asRecord(row?.params);
        const update = asRecord(params?.update);
        const usage = asRecord(update?.usage);
        if (usage && (usage.totalTokens !== undefined || usage.inputTokens !== undefined)) {
          latest = usage as SessionUsageJson;
        }
      } catch {
        // Ignore incomplete JSONL rows while the active session is writing.
      }
    }
    return latest;
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

async function readAuthMethod(grokHome: string): Promise<string> {
  if (process.env.XAI_API_KEY) return "API key (XAI_API_KEY)";
  try {
    const parsed = asRecord(JSON.parse(await readFile(join(grokHome, "auth.json"), "utf8")));
    const entries = Object.values(parsed ?? {}).map(asRecord).filter(Boolean) as Array<Record<string, unknown>>;
    entries.sort((left, right) => {
      const a = Date.parse(asString(left.create_time) ?? "") || 0;
      const b = Date.parse(asString(right.create_time) ?? "") || 0;
      return b - a;
    });
    const entry = entries[0];
    if (!entry) return "Not signed in";
    const mode = asString(entry.auth_mode);
    if (mode?.toLowerCase().includes("oauth")) return "OAuth";
    return mode ?? (entry.key || entry.access_token ? "OAuth" : "Not signed in");
  } catch {
    return "Not signed in";
  }
}

async function readModelInfo(grokHome: string, model: string | null): Promise<Record<string, unknown> | null> {
  if (!model) return null;
  try {
    const cache = asRecord(JSON.parse(await readFile(join(grokHome, "models_cache.json"), "utf8")));
    const models = asRecord(cache?.models);
    const entry = asRecord(models?.[model]);
    return asRecord(entry?.info);
  } catch {
    return null;
  }
}

/**
 * Safe local equivalent of Grok CLI 1.0.3 `/session-info` for ACP clients.
 * The private x.ai/session/info extension is intentionally not required.
 */
export async function readSessionInfo(options: {
  sessionId?: string;
  cwd?: string;
  grokHome?: string;
}): Promise<GrokSessionInfoSnapshot> {
  const grokHome = options.grokHome ?? join(homedir(), ".grok");
  const sessionDir = options.sessionId
    ? await findSessionDirectory({ sessionId: options.sessionId, grokHome })
    : undefined;
  let summary: SummaryJson = {};
  if (sessionDir) {
    try {
      summary = JSON.parse(await readFile(join(sessionDir, "summary.json"), "utf8")) as SummaryJson;
    } catch {
      summary = {};
    }
  }
  const usage = sessionDir ? await readLatestSessionUsage(sessionDir) : null;
  const model = summary.current_model_id ?? null;
  const modelInfo = await readModelInfo(grokHome, model);
  const contextSize = asNumber(modelInfo?.context_window);
  const contextUsed = asNumber(usage?.totalTokens);
  const percent = contextSize && contextUsed !== null
    ? Math.min(100, Math.max(0, Math.round((contextUsed / contextSize) * 1000) / 10))
    : null;
  const title = asString(summary.generated_title) ?? asString(summary.session_summary);
  const costTicks = asNumber(usage?.costUsdTicks);

  return {
    ok: Boolean(options.sessionId),
    title,
    authMethod: await readAuthMethod(grokHome),
    sessionId: options.sessionId ?? summary.info?.id ?? null,
    workingDirectory: summary.info?.cwd ?? options.cwd ?? null,
    model,
    modelHash: null,
    apiBackend: asString(modelInfo?.api_backend),
    sandbox: asString(summary.sandbox_profile),
    turns: asNumber(usage?.numTurns),
    reasoningEffort: asString(summary.reasoning_effort),
    lastTurnSummary: asString(summary.last_turn_summary),
    lastRecap: asString(summary.last_recap),
    agentName: asString(summary.agent_name) ?? "Grok Build",
    createdAt: asString(summary.created_at),
    updatedAt: asString(summary.updated_at),
    context: {
      used: contextUsed,
      size: contextSize,
      percent,
      inputTokens: asNumber(usage?.inputTokens),
      outputTokens: asNumber(usage?.outputTokens),
      cachedReadTokens: asNumber(usage?.cachedReadTokens),
      cacheCreationTokens: asNumber(usage?.cacheCreationTokens),
      reasoningTokens: asNumber(usage?.reasoningTokens),
      modelCalls: asNumber(usage?.modelCalls),
      apiDurationMs: asNumber(usage?.apiDurationMs),
      costUsd: costTicks === null ? null : costTicks / USD_TICKS,
    },
  };
}

/** Locate a session folder by id under ~/.grok/sessions/<cwd>/<id>. */
export async function findSessionDirectory(options: {
  sessionId: string;
  grokHome?: string;
}): Promise<string | undefined> {
  const root = join(options.grokHome ?? join(homedir(), ".grok"), "sessions");
  let cwdRoots: string[] = [];
  try {
    cwdRoots = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return undefined;
  }
  for (const cwdRoot of cwdRoots) {
    const sessionDir = join(root, cwdRoot, options.sessionId);
    try {
      await stat(sessionDir);
      return sessionDir;
    } catch {
      // try next cwd root
    }
  }
  return undefined;
}

/**
 * Persist a custom display title into summary.json `generated_title`
 * (takes precedence over auto-derived titles in the Sessions tree).
 */
export async function setSessionGeneratedTitle(options: {
  sessionId: string;
  title: string;
  grokHome?: string;
}): Promise<string> {
  const title = collapseWhitespace(options.title);
  if (!title) {
    throw new Error("Session title cannot be empty.");
  }
  if (title.length > 200) {
    throw new Error("Session title is too long (max 200 characters).");
  }
  const sessionDir = await findSessionDirectory({
    sessionId: options.sessionId,
    ...(options.grokHome ? { grokHome: options.grokHome } : {}),
  });
  if (!sessionDir) {
    throw new Error(`Session not found: ${options.sessionId}`);
  }
  const summaryPath = join(sessionDir, "summary.json");
  const raw = await readFile(summaryPath, "utf8");
  const summary = JSON.parse(raw) as SummaryJson & Record<string, unknown>;
  summary.generated_title = title;
  // Keep summary text in sync when it was empty or only mirrored the old title.
  if (!summary.session_summary || !String(summary.session_summary).trim()) {
    summary.session_summary = title;
  }
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return title;
}

export async function deleteSessionViaCli(options: {
  executable: string;
  sessionId: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<void> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["sessions", "delete", options.sessionId],
    cwd: options.cwd,
    environment: options.environment,
  }));
  if ((result.code ?? 1) !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "Failed to delete session");
  }
}

export async function exportSessionMarkdown(options: {
  executable: string;
  sessionId: string;
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> {
  const result = await runGrokCli(cliOptions({
    executable: options.executable,
    args: ["export", options.sessionId],
    cwd: options.cwd,
    environment: options.environment,
    timeoutMs: 60_000,
  }));
  if ((result.code ?? 1) !== 0 && !result.stdout.trim()) {
    throw new Error(result.stderr.trim() || "Failed to export session");
  }
  return result.stdout.trim();
}
