import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountUsage } from "./usageService.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function authHome(entry: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "grok-usage-"));
  temporaryRoots.push(root);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "auth.json"), JSON.stringify({ issuer: entry }), "utf8");
  return root;
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchAccountUsage", () => {
  it("returns a safe SuperGrok weekly usage model without exposing the auth token", async () => {
    const grokHome = await authHome({ key: "secret-token", email: "dev@example.com" });
    const calls: Array<{ url: string; authorization: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get("authorization") });
      if (url.includes("billing")) {
        return response(200, {
          config: {
            currentPeriod: { type: "WEEKLY", end: "2026-08-15T00:00:00.000Z" },
            creditUsagePercent: 37.5,
            productUsage: [{ product: "grok_build", usagePercent: 12 }],
          },
        });
      }
      if (url.includes("/user")) {
        return response(200, { email: "dev@example.com", subscriptionTier: "SuperGrok" });
      }
      return response(200, { usage_billing_redirect_url: "https://grok.com/account/usage" });
    };

    const result = await fetchAccountUsage({
      environment: { GROK_HOME: grokHome },
      fetchImpl,
      now: () => new Date("2026-08-09T00:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.plan?.limitLabel).toBe("SuperGrok weekly limit");
    expect(result.plan?.creditUsagePercent).toBe(37.5);
    expect(result.plan?.productUsage).toEqual([{ label: "Grok Build", usagePercent: 12 }]);
    expect(result.manageUrl).toBe("https://grok.com/account/usage");
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.authorization === "Bearer secret-token")).toBe(true);
  });

  it("returns an actionable signed-out state without making a network request", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "grok-usage-empty-"));
    temporaryRoots.push(root);
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await fetchAccountUsage({ environment: { GROK_HOME: root }, fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not signed in");
    expect(result.plan).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps an expired session to a login action and never returns raw response data", async () => {
    const grokHome = await authHome({ access_token: "expired-token" });
    const fetchImpl: typeof fetch = async (input) =>
      response(String(input).includes("billing") ? 401 : 200, { raw: "sensitive-server-detail" });

    const result = await fetchAccountUsage({ environment: { GROK_HOME: grokHome }, fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Session expired");
    expect(JSON.stringify(result)).not.toContain("expired-token");
    expect(JSON.stringify(result)).not.toContain("sensitive-server-detail");
  });

  it("refuses to send the auth token to a non-HTTPS remote service", async () => {
    const grokHome = await authHome({ key: "never-send-this" });
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await fetchAccountUsage({
      environment: {
        GROK_HOME: grokHome,
        GROK_CLI_CHAT_PROXY_BASE_URL: "http://usage.example.com/v1",
      },
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("HTTPS");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("never-send-this");
  });

  it("does not surface network exception details into the chat webview", async () => {
    const grokHome = await authHome({ key: "network-token" });
    const fetchImpl: typeof fetch = async () => {
      throw new Error("socket failed with private-host.internal");
    };

    const result = await fetchAccountUsage({ environment: { GROK_HOME: grokHome }, fetchImpl });

    expect(result.error).toBe("Could not load account usage. Check your network and sign in again.");
    expect(JSON.stringify(result)).not.toContain("private-host.internal");
    expect(JSON.stringify(result)).not.toContain("network-token");
  });

  it("drops a credential-bearing manage URL returned by the service", async () => {
    const grokHome = await authHome({ key: "manage-url-token" });
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("billing")) return response(200, { config: {} });
      if (url.includes("/settings")) {
        return response(200, { usage_billing_redirect_url: "https://user:password@example.com/private" });
      }
      return response(200, {});
    };

    const result = await fetchAccountUsage({ environment: { GROK_HOME: grokHome }, fetchImpl });

    expect(result.manageUrl).toBe("https://grok.com?_s=usage");
    expect(JSON.stringify(result)).not.toContain("user:password");
    expect(JSON.stringify(result)).not.toContain("manage-url-token");
  });
});
