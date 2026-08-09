import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canReadWorkspacePath,
  canWriteWorkspacePath,
  isVerifiedCurrentProjectProfile,
} from "./workspacePathPolicy.js";

describe("workspace path policy", () => {
  let temporaryRoot: string;
  let portfolioRoot: string;
  let workspaceRoot: string;
  let sharedDirectory: string;
  let currentProfile: string;

  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "grok-path-policy-"));
    portfolioRoot = path.join(temporaryRoot, "projects");
    workspaceRoot = path.join(portfolioRoot, "youtube-cinema-gold");
    sharedDirectory = path.join(portfolioRoot, ".codex-shared");
    currentProfile = path.join(sharedDirectory, "project-profiles", "youtube-cinema-gold.md");

    fs.mkdirSync(workspaceRoot, { recursive: true });
    fs.mkdirSync(path.dirname(currentProfile), { recursive: true });
    fs.writeFileSync(path.join(sharedDirectory, "projects-index.json"), "{}", "utf8");
    fs.writeFileSync(
      currentProfile,
      "# youtube-cinema-gold\n\n- **Đường dẫn di động:** `..\\youtube-cinema-gold` (tương đối từ `.codex-shared`)\n",
      "utf8",
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it("allows workspace files for reads and writes", () => {
    const candidate = path.join(workspaceRoot, "README.md");
    const options = { workspaceRoots: [workspaceRoot], allowOutsideWorkspace: false };

    expect(canReadWorkspacePath(candidate, options)).toBe(true);
    expect(canWriteWorkspacePath(candidate, options)).toBe(true);
  });

  it("allows only the current verified portfolio profile for read access", () => {
    const options = { workspaceRoots: [workspaceRoot], allowOutsideWorkspace: false };

    expect(isVerifiedCurrentProjectProfile(currentProfile, [workspaceRoot])).toBe(true);
    expect(canReadWorkspacePath(currentProfile, options)).toBe(true);
    expect(canWriteWorkspacePath(currentProfile, options)).toBe(false);
  });

  it("denies another project profile and arbitrary shared files", () => {
    const otherWorkspace = path.join(portfolioRoot, "other-project");
    const otherProfile = path.join(sharedDirectory, "project-profiles", "other-project.md");
    const arbitrarySharedFile = path.join(sharedDirectory, "private.txt");
    fs.mkdirSync(otherWorkspace, { recursive: true });
    fs.writeFileSync(
      otherProfile,
      "# other-project\n\n- **Đường dẫn di động:** `..\\other-project`\n",
      "utf8",
    );
    fs.writeFileSync(arbitrarySharedFile, "private", "utf8");
    const options = { workspaceRoots: [workspaceRoot], allowOutsideWorkspace: false };

    expect(canReadWorkspacePath(otherProfile, options)).toBe(false);
    expect(canReadWorkspacePath(arbitrarySharedFile, options)).toBe(false);
  });

  it("denies malformed and mismatched profiles", () => {
    const options = { workspaceRoots: [workspaceRoot], allowOutsideWorkspace: false };
    fs.writeFileSync(currentProfile, "# Missing portable path\n", "utf8");
    expect(canReadWorkspacePath(currentProfile, options)).toBe(false);

    fs.writeFileSync(
      currentProfile,
      "# wrong\n\n- **Đường dẫn di động:** `..\\different-project`\n",
      "utf8",
    );
    expect(canReadWorkspacePath(currentProfile, options)).toBe(false);
  });

  it("keeps the explicit trusted outside-workspace override", () => {
    const outside = path.join(temporaryRoot, "outside.txt");
    const options = { workspaceRoots: [workspaceRoot], allowOutsideWorkspace: true };

    expect(canReadWorkspacePath(outside, options)).toBe(true);
    expect(canWriteWorkspacePath(outside, options)).toBe(true);
  });
});
