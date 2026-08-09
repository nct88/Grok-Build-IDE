# Grok Workbench 0.3.7 icon audit

Date: 2026-08-03

## Direct observations

- The installed Windows Codex package was inspected locally at `OpenAI.Codex_26.727.6591.0_x64__2p2nqsd0c76g0`.
- Its `resources/app.asar` contains `webview/assets/createLucideIcon-BrIFp4GW-p56MOOns.js` and thousands of per-icon modules such as `menu`, `shield-check`, `chevron-down`, `gauge`, `mic`, and `triangle-alert`.
- The observed factory creates inline SVG with a `0 0 24 24` view box, no fill, `currentColor` stroke, stroke width 2, and rounded line caps/joins.
- This is direct evidence that these Codex controls use vector Lucide components rather than operating-system emoji glyphs. The unrelated `emoji-regex` package found under a device dependency does not establish that Codex uses emoji as its control icon system.

## Grok finding

The Grok webview mixed text glyphs and emoji (`☰`, `●`, `■`, `▣`, `↔`, `⌄`, `◇`, `↯`, `◫`, `◔`, `🎙`, `↑`, `◆`, `⚙`, `✎`, `⌕`, `⚠`, and `×`). Their weight, baseline, color rendering, and fallback font varied by Windows/font/theme, so they could not form a coherent UI icon system.

## Implemented contract

- One local SVG registry now supplies navigation, connection, workspace, layout, permission, model, reasoning, agent mode, usage, microphone, send/stop, tool-kind, warning, and attachment controls.
- Icons follow the measured Lucide geometry contract and inherit VS Code theme color through `currentColor`.
- Text labels and ARIA names remain the source of meaning; decorative SVG is hidden from assistive technology.
- The extension records the Lucide ISC notice in `THIRD_PARTY_NOTICES.md`.

## Regression gates

- Every `data-icon` placeholder must hydrate to SVG.
- Every UI SVG must keep `viewBox="0 0 24 24"`, `fill="none"`, and `stroke="currentColor"`.
- The former raw Unicode glyph set is forbidden in rendered controls.
- Responsive visual evidence covers 240×720 at 100%, 390×720 at 125%, and 600×900 at 150% in dark/light and active/menu states.

## Scope

The result adopts the same open vector-icon language and geometry observed in Codex. It does not claim pixel-for-pixel reproduction of Codex, nor does it copy Codex layout, private components, or product assets.
