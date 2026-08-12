# Architecture

Grok Build IDE is a branded Code - OSS workbench with the Grok Build Workbench
extension integrated as the Grok-specific agent surface.

```text
Code - OSS workbench
  -> extensions/grok-build-workbench
    -> ACP client
      -> grok agent stdio
```

The Grok CLI owns authentication, sessions and the agent/tool loop. The
extension host owns process supervision and filesystem policy. The webview is a
rendering and interaction surface; it must not receive Grok authentication
tokens.

The Code - OSS directories `src/`, `extensions/`, `build/`, `resources/`,
`cli/`, `remote/` and `test/` remain source inputs for the standalone IDE.
