export interface RuntimeSecurityPolicy {
  workspaceTrusted: boolean;
  terminalRequested: boolean;
  terminalEnabled: boolean;
}

/**
 * Resolve the effective runtime capabilities advertised to Grok Build.
 * Reverse-terminal is intentionally fail-closed: the user must opt in and
 * VS Code must consider the current workspace trusted.
 */
export function resolveRuntimeSecurityPolicy(options: {
  workspaceTrusted: boolean;
  terminalRequested: boolean;
}): RuntimeSecurityPolicy {
  return {
    ...options,
    terminalEnabled: options.workspaceTrusted && options.terminalRequested,
  };
}

export function assertTerminalEnabled(policy: RuntimeSecurityPolicy): void {
  if (!policy.workspaceTrusted) {
    throw new Error("Grok Build terminal access requires a trusted workspace.");
  }
  if (!policy.terminalRequested) {
    throw new Error("Grok Build terminal access is disabled in Settings.");
  }
}
