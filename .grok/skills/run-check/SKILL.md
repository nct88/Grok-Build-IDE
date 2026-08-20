---
name: run-check
description: Use when claiming an IDE or Workbench change is complete, fixed, ready to PR, or passing, and before commit or release. Also /run-check.
---

# Run check

From the repo root:

```powershell
npm run check:grok
```

That is repo-config lint, Playwright Chromium install for the workbench, TypeScript, vitest, production esbuild, the release contract, and the visual harness.

## Rules

- Claim pass only after this command (or the subset that covers the change) finishes and the output is green.
- UI/layout work also needs `verify-ui`. A green unit file is not a visual gate.
- If `npm run check:grok` is too heavy mid-loop, run the matching workbench script (`npm --prefix extensions/grok-build-workbench run check`) then the full gate before "done".
- Paste or summarize actual failures. Do not invent results.
