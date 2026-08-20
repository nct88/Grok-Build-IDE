# Changelog

Public, versioned changes for Grok Build IDE.

## 1.0.11 — 2026-08-20

- Added workspace Grok skills (`/verify-ui`, `/use-mcp`, `/write-fix-log`, `/run-check`), always-on `.grok/rules`, and Chrome DevTools MCP.
- Terminate ACP/CLI/terminal process trees on Windows so grandchild `grok.exe` processes cannot leak across reconnects.
- Tightened portable Git and file-watcher defaults for large workspaces (`restoreWindows=one`, no parent-folder Git, no submodules, exclude `node_modules`/`dist`/`workspaces/req_*`).

## 1.0.10 — 2026-08-18

- Resume sessions with display-safe reasoning summaries, last-turn recap, and CLI 1.0.5 `_meta.reasoningEffort` on `session/new` and `session/load`.
- Add TUI slash commands, local Grok skills, preparing-tool labels, and Codex-style thought titles in the Agent sidebar.
- Enable the Open VSX gallery with direct `grok-build-ide:extension/publisher.name` links and **Install Extension from Link…**.

## 1.0.9 — 2026-08-13

- Enforced Workspace Trust and made reverse-terminal ACP opt-in with explicit security boundaries.
- Added Grok CLI 1.0.3 version detection and an authenticated real-ACP smoke test.
- Replaced the destructive VSIX updater with SHA-256 verification, atomic promotion, transaction backups, automatic recovery and explicit rollback.
- Added isolated Windows install/uninstall lifecycle coverage that cannot modify the production AppId.
- Added source-matching Code OSS base provenance, executable/product hashes, Authenticode signing/timestamp hooks and CI-before-publication gates.
- Added project-owned security, privacy, support and dependency-security documentation.

## 1.0.8 — 2026-08-13

- Rebuilt History as a searchable in-Agent drawer with date groups, active-session state and direct resume, rename, export, delete, refresh and new-conversation actions.
- Enriched the native VS Code History tree with clearer metadata, tooltips and export/delete actions, while removing the redundant two-step session picker.
- Made Desktop-style Usage the primary view by combining context-window progress, cumulative session tokens and account-plan details.
- Moved technical session metadata into a secondary Session details view and added a compact context percentage to the Usage control.
- Expanded responsive visual coverage to eight scenarios for narrow/wide layouts, 150% scale, light/dark themes and history/usage empty and error states.

## 1.0.7 — 2026-08-13

- Added a Grok CLI 1.0.3-style Session info surface with separate Session, Context and Account tabs.
- Derived safe local session metadata from Grok summaries, cumulative usage updates and the model cache, while keeping authentication secrets outside the webview.
- Added title, CLI version, authentication method, Session ID, working directory, model/backend, sandbox, turns, reasoning effort, permission mode and ACP protocol details.
- Added cumulative token/cache/reasoning/model-call/API-time/cost details plus click-to-copy rows and Copy all.
- Added responsive visual regression coverage from 240px through 600px, at 150% scale, in dark/light themes and account-error state.

## 1.0.6 — 2026-08-12

- Added restored user/assistant transcript replay when resuming Grok CLI sessions.
- Kept system scaffolding and synthetic context out of the visible transcript.
- Standardized source startup as `npm install` followed by `npm start`.
- Reduced repository-only Microsoft/AI automation that is not required to build
  or run Grok Build IDE.
- Kept the root ESLint configuration loadable after removing the bundled
  Copilot extension, with a CI regression gate.
- Updated compatible production dependencies to remove all known critical and
  high-severity audit findings.
- Added complete English/Vietnamese README pages with a centered language
  switch and a release-contract parity check.
