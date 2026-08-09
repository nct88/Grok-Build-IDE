import { readFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { normalizeSafeExternalUrl } from "./externalUrlPolicy.js";

type JsonRecord = Record<string, unknown>;

export interface UsageProduct {
  label: string;
  usagePercent: number | null;
}

export interface AccountUsagePlan {
  limitLabel: string;
  creditUsagePercent: number | null;
  nextReset: string | null;
  productUsage: UsageProduct[];
  monthlyLimit: number | null;
  used: number | null;
  remaining: number | null;
  onDemandCap: number | null;
  onDemandUsed: number | null;
}

export interface AccountUsageResult {
  ok: boolean;
  error: string | null;
  fetchedAt: string;
  manageUrl: string;
  account: {
    email: string | null;
    subscriptionTier: string | null;
  } | null;
  plan: AccountUsagePlan | null;
}

interface UsageOptions {
  environment?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const raw = isRecord(value) && "val" in value ? value.val : value;
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function productLabel(value: unknown): string {
  const name = asString(value) ?? "Product";
  if (/grokbuild|grok_build|grok-build/i.test(name)) return "Grok Build";
  if (/supergrok/i.test(name)) return "SuperGrok";
  return name;
}

function periodLabel(period: unknown, start: unknown, end: unknown): string {
  const value = asString(period) ?? "";
  if (/week/i.test(value)) return "Weekly limit";
  if (/month/i.test(value)) return "Monthly limit";
  if (/day/i.test(value)) return "Daily limit";
  const startMs = Date.parse(asString(start) ?? "");
  const endMs = Date.parse(asString(end) ?? "");
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
    const days = (endMs - startMs) / 86_400_000;
    if (days >= 5 && days <= 9) return "Weekly limit";
    if (days >= 25 && days <= 35) return "Monthly limit";
  }
  return "Plan limit";
}

async function readNewestAuthEntry(grokHome: string): Promise<JsonRecord | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path.join(grokHome, "auth.json"), "utf8"));
    if (!isRecord(parsed)) return null;
    const entries = Object.values(parsed).filter(isRecord);
    entries.sort((left, right) => {
      const leftTime = Date.parse(asString(left.create_time) ?? "") || 0;
      const rightTime = Date.parse(asString(right.create_time) ?? "") || 0;
      return rightTime - leftTime;
    });
    return entries[0] ?? null;
  } catch {
    return null;
  }
}

function emptyResult(error: string, now: Date): AccountUsageResult {
  return {
    ok: false,
    error,
    fetchedAt: now.toISOString(),
    manageUrl: "https://grok.com?_s=usage",
    account: null,
    plan: null,
  };
}

export async function fetchAccountUsage(options: UsageOptions = {}): Promise<AccountUsageResult> {
  const environment = options.environment ?? process.env;
  const now = options.now?.() ?? new Date();
  const grokHome = environment.GROK_HOME || path.join(os.homedir(), ".grok");
  const auth = await readNewestAuthEntry(grokHome);
  if (!auth) return emptyResult("Not signed in. Run Grok: Login first.", now);

  const token = asString(auth.key) ?? asString(auth.access_token);
  if (!token) return emptyResult("No active session token. Run Grok: Login again.", now);

  const base = (environment.GROK_CLI_CHAT_PROXY_BASE_URL || "https://cli-chat-proxy.grok.com/v1")
    .replace(/\/+$/, "");
  let serviceUrl: URL;
  try {
    serviceUrl = new URL(base);
  } catch {
    return emptyResult("Account usage service URL is invalid.", now);
  }
  const localService = serviceUrl.hostname === "localhost" || serviceUrl.hostname === "127.0.0.1";
  if (serviceUrl.protocol !== "https:" && !(localService && serviceUrl.protocol === "http:")) {
    return emptyResult("Account usage service must use HTTPS.", now);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": "grok-build-ide/usage",
  };

  async function getJson(endpoint: string): Promise<{ status: number; body: JsonRecord }> {
    const response = await fetchImpl(`${base}${endpoint}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    let body: unknown = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    return { status: response.status, body: isRecord(body) ? body : {} };
  }

  try {
    const [creditsResponse, userResponse, settingsResponse] = await Promise.all([
      getJson("/billing?format=credits"),
      getJson("/user?include=subscription"),
      getJson("/settings"),
    ]);
    if (creditsResponse.status === 401) {
      return emptyResult("Session expired. Run Grok: Login again.", now);
    }

    const configValue = creditsResponse.body.config;
    const config = isRecord(configValue) ? configValue : creditsResponse.body;
    const user = userResponse.status >= 200 && userResponse.status < 300 ? userResponse.body : {};
    const settings = settingsResponse.status >= 200 && settingsResponse.status < 300
      ? settingsResponse.body
      : {};
    const currentPeriod = isRecord(config.currentPeriod) ? config.currentPeriod : null;
    const periodType = currentPeriod?.type ?? config.currentPeriod;
    const periodStart = currentPeriod?.start ?? config.billingPeriodStart;
    const periodEnd = currentPeriod?.end ?? config.billingPeriodEnd;
    const subscriptionTier =
      asString(settings.subscription_tier_display) ??
      asString(user.subscriptionTier) ??
      asString(user.subscription_tier);

    let creditUsagePercent = asNumber(config.creditUsagePercent);
    const monthlyLimit = asNumber(config.monthlyLimit);
    const used = asNumber(config.used);
    if (creditUsagePercent === null && monthlyLimit !== null && monthlyLimit > 0 && used !== null) {
      creditUsagePercent = Math.min(100, Math.round((used / monthlyLimit) * 1000) / 10);
    }

    const limitKind = periodLabel(periodType, periodStart, periodEnd);
    const cadence = /week/i.test(limitKind) ? "weekly" : /month/i.test(limitKind) ? "monthly" : null;
    const limitLabel = subscriptionTier && cadence
      ? `${subscriptionTier} ${cadence} limit`
      : limitKind;
    const productUsage = Array.isArray(config.productUsage)
      ? config.productUsage.filter(isRecord).map((item) => ({
          label: productLabel(item.product ?? item.name),
          usagePercent: asNumber(item.usagePercent ?? item.percent),
        }))
      : [];
    const planOk = creditsResponse.status >= 200 && creditsResponse.status < 300;
    const manageUrl =
      normalizeSafeExternalUrl(asString(settings.usage_billing_redirect_url)) ??
      "https://grok.com?_s=usage";

    return {
      ok: planOk,
      error: planOk ? null : `Billing API HTTP ${creditsResponse.status}`,
      fetchedAt: now.toISOString(),
      manageUrl,
      account: {
        email: asString(user.email) ?? asString(auth.email),
        subscriptionTier,
      },
      plan: planOk
        ? {
            limitLabel,
            creditUsagePercent,
            nextReset: asString(periodEnd),
            productUsage,
            monthlyLimit,
            used,
            remaining: monthlyLimit !== null && used !== null ? Math.max(0, monthlyLimit - used) : null,
            onDemandCap: asNumber(config.onDemandCap),
            onDemandUsed: asNumber(config.onDemandUsed),
          }
        : null,
    };
  } catch {
    return emptyResult("Could not load account usage. Check your network and sign in again.", now);
  }
}
