(() => {
  const BUILTIN_COMMANDS = [
    { id: "new", label: "/new", hint: "Start a fresh chat", insert: "/new", aliases: ["clear"] },
    { id: "session-info", label: "/session-info", hint: "Session, context and account", insert: "/session-info", aliases: ["status", "info"] },
    { id: "context", label: "/context", hint: "Show context-window use", insert: "/context" },
    {
      id: "compact",
      label: "/compact",
      hint: "Compress history to free context",
      insert: "/compact ",
      expand: (arg) => {
        const note = String(arg || "").trim();
        return (
          "Compact this conversation to reclaim context-window space. " +
          "Keep the project goal, current files, unresolved decisions and the last useful turn. " +
          (note ? `Preserve especially: ${note}` : "Drop stale exploration that is no longer needed.")
        );
      },
    },
    {
      id: "recap",
      label: "/recap",
      hint: "Summarize this session",
      insert: "/recap",
      aliases: ["summarize"],
      expand: (arg) => {
        const note = String(arg || "").trim();
        return (
          "Write an on-demand recap of this session in the same language as the conversation. " +
          "Cover: what we decided, the current project context, remaining work, and the last turn's outcome. " +
          "Keep it short enough to restore reasoning later. " +
          (note ? `Focus: ${note}` : "")
        );
      },
    },
    {
      id: "rewind",
      label: "/rewind",
      hint: "Undo later turns (history only)",
      insert: "/rewind",
      aliases: ["undo"],
      expand: (arg) => {
        const note = String(arg || "").trim();
        return (
          "Rewind this conversation to an earlier user turn. " +
          "Truncate conversation history only — do not revert files on disk. " +
          "Ask which turn to keep if I did not name one. " +
          (note ? `Target: ${note}` : "")
        );
      },
    },
    { id: "copy", label: "/copy", hint: "Copy the last reply", insert: "/copy" },
    { id: "export", label: "/export", hint: "Export this chat", insert: "/export" },
    { id: "rename", label: "/rename", hint: "Rename this chat", insert: "/rename ", aliases: ["title"] },
    { id: "delete", label: "/delete", hint: "Delete this chat", insert: "/delete" },
    { id: "model", label: "/model", hint: "Switch model", insert: "/model ", aliases: ["m"] },
    { id: "effort", label: "/effort", hint: "Set reasoning effort", insert: "/effort " },
    { id: "plan", label: "/plan", hint: "Switch to plan mode", insert: "/plan" },
    { id: "always-approve", label: "/always-approve", hint: "Skip permission prompts", insert: "/always-approve" },
    { id: "auto", label: "/auto", hint: "Auto-approve safe tools", insert: "/auto" },
    {
      id: "btw",
      label: "/btw",
      hint: "Side question without derailing",
      insert: "/btw ",
      expand: (arg) => {
        const q = String(arg || "").trim();
        return (
          "This is a side question. Do not abandon the current task. " +
          "Answer briefly, then continue the main work. " +
          (q ? `Question: ${q}` : "Ask me what the aside is if I did not specify one.")
        );
      },
    },
    {
      id: "remember",
      label: "/remember",
      hint: "Save a note to memory",
      insert: "/remember ",
      expand: (arg) => {
        const note = String(arg || "").trim();
        return note
          ? `Save this to memory now, without waiting for an automatic summary:\n${note}`
          : "Ask me what to remember, then save it to memory immediately.";
      },
    },
    {
      id: "imagine",
      label: "/imagine",
      hint: "Generate an image",
      insert: "/imagine ",
      expand: (arg) => {
        const d = String(arg || "").trim();
        if (!d) {
          return "Use the Imagine skill and image_gen tool to create an image. Ask me for a short description if needed.";
        }
        return (
          `Use the Imagine skill and the image_gen tool to generate an image.\n` +
          `Description: ${d}\n` +
          `Choose a sensible aspect_ratio. After generating, report the saved file path clearly.`
        );
      },
    },
    {
      id: "imagine-video",
      label: "/imagine-video",
      hint: "Generate a short video",
      insert: "/imagine-video ",
      expand: (arg) => {
        const d = String(arg || "").trim();
        return (
          "Use the Imagine skill and available video tools to create a short video. " +
          "Default: ONE 6s clip at 480p. Report saved image and video paths. " +
          "If image_to_video fails with Zero Data Retention / upload_url / HTTP 400, stop and explain /privacy Opt in. " +
          (d ? `Description: ${d}` : "Ask me for a short description if needed.")
        );
      },
    },
    { id: "usage", label: "/usage", hint: "Open usage", insert: "/usage", aliases: ["cost"] },
    { id: "settings", label: "/settings", hint: "Open Settings", insert: "/settings", aliases: ["config"] },
    { id: "plugins", label: "/plugins", hint: "Open plugins", insert: "/plugins" },
    { id: "skills", label: "/skills", hint: "List local skills", insert: "/skills" },
    { id: "mcps", label: "/mcps", hint: "Open MCP servers", insert: "/mcps" },
    { id: "login", label: "/login", hint: "Sign in to Grok", insert: "/login" },
    { id: "logout", label: "/logout", hint: "Sign out", insert: "/logout" },
    { id: "docs", label: "/docs", hint: "Open Grok Build docs", insert: "/docs", aliases: ["howto"] },
    { id: "doctor", label: "/doctor", hint: "Run grok doctor", insert: "/doctor" },
  ];

  const COMMANDS = [...BUILTIN_COMMANDS];

  function skillPrompt(id, arg) {
    const request = String(arg || "").trim();
    if (!request) return `Use the ${id} skill and follow it for the current request.`;
    return `Use the ${id} skill and follow it.\nUser request: ${request}`;
  }

  function commandAliases(command) {
    return (command?.aliases || []).map((alias) => String(alias).toLowerCase());
  }

  function builtinNameSet() {
    const names = new Set();
    for (const command of BUILTIN_COMMANDS) {
      names.add(command.id);
      for (const alias of commandAliases(command)) names.add(alias);
    }
    return names;
  }

  function findCommand(id) {
    const key = String(id || "").trim().toLowerCase();
    if (!key) return null;
    return COMMANDS.find((command) => command.id === key || commandAliases(command).includes(key)) || null;
  }

  function commandMatchesQuery(command, query) {
    if (!query) return true;
    if (command.id.startsWith(query) || command.label.slice(1).startsWith(query)) return true;
    return commandAliases(command).some((alias) => alias.startsWith(query));
  }

  function setRuntimeCommands(items) {
    const reserved = builtinNameSet();
    const seen = new Set();
    const runtime = [];
    for (const item of Array.isArray(items) ? items : []) {
      const id = String(item?.id || "").trim().toLowerCase();
      if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id) || reserved.has(id) || seen.has(id)) continue;
      if (item?.kind && item.kind !== "skill") continue;
      seen.add(id);
      runtime.push({
        id,
        label: `/${id}`,
        hint: String(item.hint || "Local Grok skill"),
        description: String(item.description || item.hint || "Local Grok skill"),
        insert: `/${id} `,
        kind: "skill",
        expand: (arg) => skillPrompt(id, arg),
      });
    }
    runtime.sort((a, b) => a.id.localeCompare(b.id));
    COMMANDS.splice(BUILTIN_COMMANDS.length, COMMANDS.length, ...runtime);
    return runtime;
  }

  function parseLeadingSlash(text) {
    const s = String(text || "").trim();
    const m = s.match(/^\/([a-zA-Z][\w-]*)(?:\s+([\s\S]*))?$/);
    if (!m) return null;
    return { id: m[1].toLowerCase(), arg: (m[2] || "").trim(), raw: s };
  }

  function resolveSlash(text) {
    const parsed = parseLeadingSlash(text);
    if (!parsed) return { kind: "passthrough", text: String(text || "") };
    const cmd = findCommand(parsed.id);
    if (!cmd) return { kind: "passthrough", text: String(text || "") };
    if (typeof cmd.expand === "function") {
      return { kind: "prompt", id: cmd.id, text: cmd.expand(parsed.arg) };
    }
    return { kind: "ui", action: cmd.id, arg: parsed.arg };
  }

  function menuForInput(value, caret) {
    const text = String(value ?? "");
    const pos = Math.max(0, Math.min(Number(caret) || 0, text.length));
    if (!text.startsWith("/")) return null;
    const before = text.slice(0, pos);
    if (before.includes("\n")) return null;
    const m = before.match(/^\/([\w-]*)$/);
    if (!m) return null;
    const q = m[1].toLowerCase();
    const items = COMMANDS.filter((c) => commandMatchesQuery(c, q));
    if (!items.length) return null;
    return { query: q, start: 0, end: pos, items };
  }

  globalThis.GrokSlashCommands = Object.freeze({
    resolveSlash,
    menuForInput,
    setRuntimeCommands,
    findCommand,
    parseLeadingSlash,
    BUILTIN_COMMANDS,
  });
})();
