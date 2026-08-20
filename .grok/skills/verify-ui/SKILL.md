---
name: verify-ui
description: Use when changing Grok Build Workbench UI, chat webview, layout, styling, slash menu, history/usage panels, i18n, or when asked to verify design, screenshots, responsive layout, dark/light theme, or browser-check the IDE. Also /verify-ui.
---

# Verify UI

Workbench webview changes are verified with this repo's Playwright harness. Chrome DevTools MCP is for live web pages (GitHub releases, docs), not the Code-OSS window.

## Workbench (required for chat UI/CSS/layout)

1. From the repo root run `npm run check:grok` (TypeScript, vitest, production esbuild, release contract, visual harness).
2. The visual gate covers dark/light, **240×720**, **390×720**, **600×900**, and **150%** scale (`extensions/grok-build-workbench/test/visual/verify-webview.mjs`).
3. Evidence lands under `extensions/grok-build-workbench/test/visual/evidence/<version>/`.
4. `npm start` / `npm run dev` is not proof. Read the gate output.

## Live web (Chrome DevTools MCP)

Use MCP tools (`search_tool` then `use_tool`) when the artifact is a URL:

1. `new_page` / `navigate_page`
2. `take_snapshot` then click/type through the flow
3. `resize_page` or `emulate` for desktop and a phone width
4. `take_screenshot` after interaction, not only first paint
5. `list_console_messages` for JS errors

If `navigate_page` fails, load the chrome-devtools `troubleshooting` skill. Chrome DevTools MCP is configured in `.grok/config.toml`.

## Do not stop at

- One render of the changed panel
- Desktop width only after a CSS change
- Claiming pass without gate or MCP output
