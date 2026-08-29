import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

export interface FolderTrust {
  path: string;
  trusted: boolean;
  decidedAt: number;
}

export function trustedFoldersPath(grokHome: string): string {
  return path.join(grokHome, "trusted_folders.toml");
}

export function normalizeFolder(folder: string): string {
  return path.resolve(folder).replace(/[\\/]+$/, "");
}

export function sameFolder(left: string, right: string): boolean {
  const a = normalizeFolder(left);
  const b = normalizeFolder(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function escapeTomlSingle(value: string): string {
  return value.replace(/'/g, "''");
}

export function parseTrustedFolders(text: string): FolderTrust[] {
  const folders: FolderTrust[] = [];
  for (const chunk of text.replace(/^\uFEFF/, "").split(/(?=\[folders\.')/)) {
    const header = chunk.match(/\[folders\.'((?:''|[^'])*)'\]/);
    if (!header) continue;
    const trusted = chunk.match(/^\s*trusted\s*=\s*(true|false)\s*$/im);
    const decidedAt = chunk.match(/^\s*decided_at\s*=\s*(-?\d+)\s*$/im);
    folders.push({
      path: header[1]!.replace(/''/g, "'"),
      trusted: trusted?.[1]?.toLowerCase() === "true",
      decidedAt: Number(decidedAt?.[1] ?? 0),
    });
  }
  return folders;
}

export function serializeTrustedFolders(folders: readonly FolderTrust[]): string {
  return folders
    .map(
      (folder) =>
        `[folders.'${escapeTomlSingle(folder.path)}']\ntrusted = ${folder.trusted}\ndecided_at = ${folder.decidedAt}\n`,
    )
    .join("\n");
}

export async function setFolderTrust(
  grokHome: string,
  folder: string,
  trusted: boolean,
): Promise<FolderTrust & { file: string }> {
  const resolved = normalizeFolder(folder);
  if (!resolved) throw new Error("Open a folder before changing Grok CLI hook trust.");
  const file = trustedFoldersPath(grokHome);
  let entries: FolderTrust[] = [];
  try {
    entries = parseTrustedFolders(await readFile(file, "utf8"));
  } catch {
    // A missing trust file is created below; unreadable content is not discarded
    // until the user explicitly changes trust for the opened folder.
  }
  const next: FolderTrust = {
    path: entries.find((entry) => sameFolder(entry.path, resolved))?.path ?? resolved,
    trusted,
    decidedAt: Math.floor(Date.now() / 1000),
  };
  const index = entries.findIndex((entry) => sameFolder(entry.path, resolved));
  if (index >= 0) entries[index] = next;
  else entries.push(next);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serializeTrustedFolders(entries), "utf8");
  return { ...next, file };
}
