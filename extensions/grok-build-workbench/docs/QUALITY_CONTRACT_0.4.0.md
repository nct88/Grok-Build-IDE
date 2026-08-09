# Quality contract — milestone 0.4.0

## User-visible outcomes

- Logo and `Grok Build` share one horizontal baseline; the obsolete `GROK ACP WORKBENCH` eyebrow is absent.
- Permission requests appear inside the conversation with the exact ACP choices supplied by Grok Build.
- Permission mode is selectable from the composer and Settings:
  - `Ask`: every ACP permission request waits for the user.
  - `Auto`: starts Grok Build with its native auto mode; if a request is still surfaced, read/search/think/fetch are approved automatically while edits, execution, deletion, move, and unknown tools still ask.
  - `Full access`: ACP permission requests are approved automatically. Workspace filesystem boundaries remain controlled separately by `allowOutsideWorkspace`.
- Model and reasoning controls use ACP session config options when the agent advertises them. The UI does not invent unavailable model IDs.
- Context usage shows `used / size` tokens and optional ACP cost. Account subscription quota is explicitly identified as unavailable through ACP.
- The microphone button performs speech-to-text only when Web Speech recognition exists and the feature is enabled; otherwise it has an actionable disabled tooltip.
- Tool cards display file locations. Clicking a location opens the native VS Code editor at the reported line.
- File writes and ACP diff content produce a reviewable native VS Code diff. When Grok reports only a location, follow mode opens that file in the editor while preserving chat focus.
- Grok integration settings include executable, arguments, auto-start, permission mode, filesystem scope, model, reasoning, reasoning visibility, follow mode, diff review, tool detail, and voice input.
- The composer keeps a compact single action row at wide sidebar widths, intentionally wraps at narrow widths, anchors the usage popover to its trigger, and never displays Send beside Stop while a turn is running.
- The Layout menu opens Windows Taskbar settings for the system-wide `Never combine` choice; the extension does not silently modify Explorer registry policy.

## Safety and truthfulness invariants

- Agent-provided text is inserted with `textContent`; no agent HTML is rendered.
- Permission choices are matched by ACP option IDs and kinds, never by display labels alone.
- `Full access` does not silently bypass `allowOutsideWorkspace`, Grok deny rules, hooks, or sandbox behavior.
- Subscription quota is not inferred from context-window usage.
- No credentials, transcripts, raw protocol traffic, or private file contents are persisted in project memory.
- Realtime follow is driven by ACP locations/diffs and reverse filesystem writes; the UI does not claim visibility when the agent omits those signals.

## Required verification

- Typecheck, unit tests, production bundle, VSIX contents, and production dependency audit pass.
- Mock ACP fixture covers session config, usage, file location/diff, Ask approval, Auto-safe approval, Full access approval, and cancel cleanup.
- Visual matrix covers 240×720 dark, 390×720 dark/light, 580×975 dark, 600×900 dark, long metadata, permission pending/resolved, tool locations, anchored context usage, running/stop, and unsupported microphone.
- Runtime smoke verifies extension activation and native diff/file opening with the packaged candidate.
