---
name: engineering-excellence
description: Framework for systematic software engineering, root cause analysis, rigorous dependency auditing, and transparent technical communication.
---

# Engineering Excellence & Software Architecture Methodology

This skill provides a structured blueprint for software architecture, request analysis, error diagnosis, and release verification based on top-tier engineering practices.

## 1. Request Analysis & Task Structuring
- **Deconstruct Requirements**: Break complex user prompts into discrete technical requirements before writing code.
- **Identify Scoping Constraints**: Respect all user-defined constraints (e.g., "do not edit code now", "only diagnose", "inspect logs first").

## 2. Empirical Root Cause Analysis (RCA) Protocol
1. **Never Guess Errors**: Always inspect un-truncated logs (`main.log`, `renderer.log`, `cli.log`) before forming a hypothesis.
2. **Trace Upstream Dependencies**: When a module resolution fails (`ERR_MODULE_NOT_FOUND`), trace the exact module loading chain (e.g. `main.js` -> `@vscode/deviceid` -> `uuid/dist-node/index.js`).
3. **Verify Binary & Symlink Packaging**: Electron packages on Windows require physical file resolution rather than unresolved pnpm symlinks in virtual stores.

## 3. Visual & Runtime Verification Standards
- **Installer & Process Validation**: Verify both process spawn and visual window rendering (no blank/black screens).
- **Log Verification**: Confirm zero uncaught exceptions in main process logs upon startup.

## 4. Honest Technical Communication
- **Acknowledge Flaws Directing Improvement**: Own up to oversights directly and explain the exact technical cause transparently.
- **Detailed Impact Reports**: Provide exact line numbers, log snippets, and concrete evidence in responses.
