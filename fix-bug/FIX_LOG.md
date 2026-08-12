# Fix log

## Unreleased — GitHub preflight security hardening

- Rejected external HTTP(S) links containing embedded usernames or passwords before opening them from the chat webview; account usage redirects now require credential-free HTTPS and fall back to the official Grok usage page.
- Added focused URL-policy and usage-service regression tests while preserving the existing rule that auth tokens stay inside the Extension Host and never appear in webview results or errors.
- Sanitized local Windows usernames and temporary screenshot IDs from durable documentation; ignored local credentials, cookie stores, environment files, and machine-specific .NET packaging intermediates.

## Unreleased — IDE resumed-session transcript parity

- Symptom: resuming a session in Grok Build IDE cleared the chat and displayed “Previous transcript is not replayed”, while Grok Build desktop restored the prior user/assistant conversation.
- Root cause: the IDE completed ACP `session/load` but had no local `chat_history.jsonl` replay event or webview renderer for persisted turns.
- Resolution: reuse the Grok Build transcript rules, exclude system/synthetic scaffolding, unwrap `<user_query>`, broadcast and retain a `session_transcript` event after resume, and rebuild the webview timeline in original user/assistant order. Empty ACP shells now use the same `Untitled chat`/zero-message semantics as Grok Build.
- Affected files: session service, controller, ACP event types, chat webview, and focused regression tests only; layout, controls, usage, tools, branding, and other IDE behavior are unchanged.
- Verification: 13 focused session/controller tests, extension typecheck, complete 72-test/check/build/release-contract suite, and direct dark 240×720 plus light 390×720 transcript renders passed without horizontal overflow or composer movement.

## 1.0.6 — 2026-08-09 — Split white/black Fluffy brand system

- Copied the complete processed Grok Build set plus the user-supplied Fluffy reference, removed all facial features, and created a faceless split white/black Fluffy with centered inverse “grok” lettering.
- Replaced live application branding across Windows ICO/tile art, macOS ICNS, Linux PNG, server favicon, installer wizard art, root SVG, VSIX marketplace/view icon, and chat header/rail.
- Added a reproducible brand generator plus a mandatory release check for source-set completeness, approved-master hash, white/black split coverage, alpha/chroma-key cleanup, size matrix, ICO/ICNS frames, hashes, package references, and removal of the legacy glyph from live UI assets.
- Visual harness now requires the final 128px Fluffy asset to load in every light/dark, 240/390/600px and 150% scenario.
- Published immutable local unsigned candidate `dist/1.0.6` after the 66-test, release-contract, runtime-activation, packaged-icon, installer, and five-scenario visual gates passed.

## 1.0.5 — 2026-08-09 — White Fluffy / black Grok branding

- Copied the original Grok Build processed icon set and produced a white-Fluffy/black-“grok” variant while preserving the source geometry and alpha.
- Synchronized Windows, macOS, Linux, server, installer, VSIX, Activity Bar, rail, and chat branding; added packaged executable icon stamping for releases that reuse an older Electron payload.
- Published immutable local unsigned candidate `dist/1.0.5` before the final split black/white direction was selected.

## 1.0.4 — 2026-08-09 — Usage parity in IDE chat

- Replaced the ACP-only Usage placeholder with a two-part chat popover: session context/last-turn tokens plus Grok account plan usage.
- Added SuperGrok weekly/monthly percentage, reset time, product breakdown, plan, credits, refresh, loading/error states, and a safe Manage Usage action.
- Account tokens stay in the extension host; the webview receives only normalized counters. Remote custom usage endpoints must use HTTPS (localhost HTTP remains available for development).
- Added five account-usage service tests and visual interaction coverage at 240 px, 390 px, 600 px, 150% scale, light/dark, long content, and expired-session error state.
- At 300 px and below, secondary Effort/Mode/Mic controls collapse so Usage and Send remain directly clickable without overlap.
- Published immutable local unsigned candidate `dist/1.0.4`; packaged runtime activation, extraction/cache repair, folder reuse, portable settings, and all release channels passed.

## 1.0.3 — 2026-08-08 — P1 startup stability

- Fresh installs now start in the **Grok Build IDE** surface; the agent-desktop layout remains an explicit opt-in and an existing saved choice is preserved.
- The chat webview derives its initial product class, title, and rail identity from the layout service, removing the wrong-product first-frame flash.
- Removed `files.hotExit` from extension `configurationDefaults`, where Code-OSS rejects its scope; the same value remains in the portable user profile where it is valid.
- Added three regression tests for fresh-install defaults, portable hot-exit behavior, and pre-persisted-state fallbacks.
- Verified 61 tests, four responsive/150% visual scenarios, packaged extension activation, portable extraction/cache repair, folder-window reuse, and absence of the prior runtime warning.
- Published immutable local unsigned candidate `dist/1.0.3` with portable EXE, portable ZIP, Inno installer, VSIX update, and relative release metadata.

## 1.0.2 — 2026-08-08 — P0 release hardening

- Unified visible product identity, executable, portable, installer, and manifest names as **Grok Build IDE**.
- Fixed webview viewport ownership so the composer remains docked at 240 px, 390 px, 600 px, and 150% DPI.
- Added a mandatory four-scenario visual gate to the extension `check` command.
- Replaced fixed-drive and stale 0.3.x release assumptions with local candidate discovery and a canonical `build/grok/VERSION`.
- Release versions are immutable; the publisher never prunes old releases and aborts on missing portable, installer, zip, or VSIX artifacts.
- Manifests now use relative paths. Public publishing requires HTTPS plus valid Authenticode signatures; local output is marked `local-unsigned-candidate`.
- Verified single-file extraction/cache repair, extension registry, portable settings, packaged runtime, folder reuse, Inno install, and launch.

## 1.0.0 — 2026-08-05 — Dual products: Grok Build ↔ Grok Build IDE

- Product home: `H:\projects\Grok-Build`; `ide` junction → this repo; app identity **Grok Build 1.0**.
- **Two product surfaces** (Antigravity-style):
  - **Grok Build** (`grok-build`): agent desktop — left rail (New Conversation / History / Projects), masthead **Open Grok Build IDE**, conversation-first chrome.
  - **Grok Build IDE** (`grok-build-ide`): Explorer/editor-first; compact agent panel; **Open Grok Build** to return.
- Status bar: current product + one-click switch. Commands: `openGrokBuild`, `openGrokBuildIde`, toggle. Setting `grokBuild.defaultProduct`.
- Still **one binary** + shared ACP agent; dual installers optional later (`docs/PRODUCTS.md`).
- Extension **1.0.0** — rebuild `dist/extension.cjs`; reload window.

## 0.8.16 — 2026-08-04 — Chat stays open while turn runs (queue follow-ups)

- Symptom: Unlike Grok CLI, IDE locked the composer (`prompt`/`send` disabled) for the whole `running` turn so users could not type or send follow-ups.
- Cause: webview treated `running` as hard busy; client rejects concurrent `session/prompt`.
- Fix: keep composer editable + Send visible while working; **queue** follow-up messages (badge + queue bar); auto-send next when turn returns to `connected`; Stop still cancels current turn; Clear queue control.
- Extension **0.8.16**. Restart IDE.

## 0.8.15 — 2026-08-04 — Model/Effort dropdowns match Permission menu chrome

- Symptom: Model and Effort used native `<select>` (OS chrome) while Permission Mode used custom composer menu — mismatched look/context.
- Fix: Model, Effort, and Agent Mode use the same **composer-menu** pattern (icon + label + chevron + floating listbox); Permission keeps warning accent; only one menu open at a time.
- Extension **0.8.15**. Restart IDE.

## 0.8.14 — 2026-08-04 — Send icon center, Usage spacing, cSpell/Error Lens noise

- Composer: re-center Send arrow (Lucide arrow-up + flex center on 32px circle); add gap/`margin-right` so Usage is not flush against Send.
- Spell/preview noise: `cSpell.diagnosticLevel=Hint`; Error Lens excludes cSpell (removes inline “square” labels); ignore Vietnamese diacritic runs; install **code-spell-checker-vietnamese**; `cSpell.language=en,vi` in user settings.
- Extension **0.8.14** + portable profile settings updated. Restart IDE.

## 0.8.13 — 2026-08-04 — Window "Not Responding" near turn results

- Symptom: Windows marks Grok Build IDE **Not Responding** near the final answer, then it recovers.
- Causes: (1) full Markdown/structured re-parse of a large assistant buffer on every stream chunk; (2) opening many pinned diff/file tabs back-to-back on the UI thread at end of turn.
- Fix: throttle stream renders (gap scales with size); cheap markdown while streaming, structured cards on `turn_complete`; queue + yield between auto-opened editors; cap with `grokBuild.maxAutoOpenEdits` (default **6**, rest via Review button).
- Extension **0.8.13**. Restart required.

## 0.8.12 — 2026-08-04 — Agent edit/review opens separate editor tabs

- Symptom: Agent file follows and Grok diffs reused one **preview** tab (`preview: true`), so each new file overwrote the previous review instead of stacking tabs like VS Code.
- Fix: default **pinned tabs** (`preview: false`) for `vscode.diff` and `showTextDocument` follow; unique snapshot URI paths per changeId; setting `grokBuild.openEditsInPreview` (default **false**) to restore single-preview behavior if desired.
- Extension **0.8.12**. Restart IDE. Tip: keep `openDiffOnEdit` on; leave `openEditsInPreview` off for multi-tab review.

## 0.3.13d — 2026-08-04 — Ghost extension registry (Unable to read package.json)

- Symptom: Many errors like `Unable to read file '…\ms-python.debugpy-…\package.json' (nonexistent file)` for GitHub/Python/ESLint/etc.
- Cause: `extensions.json` still listed extensions after their **folders were deleted** (only Grok Workbench folder remained). Registry pointed at missing paths.
- Fix now: pruned registry to **1** valid entry (Grok Workbench 0.8.11). `apply-update.ps1` now **drops** registry rows whose `package.json` is missing. `repair-portable-extensions-registry.ps1` only registers folders that still exist.
- Note: marketplace extensions (Python, GitHub PR, …) must be **reinstalled** if still needed — files are gone, not just unregistered.

## 0.3.13c — 2026-08-04 — apply-update wiped extensions.json (GitHub reinstall loop)

- Symptom: Every IDE launch asked to install **GitHub Pull Requests** (and other workspace recommendations) even after successful install.
- Root cause: `dist/*/update/apply-update.ps1` rewrote `data/extensions/extensions.json` to a **single** entry (Grok Workbench only). Extension folders (GitHub, Python, ESLint, …) remained on disk but were unregistered, so VS Code treated them as missing.
- Fix:
  1. **Immediate repair:** rebuild registry from folders — `scripts/repair-portable-extensions-registry.ps1` (ran on this machine: **10** extensions restored including `GitHub.vscode-pull-request-github`).
  2. **apply-update.ps1** now **merges** the Grok entry and **recovers** unregistered folders; never wipes other extensions.
  3. Template: `scripts/templates/apply-update.ps1`; Publish-ToDist copies it into each update pack.
- User action: **Restart Grok Build IDE**. If prompt returns after a future bad update, re-run the repair script.

## 0.8.11 — 2026-08-04 — Chat stream UX redesign (avatars, Thinking, tools, @ context, Usage split)

- Symptom: Chat still felt like the old Codex-style stream (plain labels, “Reasoning activity”, monochrome tools, Context/Usage mixed, no @ context).
- Fix (media + HTML):
  - Message headers with **avatars** (Y / G / !) + role labels
  - Thinking collapsible labeled **Thinking** (brain icon); removed “Reasoning activity”
  - Tool cards: status-colored left border + status pills (pending / in progress / completed / failed / cancelled)
  - Assistant body via `setStructuredContent` (Markdown + **code cards** with language header)
  - Composer context: attachment chips show `@file`; typing **`@`** at word boundary opens file picker (same as `+`)
  - User stream shows context chips instead of “Attached: …” text dump
  - Usage popover splits **Session context** vs **Account** (account N/A via API/ACP)
  - Activity notes as centered pills; hint updated for @ / paste
- Verification: typecheck; **58** Vitest; production esbuild; visual harness evidence `test/visual/evidence/0.8.11/` (dark 240/600, light 390 — avatars, Thinking, tool status, code cards, no overflow).
- Applied to installed IDE as extension **0.8.11**. Restart required.

## 0.8.10 — 2026-08-04 — Rename session titles in Sessions tree

- Symptom: Session titles were auto-derived from first user message / summary, but users could not rename them in the UI.
- Fix: command `grokBuild.renameSession` (context menu **Rename Session…**, inline edit icon, **F2** on a session item). Writes `generated_title` into the session `summary.json` under `~/.grok/sessions` (takes precedence on next list refresh). Max 200 characters; empty rejected.
- Files: `sessionService.ts` (`setSessionGeneratedTitle`, `findSessionDirectory`), `sessionTreeProvider.ts` helpers, `extension.ts`, `package.json` menus/keybindings.
- Verification: typecheck; **57** Vitest tests (incl. rename write/list/reject); production bundle; VSIX 0.8.10 applied to installed IDE.
- Restart Grok Build IDE required. Usage: open **Grok Sessions** → select session → **F2** or right-click → **Rename Session…**.

## 0.3.13 — 2026-08-04 — Dist channels, retention, Grok-only memory, project ops layout

- **Active source only:** `H:\projects\grok-build-ide`. `H:\projects\grok-code` is backup.
- **Local memory (Grok-only):** `H:\projects\.grok-build` (policies, FIX_LOG mirror, logs) — isolated from Codex/Claude.
- **Dist (inside project):** `H:\projects\grok-build-ide\dist\<version>\{portable,install,update}` + `latest.json`.
- **Retention:** keep 2 newest dist versions (`Invoke-Retention.ps1`).
- **Update channel:** VSIX + `apply-update.ps1` for extension-only fixes without full reinstall.
- **Ops scripts:** `scripts/grok-release/*` (clean, publish, build-and-publish).
- **Tree tidy:** investigation notes were separated from Code-OSS `src/` / `extensions/` architecture and later removed from the published source tree.

## 0.3.13b — 2026-08-04 — Dist path moved into project tree

- Relocate published artifacts from `H:\projects\grok-build-dist` → `H:\projects\grok-build-ide\dist`.
- Default `DistRoot` in release scripts = `<project>/dist`.

## 0.8.9 — 2026-08-04 — Session tree titles from first user message

- Symptom: Sessions list often showed truncated session IDs when `generated_title` was empty.
- Fix: `listLocalSessions` title order = `generated_title` → `session_summary` → first real prompt from `chat_history.jsonl` (`<user_query>` preferred) → short id.
- Extension **0.8.9**.

## 0.8.8 — 2026-08-04 — Clipboard image paste + image drop in chat

- Symptom: Paste image from clipboard (screenshot / Ctrl+V) did nothing in the Agent composer.
- Root cause: docs claimed paste support, but `media/main.js` never registered a `paste` handler; drop only opened the file picker.
- Fix: `paste` on prompt/composer reads `clipboardData` image items/files → base64 → attachment chips (5MB cap); drop attaches image blobs the same way; non-image drop still uses native picker.
- Hint text updated. Extension **0.8.8**.

## 0.8.7 — 2026-08-04 — Sessions default on Activity Bar (real fix)

- Symptom: Sessions still stacked under Agent chat after 0.8.6; contribution was correct but (1) Activity Bar container used invalid codicon `$(history)` instead of an SVG file, (2) VS Code remembered old view location for id `grokBuild.sessionsView` under secondary sidebar.
- Fix: Activity Bar icon `logo/sessions.svg`; rename view id → `grokBuild.sessions` (new default location); one-time `workbench.view.extension.grokBuildSessions` on activate.
- Applied to installed IDE as extension **0.8.7**. Restart required. If a ghost Sessions strip remains under chat: Command Palette → `View: Reset View Locations`.

## 0.8.6-clean — 2026-08-04 — Rebuild extension + apply update to installed IDE

- Re-ran typecheck / 51 tests / esbuild / VSIX after removing invalid `window.restoreWindows` from extension `configurationDefaults`.
- Refreshed `dist/0.3.13/update` VSIX and payload extension tree.
- Applied update to `%LOCALAPPDATA%\Programs\Grok Build IDE` → extension **0.8.6** only (removed older 0.8.4/0.8.5 folders).
- Verify: no `restoreWindows` in installed package.json; `grokBuildSessions` activity bar present; Usage labels in media.

## 0.8.6 — 2026-08-04 — Sessions activity bar, usage quota, restore folders, settings hints, voice default off

- Sessions TreeView moved to its own **Activity Bar** container (`grokBuildSessions` / history icon); Agent chat stays secondary sidebar.
- UI label **Context** → **Usage quota** (session ACP token window; not billing).
- Portable + configurationDefaults: `window.restoreWindows=preserve`, `openWithoutArgumentsInNewWindow=off`, `files.hotExit=onExitAndWindowClose` so last project folders reopen.
- Settings: markdown descriptions, enum labels/descriptions, examples, order.
- Voice: default `voiceInput=false`; mic hidden unless runtime has Web Speech (Electron: not feasible in practice).
- Docs: `docs/grok-workbench/SELF_HOST_EDIT_AND_FEATURES.md` (self-host file locks, built-in vs marketplace extensions).
- Recommendations list: `build/grok/portable-profile/extensions-recommendations.json`.

## 0.3.12-hotfix — 2026-08-04 — Black screen: missing preload + incomplete undici

- Symptom: Installed Grok Build IDE opened to a pure black window; later workbench chrome appeared but extension host crashed in a loop.
- Root cause A: payload `resources/app/out` only had 57 files; missing `vs/base/parts/sandbox/electron-browser/preload.js` prevented BrowserWindow bootstrap.
- Root cause B: `node_modules/undici` was truncated (116 vs 118 files) so extension host failed with `Cannot find module './lib/web/websocket/stream/websocketstream'`.
- Root cause C: git extension missing `@vscode/fs-copyfile`; `extensions.json` still pointed at absolute build-machine path.
- Fix: restore missing `out/` files and complete `undici` (+ incomplete packages) from known-good release `grok-code/releases/0.3.1`; restore git `node_modules`; rewrite portable registry `location` to install path; payload builder now guards preload + undici and never uses ConvertTo-Json for product.json.
- Verification: renderer + exthost logs present; extension host no longer exits code 1; `Grok Build Workbench.log` created; screenshot shows welcome UI.

## 0.3.12 — 2026-08-04 — Correct Gemini over-claims; rebrand into payload; sync trees

- Symptom: Gemini audit claimed full “Grok Build IDE” rebrand, AI ghost-text, 5MB attachment limit, and 20/20 real commands; shipped 0.3.11 still showed Grok Workbench window identity and used a hard-coded inline stub.
- Fix 1: Complete source `product.json` leftovers (`urlProtocol`, `linuxIconName`, `darwinBundleIdentifier`, `agentsTelemetryAppName`).
- Fix 2: Payload builder now patches `resources/app/product.json` identity fields from source after copying the Electron base candidate (EXE file name remains `Grok Workbench.exe` because the portable launcher hardcodes it).
- Fix 3: Inline completion gated behind `grokBuild.localSnippetCompletions` (default **false**); documented as non-AI local snippets only.
- Fix 4: Enforce 5MB max for image attachments in `chatViewProvider.ts` before base64 encode.
- Fix 5: Contribute `grokBuild.loadSessionFromTree` / `grokBuild.refreshSessionsTree`; refresh on Sessions view title.
- Fix 6: Repair extension vitest deps (`@vitest/utils`); extension version **0.8.5**.
- Fix 7: Sync extension sources to `H:\projects\grok-code` (product brand kept separate on code tree).
- Verification target: typecheck, 51 tests, production bundle, release 0.3.12 payload product nameShort/nameLong = Grok Build / Grok Build IDE.

## 0.3.11 — 2026-08-04 — Full backlog resolution: Windows terminal spawn, webview RAF batching, full Code-OSS tree sync

- Symptom 1: Grok Build Workbench terminal tool calls failed on Windows when `command` contained full command lines without separate `args`.
- Fix 1: Restored `resolveTerminalSpawn` and child `error` listener in `terminalHost.ts` so Windows commands execute via `cmd.exe /d /s /c`.
- Symptom 2: Heavy streaming or large tool responses froze the Electron renderer window ("CodeWindow detected unresponsive").
- Fix 2: Added `requestAnimationFrame` batching (`flushPendingRenders` / `scheduleNodeRender`) and 5MB image attachment limit in `main.js` to eliminate synchronous DOM thrashing.
- Symptom 3: `grok-build-ide` was missing Code - OSS source tree files (`src/`, `build/`, `test/`, `resources/`).
- Fix 3: Executed full tree sync via `bootstrap-copy-from-grok-code.ps1` (copied 15,985 files / 2.989 GB) and generated selfhost extension stubs via `compile-workspace-extensions.ps1`.
- Verification: Vitest suite 13 files, 51/51 tests passed; TypeScript typecheck 0 errors; production bundle built cleanly via esbuild.

## 0.3.10 — 2026-08-04 — Agent shell tools failed with spawn ENOENT in chat

- Symptom: while chatting in Grok Workbench IDE 0.3.9, reverse-terminal tool calls failed with `spawn … ENOENT`, so the agent could not run builds or even simple shell probes.
- Root cause: the embedded Grok Build Workbench 0.8.3 reverse terminal host spawned `request.command` with `shell: false` while Grok ACP supplied full command lines without separate `args`.
- Resolution: ship extension 0.8.4, which wraps bare command lines through `cmd.exe /d /s /c` on Windows (and `/bin/sh -c` elsewhere) and records spawn errors as terminal exit status.
- Affected artifact target: `Grok-Workbench-IDE-0.3.10-win32-x64-portable.exe` with extension 0.8.4.
- Immediate workaround without a full rebuild: rebuild `extensions/grok-build-workbench` and replace `dist/extension.cjs` in the 0.3.9 per-user portable cache under `%LOCALAPPDATA%\Grok Workbench Portable\0.3.9\…\local-grok-workbench.grok-build-workbench-0.8.3\dist\`, then reload the window.

## 0.3.9 — 2026-08-03 — Shared profile read fixed against the real generated portfolio grammar

- Symptom and origin: an ACP Read location under `H:\projects\.codex-shared\project-profiles` was treated as outside the workspace by automatic editor follow, and reverse filesystem reads had no narrow portfolio exception.
- Resolution: allow read-only access only to a direct current-project profile whose real path, portfolio index, size, and portable-path mapping verify against an open workspace; accept the generator's explanatory suffix after the portable-path code span. Keep write/review paths workspace-scoped and make optional editor following non-fatal to the tool event.
- Exact-path gate: bundled policy with workspace `H:\projects\youtube-cinema-gold` returned `currentProfileRead: true`, `currentProfileWrite: false`, and `otherProfileRead: false` for `grok-code.md`.
- Security gates: workspace files remain readable/writable; another project profile, arbitrary shared files, malformed/mismatched profiles, and writes to a valid external profile remain denied by default. The existing explicit trusted override is unchanged.
- Verification: extension typecheck, 45/45 tests, production bundle, packaged-regex audit, VSIX audit, candidate and archived artifact checksum equality, exact archived EXE extraction/cache repair, registry/settings, relocated runtime, seven processes, extension 0.8.3 activation, and one-window folder reuse passed.
- Acceptance boundary: the exact authenticated Grok prompt shown by the user was not replayed automatically; retrying it in IDE 0.3.9 remains the final user acceptance check.

## 0.3.8 — 2026-08-03 — Invalidated candidate: simulated profile passed while the real generated profile failed

- Symptom: reading `H:\projects\.codex-shared\project-profiles\youtube-cinema-gold.md` produced `Grok Build location is outside the open workspace`, and the tool row failed while the workspace itself was valid.
- Root cause: the optional editor-follow path asserted that every announced file location must be inside the open workspace before entering its non-fatal open-file block. The reverse ACP filesystem also used one undifferentiated boundary for reads and writes, so it could not express the portfolio's narrow read-only metadata requirement.
- Attempted resolution: introduced a shared path policy and tests using a profile line that ended immediately after the portable-path code span.
- Post-package contradiction: direct execution of the bundled policy against the real `youtube-cinema-gold.md` returned `currentProfileRead: false`. The generator appends ` (tương đối từ .codex-shared)`, which the anchored parser did not accept.
- Disposition: IDE 0.3.8 and extension 0.8.2 are retained with checksums but explicitly marked `invalidated`; they must not be distributed. The corrected parser and real-path gate move to 0.3.9/0.8.3.
- Security invariants: another project's profile, arbitrary `.codex-shared` files, malformed/mismatched profiles, and all external writes remain denied by default; the existing explicit trusted override remains unchanged.
- Verification lesson: source tests, packaging, activation, and launcher checks were insufficient because the fixture did not match the generated profile grammar. A direct gate against the real resolved portfolio paths is required before release.

## 0.3.7 — 2026-08-03 — Composer shell was bottom-docked while the visible input remained too high

- Symptom: Grok Workbench IDE 0.3.6 showed the visible composer near the middle of the sidebar with a large unexplained blank region below it, despite the release record saying it was docked.
- Root cause: `.app` used six explicit Grid rows while a hidden `planDock` was removed from layout. Auto-placement put messages in an `auto` row and the composer shell in the `1fr` row; the shell filled the remaining height but its visible card stayed at the shell's top. The regression assertion measured only the shell bottom.
- Resolution: use a column flex layout so messages alone absorb free height and the composer remains intrinsic-sized; measure the visible `.composer-card`, shell height, and bottom gap in both the responsive harness and the packaged webview.
- Invariants: only the conversation region grows/scrolls; plan visibility must not alter composer docking; the visible card bottom gap is at most 48 px and the empty composer shell is at most 180 px tall.
- Regression gate: extension typecheck/tests/build and three responsive renders must pass; then the exact 0.3.7 EXE must expose packaged card geometry through CDP and produce a full-window screenshot with no contradictory blank region.
- Historical correction: the earlier composer verification result was marked invalid and was not retained as a release claim.
- Icon follow-up: replaced font-dependent Unicode controls with a centralized Lucide-style SVG registry after inspecting the locally installed Codex `app.asar`; responsive visual gates now reject unhydrated icons, non-24×24/currentColor SVG, and the former raw glyph set.

## 0.3.5 — 2026-08-03 — Release pipeline was pinned to 0.3.4 and could not rebuild safely

- Symptom: changing only `-Version` left the payload, extension artifact, verification expectations, and packaging metadata pinned to 0.3.4/0.6.0; retrying 0.3.5 also collided with an existing candidate directory.
- Root cause: version-dependent paths were duplicated as defaults across multiple PowerShell scripts, and there was no single command that ordered source, package, structural, and runtime gates.
- Resolution: require or infer semantic versions, isolate candidate output under `.build/release-candidates/<version>`, derive payload paths, add one release orchestrator, and package the already-prepublished VSIX without requiring an ambient `npm` command.
- Invariants: released versions are never overwritten; source candidates remain under `.build`; extension tests precede packaging; runtime activation and one-window folder reuse must pass on the exact final EXE.
- Affected artifact: `Grok-Workbench-IDE-0.3.5-win32-x64-portable.exe` with Grok Build Workbench 0.7.0.
- Verification: build/src typechecks, 36/36 extension tests, production bundle, VSIX audit, registry/settings checks, extraction/cache repair, seven-process relocated runtime, extension activation, and one-window folder reuse passed.

## 0.3.4 — 2026-08-02 — Open Folder created a redundant second window

- Symptom: selecting Open Folder from an empty Grok Workbench window left that empty window open and launched the chosen project in a second window.
- Root cause: the portable profile explicitly set `window.openFoldersInNewWindow` to `on`; the same release also exposed a misleading `+` composer control that only reopened Explorer.
- Resolution: set the portable folder policy to `off`, make the profile a reproducible checked build input, add a runtime one-window regression gate, and embed Grok Build Workbench 0.6.0 with real ACP file attachments and an audited composer control path.
- Invariants: launching Grok Workbench without arguments can still create/focus an empty application window; Workspace Trust remains disabled only in the portable profile; folder selection must replace the current empty window.
- Affected artifact: `Grok-Workbench-IDE-0.3.4-win32-x64-portable.exe`.

## 0.3.3 — 2026-08-02 — Completion summaries were separated from the latest task activity

- Symptom: the Grok sidebar could place final completion text in an earlier assistant card above later reasoning, plan, tool, and edit cards.
- Root cause: the bundled 0.5.0 webview reused an assistant node by message ID without checking whether that node was still the chronological tail.
- Resolution: consolidate Grok Build Workbench source under `extensions/grok-build-workbench`, embed extension 0.5.1, and segment assistant output after intervening activity while preserving intentional reader scroll position.
- Affected artifact: `Grok-Workbench-IDE-0.3.3-win32-x64-portable.exe`.
- Regression gate: extension typecheck/tests/build, chronological browser harness inspection, responsive dark/light renders, portable extension registry validation, single-EXE extraction/cache repair, relocated runtime launch, and extension-host activation must pass.

## 0.3.2 — 2026-08-02 — Portable release required manual ZIP extraction

- Symptom: the verified portable build was distributed as a ZIP, so users had to extract the complete Electron directory before launching `Grok Workbench.exe`.
- Root cause: Electron requires its DLL and resource tree on disk, while the release pipeline exposed that tree directly instead of wrapping it in a bootstrap executable.
- Resolution: add a self-contained Windows x64 launcher that embeds the verified 0.3.1 ZIP, safely extracts it to a versioned per-user cache on first run, validates critical files, reuses the cache on later runs, forwards application arguments, and shows bootstrap failures in a native error dialog.
- Affected artifact: `Grok-Workbench-IDE-0.3.2-win32-x64-portable.exe`; the immutable embedded payload remains the verified 0.3.1 ZIP with SHA-256 `2C26192B3BFBF818D3ACD37639FB3A1D6210091E5F45ADDEC1AA63F479EE6EB2`.
- Regression gate: single-file publish output, clean extraction, cached second launch, portable extension registry validation, relocated-path runtime launch, branded CDP target, and Grok extension-host activation must all pass.
- Verification: the 249,645,525-byte EXE launched from a relocated path containing spaces, returned launcher exit code 0, exposed `Grok Workbench IDE (Unofficial)` through CDP, ran seven payload processes, and logged activation of `local-grok-workbench.grok-build-workbench` through `onStartupFinished`.

## 0.3.1 — 2026-08-02 — Opening a project left the Grok sidebar empty

- Symptom: after opening a folder, the right sidebar showed “Drag a view here to display” and no Grok Build chat or Activity Bar container.
- Root cause: portable 0.3.0 wrote an extension registry entry with `relativeLocation` but omitted the schema-required `location` URI. Code OSS rejected the complete `extensions.json` file before resolving the relative path.
- Resolution: retain a valid `location` URI for schema compatibility and a `relativeLocation` for portable relocation.
- Affected artifact: Grok Workbench IDE portable 0.3.1; Grok Build Workbench remains version 0.5.0.
- Regression gate: `scripts/verify-portable-extension-registry.ps1` must pass, runtime logs must activate `local-grok-workbench.grok-build-workbench`, and the packaged app must visibly render the GROK BUILD view after opening a project.
- Verification: 0.3.0 logs reproduced `Invalid extensions content`; 0.3.1 extension-host logs showed activation through `onStartupFinished`/`onView:grokBuild.chat`, and the live 1440×900 application rendered the connected chat view.

## 0.3.0 — 2026-08-02 — Project windows remained grouped and new folders opened Restricted Mode

- Symptom: multiple Grok project windows appeared under one combined taskbar entry, and every new folder required a Workspace Trust confirmation before Grok chat could activate.
- Root cause: the distribution used one process-level AppUserModelID for all BrowserWindows and inherited Code OSS Workspace Trust defaults.
- Resolution: assign a process-and-window-specific AppUserModelID when each BrowserWindow is created and shown; ship a portable-only user setting that disables Workspace Trust and opens folders in new windows.
- Scope: VSIX installs in regular VS Code retain normal Workspace Trust. Only the Grok Workbench portable profile trusts folders by default.
- Verification: two packaged-app project windows rendered as separate taskbar buttons; a new test folder opened without the Restricted Mode banner; the portable extension reports 0.5.0.

## 0.2.0 — 2026-08-02 — Grok controls, edit review, composer alignment, and taskbar guidance

- Symptom: the 0.1.0 portable shell embedded the earlier Grok extension, lacked inline permission/model/usage controls and native edit review, and same-app windows followed Windows' default combined taskbar behavior without an in-app route to the relevant setting.
- Resolution: embed Grok Build Workbench 0.4.0, add Ask/Auto/Full permission handling, real CLI model discovery, ACP context/session controls, editor follow/diff review, a responsive compact composer, and a Layout action that opens Windows Taskbar settings.
- Boundary: Grok Workbench keeps a distinct application identity from VS Code. Separating every window of the same Grok application remains the Windows system-wide **Never combine** choice; the app does not modify Explorer Registry policy silently.
- Verification: extension reports 0.4.0 in the portable profile; extension typecheck and 22/22 tests pass; composer visual QA passes at 240×720, 390×720, and 580×975 with no horizontal overflow.

## 0.1.0 — 2026-08-02

Target: Grok Workbench IDE 0.1.0 / Grok Build Workbench 0.3.1

### Startup and extension loading

- Symptom: the workbench crashed without `defaultChatAgent`, and a later run showed an empty Grok container.
- Root cause: the current workbench runtime dereferenced the product agent descriptor; separately, a bootstrap VSIX reinstall temporarily removed the already-scanned portable extension directory.
- Resolution: supply a dormant Grok descriptor required by the runtime and use one preinstalled portable extension source without the concurrent bootstrap reinstall.
- Affected files: `product.json`, packaged `resources/app/product.json`, `data/extensions`.
- Verification: clean and relocated launches activated `local-grok-workbench.grok-build-workbench` without extension-host load errors.

### Grok-first startup and CLI discovery

- Symptom: the secondary sidebar header appeared with no agent body, and GUI launches could miss `grok.exe` despite a valid user installation.
- Root cause: the view container was revealed before its provider loaded; GUI `PATH` inheritance did not guarantee `%USERPROFILE%\.grok\bin`.
- Resolution: reveal `workbench.view.extension.grokBuild` after provider registration and resolve the standard Windows Grok install path as a fallback.
- Affected files: `src/extension.ts`, `src/vscode/executablePath.ts`, extension 0.3.1 bundle.
- Verification: 13/13 extension tests passed; packaged UI showed `ACP session ready`, spawned `grok.exe agent stdio`, and returned `POC_OK` through the composer.

### Product identity and update isolation

- Symptom: the renamed runtime expected a missing tunnel binary and retained inherited VSCodium updater endpoints.
- Root cause: product renaming changed expected binary names while the fallback runtime retained its original distribution metadata.
- Resolution: add the branded tunnel filename and metadata, remove inherited update/download endpoints, and remove duplicate VSCodium launchers from the release bundle while preserving licenses.
- Affected files: packaged `bin/grok-workbench-tunnel.exe`, packaged `resources/app/product.json`, release notices.
- Verification: final clean and relocated launches succeeded; the ZIP contains only the Grok launcher and retains upstream license/notice files.
# 0.3.6 — 2026-08-03 — Grok chat layout and CLI controls needed a complete UI pass

- Symptom: the Grok composer was not reliably docked to the bottom, the permission popup was unreadable in dark mode, and assistant Markdown appeared as source notation instead of readable content.
- Root cause: viewport layout and visual regression coverage were incomplete; native Windows select theming was outside CSS control; CLI management paths contained untested argument and confirmation edge cases.
- Fix: ship Grok Build Workbench 0.8.0 with viewport docking, an accessible themed listbox, Codex-like safe Markdown, repaired visual gates, voice-error deduplication, and corrected worktree/sandbox/MCP/plugin/memory paths.
- Audit completed for UI wiring and Grok CLI 0.2.118 parity/limitations.
- Verification: extension typecheck, 39/39 tests, production bundle, responsive UI checks, plus final portable extraction/runtime gates.
- Affected artifact: `Grok-Workbench-IDE-0.3.6-win32-x64-portable.exe` with Grok Build Workbench 0.8.0.

## Unreleased — 2026-08-09 — Generated visual evidence was tracked in Git

- Symptom: each Grok Build Workbench visual verification could rewrite versioned PNG output already committed under `test/visual/evidence`, creating repository churn.
- Root cause: the generated verification destination was not declared in the repository `.gitignore`.
- Resolution: ignore the visual evidence output directory and remove the 95 existing generated PNG files from Git tracking while preserving their local copies; extension-local `.vsix` packages were already covered by the extension's own ignore rule.
- Preserved inputs: Code-OSS source/layout, report screenshots, visual test harness/scenarios, and Copilot simulation SQLite fixtures remain tracked because they are source, documented evidence, or deterministic test inputs.
- Verification: `git check-ignore`, tracked-file audit, `git diff --check`, Grok Build Workbench `npm run check`, and dirty-session source hash comparison.
