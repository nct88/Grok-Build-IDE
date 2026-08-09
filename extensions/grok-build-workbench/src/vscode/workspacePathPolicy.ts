import * as fs from "node:fs";
import * as path from "node:path";

const PORTFOLIO_DIRECTORY = ".codex-shared";
const PROFILE_DIRECTORY = "project-profiles";
const PORTFOLIO_INDEX = "projects-index.json";
const MAX_PROFILE_BYTES = 256 * 1024;
const PORTABLE_PATH_PATTERN =
  /^- \*\*(?:Đường dẫn di động|Portable path):\*\* `([^`]+)`/mu;

export interface WorkspacePathPolicyOptions {
  workspaceRoots: readonly string[];
  allowOutsideWorkspace: boolean;
}

export function canReadWorkspacePath(
  candidate: string,
  options: WorkspacePathPolicyOptions,
): boolean {
  return options.allowOutsideWorkspace
    || isInsideWorkspace(candidate, options.workspaceRoots)
    || isVerifiedCurrentProjectProfile(candidate, options.workspaceRoots);
}

export function canWriteWorkspacePath(
  candidate: string,
  options: WorkspacePathPolicyOptions,
): boolean {
  return options.allowOutsideWorkspace
    || isInsideWorkspace(candidate, options.workspaceRoots);
}

export function isInsideWorkspace(candidate: string, workspaceRoots: readonly string[]): boolean {
  const resolved = path.resolve(candidate);
  return workspaceRoots.some((root) => isPathInside(path.resolve(root), resolved));
}

export function isVerifiedCurrentProjectProfile(
  candidate: string,
  workspaceRoots: readonly string[],
): boolean {
  const candidateRealPath = existingRealPath(candidate);
  if (!candidateRealPath || path.extname(candidateRealPath).toLowerCase() !== ".md") {
    return false;
  }

  return workspaceRoots.some((workspaceRoot) => {
    const workspaceRealPath = existingRealPath(workspaceRoot);
    const portfolioRoot = findPortfolioRoot(workspaceRoot);
    if (!workspaceRealPath || !portfolioRoot) {
      return false;
    }

    const sharedDirectory = path.join(portfolioRoot, PORTFOLIO_DIRECTORY);
    const profileDirectoryRealPath = existingRealPath(
      path.join(sharedDirectory, PROFILE_DIRECTORY),
    );
    if (!profileDirectoryRealPath || !samePath(path.dirname(candidateRealPath), profileDirectoryRealPath)) {
      return false;
    }

    try {
      if (fs.statSync(candidateRealPath).size > MAX_PROFILE_BYTES) {
        return false;
      }
      const profile = fs.readFileSync(candidateRealPath, "utf8");
      const portablePath = PORTABLE_PATH_PATTERN.exec(profile)?.[1];
      if (!portablePath) {
        return false;
      }
      const referencedProject = existingRealPath(path.resolve(sharedDirectory, portablePath));
      return referencedProject !== undefined && samePath(referencedProject, workspaceRealPath);
    } catch {
      return false;
    }
  });
}

function findPortfolioRoot(workspaceRoot: string): string | undefined {
  let current = path.resolve(workspaceRoot);
  while (true) {
    if (fs.existsSync(path.join(current, PORTFOLIO_DIRECTORY, PORTFOLIO_INDEX))) {
      return current;
    }
    const parent = path.dirname(current);
    if (samePath(parent, current)) {
      return undefined;
    }
    current = parent;
  }
}

function existingRealPath(candidate: string): string | undefined {
  try {
    return fs.realpathSync.native(path.resolve(candidate));
  } catch {
    return undefined;
  }
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function samePath(left: string, right: string): boolean {
  return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase();
}
