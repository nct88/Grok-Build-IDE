# Dependency security status

Last reviewed: 2026-08-13

## Enforced gate

Release validation runs production-only npm audits at `high` severity for both
the Code - OSS root and `extensions/grok-build-workbench`. A high or critical
production advisory blocks publication.

The Grok Build Workbench extension currently reports zero production
vulnerabilities.

## Accepted moderate upstream findings

The Code - OSS root currently reports three moderate findings:

1. `@anthropic-ai/sdk` local-filesystem memory-tool permissions. Grok Build IDE
   uses this package for Claude agent-host wire types and does not use that SDK
   memory tool. The patched `0.116.0` release was tested, but it conflicts with
   the `@anthropic-ai/claude-agent-sdk` version pinned by this source tree and
   fails the root TypeScript compile due to incompatible duplicated SDK types.
   Upgrade both packages together when upstream compatibility is available.
2. `uuid` below `11.1.1`, transitively required by
   `@microsoft/dev-tunnels-connections`. The advisory concerns v3/v5/v6 calls
   with a caller-provided buffer. The current Microsoft tunnel package still
   depends on the older UUID major and npm reports no compatible fix. Do not
   force a major override without tunnel integration tests.
3. `@microsoft/dev-tunnels-connections`, reported because of the transitive
   UUID item above.

These are tracked exceptions, not a claim of zero risk. Re-run:

```powershell
npm audit --omit=dev
npm --prefix extensions/grok-build-workbench audit --omit=dev
```

Review this file whenever the root Code - OSS baseline or either affected
dependency changes.
