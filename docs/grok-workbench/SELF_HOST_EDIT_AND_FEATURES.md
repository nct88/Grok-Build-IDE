# Self-host edit, sessions layout, voice, extensions

## 1. Sessions on Activity Bar

From extension **0.8.6**, `grokBuild.sessionsView` lives in its own **Activity Bar** container (`grokBuildSessions`, icon history).

- Click the history icon on the **left Activity Bar** to open/collapse Sessions.
- Agent chat stays on the **Secondary Sidebar** (right) under Grok Build.

## 2. Built-in programming tooling

| Layer | What ships today |
|---|---|
| **Built-in language extensions** | ~90 Code-OSS packs: TS/JS, Python, Go, Rust, Java, C/C++, HTML/CSS, JSON, Docker syntax, Emmet, Git, … |
| **Debug** | `ms-vscode.js-debug` (+ companion) via `product.json` `builtInExtensions` |
| **Marketplace “essentials”** | Not auto-downloaded (needs network + trust). See `build/grok/portable-profile/extensions-recommendations.json` for a recommended list (Python, ESLint, Prettier, Rust Analyzer, Go, Docker, …). |

To pre-seed marketplace VSIX into a release, place them under the portable payload `data/extensions/` and register in `extensions.json` (same pattern as Grok Build Workbench).

## 3. Usage quota (was “Context”)

UI label is **Usage** / **Usage quota**: session context-window tokens from ACP `usage_update` (`used / size`). This is **not** account billing quota (ACP does not expose subscription remaining).

## 4. Remember last project folder

Portable + extension defaults:

- `window.restoreWindows`: `preserve`
- `window.openWithoutArgumentsInNewWindow`: `off`
- `files.hotExit`: `onExitAndWindowClose`
- `window.openFoldersInNewWindow`: `off` (Open Folder reuses current window)

## 5. Why the agent asks to close the running IDE (self-host edit)

When the **open workspace is** `grok-code` / `grok-build-ide` **and** the agent tries to:

- rebuild / replace `Grok Workbench.exe`, Electron DLLs, or `resources/app/out/**` of a **running** install;
- rewrite `node_modules` files currently loaded by the same process;
- replace the portable cache the app was launched from;

Windows returns **EBUSY / EPERM / sharing violation**. The agent may then suggest closing the app.

**This is a real OS lock, not a Grok chat bug.**

### Mitigations

1. **Edit source with a separate binary**  
   Run installed/portable Grok Build IDE from `%LocalAppData%\Programs\…` while the workspace is `H:\projects\grok-build-ide` sources.
2. **Do not rebuild the running tree in-session**  
   Change TypeScript/media under `extensions/grok-build-workbench`, then rebuild extension / release **after** closing the target install if you replace its payload.
3. **Avoid “fix the EXE I’m running”**  
   Hotfix `dist/extension.cjs` in the install is OK; overwriting the main Electron EXE while running is not.
4. **Agent policy**  
   Prefer source-only edits; defer packaging steps that touch the live install directory.

## 6. Chat voice

| Claim | Reality |
|---|---|
| Web Speech mic in composer | Depends on `window.SpeechRecognition` in the **webview** |
| Electron / Code-OSS webview | **Almost never** exposes Web Speech (unlike Chrome) |
| Verdict | **Not feasible** for normal desktop use |

**0.8.6 behavior:** `grokBuild.voiceInput` defaults to **false**; mic button is **hidden** unless the setting is on **and** the runtime actually supports recognition. Prefer keyboard / paste.

## 7. Settings clarity

Settings properties use `markdownDescription`, `enumItemLabels`, `enumDescriptions`, `order`, and concrete **Examples** so Settings UI is self-explanatory.
