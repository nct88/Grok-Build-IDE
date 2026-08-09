# Engineering Rigor & Runtime Verification Rules

## 1. Persistent Memory & Lessons Learned from Past Errors
- **Electron Black Screen Failure**: Occurred when `resources/app/node_modules` contained broken symlinks or missing sub-dependencies (e.g., `@vscode/deviceid/node_modules/uuid/dist-node/index.js`). Main process startup threw an uncaught error inside `Promise.all` in `main.js`, causing the window renderer to hang on a solid black screen.
- **Root Cause Protocol**: Never assume success based solely on installer generation or test pass exit codes. Always inspect empirical log files (`main.log`, `renderer.log`, `cli.log`) from the installed execution path (`AppData/Local/Programs/.../user-data/logs`).

## 2. Mandatory Rules for AI Assistant
1. **Empirical Evidence First**: Before declaring any feature or build complete, retrieve and analyze the actual runtime logs.
2. **Symlink Flattening Requirement**: When copying or packaging `node_modules` for standalone Electron apps on Windows, dereference all symlinks (pnpm virtual store) into concrete files to prevent `ERR_MODULE_NOT_FOUND` errors.
3. **No Superficial Declarations**: Never claim a GUI window or installer works without verifying visual rendering and zero-exception startup logs.
4. **Deliberate Reasoning Over Speed**: Prioritize correctness, deep reasoning, and comprehensive verification over fast generation.
