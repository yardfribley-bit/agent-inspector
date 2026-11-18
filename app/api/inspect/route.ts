import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl, fetchEvent, cleanEvent } from "@/lib/fingerprint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/inspect
 * Body: { "eventId": string }
 *
 * Calls FingerprintJS Server API v4 to retrieve event details,
 * returns cleaned data + raw payload.
 */
export async function POST(request: NextRequest) {
  // --- Validate input ---
  let body: { eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "请求体不是有效的 JSON (Invalid JSON body)" },
      { status: 400 }
    );
  }

  const eventId = body?.eventId?.trim();
  if (!eventId) {
    return NextResponse.json(
      { error: "缺少 eventId 参数 (Missing eventId)" },
      { status: 400 }
    );
  }

  // --- Determine API region ---
  const region = process.env.NEXT_PUBLIC_FP_REGION || "us";
  const baseUrl = getApiBaseUrl(region);

  // --- Get secret key ---
  const secretKey = process.env.FP_SECRET_API_KEY;
  if (!secretKey || secretKey === "your_secret_api_key_here") {
    return NextResponse.json(
      { error: "服务端未配置 FP_SECRET_API_KEY，请运行 bash setup-env.sh 并填入密钥 (Server API key not configured)" },
      { status: 500 }
    );
  }

  // --- Capture incoming request headers for cross-reference ---
  const requestHeaders: Record<string, string> = {};
  const relevantHeaders = [
    "user-agent",
    "sec-ch-ua",
    "sec-ch-ua-platform",
    "sec-ch-ua-mobile",
    "accept-language",
    "x-forwarded-for",
    "x-real-ip",
    "host",
  ];
  relevantHeaders.forEach((h) => {
    const val = request.headers.get(h);
    if (val) requestHeaders[h] = val;
  });

  // --- Fetch event from FingerprintJS Server API ---
  try {
    const event = await fetchEvent({ baseUrl, eventId, secretKey });
    const cleaned = cleanEvent(event);
    // Attach the server-side request headers for cross-comparison
    return NextResponse.json({ ...cleaned, requestHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Determine status: 429/503-like errors get 503, others get 500
    const isRateLimited = message.includes("Rate limited") || message.includes("unavailable");
    return NextResponse.json(
      { error: message },
      { status: isRateLimited ? 503 : 500 }
    );
  }
}

/**
 * GET /api/inspect — always returns 400 (no direct access without eventId)
 */
export async function GET() {
  return NextResponse.json(
    { error: "请使用 POST 方式提交 eventId (Use POST with eventId)" },
    { status: 400 }
  );
}
