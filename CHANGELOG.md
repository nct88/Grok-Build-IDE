# Changelog

Public, versioned changes for Grok Build IDE.

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
