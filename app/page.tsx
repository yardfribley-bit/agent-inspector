"use client";

import { useCallback, useEffect, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs-pro";
import type { InspectResult } from "@/lib/types";
import { InfoCard, FieldRow, Badge } from "@/components/ui";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: InspectResult; requestId?: string };

// Must match `basePath` in next.config.js. Client-side fetch() does not
// automatically inherit basePath, so API paths need it prepended explicitly.
const BASE_PATH = "/agent-inspector";

// --- Region label helper ---
const REGION_LABELS: Record<string, string> = {
  us: "United States",
  eu: "Europe",
  ap: "Asia-Pacific",
};

export default function Home() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [httpHeaders, setHttpHeaders] = useState<Record<string, string>>({});

  const apiKey = process.env.NEXT_PUBLIC_FP_PUBLIC_API_KEY;
  const region = process.env.NEXT_PUBLIC_FP_REGION || "us";

  const runInspection = useCallback(async () => {
    setState({ status: "loading" });
    setShowRawJson(false);

    if (!apiKey || apiKey === "your_public_api_key_here") {
      setState({
        status: "error",
        message:
          "未配置 FingerprintJS Public API Key。请运行 bash setup-env.sh 并在 .env.local 中填入密钥。",
      });
      return;
    }

    try {
      // --- Initialize FingerprintJS Pro SDK ---
      const fp = await FingerprintJS.load({
        apiKey,
        region: region as "us" | "eu" | "ap",
      });

      const result = await fp.get();

      if (!result.requestId) {
        setState({
          status: "error",
          message: "未能获取指纹事件 ID (Failed to get requestId)",
        });
        return;
      }

      // --- Send eventId to backend ---
      const response = await fetch(`${BASE_PATH}/api/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: result.requestId }),
      });

      // --- Capture response headers for the HTTP headers card ---
      const respHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        respHeaders[key] = value;
      });
      setHttpHeaders(respHeaders);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "未知错误" }));
        setState({
          status: "error",
          message: errorData.error || `HTTP ${response.status}`,
        });
        return;
      }

      const data: InspectResult = await response.json();
      setState({ status: "success", data, requestId: result.requestId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: "error", message });
    }
  }, [apiKey, region]);

  // --- Auto-run on mount ---
  useEffect(() => {
    runInspection();
  }, [runInspection]);

  // --- Copy JSON report ---
  const handleCopyJson = useCallback(() => {
    if (state.status !== "success") return;
    const report = {
      generated_at: new Date().toISOString(),
      request_id: state.requestId,
      visitor_id: state.data.visitor_id,
      bot: state.data.bot,
      ip: state.data.ip,
      device: state.data.device,
      raw: state.data.rawPayload,
    };
    const text = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [state]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              🔍
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Agent Inspector
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI Agent · Bot · Fingerprint Detection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              label={`Region: ${REGION_LABELS[region] || region.toUpperCase()}`}
              color="gray"
            />
            {state.status === "success" && (
              <button
                onClick={handleCopyJson}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {copied ? "✓ Copied" : "Copy JSON Report"}
              </button>
            )}
            {(state.status === "error" || state.status === "success") && (
              <button
                onClick={runInspection}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Re-inspect
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {state.status === "loading" && <LoadingSkeleton />}
        {state.status === "error" && (
          <ErrorPanel message={state.message} onRetry={runInspection} />
        )}
        {state.status === "success" && (
          <SuccessPanel
            data={state.data}
            requestId={state.requestId}
            showRawJson={showRawJson}
            setShowRawJson={setShowRawJson}
            httpHeaders={httpHeaders}
          />
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-600">
          Powered by FingerprintJS Pro · Server API v4 · Built with Next.js
        </p>
      </footer>
    </div>
  );
}

// ============ Loading State ============

function LoadingSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          正在分析访问者指纹与 Agent 特征...
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="mb-4 h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-3">
              <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-700/50" />
              <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-700/50" />
              <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-700/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Error State ============

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="text-4xl" aria-hidden>
        ⚠️
      </span>
      <div>
        <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
          检测失败
        </h2>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
      >
        重新检测
      </button>
    </div>
  );
}

// ============ Success State ============

function SuccessPanel({
  data,
  requestId,
  showRawJson,
  setShowRawJson,
  httpHeaders,
}: {
  data: InspectResult;
  requestId?: string;
  showRawJson: boolean;
  setShowRawJson: (v: boolean) => void;
  httpHeaders: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      {/* Grid of 4 cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <BotCard data={data} />
        <IpCard data={data} />
        <DeviceCard data={data} requestId={requestId} />
        <HttpHeadersCard headers={httpHeaders} requestHeaders={data.requestHeaders} />
      </div>

      {/* Raw JSON collapsible panel */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <span>展开原始响应 (Raw JSON)</span>
          <span className="text-slate-400">{showRawJson ? "▲" : "▼"}</span>
        </button>
        {showRawJson && (
          <div className="expanded-panel border-t border-slate-200 dark:border-slate-700">
            <pre className="raw-json-scroll max-h-96 overflow-auto p-4 text-xs text-slate-700 dark:text-slate-300">
              {JSON.stringify(data.rawPayload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Card: AI Agent / Bot Detection ============

function BotCard({ data }: { data: InspectResult }) {
  const { bot, signals } = data;
  const category = bot.category ?? "not_detected";
  const verdict = bot.verdict ?? "";

  // FingerprintJS returns named AI agents (ChatGPT, Claude, Perplexity...) in
  // bot_info with category ai_agent / ai_assistant, name, provider and identity.
  // A named agent is the PRIMARY thing this panel must surface.
  const isNamedAI =
    category === "ai_agent" ||
    category === "ai_assistant" ||
    category === "verified_bot" ||
    Boolean(bot.name && (bot.identity === "signed" || bot.identity === "verified"));

  const isAutomation =
    verdict === "bad" ||
    category.includes("automation") ||
    category === "browser_bot" ||
    category === "headless_chrome" ||
    Boolean(bot.name && !isNamedAI);

  const isHuman =
    category === "not_detected" ||
    verdict === "not_detected" ||
    (verdict === "good" && !bot.name && !isNamedAI);

  // Primary identity: named agent > generic AI > automation > human
  let visitorType: string;
  let badgeColor: "green" | "amber" | "purple" | "red";
  let icon: string;

  if (isNamedAI) {
    visitorType = bot.name
      ? `${bot.name}${bot.provider ? ` · ${bot.provider}` : ""}`
      : "AI Agent";
    badgeColor = "purple";
    icon = "🤖";
  } else if (isHuman) {
    visitorType = "Human (人类浏览器)";
    badgeColor = "green";
    icon = "👤";
  } else if (isAutomation) {
    visitorType = bot.name
      ? `${bot.name} (自动化)`
      : "Browser Bot / Automation";
    badgeColor = "amber";
    icon = "🔧";
  } else {
    visitorType = `Bot: ${category}`;
    badgeColor = "amber";
    icon = "🔧";
  }

  // Build the evidence chips — the signals that justify the verdict
  const evidence: { label: string; color: "red" | "amber" | "green" }[] = [];
  if (signals?.developer_tools) evidence.push({ label: "开发者工具开启", color: "amber" });
  if (signals?.virtual_machine) evidence.push({ label: "虚拟机", color: "amber" });
  if (signals?.virtual_machine_ml_score && signals.virtual_machine_ml_score >= 0.5)
    evidence.push({ label: `VM 置信度 ${(signals.virtual_machine_ml_score * 100).toFixed(0)}%`, color: "red" });
  if (signals?.tampering) evidence.push({ label: "指纹篡改", color: "red" });
  if (signals?.high_activity_device) evidence.push({ label: "高频活动设备", color: "amber" });
  if (signals?.rare_device) evidence.push({ label: "罕见设备", color: "amber" });
  if (signals?.simulator) evidence.push({ label: "模拟器", color: "amber" });
  if (signals?.incognito) evidence.push({ label: "隐身模式", color: "amber" });
  if (signals?.ip_blocklist?.attack_source) evidence.push({ label: "攻击源 IP", color: "red" });
  if (signals?.ip_blocklist?.tor_node) evidence.push({ label: "Tor 节点", color: "red" });
  if (signals?.ip_blocklist?.email_spam) evidence.push({ label: "垃圾邮件 IP", color: "red" });

  // Identity verification status
  let identityBadge: { label: string; color: "green" | "amber" | "red" | "gray" };
  switch (bot.identity) {
    case "verified":
    case "signed":
      identityBadge = { label: `✓ ${bot.identity}`, color: "green" };
      break;
    case "spoofed":
      identityBadge = { label: "⚠ spoofed", color: "red" };
      break;
    case "unknown":
      identityBadge = { label: "? unknown", color: "amber" };
      break;
    default:
      identityBadge = { label: "N/A", color: "gray" };
  }

  return (
    <InfoCard title="AI Agent / Bot 识别" icon={icon} highlight>
      <div className="mb-3 flex items-center gap-2">
        <Badge label={visitorType} color={badgeColor} size="md" />
        {bot.confidence && (
          <Badge
            label={`置信度: ${bot.confidence}`}
            color={bot.confidence === "high" ? "green" : bot.confidence === "low" ? "red" : "amber"}
          />
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {bot.identity && bot.identity !== "unknown" ? (
          <Badge label={`签名验证: ${identityBadge.label}`} color={identityBadge.color} />
        ) : (
          <Badge label="签名验证: 未启用" color="gray" />
        )}
        {evidence.map((e, i) => (
          <Badge key={i} label={e.label} color={e.color} />
        ))}
      </div>
      <FieldRow label="Bot 判定 (verdict)" value={bot.verdict} mono />
      <FieldRow label="Bot Category" value={category} mono />
      <FieldRow label="Bot 子类型" value={bot.type} mono />
      <FieldRow label="Agent 名称" value={bot.name} />
      <FieldRow label="提供商" value={bot.provider} />
      <FieldRow label="签名身份" value={bot.identity} />
      {/* Detection evidence metrics */}
      <div className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-600">
        <p className="mb-1.5 text-xs font-semibold text-slate-400">识别证据 (Detection Evidence)</p>
        <FieldRow label="可疑分数 (suspect score)" value={signals?.suspect_score?.toString()} mono />
        <FieldRow
          label="虚拟机 ML 置信度"
          value={signals?.virtual_machine_ml_score != null
            ? `${(signals.virtual_machine_ml_score * 100).toFixed(1)}%` : undefined}
          mono
        />
        <FieldRow label="篡改 ML 分数" value={signals?.tampering_ml_score?.toString()} mono />
        <FieldRow
          label="24h 事件数"
          value={signals?.velocity_events_24h?.toString()}
          mono
        />
        <FieldRow
          label="24h 不同 IP 数"
          value={signals?.velocity_distinct_ip_24h?.toString()}
          mono
        />
      </div>
    </InfoCard>
  );
}

// ============ Card: IP & Network ============

function IpCard({ data }: { data: InspectResult }) {
  const { ip } = data;
  const locationParts = [ip.geolocation?.country, ip.geolocation?.city].filter(
    Boolean
  );
  const location = locationParts.length > 0 ? locationParts.join(" / ") : undefined;

  // Risk badges
  const risks: { label: string; color: "red" | "amber" }[] = [];
  if (ip.vpn) risks.push({ label: "VPN", color: "red" });
  if (ip.proxy) risks.push({ label: "Proxy", color: "red" });
  if (ip.tor) risks.push({ label: "Tor", color: "red" });
  if (ip.datacenter) risks.push({ label: "Datacenter IP", color: "red" });

  const isClean = risks.length === 0;

  return (
    <InfoCard title="IP 与网络特征" icon="🌐">
      <FieldRow label="访问 IP" value={ip.address} mono />
      <FieldRow label="地理位置" value={location} />
      <FieldRow label="时区" value={ip.geolocation?.timezone} />
      <FieldRow
        label="ASN / ISP"
        value={
          ip.asn?.name
            ? `${ip.asn.name}${ip.asn.asn ? ` (AS${ip.asn.asn})` : ""}`
            : undefined
        }
      />
      <FieldRow label="网络类型" value={ip.asn?.type} />
      <div className="pt-2">
        {isClean ? (
          <Badge label="✓ 未检测到网络风险" color="green" size="md" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {risks.map((r) => (
              <Badge key={r.label} label={r.label} color={r.color} />
            ))}
          </div>
        )}
      </div>
    </InfoCard>
  );
}

// ============ Card: Device & Fingerprint ============

function DeviceCard({ data, requestId }: { data: InspectResult; requestId?: string }) {
  const { device } = data;

  const browserStr = [device.browser_name, device.browser_version]
    .filter(Boolean)
    .join(" ");
  const osStr = [device.os, device.os_version].filter(Boolean).join(" ");

  const anomalies: string[] = [];
  if (device.virtual_machine) anomalies.push("Virtual Machine");
  if (device.tampering) anomalies.push("Fingerprint Tampering");
  if (device.incognito) anomalies.push("Incognito Mode");

  return (
    <InfoCard title="设备与指纹特征" icon="💻">
      <div className="mb-2 flex items-center gap-2">
        {data.visitor_id && (
          <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800 dark:bg-slate-700 dark:text-slate-200">
            {data.visitor_id}
          </code>
        )}
      </div>
      <FieldRow label="Browser" value={browserStr} />
      <FieldRow label="Operating System" value={osStr} />
      <FieldRow label="Device" value={device.device_name} />
      <FieldRow label="Request ID" value={requestId} mono />
      <div className="pt-2">
        {anomalies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {anomalies.map((a) => (
              <Badge key={a} label={`⚠ ${a}`} color="red" />
            ))}
          </div>
        ) : (
          <Badge label="✓ 环境正常" color="green" size="md" />
        )}
      </div>
    </InfoCard>
  );
}

// ============ Card: HTTP Headers ============

function HttpHeadersCard({
  headers,
  requestHeaders,
}: {
  headers: Record<string, string>;
  requestHeaders?: Record<string, string>;
}) {
  // Server-side captured request headers take priority for cross-comparison
  const serverHeaders = requestHeaders ?? {};
  const serverEntries = Object.entries(serverHeaders);

  return (
    <InfoCard title="HTTP 请求头补充" icon="📋">
      {serverEntries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-400">Server-side Request Headers</p>
          {serverEntries.map(([key, value]) => (
            <FieldRow key={key} label={key} value={value} mono />
          ))}
        </div>
      )}
      {/* Also show navigator info from client-side for cross-comparison */}
      <ClientSideHeaders />
    </InfoCard>
  );
}

function ClientSideHeaders() {
  const [navInfo, setNavInfo] = useState<{
    userAgent?: string;
    platform?: string;
    language?: string;
    secChUa?: string;
  }>({});

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setNavInfo({
        userAgent: navigator.userAgent,
        platform: (navigator as Navigator & { platform?: string }).platform,
        language: navigator.language,
        secChUa: (navigator as Navigator & { userAgentData?: { ua?: string } })
          .userAgentData?.ua,
      });
    }
  }, []);

  return (
    <>
      <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-700">
        <p className="mb-1 text-xs font-medium text-slate-400">Client-side Navigator</p>
      </div>
      <FieldRow label="User-Agent" value={navInfo.userAgent} mono />
      <FieldRow label="Platform" value={navInfo.platform} />
      <FieldRow label="Language" value={navInfo.language} />
      <FieldRow label="Sec-CH-UA" value={navInfo.secChUa} mono />
    </>
  );
}
