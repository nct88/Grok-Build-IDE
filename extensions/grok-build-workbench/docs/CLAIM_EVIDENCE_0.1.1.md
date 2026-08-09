# Claim/evidence ledger — 0.1.1

| Claim | Type | Artifact and scope | Direct evidence | Counterexample or untested state | Status |
|---|---|---|---|---|---|
| Repeated no-workspace connection attempts do not multiply UI errors | Source/runtime test | `src/vscode/grokController.test.ts`, source 0.1.1 | Four sequential `connect()` calls emitted one `workspace_required` state; Vitest passed | Extension Host could recreate the entire webview, which this unit test does not simulate | Verified for controller lifecycle |
| No-workspace view has one actionable setup surface | Visual observation | 0.1.1 harness, dark 260×720 and light 390×720 | One `#emptyState`, zero `.message.error`, one visible Open Folder setup button | Installed 0.1.1 Extension Host pixels are not yet captured | Partially verified |
| Composer cannot submit without a workspace | Source + visual interaction | 0.1.1 harness at 260×720 and 390×720 | Prompt and Send were disabled; placeholder instructed the user to open a folder | Programmatic forged webview messages are outside the user interaction contract | Verified for rendered UI interaction |
| Open Folder recovery action is wired | Interaction observation | 0.1.1 harness, setup button | One uniquely scoped click produced one `openFolder` message | Native VS Code folder picker was not opened by the harness | Partially verified |
| Surrounding connected/running layout did not regress | Visual/geometry observation | 0.1.1 harness: connected 600×900, running/long 240×640 | Composer bottom equaled viewport bottom, no clipped buttons, long conversation used internal scroll | 125%/150% DPI and high-contrast theme were not exercised | Partially verified |
| Candidate is installable and cleanly packaged | Package/runtime observation | `releases/0.1.1/grok-build-workbench-0.1.1.vsix` | VSIX had 11 expected entries and no `releases/`; isolated VS Code reported `local-grok-workbench.grok-build-workbench@0.1.1` | A second physical machine was not tested | Verified for this machine's isolated profile |

## Conclusion boundary

The controller defect, packaging contents, and harness interaction are directly verified. The user-visible correction remains partially verified until the archived 0.1.1 VSIX is installed in the user's normal VS Code profile and a real Extension Host screenshot confirms the same state.
