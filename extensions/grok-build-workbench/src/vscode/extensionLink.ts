export function parseExtensionReference(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }
  const itemName = value.match(/[?&]itemName=([^&#]+)/i)?.[1];
  if (itemName) {
    return decodeURIComponent(itemName);
  }
  const openVsx = value.match(/open-vsx\.org\/extension\/([^/]+)\/([^/?#]+)/i);
  if (openVsx) {
    return `${openVsx[1]}.${openVsx[2]}`;
  }
  const vscodeScheme = value.match(
    /^(?:vscode|grok-build-ide):extension\/([A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9-]*)$/i,
  );
  if (vscodeScheme) {
    return vscodeScheme[1];
  }
  if (/^[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9-]*$/.test(value)) {
    return value;
  }
  return undefined;
}
