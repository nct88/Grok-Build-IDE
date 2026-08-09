# Grok Workbench IDE 0.3.9 claim/evidence record

Date: 2026-08-03

| Claim | Evidence | Result | Boundary |
|---|---|---|---|
| The displayed error came from automatic editor follow | The screenshot's exact message was traced to the pre-fix `EditReviewService` workspace assertion, which ran before its best-effort open-file `try/catch` | Verified | The reverse ACP read boundary was reviewed separately |
| The real current-project profile is allowed read-only | The production policy was bundled in memory and executed against workspace `H:\projects\youtube-cinema-gold` and its real generated profile | Verified: read `true`, write `false` | This gate verifies path policy, not the user's authenticated Grok service response |
| Another project profile is denied | The same direct gate tested `H:\projects\.codex-shared\project-profiles\grok-code.md` while `youtube-cinema-gold` was the workspace | Verified: read `false` | Arbitrary shared files and malformed mappings are covered by unit tests |
| Generated profile grammar is packaged | The packaged extension bundle contains the unanchored portable-path pattern and the read/write-specific WorkspaceHost calls | Verified in exact 0.3.9 payload | Bundle audit does not replace runtime policy tests; both were run |
| Optional editor-follow failure cannot fail the agent event | Controller regression injects a rejected follow operation, verifies the tool event remains broadcast, and confines the detail to the output channel | Verified | Actual ACP/tool failures remain visible |
| IDE 0.3.9 embeds extension 0.8.3 and runs | 45/45 tests, production bundle, VSIX audit, portable registry/settings, relocated launch, seven runtime processes, extension activation, and one-window folder reuse | Verified on this Windows x64 machine | Runtime overlay is the documented portable VSCodium base |
| Archived artifacts equal verified candidates | Candidate/archive SHA-256 values match for EXE and VSIX; the exact archived EXE separately passed extraction, cache reuse/repair, registry, and settings verification | Verified | No code signing or public publication was requested |
| Original authenticated prompt no longer displays the error | Not automatically replayed because it depends on the user's live Grok account/session and target project | Pending user acceptance | User should launch 0.3.9, open `youtube-cinema-gold`, and retry the same prompt |

## Artifacts

- IDE: `releases/0.3.9/Grok-Workbench-IDE-0.3.9-win32-x64-portable.exe`
- IDE SHA-256: `23AFA2944C6065FF02D6D62C87777D6D010E4FD0215CF6580376DCDD9F57568F`
- Extension: `extensions/grok-build-workbench/releases/0.8.3/grok-build-workbench-0.8.3.vsix`
- Extension SHA-256: `69681D367E08D2360F1F3D3D26A2B9DCDA533DCADE7559F9C625A8359EF882AB`
- Verified candidate: `.build/release-candidates/0.3.9-final`

## Invalidated predecessor

0.3.8/0.8.2 passed the temporary fixture and packaging gates but failed the first direct check against the real generated profile. Its release metadata and notes are marked `invalidated`; it must not be distributed.
