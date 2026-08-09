export interface ExternalUrlPolicy {
  allowHttp?: boolean;
}

export function normalizeSafeExternalUrl(
  value: unknown,
  policy: ExternalUrlPolicy = {},
): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  const protocolAllowed = parsed.protocol === "https:" || (policy.allowHttp && parsed.protocol === "http:");
  if (!protocolAllowed || parsed.username || parsed.password) return null;
  return parsed.toString();
}
