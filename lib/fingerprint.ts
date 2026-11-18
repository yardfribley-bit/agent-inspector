import type { FingerprintEvent, InspectResult } from "./types";

/**
 * Get the FingerprintJS Server API base URL based on configured region.
 */
export function getApiBaseUrl(region?: string): string {
  switch (region) {
    case "eu":
      return "https://eu.api.fpjs.io";
    case "ap":
      return "https://ap.api.fpjs.io";
    case "us":
    default:
      return "https://api.fpjs.io";
  }
}

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchEventOptions {
  baseUrl: string;
  eventId: string;
  secretKey: string;
  maxRetries?: number;
}

/**
 * Fetch a single event from FingerprintJS Server API v4.
 * - On 404: retry with exponential backoff (event may not be persisted yet)
 * - On 429/503: throw a user-friendly error
 * - On other errors: throw with status info
 */
export async function fetchEvent({
  baseUrl,
  eventId,
  secretKey,
  maxRetries = 2,
}: FetchEventOptions): Promise<FingerprintEvent> {
  const url = `${baseUrl}/v4/events/${encodeURIComponent(eventId)}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { headers, method: "GET" });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Network error — retry if attempts remain
      if (attempt < maxRetries) {
        const delay = 300 * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }
      throw new Error(`网络请求失败: ${lastError.message}`);
    }

    if (response.ok) {
      const data = (await response.json()) as FingerprintEvent;
      return data;
    }

    if (response.status === 404) {
      // Event not yet persisted — retry with backoff
      if (attempt < maxRetries) {
        const delay = 300 * Math.pow(2, attempt); // 300ms, 600ms
        await sleep(delay);
        continue;
      }
      throw new Error("指纹事件尚未落库，重试后仍未找到 (Event not found after retries)");
    }

    if (response.status === 429) {
      throw new Error("请求过于频繁，请稍后再试 (Rate limited by Fingerprint API)");
    }

    if (response.status === 503) {
      throw new Error("Fingerprint 服务暂时不可用，请稍后再试 (Service unavailable)");
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("API 密钥无效或权限不足 (Invalid API key)");
    }

    // Other errors
    const body = await response.text().catch(() => "");
    throw new Error(`Fingerprint API 返回 ${response.status}: ${body || response.statusText}`);
  }

  // Should not reach here, but just in case
  throw lastError ?? new Error("未知错误 (Unknown error)");
}

/**
 * Normalize a Smart Signal value that may be a plain boolean (v4 flat)
 * or a legacy { data: { result } } wrapper.
 */
function signalResult(signal: boolean | { data?: { result?: boolean } } | undefined): boolean | undefined {
  if (typeof signal === "boolean") return signal;
  return signal?.data?.result ?? undefined;
}

/**
 * Extract and clean the core fields from the v4 response payload.
 *
 * IMPORTANT: The Fingerprint Server API v4 returns a FLAT structure —
 * fields like identification, browser_details, ip_info, bot_info, vpn, etc.
 * live directly at the top level (NOT under products.*.data as older docs suggest).
 * This is verified against a real API response.
 *
 * Uses optional chaining everywhere — gracefully handles missing fields
 * (Smart Signals not enabled on the account).
 */
export function cleanEvent(event: FingerprintEvent): InspectResult {
  // v4 flat structure. `products` fallback kept for API-version tolerance.
  const legacy = event.products ?? {};
  const ident = event.identification ?? legacy.identification?.data ?? {};
  const browserDetails = event.browser_details ?? {};

  // --- Bot detection ---
  // v4: bot_info = {category, name, provider, identity, confidence}
  //     bot = "bad" | "good" | "not_detected"  (string)
  //     bot_type = "headless_chrome" etc.
  const rawBotInfo = event.bot_info ?? legacy.botd?.data ?? {};
  const botString = event.bot;
  const bot = {
    category: rawBotInfo.category ?? event.bot_type ?? undefined,
    name: rawBotInfo.name ?? undefined,
    provider: rawBotInfo.provider ?? undefined,
    identity: rawBotInfo.identity ?? undefined,
    // True "purpose" only comes from bot_info — do NOT conflate with bot verdict
    purpose: rawBotInfo.purpose ?? undefined,
    // The top-level `bot` string ("bad"/"good"/"not_detected") is a verdict
    verdict: botString ?? undefined,
    confidence: rawBotInfo.confidence ?? undefined,
    type: event.bot_type ?? undefined,
  };

  // --- Additional bot-detection evidence signals ---
  // These are the supporting signals that make bot identification trustworthy.
  const rawBlocklist = event.ip_blocklist;
  const blocklist = (rawBlocklist && typeof rawBlocklist === "object" && !("data" in rawBlocklist))
    ? rawBlocklist as { email_spam?: boolean; attack_source?: boolean; tor_node?: boolean }
    : undefined;
  const signals = {
    developer_tools: signalResult(event.developer_tools as boolean | { data?: { result?: boolean } }),
    suspect_score: event.suspect_score ?? undefined,
    virtual_machine: signalResult(event.virtual_machine as boolean | { data?: { result?: boolean } }),
    virtual_machine_ml_score: event.virtual_machine_ml_score ?? undefined,
    tampering: signalResult(event.tampering as boolean | { data?: { result?: boolean } }),
    tampering_ml_score: event.tampering_ml_score ?? undefined,
    tampering_confidence: event.tampering_confidence ?? undefined,
    simulator: signalResult(event.simulator as boolean | { data?: { result?: boolean } }),
    incognito: signalResult(event.incognito as boolean | { data?: { result?: boolean } }),
    privacy_settings: signalResult(event.privacy_settings as boolean | { data?: { result?: boolean } }),
    high_activity_device: event.high_activity_device ?? undefined,
    rare_device: event.rare_device ?? undefined,
    rare_device_percentile_bucket: event.rare_device_percentile_bucket ?? undefined,
    ip_blocklist: blocklist ? {
      email_spam: blocklist.email_spam,
      attack_source: blocklist.attack_source,
      tor_node: blocklist.tor_node,
    } : undefined,
    velocity_events_24h: event.velocity?.events?.["24_hours"] ?? undefined,
    velocity_distinct_ip_24h: event.velocity?.distinct_ip?.["24_hours"] ?? undefined,
  };

  // --- IP info ---
  // v4: ip_info.v4 = {address, geolocation{city_name,country_name,timezone...},
  //                   asn, asn_name, asn_type, datacenter_result, datacenter_name}
  const ipData = event.ip_info ?? legacy.ip_info?.data ?? {};
  const ipRecord = ipData.v4 ?? ipData.v6 ?? {};
  const geo = ipRecord.geolocation ?? {};
  const isDatacenter = ipRecord.datacenter_result === true || ipRecord.asn_type === "hosting";
  const datacenterName = ipRecord.datacenter_name;

  const ip = {
    address: ipRecord.address ?? event.ip_address ?? undefined,
    geolocation: {
      country: geo.country_name ?? geo.country ?? undefined,
      city: geo.city_name ?? geo.city ?? undefined,
      timezone: geo.timezone ?? undefined,
    },
    asn: {
      asn: (ipRecord.asn as unknown as string) ?? undefined,
      name: ipRecord.asn_name ?? undefined,
      type: ipRecord.asn_type ?? undefined,
    },
    vpn: signalResult(event.vpn as boolean | { data?: { result?: boolean } }),
    proxy: signalResult(event.proxy as boolean | { data?: { result?: boolean } }),
    tor: signalResult(event.tor as boolean | { data?: { result?: boolean } }),
    datacenter: isDatacenter ? (datacenterName ?? "Datacenter IP") : undefined,
  };

  // --- Device fingerprint ---
  // v4: browser_details = {browser_name, browser_major_version, browser_full_version,
  //                         os, os_version, device}
  //     virtual_machine / tampering / incognito are booleans at top level
  const browserVersion = browserDetails.browser_full_version || browserDetails.browser_version ||
    browserDetails.browser_major_version;
  const device = {
    browser_name: browserDetails.browser_name ?? undefined,
    browser_version: browserVersion ?? undefined,
    os: browserDetails.os ?? event.os ?? undefined,
    os_version: browserDetails.os_version ?? event.os_version ?? undefined,
    device_name: browserDetails.device ?? browserDetails.device_name ?? event.device ?? undefined,
    virtual_machine: signalResult(event.virtual_machine as boolean | { data?: { result?: boolean } }),
    tampering: signalResult(event.tampering as boolean | { data?: { result?: boolean } }),
    incognito: signalResult(event.incognito as boolean | { data?: { result?: boolean } }),
  };

  return {
    visitor_id: ident.visitor_id ?? undefined,
    request_id: ident.request_id ?? event.event_id ?? undefined,
    bot,
    signals,
    ip,
    device,
    rawPayload: event,
  };
}
