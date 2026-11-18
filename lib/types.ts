/**
 * Type definitions for FingerprintJS Server API v4 response.
 *
 * Verified against a real v4 API response (2026-11-18): the Server API v4
 * returns a FLAT structure — smart signals are top-level fields, NOT nested
 * under `products.*.data`. We keep an optional `products` block for
 * tolerance with other API versions, but primary extraction uses flat fields.
 * All fields are optional — Smart Signals may not be enabled on all accounts.
 */

export type BotCategory = string;
export type BotIdentity = "verified" | "signed" | "unknown" | "spoofed" | string;

export interface BotInfo {
  category?: BotCategory;
  name?: string;
  provider?: string;
  identity?: BotIdentity;
  purpose?: string;
  confidence?: string;
  signature?: {
    data?: string;
    type?: string;
  };
}

export interface IPGeolocation {
  country_name?: string;
  country_code?: string;
  city_name?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  // legacy aliases
  country?: string;
  city?: string;
}

export interface IPAddressRecord {
  address?: string;
  geolocation?: IPGeolocation;
  asn?: string;
  asn_name?: string;
  asn_network?: string;
  asn_type?: string;
  datacenter_result?: boolean;
  datacenter_name?: string;
  type?: string;
}

export interface IPInfo {
  v4?: IPAddressRecord;
  v6?: IPAddressRecord;
}

export interface BrowserDetails {
  browser_name?: string;
  browser_major_version?: string;
  browser_full_version?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  device?: string;
  device_name?: string;
  device_category?: string;
}

export interface IdentificationData {
  visitor_id?: string;
  request_id?: string;
  confidence?: { score?: number; version?: string };
  visitor_found?: boolean;
  first_seen_at?: number;
  last_seen_at?: number;
}

/** Smart signal: may be a plain boolean (v4 flat) or {data:{result}} (legacy) */
export type SmartSignal = boolean | { data?: { result?: boolean } } | undefined;

/**
 * Real Server API v4 response — flat top-level fields.
 */
export interface FingerprintEvent {
  event_id?: string;
  timestamp?: number;
  source?: string;
  environment_id?: string;
  sdk?: unknown;
  replayed?: boolean;

  // Identification
  identification?: IdentificationData;
  url?: string;
  ip_address?: string;
  user_agent?: string;

  // Device / browser
  device?: string;
  os?: string;
  os_version?: string;
  browser_details?: BrowserDetails;

  // Bot detection
  bot?: string;              // "bad" | "good" | "not_detected"
  bot_type?: string;         // "headless_chrome" etc.
  bot_info?: BotInfo;

  // IP intelligence
  ip_info?: IPInfo;

  // Smart signals (flat booleans in v4)
  developer_tools?: SmartSignal;
  ip_blocklist?: {
    email_spam?: boolean;
    attack_source?: boolean;
    tor_node?: boolean;
    [key: string]: unknown;
  } | SmartSignal;
  proxy?: SmartSignal;
  proxy_confidence?: string | number;
  proxy_ml_score?: number;
  incognito?: SmartSignal;
  privacy_settings?: SmartSignal;
  simulator?: SmartSignal;
  suspect_score?: number;
  velocity?: {
    distinct_ip?: Record<string, number>;
    distinct_country?: Record<string, number>;
    events?: Record<string, number>;
    ip_events?: Record<string, number>;
    [key: string]: unknown;
  };
  rare_device?: boolean;
  rare_device_percentile_bucket?: string;
  high_activity_device?: boolean;
  tampering?: SmartSignal;
  tampering_confidence?: string | number;
  tampering_ml_score?: number;
  tampering_details?: Record<string, unknown>;
  virtual_machine?: SmartSignal;
  virtual_machine_ml_score?: number;
  vpn?: SmartSignal;
  vpn_confidence?: string | number;
  vpn_ml_score?: number;
  tor?: SmartSignal;

  // Legacy nested format (tolerated for other API versions)
  products?: {
    identification?: { data?: IdentificationData & { browser_details?: BrowserDetails } };
    botd?: { data?: BotInfo };
    ip_info?: { data?: IPInfo };
    vpn?: { data?: { result?: boolean } };
    proxy?: { data?: { result?: boolean } };
    tor?: { data?: { result?: boolean } };
    virtual_machine?: { data?: { result?: boolean } };
    tampering?: { data?: { result?: boolean } };
    incognito?: { data?: { result?: boolean } };
    ip_blocklist?: { data?: { result?: boolean } };
  };

  // Any additional fields preserved in rawPayload
  [key: string]: unknown;
}

/** Cleaned, structured result returned to the frontend */
export interface InspectResult {
  visitor_id?: string;
  request_id?: string;
  bot: {
    category?: string;
    name?: string;
    provider?: string;
    identity?: string;
    purpose?: string;
    /** Top-level bot verdict: "bad" | "good" | "not_detected" */
    verdict?: string;
    /** Detection confidence from bot_info: "high" | "medium" | "low" */
    confidence?: string;
    /** BotD sub-type: "headless_chrome", "selenium", "playwright" etc. */
    type?: string;
  };
  /** Additional bot-detection evidence signals */
  signals: {
    developer_tools?: boolean;
    suspect_score?: number;
    virtual_machine?: boolean;
    virtual_machine_ml_score?: number;
    tampering?: boolean;
    tampering_ml_score?: number;
    tampering_confidence?: string | number;
    simulator?: boolean;
    incognito?: boolean;
    privacy_settings?: boolean;
    high_activity_device?: boolean;
    rare_device?: boolean;
    rare_device_percentile_bucket?: string;
    ip_blocklist?: {
      email_spam?: boolean;
      attack_source?: boolean;
      tor_node?: boolean;
    };
    velocity_events_24h?: number;
    velocity_distinct_ip_24h?: number;
  };
  ip: {
    address?: string;
    geolocation?: {
      country?: string;
      city?: string;
      timezone?: string;
    };
    asn?: {
      asn?: string;
      name?: string;
      type?: string;
    };
    vpn?: boolean;
    proxy?: boolean;
    tor?: boolean;
    datacenter?: string | undefined;
  };
  device: {
    browser_name?: string;
    browser_version?: string;
    os?: string;
    os_version?: string;
    device_name?: string;
    virtual_machine?: boolean;
    tampering?: boolean;
    incognito?: boolean;
  };
  /** Server-side captured request headers for cross-comparison */
  requestHeaders?: Record<string, string>;
  rawPayload: unknown;
}
