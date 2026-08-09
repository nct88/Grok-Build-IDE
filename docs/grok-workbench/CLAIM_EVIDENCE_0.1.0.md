# Grok Workbench IDE 0.1.0 claim/evidence ledger

Artifact: `releases/0.1.0/Grok-Workbench-IDE-0.1.0-win32-x64-portable.zip`  
SHA-256: `EF72F70E5C7054BC22EE6C4A869AA3BBC40A50958489C1C9BBFC01EA79202E1F`

| Claim | Type | Artifact and tested scope | Direct evidence | Untested or limiting state | Status |
|---|---|---|---|---|---|
| The archive launches as a separately branded portable IDE | Observation | Release ZIP extracted under `.build/release-validation-0.1.0` | `Grok Workbench.exe` launched with isolated portable `data/user-data`; window title and product icon showed Grok Workbench | Code signing and installer registration were not tested | Verified for portable Windows x64 POC |
| Explorer is left and Grok Build is right on first clean launch | Observation | Clean release candidate and relocated release extraction | Packaged screenshots at 1280×720, 1440×900, and 1920×1080 | DPI scaling other than the tested desktop setting was not exercised | Verified at tested sizes |
| Grok view is preinstalled and opens without a VSIX step | Observation | Relocated release extraction | Extension host loaded `data/extensions/local-grok-workbench.grok-build-workbench-0.3.1`; right sidebar rendered on startup | A damaged or read-only `data` directory was not tested | Verified |
| The IDE connects to the locally installed Grok CLI through ACP | Observation | Final candidate with extension 0.3.1 | UI reached `ACP session ready`; process inspection showed `grok.exe agent stdio` | Logged-out authentication was not exercised | Verified for an already-authenticated CLI |
| Composer messages travel to Grok and responses render | Observation | Same 0.3.1 extension/runtime bits used for the release | A no-write prompt returned exact text `POC_OK` and completed with `end_turn` | Cancellation and long-running prompts were not exercised | Verified for one normal round trip |
| Layout controls expose movement and sidebar actions | Observation and source fact | Relocated release extraction; `chatViewProvider.ts` | Clicking `↔` displayed Move Grok Build view, toggle sidebars, and reset locations; commands use native workbench actions | Completing every destination move was not exercised | Partially verified |
| Light and dark themes remain legible | Observation | Light 2026 at 1440×900; Dark 2026 at 1280×720 and 1920×1080 | Full-window screenshots show legible status, messages, composer, and controls without overlap | High-contrast themes and long conversation overflow were not exercised | Verified at tested themes/sizes |
| Native Microsoft/Copilot chat is not the default product channel | Source fact and observation | Product manifest and clean launch | Copilot packaging was removed from the source build task, AI chat features default disabled, and no native Chat activity icon appeared | Dormant chat framework code remains in the upstream workbench runtime | Verified as a product default, not as code removal |
| The executable is built entirely from this Code - OSS checkout | Unverified | Code - OSS 1.124.2 source fork | Source install reached native compilation but failed on missing Spectre-mitigated libraries | Visual Studio Spectre components are not installed | Not verified; release uses disclosed VSCodium 1.126.04524 runtime fallback |

## Release boundary

The artifact is a locally verified portable POC, not a signed production installer or an official xAI/Microsoft distribution. Production release still requires a legal/trademark decision, code signing, updater design, logged-out authentication validation, cancellation/process-exit validation, and the pure Code - OSS source build after installing the required Visual Studio components.
