# Grok Workbench IDE 0.3.8 claim/evidence record

> **Final disposition: invalidated.** Do not distribute 0.3.8/0.8.2. A post-package direct check against the real generated profile contradicted the simulated policy test.

Date: 2026-08-03

| Claim | Evidence | Result | Boundary |
|---|---|---|---|
| The screenshot error originates in automatic editor follow | The exact message text was traced to `EditReviewService.assertVisiblePath`, called before its best-effort file-open `try/catch` | Verified in source | This identifies the displayed error path; it does not alone prove the ACP read policy was correct |
| The current workspace portfolio profile is readable | Temporary-layout tests passed, but direct execution of the bundled policy against `H:\projects\.codex-shared\project-profiles\youtube-cinema-gold.md` returned false | **Failed** | Fixture omitted the generator's explanatory suffix after the code span |
| The exception does not grant broad external access | Tests deny another project profile, an arbitrary shared file, malformed/mismatched mappings, and writes to the valid external profile | Verified | The explicit `allowOutsideWorkspace` trusted override intentionally retains its prior broad behavior |
| Optional editor-follow failure cannot fail the tool event | Controller regression injects a rejected follow operation, confirms the event is still broadcast, and confines the error to the output log | Verified | Other ACP failures remain visible and are not suppressed |
| IDE 0.3.8 embeds extension 0.8.2 and launches | 45/45 tests, production bundle, VSIX audit, registry/settings checks, extraction/cache repair, relocated runtime, seven runtime processes, extension activation, and one-window folder reuse | Packaging verified, functional candidate invalidated | A launching artifact is not proof that the target profile grammar is accepted |
| The exact archived artifact matches the verified candidate | Source and archived SHA-256 values match; the archived EXE separately passed extraction, cache reuse/repair, registry, and settings verification | Verified | Code signing/publication were not requested |
| The original authenticated `youtube-cinema-gold` request no longer shows the error | Not replayed because it depends on the user's live Grok login/session and target project | Pending user acceptance | Do not mark the screenshot scenario fully confirmed until the user retries it in 0.3.8 |

## Artifacts

- IDE: `releases/0.3.8/Grok-Workbench-IDE-0.3.8-win32-x64-portable.exe`
- IDE SHA-256: `0F23DAC2E6E64A95C1A65D5C50682303E10C189DAF7340A408FCA24781C291F8`
- Extension: `extensions/grok-build-workbench/releases/0.8.2/grok-build-workbench-0.8.2.vsix`
- Extension SHA-256: `C4F9A3557A4E238774E91FFC27FDF442A310B3CB0273A96CC3CB96584EEF9713`
- Verified candidate: `.build/release-candidates/0.3.8-retry`
