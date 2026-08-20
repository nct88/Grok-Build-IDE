# Grok Build IDE workspace

This repository is **Grok Build IDE** (`nct88/Grok-Build-IDE`): Code-OSS plus the Grok Build Workbench extension. The agent engine is the official **Grok CLI** over ACP.

- Do not add a second agent runtime or send Grok auth tokens into the webview.
- Product names: `docs/PRODUCT_IDENTITY.md`. Architecture: `docs/ARCHITECTURE.md`.
- **Open Grok Build** launches Grok Build Desktop (`nct88/Grok-Build-Desktop`), not this IDE.
- Root `AGENTS.md` is gitignored. Always-on rules live in `.grok/rules/`. Slash skills live in `.grok/skills/` (the Workbench `/` catalog reads only that folder and `%GROK_HOME%/skills`).
- Chat webview, layout, styling, or slash-menu work: load `verify-ui`. A single screenshot is not verification.
- Browser, MCP, Figma, Canva, MongoDB, Cloudflare, or plugin tools: load `use-mcp` before calling those servers.
- After a fix or release-worthy change: load `write-fix-log`.
- Before claiming complete, passing, or ready to ship: load `run-check` and report the command output.
