# Security Policy

Grok Build IDE can read and modify project files and, when explicitly enabled,
run host shell commands through the official Grok CLI. Treat agent permissions with
the same care as terminal access.

## Supported versions

Security fixes are provided for the latest published version. Please reproduce
an issue on the newest release before reporting it when that is safe to do.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability. Use the repository's
[private security advisory form](https://github.com/nct88/Grok-Build-IDE/security/advisories/new).

Include the affected version, operating system, impact, minimal reproduction,
and any relevant logs with tokens, paths, and personal data removed. Do not
include API keys, Grok credentials, session transcripts, or private source code.

If the advisory form is unavailable, open a minimal public issue that asks for a
private contact channel without disclosing the vulnerability details.

## Security defaults

- Workspace Trust must be granted before the Grok agent can connect.
- ACP reverse-terminal access is disabled by default and requires both an
  explicit setting and Workspace Trust.
- ACP file access is restricted to open workspace folders by default.
- `grokBuild.allowOutsideWorkspace` changes ACP file-host scope only; it does
  not sandbox shell commands or other tools executed by the Grok CLI.
- Public release installers and portable executables must pass the repository's
  Authenticode gate. Unsigned builds are development candidates, not trusted
  public releases.

The Grok CLI sandbox, deny rules, hooks, operating-system permissions, and the
IDE's ACP permission mode are separate controls. Review all of them before using
automatic approval modes.

Production dependency exceptions and the enforced severity gate are documented
in [docs/DEPENDENCY_SECURITY.md](docs/DEPENDENCY_SECURITY.md).

## Upstream security issues

This repository is based on Code - OSS. If a problem reproduces in unmodified
Visual Studio Code / Code - OSS, follow Microsoft's security reporting process.
If it is specific to Grok Build IDE, its packaging, or its Grok integration,
report it here.
