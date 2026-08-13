export function parseGrokVersion(output: string): string | undefined {
  const match = output.match(/\bgrok\s+([0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?)/i);
  return match?.[1];
}
