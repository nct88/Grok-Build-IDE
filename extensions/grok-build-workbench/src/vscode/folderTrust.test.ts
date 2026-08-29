import { describe, expect, it } from "vitest";
import { parseTrustedFolders, serializeTrustedFolders } from "./folderTrust.js";

describe("Grok CLI folder trust", () => {
  it("round-trips the trusted_folders.toml entries used by the CLI", () => {
    const text = serializeTrustedFolders([
      { path: "C:\\Work\\O'Brien", trusted: true, decidedAt: 123 },
      { path: "C:\\Work\\untrusted", trusted: false, decidedAt: 456 },
    ]);
    expect(parseTrustedFolders(text)).toEqual([
      { path: "C:\\Work\\O'Brien", trusted: true, decidedAt: 123 },
      { path: "C:\\Work\\untrusted", trusted: false, decidedAt: 456 },
    ]);
  });
});
