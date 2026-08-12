(() => {
  const vscode = acquireVsCodeApi();
  const timeline = globalThis.GrokConversationTimeline;
  const markdown = globalThis.GrokMarkdown;
  if (!timeline) throw new Error("Grok conversation timeline helper is unavailable");
  if (!markdown) throw new Error("Grok markdown helper is unavailable");

  // Lucide-compatible 24px outline icons. Keeping one registry avoids platform-font emoji/glyph drift.
  const iconNodes = {
    // Lucide arrow-up (optically centered in 24×24 viewBox for the circular send control).
    arrowUp: [["path", { d: "m5 12 7-7 7 7" }], ["path", { d: "M12 19V5" }]],
    box: [["path", { d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" }], ["path", { d: "m3.3 7 8.7 5 8.7-5" }], ["path", { d: "M12 22V12" }]],
    brain: [["path", { d: "M9.5 4A2.5 2.5 0 0 1 12 6.5v11A2.5 2.5 0 0 1 9.5 20a2.5 2.5 0 0 1-2.45-2A3 3 0 0 1 5 13a3 3 0 0 1 .6-5.83A2.5 2.5 0 0 1 9.5 4Z" }], ["path", { d: "M14.5 4A2.5 2.5 0 0 0 12 6.5v11a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.45-2A3 3 0 0 0 19 13a3 3 0 0 0-.6-5.83A2.5 2.5 0 0 0 14.5 4Z" }], ["path", { d: "M9 10a3 3 0 0 1-3-3" }], ["path", { d: "M15 10a3 3 0 0 0 3-3" }], ["path", { d: "M9 15a3 3 0 0 0-2 3" }], ["path", { d: "M15 15a3 3 0 0 1 2 3" }]],
    chevronDown: [["path", { d: "m6 9 6 6 6-6" }]],
    externalLink: [["path", { d: "M15 3h6v6" }], ["path", { d: "M10 14 21 3" }], ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }]],
    folder: [["path", { d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" }]],
    gauge: [["path", { d: "m12 14 4-4" }], ["path", { d: "M3.34 19a10 10 0 1 1 17.32 0" }]],
    listTodo: [["rect", { x: "3", y: "5", width: "6", height: "6", rx: "1" }], ["path", { d: "m3 17 2 2 4-4" }], ["path", { d: "M13 6h8" }], ["path", { d: "M13 12h8" }], ["path", { d: "M13 18h8" }]],
    menu: [["line", { x1: "4", x2: "20", y1: "6", y2: "6" }], ["line", { x1: "4", x2: "20", y1: "12", y2: "12" }], ["line", { x1: "4", x2: "20", y1: "18", y2: "18" }]],
    mic: [["path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" }], ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }], ["line", { x1: "12", x2: "12", y1: "19", y2: "22" }]],
    move: [["path", { d: "M5 9l-3 3 3 3" }], ["path", { d: "M9 5l3-3 3 3" }], ["path", { d: "m15 19-3 3-3-3" }], ["path", { d: "m19 9 3 3-3 3" }], ["path", { d: "M2 12h20" }], ["path", { d: "M12 2v20" }]],
    panels: [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }], ["path", { d: "M3 9h18" }], ["path", { d: "M9 21V9" }]],
    pencil: [["path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }], ["path", { d: "m15 5 4 4" }]],
    plug: [["path", { d: "M9 2v6" }], ["path", { d: "M15 2v6" }], ["path", { d: "M12 17v5" }], ["path", { d: "M5 8h14" }], ["path", { d: "M6 11V8h12v3a6 6 0 1 1-12 0Z" }]],
    plus: [["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }]],
    refreshCw: [["path", { d: "M21 12a9 9 0 0 0-15.1-6.6L3 8" }], ["path", { d: "M3 3v5h5" }], ["path", { d: "M3 12a9 9 0 0 0 15.1 6.6L21 16" }], ["path", { d: "M16 16h5v5" }]],
    search: [["circle", { cx: "11", cy: "11", r: "8" }], ["path", { d: "m21 21-4.3-4.3" }]],
    settings: [["path", { d: "M20 7h-9" }], ["path", { d: "M14 17H5" }], ["circle", { cx: "17", cy: "17", r: "3" }], ["circle", { cx: "7", cy: "7", r: "3" }]],
    shieldCheck: [["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }], ["path", { d: "m9 12 2 2 4-4" }]],
    square: [["rect", { width: "14", height: "14", x: "5", y: "5", rx: "2" }]],
    terminal: [["polyline", { points: "4 17 10 11 4 5" }], ["line", { x1: "12", x2: "20", y1: "19", y2: "19" }]],
    trash: [["path", { d: "M3 6h18" }], ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }], ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }], ["line", { x1: "10", x2: "10", y1: "11", y2: "17" }], ["line", { x1: "14", x2: "14", y1: "11", y2: "17" }]],
    triangleAlert: [["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }], ["path", { d: "M12 9v4" }], ["path", { d: "M12 17h.01" }]],
    x: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
  };
  const svgNamespace = "http://www.w3.org/2000/svg";

  function createIcon(name) {
    const nodes = iconNodes[name];
    if (!nodes) throw new Error(`Unknown UI icon: ${name}`);
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.classList.add("ui-icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    for (const [tag, attributes] of nodes) {
      const node = document.createElementNS(svgNamespace, tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      svg.appendChild(node);
    }
    return svg;
  }

  function setIcon(element, name) {
    element.replaceChildren(createIcon(name));
    element.dataset.iconName = name;
  }

  for (const element of document.querySelectorAll("[data-icon]")) setIcon(element, element.dataset.icon);
  const byId = (id) => document.getElementById(id);
  const status = byId("status");
  const statusText = byId("statusText");
  const connectionButton = byId("connectionButton");
  const sessionsButton = byId("sessionsButton");
  const workspaceButton = byId("workspaceButton");
  const openIdeButton = byId("openIdeButton");
  const openIdeLabel = byId("openIdeLabel");
  const productTitle = byId("productTitle");
  const productTagline = byId("productTagline");
  const railProductName = byId("railProductName");
  const railProductTag = byId("railProductTag");
  const railNewConversation = byId("railNewConversation");
  const railHistory = byId("railHistory");
  const railProjects = byId("railProjects");
  const railOpenIde = byId("railOpenIde");
  const railSettings = byId("railSettings");
  const workspaceName = byId("workspaceName");
  const settingsButton = byId("settingsButton");
  const toolsButton = byId("toolsButton");
  const layoutButton = byId("layoutButton");
  const sessionInfo = byId("sessionInfo");
  const runtimeInfo = byId("runtimeInfo");
  const planDock = byId("planDock");
  const messages = byId("messages");
  const emptyState = byId("emptyState");
  const emptyTitle = byId("emptyTitle");
  const emptyDescription = byId("emptyDescription");
  const emptyConnect = byId("emptyConnect");
  const prompt = byId("prompt");
  const composerCard = byId("composerCard");
  let currentProduct = "grok-build";
  const attachmentList = byId("attachments");
  const filesButton = byId("filesButton");
  const permissionButton = byId("permissionButton");
  const permissionLabel = byId("permissionLabel");
  const permissionMenu = byId("permissionMenu");
  const modelButton = byId("modelButton");
  const modelLabel = byId("modelLabel");
  const modelMenu = byId("modelMenu");
  const effortButton = byId("effortButton");
  const effortLabel = byId("effortLabel");
  const effortMenu = byId("effortMenu");
  const modeButton = byId("modeButton");
  const modeLabel = byId("modeLabel");
  const modeMenu = byId("modeMenu");
  const usageButton = byId("usageButton");
  const usageLabel = byId("usageLabel");
  const usagePopover = byId("usagePopover");
  const usageDetail = byId("usageDetail");
  const usageStatus = byId("usageStatus");
  const usageContextPercent = byId("usageContextPercent");
  const usageContextBar = byId("usageContextBar");
  const usageContextBarWrap = byId("usageContextBarWrap");
  const refreshUsageButton = byId("refreshUsageButton");
  const accountUsageTitle = byId("accountUsageTitle");
  const accountUsagePercent = byId("accountUsagePercent");
  const accountUsageBar = byId("accountUsageBar");
  const accountUsageBarWrap = byId("accountUsageBarWrap");
  const accountUsageRows = byId("accountUsageRows");
  const accountUsageError = byId("accountUsageError");
  const usageFetchedAt = byId("usageFetchedAt");
  const manageUsageButton = byId("manageUsageButton");
  const micButton = byId("micButton");
  const cancel = byId("cancel");
  const send = byId("send");
  const promptQueueBar = byId("promptQueueBar");
  const promptQueueText = byId("promptQueueText");
  const promptQueueClear = byId("promptQueueClear");

  const tools = new Map();
  const permissionCards = new Map();
  const attachedFiles = new Map();
  /** Follow-up prompts queued while a turn is running (CLI-like multi-message). */
  const promptQueue = [];
  let drainingQueue = false;
  let state = "disconnected";
  let lastAssistant;
  let lastThought;
  let showReasoning = true;
  let showToolDetails = true;
  let voiceInputEnabled = true;
  let allowOutsideWorkspace = false;
  let modelCatalog;
  let accountUsageLoaded = false;
  let accountUsageManageUrl = "https://grok.com?_s=usage";
  let recognition;
  let listening = false;
  let voiceBase = "";
  let offlineEffort = "";
  let lastVoiceError = "";
  let lastVoiceErrorAt = 0;

  /** Shared state for custom composer menus (Permission-style). */
  const modelState = {
    button: modelButton,
    label: modelLabel,
    menu: modelMenu,
    value: "",
    options: [],
    configId: "",
    modelCatalog: false,
    offlineEffort: false,
    title: "Model",
  };
  const effortState = {
    button: effortButton,
    label: effortLabel,
    menu: effortMenu,
    value: "",
    options: [],
    configId: "",
    modelCatalog: false,
    offlineEffort: false,
    title: "Reasoning effort",
  };
  const modeState = {
    button: modeButton,
    label: modeLabel,
    menu: modeMenu,
    value: "",
    options: [],
    configId: "",
    modelCatalog: false,
    offlineEffort: false,
    title: "Agent mode",
  };

  const permissionLabels = {
    ask: "Ask",
    acceptEdits: "Accept edits",
    auto: "Auto",
    plan: "Plan",
    dontAsk: "Don't ask",
    full: "Full access",
  };

  function closeAllComposerMenus(except) {
    for (const entry of [
      { button: permissionButton, menu: permissionMenu },
      { button: modelButton, menu: modelMenu },
      { button: effortButton, menu: effortMenu },
      { button: modeButton, menu: modeMenu },
    ]) {
      if (except && entry.menu === except) continue;
      entry.menu.classList.add("hidden");
      entry.button.setAttribute("aria-expanded", "false");
    }
  }

  function setMenuOpen(button, menu, open, focusSelected = false) {
    if (open) closeAllComposerMenus(menu);
    menu.classList.toggle("hidden", !open);
    button.setAttribute("aria-expanded", String(open));
    if (open && focusSelected) {
      menu.querySelector('[aria-selected="true"]')?.focus();
    }
  }

  function renderMenuOptions(ctl, onPick) {
    ctl.menu.replaceChildren();
    for (const option of ctl.options) {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "composer-menu-option";
      node.setAttribute("role", "option");
      node.dataset.value = option.value;
      node.textContent = option.label;
      node.title = option.title || option.label;
      node.setAttribute("aria-selected", String(option.value === ctl.value));
      node.addEventListener("click", () => onPick(option.value));
      node.addEventListener("keydown", (event) => {
        const options = Array.from(ctl.menu.querySelectorAll(".composer-menu-option"));
        const index = options.indexOf(node);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const offset = event.key === "ArrowDown" ? 1 : -1;
          options[(index + offset + options.length) % options.length]?.focus();
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          options[event.key === "Home" ? 0 : options.length - 1]?.focus();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setMenuOpen(ctl.button, ctl.menu, false);
          ctl.button.focus();
        }
      });
      ctl.menu.appendChild(node);
    }
    const selected = ctl.options.find((o) => o.value === ctl.value) || ctl.options[0];
    ctl.label.textContent = selected?.label || ctl.title;
    ctl.button.title = ctl.title;
  }

  function setComposerMenuValue(ctl, value, notify) {
    if (!ctl.options.some((o) => o.value === value) && ctl.options.length) {
      value = ctl.options[0].value;
    }
    ctl.value = value;
    for (const option of ctl.menu.querySelectorAll(".composer-menu-option")) {
      option.setAttribute("aria-selected", String(option.dataset.value === value));
    }
    const selected = ctl.options.find((o) => o.value === value);
    ctl.label.textContent = selected?.label || ctl.title;
    setMenuOpen(ctl.button, ctl.menu, false);
    if (notify) notify(value);
  }

  function setComposerMenuDisabled(ctl, disabled) {
    ctl.button.disabled = Boolean(disabled);
    if (disabled) setMenuOpen(ctl.button, ctl.menu, false);
  }

  function bindComposerMenu(ctl, onPick) {
    ctl.button.addEventListener("click", () => {
      if (ctl.button.disabled) return;
      const open = ctl.menu.classList.contains("hidden");
      setMenuOpen(ctl.button, ctl.menu, open, open);
    });
    ctl.button.addEventListener("keydown", (event) => {
      if (ctl.button.disabled) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setMenuOpen(ctl.button, ctl.menu, true, true);
      }
    });
    // Options bound in renderMenuOptions via onPick
    ctl._onPick = onPick;
  }

  function populateMenu(ctl, options, currentValue, meta = {}) {
    ctl.options = options.map((o) => ({
      value: String(o.value),
      label: o.label || String(o.value),
      title: o.title || o.label || String(o.value),
    }));
    ctl.configId = meta.configId || "";
    ctl.modelCatalog = Boolean(meta.modelCatalog);
    ctl.offlineEffort = Boolean(meta.offlineEffort);
    ctl.title = meta.title || ctl.title;
    const values = ctl.options.map((o) => o.value);
    ctl.value = values.includes(String(currentValue)) ? String(currentValue) : (values[0] || "");
    renderMenuOptions(ctl, (value) => {
      setComposerMenuValue(ctl, value, ctl._onPick);
    });
    setComposerMenuDisabled(ctl, meta.disabled);
  }

  function updateContext(event) {
    workspaceName.textContent = event.workspaceName;
    workspaceButton.title = `Open Explorer · ${event.workspaceName}`;
    allowOutsideWorkspace = event.allowOutsideWorkspace;
    setPermissionMode(event.permissionMode || "ask", false);
    showReasoning = event.showReasoning;
    showToolDetails = event.showToolDetails;
    voiceInputEnabled = event.voiceInput;
    offlineEffort = event.reasoningEffort && event.reasoningEffort !== "Default effort"
      ? event.reasoningEffort
      : "";
    if (!modelState.configId) {
      if (modelCatalog) {
        updateModelCatalog(modelCatalog);
      } else {
        setFallbackMenu(modelState, event.model || "Default model");
      }
    }
    if (!effortState.configId) {
      ensureOfflineEffortOptions(offlineEffort || "");
    }
    configureMicrophone();
  }

  /**
   * Two product surfaces:
   * - grok-build → agent desktop (rail + Open Grok Build IDE)
   * - grok-build-ide → compact IDE agent panel (Open Grok Build)
   */
  function applyProduct(msg) {
    currentProduct = msg.product === "grok-build-ide" ? "grok-build-ide" : "grok-build";
    const isIde = currentProduct === "grok-build-ide";
    document.body.classList.toggle("product-grok-build", !isIde);
    document.body.classList.toggle("product-grok-build-ide", isIde);
    document.body.dataset.product = currentProduct;

    const shortName = msg.shortName || (isIde ? "Grok Build IDE" : "Grok Build");
    const tagline = msg.tagline || (isIde
      ? "Full IDE — Explorer, editor, terminal"
      : "Agent desktop — conversations, plans, reviews");

    if (productTitle) productTitle.textContent = shortName;
    if (productTagline) productTagline.textContent = tagline;
    if (railProductName) railProductName.textContent = isIde ? "Grok Build IDE" : "Grok Build";
    if (railProductTag) railProductTag.textContent = isIde ? "IDE agent panel" : "Agent desktop";

    if (openIdeLabel) {
      openIdeLabel.textContent = isIde ? "Open Grok Build" : "Open Grok Build IDE";
    }
    if (openIdeButton) {
      openIdeButton.title = isIde
        ? "Switch to Grok Build agent desktop"
        : "Switch to Grok Build IDE (Explorer, editor, terminal)";
      openIdeButton.dataset.target = isIde ? "grok-build" : "grok-build-ide";
    }
    if (railOpenIde) {
      const label = railOpenIde.querySelector("span:last-child");
      if (label) label.textContent = isIde ? "Open Grok Build" : "Open Grok Build IDE";
      railOpenIde.title = openIdeButton?.title || "";
      railOpenIde.dataset.target = isIde ? "grok-build" : "grok-build-ide";
    }

    if (emptyTitle) emptyTitle.textContent = shortName;
    if (emptyDescription) {
      emptyDescription.innerHTML = isIde
        ? "You are in <strong>Grok Build IDE</strong>. Use Explorer and the editor for classic coding; this panel is the agent side-chat. Switch to <strong>Grok Build</strong> for the full agent desktop."
        : "Agent desktop for Grok. Describe a change — files and diffs open beside this chat. Use <strong>Open Grok Build IDE</strong> for the full IDE product.";
    }
    if (prompt) {
      prompt.placeholder = isIde ? "Ask Grok in the IDE…" : "Ask anything…";
    }
  }

  function switchProductFromUi() {
    if (currentProduct === "grok-build-ide") {
      vscode.postMessage({ type: "openGrokBuild" });
    } else {
      vscode.postMessage({ type: "openGrokBuildIde" });
    }
  }

  function permissionTitle(mode, allowOutside) {
    const scope = allowOutside ? "workspace and external paths" : "open workspace only";
    const labels = {
      full: `Full access: approve ACP requests automatically; filesystem scope: ${scope}`,
      auto: `Grok Auto mode; safe read/search/think/fetch auto-approved; filesystem: ${scope}`,
      acceptEdits: `Accept edits: auto-approve reads and edits; execute still asks; filesystem: ${scope}`,
      plan: `Plan mode: keep tool execution interactive; filesystem: ${scope}`,
      dontAsk: `Don't ask: auto-approve ACP tool permissions; filesystem: ${scope}`,
      ask: `Ask for every ACP permission request; filesystem scope: ${scope}`,
    };
    return labels[mode] || labels.ask;
  }

  function setPermissionMenuOpen(open, focusSelected = false) {
    if (open) {
      usagePopover.classList.add("hidden");
      usageButton.setAttribute("aria-expanded", "false");
    }
    setMenuOpen(permissionButton, permissionMenu, open, focusSelected);
  }

  function setPermissionMode(mode, notify = true) {
    if (!permissionLabels[mode]) return;
    permissionLabel.textContent = permissionLabels[mode];
    permissionButton.title = permissionTitle(mode, allowOutsideWorkspace);
    for (const option of permissionMenu.querySelectorAll(".composer-menu-option")) {
      option.setAttribute("aria-selected", String(option.dataset.value === mode));
    }
    setPermissionMenuOpen(false);
    if (notify) vscode.postMessage({ type: "setPermissionMode", mode });
  }

  function setFallbackMenu(ctl, label) {
    populateMenu(ctl, [{ value: "", label }], "", {
      disabled: true,
      title: `${label} · Grok Build did not advertise selectable values through ACP`,
    });
    ctl.configId = "";
    ctl.modelCatalog = false;
    ctl.offlineEffort = false;
  }

  function ensureOfflineEffortOptions(current) {
    if (effortState.configId) return;
    const values = ["", "low", "medium", "high", "xhigh"];
    const labels = {
      "": "Default",
      low: "Low",
      medium: "Medium",
      high: "High",
      xhigh: "Extra high",
    };
    const busy = state === "running" || state === "starting" || state === "stopping" || state === "workspace_required";
    populateMenu(
      effortState,
      values.map((value) => ({ value, label: labels[value] })),
      values.includes(current) ? current : "",
      {
        offlineEffort: true,
        disabled: busy,
        title: "Reasoning effort (reconnects ACP session when changed offline)",
      },
    );
  }

  function updateRuntime(event) {
    const label = `${event.agentName}${event.agentVersion ? ` ${event.agentVersion}` : ""}`;
    runtimeInfo.textContent = label;
    runtimeInfo.title = `${label} · ACP ${event.protocolVersion}`;
  }

  function updateSession(sessionId, resumed) {
    const shortId = sessionId.length > 12 ? `${sessionId.slice(0, 10)}…` : sessionId;
    sessionInfo.textContent = resumed ? `${shortId} (resumed)` : shortId;
    sessionInfo.title = `Session ${sessionId}`;
    usageLabel.textContent = "Usage";
    usageContextPercent.textContent = "—";
    setUsageProgress(usageContextBar, usageContextBarWrap, null);
    usageDetail.textContent = "Waiting for ACP session context data.";
    const sessionTurn = byId("sessionTurnUsage");
    if (sessionTurn) sessionTurn.textContent = "Last turn: waiting for token counts…";
  }

  function setState(next, detail) {
    const prev = state;
    state = next;
    status.dataset.state = next;
    statusText.textContent = detail || stateLabel(next);
    // Only hard-lock composer while connecting/stopping or no workspace.
    // While "running", keep prompt editable so follow-ups can be typed/queued (CLI parity).
    const hardLock = next === "starting" || next === "stopping";
    const needsWorkspace = next === "workspace_required";
    const canCompose = !hardLock && !needsWorkspace && (next === "connected" || next === "running" || next === "disconnected" || next === "error");
    prompt.disabled = !canCompose || needsWorkspace || hardLock;
    // Allow send whenever session is live (connected or mid-turn).
    send.disabled = needsWorkspace || hardLock || (next !== "connected" && next !== "running");
    filesButton.disabled = needsWorkspace || hardLock || (next !== "connected" && next !== "running");
    permissionButton.disabled = needsWorkspace;
    if (needsWorkspace) {
      setPermissionMenuOpen(false);
      closeAllComposerMenus();
    }
    // Keep Send visible during runs; Stop appears beside it.
    send.classList.remove("hidden");
    cancel.classList.toggle("hidden", next !== "running");
    send.title = next === "running"
      ? "Queue message for after the current turn (or wait until Grok finishes)"
      : "Send message";
    setIcon(connectionButton, next === "connected" || next === "running" ? "square" : "plug");
    connectionButton.title = next === "connected" || next === "running" ? "Disconnect" : "Connect";
    connectionButton.setAttribute(
      "aria-label",
      next === "connected" || next === "running" ? "Disconnect Grok Build" : "Connect Grok Build",
    );
    // When a turn ends (or cancel restores connected), drain queued follow-ups.
    if (next === "connected" && prev === "running") {
      queueMicrotask(() => drainPromptQueue());
    }
    if (next === "disconnected" || next === "error" || next === "workspace_required") {
      clearPromptQueue(false);
    }
    updatePromptQueueUi();
    if (needsWorkspace) {
      showSetupState(
        "Open a folder to start",
        "Grok Build needs a workspace before it can inspect or edit files.",
        "Open folder",
        "openFolder",
      );
    } else if (next === "disconnected" || next === "error") {
      showSetupState(
        next === "error" ? "Grok Build needs attention" : "Ready for your first task",
        detail || "Connect Grok Build, then describe the change you want.",
        next === "error" ? "Try again" : "Connect agent",
        "connect",
      );
    } else if (emptyState.isConnected) {
      emptyState.querySelector("h2").textContent = "Ready for your first task";
      emptyState.querySelector("p").textContent =
        "Describe the change you want Grok Build to make. Files and diffs will open in the editor as it works.";
      emptyConnect.classList.add("hidden");
    }
    refreshSessionControls();
  }

  function stateLabel(value) {
    return {
      disconnected: "Disconnected",
      workspace_required: "Workspace required",
      starting: "Starting Grok Build…",
      connected: "New ACP session ready",
      running: "Grok Build is working",
      stopping: "Stopping Grok Build…",
      error: "Connection error",
    }[value] || value;
  }

  function showSetupState(title, description, actionLabel, action) {
    if (!emptyState.isConnected) {
      messages.replaceChildren(emptyState);
    }
    emptyTitle.textContent = title;
    emptyDescription.textContent = description;
    emptyConnect.textContent = actionLabel;
    emptyConnect.dataset.action = action;
    emptyConnect.classList.remove("hidden");
  }

  function clearConversation(reason) {
    tools.clear();
    permissionCards.clear();
    lastAssistant = undefined;
    lastThought = undefined;
    planDock.classList.add("hidden");
    planDock.replaceChildren();
    messages.replaceChildren(emptyState);
    if (reason === "manual") {
      showSetupState(
        "Conversation cleared",
        "Session is still active. Send a new prompt to continue.",
        "Continue",
        "connect",
      );
      emptyConnect.classList.add("hidden");
    } else if (reason === "resume") {
      showSetupState(
        "Session resumed",
        "Loading previous conversation…",
        "Continue",
        "connect",
      );
      emptyConnect.classList.add("hidden");
    } else {
      showSetupState(
        "New session ready",
        "Describe the change you want Grok Build to make.",
        "Continue",
        "connect",
      );
      emptyConnect.classList.add("hidden");
    }
  }

  function ensureConversation() {
    if (emptyState.isConnected) emptyState.remove();
  }

  function roleLabel(role) {
    return role === "assistant" ? "Grok Build" : role === "user" ? "You" : "Error";
  }

  function roleAvatarLetter(role) {
    return role === "assistant" ? "G" : role === "user" ? "Y" : "!";
  }

  function createMessageHeader(role) {
    const header = document.createElement("div");
    header.className = "message-header";
    const avatar = document.createElement("span");
    avatar.className = `message-avatar message-avatar-${role}`;
    avatar.textContent = roleAvatarLetter(role);
    avatar.setAttribute("aria-hidden", "true");
    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = roleLabel(role);
    header.append(avatar, label);
    return header;
  }

  // message-header uses flex; badge uses margin-left:auto when queued.

  function createMessage(role, text, contextNames) {
    const item = document.createElement("article");
    item.className = `message ${role}`;
    const header = createMessageHeader(role);
    const body = document.createElement("div");
    body.className = "message-body";
    if (role === "assistant") {
      (markdown.setStructuredContent || markdown.setMarkdownContent)(body, text, (href) =>
        vscode.postMessage({ type: "openExternal", value: href }),
      );
    } else {
      body.textContent = text;
    }
    item.append(header);
    if (contextNames?.length) {
      const chips = document.createElement("div");
      chips.className = "message-context-chips";
      chips.setAttribute("aria-label", "Attached context");
      for (const name of contextNames) {
        const chip = document.createElement("span");
        chip.className = "message-context-chip";
        chip.title = name;
        const at = document.createElement("span");
        at.className = "message-context-at";
        at.textContent = "@";
        const label = document.createElement("span");
        label.className = "message-context-name";
        label.textContent = name;
        chip.append(at, label);
        chips.appendChild(chip);
      }
      item.append(chips);
    }
    item.append(body);
    return { item, body };
  }

  function updateConversation(update, forceStickToBottom = false) {
    const shouldStick = forceStickToBottom || timeline.shouldStickToBottom(
      messages.scrollHeight,
      messages.scrollTop,
      messages.clientHeight,
    );
    update();
    if (shouldStick) scrollToBottom();
  }

  function addMessage(role, text, forceStickToBottom = false, contextNames) {
    ensureConversation();
    const message = createMessage(role, text, contextNames);
    updateConversation(() => messages.appendChild(message.item), forceStickToBottom);
    return message.body;
  }

  function renderSessionTranscript(messagesToRender) {
    tools.clear();
    permissionCards.clear();
    resetTurnPointers();
    planDock.classList.add("hidden");
    planDock.replaceChildren();
    messages.replaceChildren();
    const transcript = Array.isArray(messagesToRender) ? messagesToRender : [];
    for (const message of transcript) {
      if ((message.role !== "user" && message.role !== "assistant") || !message.text) {
        continue;
      }
      addMessage(message.role, message.text);
    }
    if (!messages.children.length) {
      messages.replaceChildren(emptyState);
      showSetupState(
        "Session resumed",
        "No previous conversation content was found. Continue with a new prompt.",
        "Continue",
        "connect",
      );
      emptyConnect.classList.add("hidden");
      return;
    }
    scrollToBottom();
  }

  let pendingRenderNodes = new Set();
  let renderRafId = null;
  let renderThrottleTimer = null;
  let lastRenderAt = 0;

  function scheduleNodeRender(node, force = false) {
    pendingRenderNodes.add(node);
    if (force) {
      if (renderThrottleTimer) {
        clearTimeout(renderThrottleTimer);
        renderThrottleTimer = null;
      }
      if (renderRafId) {
        cancelAnimationFrame(renderRafId);
        renderRafId = null;
      }
      flushPendingRenders(true);
      return;
    }
    // Throttle full Markdown re-parses: near turn end the buffer is large and
    // re-rendering every chunk freezes the Electron window ("Not Responding").
    const rawLen = node?.dataset?.raw?.length || 0;
    const minGap = rawLen > 40_000 ? 280 : rawLen > 12_000 ? 140 : 48;
    const elapsed = Date.now() - lastRenderAt;
    if (elapsed >= minGap && !renderThrottleTimer && !renderRafId) {
      renderRafId = requestAnimationFrame(() => flushPendingRenders(false));
      return;
    }
    if (renderThrottleTimer) {
      return;
    }
    renderThrottleTimer = setTimeout(() => {
      renderThrottleTimer = null;
      if (!renderRafId) {
        renderRafId = requestAnimationFrame(() => flushPendingRenders(false));
      }
    }, Math.max(16, minGap - elapsed));
  }

  function flushPendingRenders(final = false) {
    if (renderRafId) {
      cancelAnimationFrame(renderRafId);
      renderRafId = null;
    }
    lastRenderAt = Date.now();
    for (const node of pendingRenderNodes) {
      if (node && node.dataset && node.dataset.raw !== undefined) {
        const raw = node.dataset.raw;
        const openLink = (href) => vscode.postMessage({ type: "openExternal", value: href });
        // Streaming: cheap markdown. Final/small: structured code cards.
        if (!final && raw.length > 8_000) {
          markdown.setMarkdownContent(node, raw, openLink);
        } else {
          (markdown.setStructuredContent || markdown.setMarkdownContent)(node, raw, openLink);
        }
      }
    }
    pendingRenderNodes.clear();
  }

  function isConversationTail(body) {
    return Boolean(body && body.parentElement === messages.lastElementChild);
  }

  function appendAssistant(text, messageId) {
    ensureConversation();
    if (timeline.shouldStartNewSegment(
      Boolean(lastAssistant),
      lastAssistant?.dataset.messageId,
      messageId,
      isConversationTail(lastAssistant),
    )) {
      flushPendingRenders();
      const message = createMessage("assistant", "");
      updateConversation(() => messages.appendChild(message.item), true);
      lastAssistant = message.body;
      lastAssistant.dataset.raw = "";
      if (messageId) lastAssistant.dataset.messageId = messageId;
    }
    lastAssistant.dataset.raw = `${lastAssistant.dataset.raw || ""}${text}`;
    scheduleNodeRender(lastAssistant);
    const shouldStick = timeline.shouldStickToBottom(
      messages.scrollHeight,
      messages.scrollTop,
      messages.clientHeight,
    );
    if (shouldStick) scrollToBottom();
  }

  function appendThought(text, messageId) {
    if (!showReasoning) return;
    ensureConversation();
    updateConversation(() => {
      if (timeline.shouldStartNewSegment(
        Boolean(lastThought),
        lastThought?.dataset.messageId,
        messageId,
        isConversationTail(lastThought),
      )) {
        const thought = document.createElement("details");
        thought.className = "thought";
        const summary = document.createElement("summary");
        summary.className = "thought-summary";
        const glyph = document.createElement("span");
        glyph.className = "thought-glyph";
        glyph.appendChild(createIcon("brain"));
        const summaryLabel = document.createElement("span");
        summaryLabel.textContent = "Thinking";
        summary.append(glyph, summaryLabel);
        const body = document.createElement("div");
        body.className = "thought-body";
        thought.append(summary, body);
        messages.appendChild(thought);
        lastThought = body;
        if (messageId) lastThought.dataset.messageId = messageId;
      }
      lastThought.textContent += text;
    });
  }

  function locationButton(location) {
    const button = document.createElement("button");
    button.className = "file-link";
    const pieces = location.path.replaceAll("\\", "/").split("/");
    button.textContent = `${pieces.at(-1) || location.path}${location.line ? `:${location.line}` : ""}`;
    button.title = location.path;
    button.addEventListener("click", () =>
      vscode.postMessage({ type: "openFile", path: location.path, line: location.line }),
    );
    return button;
  }

  function normalizeToolStatus(status) {
    const raw = String(status || "pending").toLowerCase().replace(/[\s-]+/g, "_");
    if (raw.includes("fail") || raw.includes("error")) return "failed";
    if (raw.includes("cancel")) return "cancelled";
    if (raw === "completed" || raw === "complete" || raw === "done" || raw === "success") return "completed";
    if (raw === "in_progress" || raw === "running" || raw === "started" || raw === "active") return "in_progress";
    if (raw === "pending" || raw === "queued" || raw === "waiting") return "pending";
    return raw || "pending";
  }

  function formatToolStatusLabel(status) {
    const key = normalizeToolStatus(status);
    return {
      pending: "Pending",
      in_progress: "In progress",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    }[key] || String(status || "Pending").replace(/_/g, " ");
  }

  function applyToolStatus(item, statusEl, status) {
    const key = normalizeToolStatus(status);
    item.dataset.status = key;
    item.classList.remove(
      "tool-status-pending",
      "tool-status-in_progress",
      "tool-status-completed",
      "tool-status-failed",
      "tool-status-cancelled",
    );
    item.classList.add(`tool-status-${key}`);
    statusEl.textContent = formatToolStatusLabel(status);
    statusEl.dataset.status = key;
  }

  function addTool(event) {
    ensureConversation();
    const item = document.createElement("section");
    item.className = "tool";
    item.dataset.toolCallId = event.toolCallId;
    if (event.kind) item.dataset.kind = event.kind;
    const row = document.createElement("div");
    row.className = "tool-row";
    const glyph = document.createElement("span");
    glyph.className = "tool-glyph";
    glyph.appendChild(createIcon(toolIcon(event.kind)));
    const title = document.createElement("span");
    title.className = "tool-title";
    title.textContent = event.title || "Tool call";
    const toolStatus = document.createElement("span");
    toolStatus.className = "tool-status";
    applyToolStatus(item, toolStatus, event.status || "pending");
    row.append(glyph, title, toolStatus);
    const locations = document.createElement("div");
    locations.className = "tool-locations";
    updateLocations(locations, event.locations);
    item.append(row, locations);
    updateConversation(() => {
      messages.appendChild(item);
      tools.set(event.toolCallId, { item, title, status: toolStatus, locations });
    });
  }

  function toolIcon(kind) {
    return { read: "externalLink", edit: "pencil", execute: "terminal", search: "search", delete: "trash", move: "move" }[kind] || "terminal";
  }

  function updateLocations(container, locations) {
    container.replaceChildren();
    if (!showToolDetails || !locations?.length) {
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    for (const location of locations) container.appendChild(locationButton(location));
  }

  function updateTool(event) {
    const tool = tools.get(event.toolCallId);
    if (!tool) {
      addTool({ ...event, title: event.title || "Tool call", status: event.status || "updated" });
      return;
    }
    updateConversation(() => {
      if (event.title) tool.title.textContent = event.title;
      if (event.kind) tool.item.dataset.kind = event.kind;
      if (event.status) applyToolStatus(tool.item, tool.status, event.status);
      if (event.locations) updateLocations(tool.locations, event.locations);
    });
  }

  function addPermission(event) {
    ensureConversation();
    const card = document.createElement("section");
    card.className = "permission-card";
    card.dataset.requestId = event.requestId;
    const heading = document.createElement("div");
    heading.className = "permission-heading";
    const icon = document.createElement("span");
    icon.appendChild(createIcon("triangleAlert"));
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Approval required";
    const description = document.createElement("span");
    description.textContent = event.title;
    copy.append(title, description);
    heading.append(icon, copy);
    const locations = document.createElement("div");
    locations.className = "tool-locations";
    updateLocations(locations, event.locations);
    const actions = document.createElement("div");
    actions.className = "permission-actions";
    event.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = option.kind.startsWith("allow_") ? "primary-button" : "secondary-button danger-button";
      button.textContent = index < 9 ? `${index + 1}. ${option.name}` : option.name;
      button.dataset.optionId = option.optionId;
      button.dataset.hotkey = String(index + 1);
      button.addEventListener("click", () => {
        disablePermissionCard(card, option.name);
        vscode.postMessage({
          type: "permissionResponse",
          requestId: event.requestId,
          optionId: option.optionId,
        });
      });
      actions.appendChild(button);
    });
    card.append(heading, locations, actions);
    updateConversation(() => {
      messages.appendChild(card);
      permissionCards.set(event.requestId, card);
    });
  }

  function resolvePermission(event) {
    const card = permissionCards.get(event.requestId);
    if (card) {
      disablePermissionCard(card, event.cancelled ? "Cancelled" : "Approved");
      permissionCards.delete(event.requestId);
    } else if (event.automatic) {
      addActivityNote(event.cancelled ? "Pending approval cancelled" : "Permission approved automatically");
    }
  }

  function disablePermissionCard(card, label) {
    for (const button of card.querySelectorAll("button")) button.disabled = true;
    card.classList.add("resolved");
    const result = document.createElement("span");
    result.className = "permission-result";
    result.textContent = label;
    card.querySelector(".permission-actions")?.appendChild(result);
  }

  function addActivityNote(text) {
    ensureConversation();
    const item = document.createElement("div");
    item.className = "activity-note";
    const pill = document.createElement("span");
    pill.className = "activity-note-pill";
    pill.textContent = text;
    item.appendChild(pill);
    updateConversation(() => messages.appendChild(item));
  }

  function addAttachment(event) {
    if (attachedFiles.has(event.uri)) return;
    const chip = document.createElement("span");
    chip.className = "attachment-chip context-attachment";
    chip.title = event.uri;
    const isImage = event.mimeType?.startsWith("image/") && event.data;
    if (isImage) {
      const thumb = document.createElement("img");
      thumb.className = "attachment-thumb";
      thumb.alt = event.name;
      thumb.src = `data:${event.mimeType};base64,${event.data}`;
      chip.appendChild(thumb);
    } else {
      const at = document.createElement("span");
      at.className = "attachment-at";
      at.textContent = "@";
      chip.appendChild(at);
    }
    const name = document.createElement("span");
    name.className = "attachment-name";
    name.textContent = event.name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "attachment-remove";
    remove.appendChild(createIcon("x"));
    remove.title = `Remove ${event.name}`;
    remove.setAttribute("aria-label", `Remove ${event.name}`);
    remove.addEventListener("click", () => {
      attachedFiles.delete(event.uri);
      chip.remove();
      attachmentList.classList.toggle("hidden", attachedFiles.size === 0);
    });
    chip.append(name, remove);
    attachedFiles.set(event.uri, {
      uri: event.uri,
      name: event.name,
      mimeType: event.mimeType,
      data: event.data,
      chip,
    });
    attachmentList.appendChild(chip);
    attachmentList.classList.remove("hidden");
  }

  function clearAttachments() {
    attachedFiles.clear();
    attachmentList.replaceChildren();
    attachmentList.classList.add("hidden");
  }

  function addWorkspaceEdit(event) {
    ensureConversation();
    const item = document.createElement("section");
    item.className = "edit-card";
    const copy = document.createElement("div");
    const file = event.path.replaceAll("\\", "/").split("/").at(-1) || event.path;
    copy.textContent = `Edited ${file}`;
    copy.title = event.path;
    const review = document.createElement("button");
    review.type = "button";
    review.className = "secondary-button";
    review.textContent = "Review";
    review.addEventListener("click", () =>
      vscode.postMessage({ type: "reviewChange", changeId: event.changeId }),
    );
    item.append(copy, review);
    updateConversation(() => messages.appendChild(item));
  }

  function showPlan(entries) {
    const shouldStick = timeline.shouldStickToBottom(
      messages.scrollHeight,
      messages.scrollTop,
      messages.clientHeight,
    );
    planDock.classList.remove("hidden");
    planDock.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = "Plan";
    const list = document.createElement("ol");
    for (const entry of entries) {
      const row = document.createElement("li");
      row.dataset.status = entry.status;
      row.textContent = `${entry.content} — ${entry.status}`;
      list.appendChild(row);
    }
    planDock.append(title, list);

    // Also keep a compact marker in the stream once per update set.
    ensureConversation();
    let streamPlan = messages.querySelector(".plan[data-sticky='true']");
    if (!streamPlan) {
      streamPlan = document.createElement("section");
      streamPlan.className = "plan";
      streamPlan.dataset.sticky = "true";
      updateConversation(() => messages.appendChild(streamPlan));
    }
    streamPlan.replaceChildren();
    const streamTitle = document.createElement("strong");
    streamTitle.textContent = "Plan";
    const streamList = document.createElement("ol");
    for (const entry of entries) {
      const row = document.createElement("li");
      row.textContent = `${entry.content} — ${entry.status}`;
      streamList.appendChild(row);
    }
    streamPlan.append(streamTitle, streamList);
    if (shouldStick) scrollToBottom();
  }

  function updateSessionConfig(event) {
    const model = event.options.find((option) => option.category === "model");
    const effort = event.options.find(
      (option) => option.category === "thought_level" || /reason|effort|thought/i.test(option.name),
    );
    if (model) {
      populateConfigMenu(modelState, model, "Default model");
    } else if (modelCatalog) {
      updateModelCatalog(modelCatalog);
    } else {
      populateConfigMenu(modelState, undefined, "Default model");
    }
    if (effort) {
      populateConfigMenu(effortState, effort, "Default effort");
      effortState.offlineEffort = false;
    } else {
      ensureOfflineEffortOptions(offlineEffort);
    }
    refreshSessionControls();
  }

  function populateConfigMenu(ctl, control, fallback) {
    if (!control || control.type !== "select" || !control.options?.length) {
      if (ctl === effortState) {
        ensureOfflineEffortOptions(offlineEffort);
        return;
      }
      setFallbackMenu(ctl, fallback);
      return;
    }
    populateMenu(
      ctl,
      control.options.map((option) => ({
        value: option.value,
        label: option.name,
        title: option.description || option.name,
      })),
      control.currentValue,
      {
        configId: control.id,
        disabled: false,
        title: control.description || control.name,
      },
    );
  }

  function updateModelCatalog(event) {
    modelCatalog = event;
    if (modelState.configId) return;
    if (!event.models?.length) {
      setFallbackMenu(modelState, event.currentModel || "Default model");
      return;
    }
    const current = event.currentModel || event.defaultModel || event.models[0];
    populateMenu(
      modelState,
      event.models.map((model) => ({ value: model, label: model })),
      current,
      {
        modelCatalog: true,
        disabled: state !== "connected",
        title: "Models reported by the installed Grok CLI; changing model reconnects the ACP session",
      },
    );
  }

  function updateSessionModes(event) {
    populateMenu(
      modeState,
      (event.modes || []).map((mode) => ({
        value: mode.id,
        label: mode.name,
        title: mode.description || mode.name,
      })),
      event.currentModeId,
      {
        disabled: state !== "connected",
        title: "Agent mode",
      },
    );
    modeButton.closest(".mode-control")?.classList.toggle("hidden", !(event.modes?.length));
    refreshSessionControls();
  }

  function clampPercent(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : null;
  }

  function formatPercent(value) {
    const number = clampPercent(value);
    if (number === null) return "—";
    return `${Math.abs(number - Math.round(number)) < 0.05 ? Math.round(number) : number}%`;
  }

  function setUsageProgress(bar, wrap, value) {
    const percent = clampPercent(value);
    const display = percent ?? 0;
    bar.style.width = `${display}%`;
    bar.classList.toggle("warn", percent !== null && percent >= 70 && percent < 90);
    bar.classList.toggle("crit", percent !== null && percent >= 90);
    wrap.setAttribute("aria-valuenow", String(Math.round(display)));
    if (percent === null) wrap.removeAttribute("aria-valuetext");
    else wrap.setAttribute("aria-valuetext", formatPercent(percent));
  }

  function usageRow(label, value) {
    const row = document.createElement("div");
    row.className = "usage-row";
    const key = document.createElement("span");
    key.className = "usage-row-key";
    key.textContent = label;
    const result = document.createElement("span");
    result.className = "usage-row-value";
    result.textContent = value;
    row.append(key, result);
    return row;
  }

  function formatCredits(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : "—";
  }

  function formatReset(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderAccountUsage(message) {
    const loading = message.state === "loading";
    refreshUsageButton.disabled = loading;
    refreshUsageButton.classList.toggle("loading", loading);
    if (loading) {
      usageStatus.textContent = "Refreshing account usage…";
      accountUsageError.classList.add("hidden");
      return;
    }

    accountUsageLoaded = true;
    const data = message.data || {};
    const plan = data.plan;
    if (typeof data.manageUrl === "string" && /^https?:\/\//i.test(data.manageUrl)) {
      accountUsageManageUrl = data.manageUrl;
    }
    accountUsageRows.replaceChildren();
    accountUsageError.classList.add("hidden");

    if (!data.ok || !plan) {
      accountUsageTitle.textContent = "Plan limit";
      accountUsagePercent.textContent = "—";
      setUsageProgress(accountUsageBar, accountUsageBarWrap, null);
      accountUsageError.textContent = data.error || "Could not load account usage.";
      accountUsageError.classList.remove("hidden");
      usageStatus.textContent = "Account usage unavailable";
    } else {
      const percent = clampPercent(plan.creditUsagePercent);
      accountUsageTitle.textContent = plan.limitLabel || "Plan limit";
      accountUsagePercent.textContent = formatPercent(percent);
      setUsageProgress(accountUsageBar, accountUsageBarWrap, percent);
      if (percent !== null) accountUsageRows.append(usageRow("Used", formatPercent(percent)));
      if (plan.nextReset) accountUsageRows.append(usageRow("Next reset", formatReset(plan.nextReset)));
      for (const product of plan.productUsage || []) {
        accountUsageRows.append(usageRow(product.label || "Product", formatPercent(product.usagePercent)));
      }
      if (data.account?.subscriptionTier) {
        accountUsageRows.append(usageRow("Plan", data.account.subscriptionTier));
      }
      if (plan.used != null && plan.monthlyLimit != null) {
        const remaining = plan.remaining != null ? ` · ${formatCredits(plan.remaining)} left` : "";
        accountUsageRows.append(
          usageRow("Credits", `${formatCredits(plan.used)} / ${formatCredits(plan.monthlyLimit)}${remaining}`),
        );
      }
      if (plan.onDemandCap != null && Number(plan.onDemandCap) > 0) {
        accountUsageRows.append(
          usageRow("Pay as you go", `${formatCredits(plan.onDemandUsed || 0)} / ${formatCredits(plan.onDemandCap)}`),
        );
      }
      if (!accountUsageRows.children.length) {
        const empty = document.createElement("span");
        empty.className = "usage-empty";
        empty.textContent = "No plan counters were returned by the account service.";
        accountUsageRows.append(empty);
      }
      usageStatus.textContent = "Session context and account plan";
    }

    const fetched = data.fetchedAt ? new Date(data.fetchedAt) : null;
    const fetchedLabel = fetched && !Number.isNaN(fetched.getTime())
      ? `Updated ${fetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Updated just now";
    usageFetchedAt.textContent = data.account?.email ? `${data.account.email} · ${fetchedLabel}` : fetchedLabel;
  }

  function updateUsage(event) {
    const percent = event.size > 0 ? Math.min(100, Math.round((event.used / event.size) * 100)) : 0;
    usageLabel.textContent = `${percent}%`;
    usageContextPercent.textContent = `${percent}%`;
    setUsageProgress(usageContextBar, usageContextBarWrap, percent);
    const cost = event.cost ? ` · ${event.cost.amount} ${event.cost.currency}` : "";
    usageDetail.textContent = `${formatTokens(event.used)} / ${formatTokens(event.size)} tokens (${percent}%)${cost}`;
    usageButton.title = `Session context ${usageDetail.textContent}. Open for account plan usage.`;
    const turn = usageButton.dataset.turnUsage;
    const sessionTurn = byId("sessionTurnUsage");
    if (sessionTurn) {
      sessionTurn.textContent = turn
        ? `Last turn: ${turn}`
        : "Last turn: waiting for token counts…";
    }
  }

  function updateTokenUsage(event) {
    if (usageLabel.textContent === "Usage" || usageLabel.textContent === "Context" || usageLabel.textContent === "Session") {
      usageLabel.textContent = formatTokens(event.totalTokens);
    }
    const thought = event.thoughtTokens ? ` · ${formatTokens(event.thoughtTokens)} reasoning` : "";
    usageButton.dataset.turnUsage = `${formatTokens(event.inputTokens)} input · ${formatTokens(event.outputTokens)} output${thought}`;
    const sessionTurn = byId("sessionTurnUsage");
    if (sessionTurn) {
      sessionTurn.textContent = `Last turn: ${usageButton.dataset.turnUsage}`;
    }
  }

  function formatTokens(value) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return String(value);
  }

  function refreshSessionControls() {
    const unavailable = state !== "connected";
    if (modelState.configId || modelState.modelCatalog) {
      setComposerMenuDisabled(modelState, unavailable);
    }
    if (effortState.configId) {
      setComposerMenuDisabled(effortState, unavailable);
    } else if (effortState.offlineEffort) {
      setComposerMenuDisabled(
        effortState,
        state === "running" || state === "starting" || state === "stopping" || state === "workspace_required",
      );
    }
    setComposerMenuDisabled(modeState, unavailable);
  }

  function configureMicrophone() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supported = Boolean(SpeechRecognition);
    // Electron webviews almost never expose Web Speech API — hide mic unless both
    // the setting is on and the runtime actually supports recognition.
    const showMic = voiceInputEnabled && supported;
    micButton.classList.toggle("hidden", !showMic);
    micButton.disabled = !showMic;
    micButton.title = !voiceInputEnabled
      ? "Voice input is disabled in Grok Build settings"
      : supported
        ? "Dictate into the prompt"
        : "Speech recognition is unavailable in this Electron webview runtime";
    if (!showMic || recognition) return;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "vi-VN";
    recognition.onstart = () => {
      voiceBase = prompt.value;
      listening = true;
      micButton.classList.add("listening");
      micButton.title = "Listening… click to stop";
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      prompt.value = `${voiceBase}${voiceBase && !voiceBase.endsWith(" ") ? " " : ""}${transcript}`;
      resizePrompt();
      prompt.focus();
    };
    recognition.onerror = (event) => {
      const now = Date.now();
      if (event.error !== lastVoiceError || now - lastVoiceErrorAt > 2_000) {
        addActivityNote(`Voice input: ${event.error}`);
        lastVoiceError = event.error;
        lastVoiceErrorAt = now;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micButton.disabled = true;
        micButton.title = "Voice input permission is unavailable in this VS Code runtime";
      }
    };
    recognition.onend = () => {
      listening = false;
      micButton.classList.remove("listening");
      micButton.title = "Dictate into the prompt";
    };
  }

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function resetTurnPointers() {
    lastAssistant = undefined;
    lastThought = undefined;
  }

  function updatePromptQueueUi() {
    if (!promptQueueBar || !promptQueueText) return;
    const n = promptQueue.length;
    promptQueueBar.classList.toggle("hidden", n === 0);
    promptQueueText.textContent = n === 0
      ? "0 messages queued"
      : n === 1
        ? "1 message queued — sends when current turn finishes"
        : `${n} messages queued — send in order when free`;
  }

  function clearPromptQueue(announce = true) {
    promptQueue.length = 0;
    for (const badge of messages.querySelectorAll(".message-queue-badge")) {
      badge.remove();
    }
    for (const item of messages.querySelectorAll(".message.user.queued")) {
      item.classList.remove("queued");
    }
    updatePromptQueueUi();
    if (announce) addActivityNote("Queued messages cleared");
  }

  function drainPromptQueue() {
    if (drainingQueue || state !== "connected" || promptQueue.length === 0) {
      updatePromptQueueUi();
      return;
    }
    drainingQueue = true;
    try {
      const next = promptQueue.shift();
      updatePromptQueueUi();
      if (!next) return;
      // Mark the matching queued bubble as live (drop badge).
      const queued = messages.querySelector(".message.user.queued");
      if (queued) {
        queued.classList.remove("queued");
        queued.querySelector(".message-queue-badge")?.remove();
      }
      resetTurnPointers();
      vscode.postMessage({ type: "send", text: next.text, attachments: next.attachments });
    } finally {
      drainingQueue = false;
    }
  }

  function submit() {
    const text = prompt.value.trim();
    const attachments = Array.from(attachedFiles.values(), ({ uri, name, mimeType, data }) => ({
      uri,
      name,
      ...(mimeType ? { mimeType } : {}),
      ...(data ? { data } : {}),
    }));
    if (!text && attachments.length === 0) return;
    if (state !== "connected" && state !== "running") return;

    const contextNames = attachments.map((attachment) => attachment.name);
    const body = addMessage(
      "user",
      text || "(context only)",
      true,
      contextNames.length ? contextNames : undefined,
    );
    // Tag bubble when queued mid-turn.
    if (state === "running") {
      const article = body?.parentElement;
      if (article) {
        article.classList.add("queued");
        const header = article.querySelector(".message-header");
        if (header && !header.querySelector(".message-queue-badge")) {
          const badge = document.createElement("span");
          badge.className = "message-queue-badge";
          badge.textContent = "Queued";
          header.appendChild(badge);
        }
      }
    }

    prompt.value = "";
    clearAttachments();
    resizePrompt();

    if (state === "running") {
      promptQueue.push({ text, attachments });
      updatePromptQueueUi();
      return;
    }

    resetTurnPointers();
    vscode.postMessage({ type: "send", text, attachments });
  }

  /** Typing `@` at a word boundary opens the context file picker (Cursor-style @ context). */
  function handleContextAtMention() {
    const value = prompt.value;
    const pos = prompt.selectionStart ?? value.length;
    if (pos < 1 || value[pos - 1] !== "@") return false;
    const before = pos >= 2 ? value[pos - 2] : " ";
    if (before && !/\s/.test(before)) return false;
    prompt.value = value.slice(0, pos - 1) + value.slice(pos);
    const nextPos = pos - 1;
    prompt.setSelectionRange(nextPos, nextPos);
    resizePrompt();
    vscode.postMessage({ type: "addContext" });
    return true;
  }

  function resizePrompt() {
    prompt.style.overflowY = "hidden";
    prompt.style.height = "auto";
    const nextHeight = Math.min(prompt.scrollHeight, 180);
    prompt.style.height = `${nextHeight}px`;
    prompt.style.overflowY = prompt.scrollHeight > 180 ? "auto" : "hidden";
  }

  window.addEventListener("message", (message) => {
    if (message.data?.type === "product") {
      applyProduct(message.data);
      return;
    }
    if (message.data?.type === "account_usage") {
      renderAccountUsage(message.data);
      return;
    }
    if (message.data?.type !== "event") return;
    const event = message.data.event;
    switch (event.type) {
      case "state": setState(event.state, event.detail); break;
      case "context": updateContext(event); break;
      case "runtime": updateRuntime(event); break;
      case "session":
        clearPromptQueue(false);
        updateSession(event.sessionId, event.resumed);
        resetTurnPointers();
        tools.clear();
        break;
      case "session_transcript":
        renderSessionTranscript(event.messages);
        break;
      case "clear_conversation":
        clearPromptQueue(false);
        clearConversation(event.reason);
        break;
      case "model_catalog": updateModelCatalog(event); break;
      case "session_config": updateSessionConfig(event); break;
      case "session_modes": updateSessionModes(event); break;
      case "current_mode":
        if (event.currentModeId) setComposerMenuValue(modeState, event.currentModeId, null);
        break;
      case "usage": updateUsage(event); break;
      case "token_usage": updateTokenUsage(event); break;
      case "attachment_added": addAttachment(event); break;
      case "assistant_delta": appendAssistant(event.text, event.messageId); break;
      case "thought_delta": appendThought(event.text, event.messageId); break;
      case "tool": addTool(event); break;
      case "tool_update": updateTool(event); break;
      case "permission_request": addPermission(event); break;
      case "permission_resolved": resolvePermission(event); break;
      case "workspace_edit": addWorkspaceEdit(event); break;
      case "plan": showPlan(event.entries); break;
      case "turn_complete":
        // Final structured render of the full answer (throttled stream used plain MD).
        if (lastAssistant) scheduleNodeRender(lastAssistant, true);
        else flushPendingRenders(true);
        resetTurnPointers();
        break;
      case "diagnostic": addActivityNote(event.message); break;
      case "cli_status":
        if (!event.available) {
          showSetupState("Grok CLI missing", event.detail, "Open settings", "settings");
        }
        break;
      case "error": addMessage("error", event.message); break;
    }
  });

  send.addEventListener("click", submit);
  cancel.addEventListener("click", () => vscode.postMessage({ type: "cancel" }));
  promptQueueClear?.addEventListener("click", () => clearPromptQueue(true));
  workspaceButton.addEventListener("click", () => vscode.postMessage({ type: "openExplorer" }));
  if (openIdeButton) {
    openIdeButton.addEventListener("click", () => switchProductFromUi());
  }
  if (railNewConversation) {
    railNewConversation.addEventListener("click", () => vscode.postMessage({ type: "newSession" }));
  }
  if (railHistory) {
    railHistory.addEventListener("click", () => vscode.postMessage({ type: "sessions" }));
  }
  if (railProjects) {
    railProjects.addEventListener("click", () => vscode.postMessage({ type: "openExplorer" }));
  }
  if (railOpenIde) {
    railOpenIde.addEventListener("click", () => switchProductFromUi());
  }
  if (railSettings) {
    railSettings.addEventListener("click", () => vscode.postMessage({ type: "settings" }));
  }
  filesButton.addEventListener("click", () => vscode.postMessage({ type: "addContext" }));
  filesButton.title = "Add context files or images (@)";
  filesButton.setAttribute("aria-label", "Add context files or images");
  prompt.addEventListener("input", () => {
    handleContextAtMention();
    resizePrompt();
  });
  settingsButton.addEventListener("click", () => vscode.postMessage({ type: "settings" }));
  toolsButton.addEventListener("click", () => vscode.postMessage({ type: "toolsHub" }));
  sessionsButton.addEventListener("click", () => vscode.postMessage({ type: "sessions" }));
  layoutButton.addEventListener("click", () => vscode.postMessage({ type: "layout" }));
  permissionButton.addEventListener("click", () => {
    const open = permissionMenu.classList.contains("hidden");
    setPermissionMenuOpen(open, open);
  });
  permissionButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPermissionMenuOpen(true, true);
    }
  });
  for (const option of permissionMenu.querySelectorAll(".composer-menu-option")) {
    option.addEventListener("click", () => setPermissionMode(option.dataset.value));
    option.addEventListener("keydown", (event) => {
      const options = Array.from(permissionMenu.querySelectorAll(".composer-menu-option"));
      const index = options.indexOf(option);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const offset = event.key === "ArrowDown" ? 1 : -1;
        options[(index + offset + options.length) % options.length].focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        options[event.key === "Home" ? 0 : options.length - 1].focus();
      }
    });
  }
  bindComposerMenu(modelState, (value) => {
    if (modelState.configId) {
      vscode.postMessage({ type: "setSessionConfig", configId: modelState.configId, value });
    } else if (modelState.modelCatalog) {
      vscode.postMessage({ type: "setModel", value });
    }
  });
  bindComposerMenu(effortState, (value) => {
    if (effortState.configId) {
      vscode.postMessage({ type: "setSessionConfig", configId: effortState.configId, value });
    } else {
      vscode.postMessage({ type: "setEffort", value });
    }
  });
  bindComposerMenu(modeState, (value) => {
    vscode.postMessage({ type: "setSessionMode", modeId: value });
  });
  // Seed effort menu immediately so it matches Permission chrome before ACP connects.
  ensureOfflineEffortOptions("");
  setFallbackMenu(modelState, "Default model");
  usageButton.addEventListener("click", () => {
    closeAllComposerMenus();
    const hidden = usagePopover.classList.toggle("hidden");
    usageButton.setAttribute("aria-expanded", String(!hidden));
    if (!hidden && !accountUsageLoaded) vscode.postMessage({ type: "refreshUsage" });
  });
  refreshUsageButton.addEventListener("click", () => vscode.postMessage({ type: "refreshUsage" }));
  manageUsageButton.addEventListener("click", () =>
    vscode.postMessage({ type: "openExternal", value: accountUsageManageUrl }),
  );
  micButton.addEventListener("click", () => {
    if (!recognition) return;
    if (listening) recognition.stop(); else recognition.start();
  });
  emptyConnect.addEventListener("click", () =>
    vscode.postMessage({ type: emptyConnect.dataset.action || "connect" }),
  );
  connectionButton.addEventListener("click", () => {
    const type = state === "workspace_required"
      ? "openFolder"
      : state === "connected" || state === "running"
        ? "disconnect"
        : "connect";
    vscode.postMessage({ type });
  });
  prompt.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!permissionMenu.classList.contains("hidden")) {
        setPermissionMenuOpen(false);
        permissionButton.focus();
        return;
      }
      if (!modelMenu.classList.contains("hidden")) {
        setMenuOpen(modelButton, modelMenu, false);
        modelButton.focus();
        return;
      }
      if (!effortMenu.classList.contains("hidden")) {
        setMenuOpen(effortButton, effortMenu, false);
        effortButton.focus();
        return;
      }
      if (!modeMenu.classList.contains("hidden")) {
        setMenuOpen(modeButton, modeMenu, false);
        modeButton.focus();
        return;
      }
      if (!usagePopover.classList.contains("hidden")) {
        usagePopover.classList.add("hidden");
        usageButton.setAttribute("aria-expanded", "false");
        usageButton.focus();
        return;
      }
    }
    if (permissionCards.size > 0 && /^[1-9]$/.test(event.key)) {
      const card = messages.querySelector(".permission-card:not(.resolved)");
      const button = card?.querySelector(`button[data-hotkey="${event.key}"]`);
      if (button && !button.disabled) {
        event.preventDefault();
        button.click();
      }
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".permission-control")) setPermissionMenuOpen(false);
  });

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  function extForImageMime(mimeType) {
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "image/gif") return "gif";
    if (mimeType === "image/webp") return "webp";
    if (mimeType === "image/bmp") return "bmp";
    return "png";
  }

  function readBlobAsBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read image"));
      reader.readAsDataURL(blob);
    });
  }

  async function attachImageBlob(blob, preferredName) {
    if (!blob || !String(blob.type || "").startsWith("image/")) {
      return false;
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      addActivityNote(`Image exceeds the 5MB attachment limit (${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB) and was skipped.`);
      return false;
    }
    const mimeType = blob.type || "image/png";
    const ext = extForImageMime(mimeType);
    const stamp = Date.now();
    const name = preferredName && preferredName.trim()
      ? preferredName
      : `clipboard-${stamp}.${ext}`;
    try {
      const data = await readBlobAsBase64(blob);
      addAttachment({
        uri: `clipboard://${stamp}-${name.replace(/[^\w.\-]+/g, "_")}`,
        name,
        mimeType,
        data,
      });
      return true;
    } catch (error) {
      addActivityNote(`Could not attach image: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async function attachImagesFromDataTransfer(dataTransfer) {
    if (!dataTransfer) {
      return 0;
    }
    let attached = 0;

    // 1) Clipboard / drag files
    const files = dataTransfer.files ? Array.from(dataTransfer.files) : [];
    for (const file of files) {
      if (file.type && file.type.startsWith("image/")) {
        if (await attachImageBlob(file, file.name || undefined)) {
          attached += 1;
        }
      }
    }
    if (attached > 0) {
      return attached;
    }

    // 2) Clipboard items (screenshots often appear here even when files is empty)
    const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
    for (const item of items) {
      if (item.kind === "file" && item.type && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file && (await attachImageBlob(file, file.name || undefined))) {
          attached += 1;
        }
      }
    }
    return attached;
  }

  // Paste image from clipboard into composer (Ctrl+V / right-click Paste).
  async function handleComposerPaste(event) {
    const dataTransfer = event.clipboardData;
    if (!dataTransfer) {
      return;
    }
    const hasImage =
      (dataTransfer.files && Array.from(dataTransfer.files).some((f) => f.type.startsWith("image/"))) ||
      (dataTransfer.items && Array.from(dataTransfer.items).some((i) => i.type && i.type.startsWith("image/")));
    if (!hasImage) {
      return; // keep normal text paste
    }
    event.preventDefault();
    event.stopPropagation();
    const count = await attachImagesFromDataTransfer(dataTransfer);
    if (count > 0) {
      addActivityNote(count === 1 ? "Image attached from clipboard" : `${count} images attached from clipboard`);
    } else {
      addActivityNote("Clipboard image could not be read. Try Win+Shift+S then Ctrl+V again, or use + to pick a file.");
    }
  }

  prompt.addEventListener("paste", (event) => {
    void handleComposerPaste(event);
  });
  composerCard.addEventListener("paste", (event) => {
    void handleComposerPaste(event);
  });

  // Drag and drop: attach image blobs directly; otherwise fall back to native file picker.
  for (const target of [composerCard, prompt]) {
    target.addEventListener("dragover", (event) => {
      event.preventDefault();
      composerCard.classList.add("drag-over");
    });
    target.addEventListener("dragleave", () => composerCard.classList.remove("drag-over"));
    target.addEventListener("drop", (event) => {
      event.preventDefault();
      composerCard.classList.remove("drag-over");
      void (async () => {
        const count = await attachImagesFromDataTransfer(event.dataTransfer);
        if (count > 0) {
          addActivityNote(count === 1 ? "Image attached from drop" : `${count} images attached from drop`);
          return;
        }
        // Non-image drops: native picker (webview cannot reliably read absolute paths).
        vscode.postMessage({ type: "addContext" });
        addActivityNote("Use the file picker to attach workspace files.");
      })();
    });
  }

  setState("disconnected");
  ensureOfflineEffortOptions("");
  configureMicrophone();
  vscode.postMessage({ type: "ready" });
})();
