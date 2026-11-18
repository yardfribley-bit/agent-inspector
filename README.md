# Agent Inspector — AI Agent & Fingerprint Detection Panel

A lightweight full-stack web app that detects AI Agents, bots, and browser environment fingerprints when any visitor — human or AI — accesses the page.

## Tech Stack

- **Framework:** Next.js 14+ (App Router) + TypeScript + Tailwind CSS
- **Frontend SDK:** @fingerprintjs/fingerprintjs-pro (v4+)
- **Backend:** Next.js Route Handler (`/api/inspect`) calling Fingerprint Server API v4

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local from template
bash setup-env.sh

# 3. Edit .env.local and fill in your FingerprintJS API keys
#    Get keys at: https://dashboard.fingerprint.com
vim .env.local

# 4. Start dev server
npm run dev

# 5. Open http://localhost:3000
```

## Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_FP_PUBLIC_API_KEY` | Client + Server | Fingerprint Public API Key |
| `NEXT_PUBLIC_FP_REGION` | Client + Server | Region: `us` \| `eu` \| `ap` (default: `us`) |
| `FP_SECRET_API_KEY` | Server only | Fingerprint Secret API Key (never exposed to client) |

## Architecture

```
Client (browser/agent)
  │
  ├── FingerprintJS.load() → fp.get() → { visitorId, requestId }
  │
  └── POST /api/inspect { eventId: requestId }
        │
        ├── Determine API base URL by region
        ├── GET {baseUrl}/v4/events/{eventId}
        │     Authorization: Bearer ${FP_SECRET_API_KEY}
        │     (404 retry: 300ms, 600ms exponential backoff)
        │
        ├── Extract core fields (bot, IP, device, etc.)
        └── Return cleaned JSON + rawPayload + requestHeaders
```

## Features

### 4 Info Cards

1. **AI Agent / Bot Detection** (highlighted) — Distinguishes AI Agent, Browser Bot, Human with identity verification status badges
2. **IP & Network** — IP address, geolocation, ASN/ISP, VPN/Proxy/Tor/Datacenter risk badges
3. **Device & Fingerprint** — visitor_id, browser, OS, virtual machine/tampering detection
4. **HTTP Headers** — Server-side captured request headers + client-side navigator info for cross-comparison

### Additional UI

- **Copy JSON Report** — One-click clipboard copy of the full report
- **Raw JSON Panel** — Collapsible panel showing the complete Fingerprint API response
- **Loading skeleton** with spinner animation
- **Error panel** with retry button
- **Graceful degradation** — All fields show "N/A" when Smart Signals aren't enabled

## API Reference

### POST /api/inspect

**Request:**
```json
{ "eventId": "event_xxx" }
```

**Response (200):**
```json
{
  "visitor_id": "...",
  "bot": { "category": "...", "name": "...", "provider": "...", "identity": "..." },
  "ip": { "address": "...", "geolocation": {...}, "vpn": false, ... },
  "device": { "browser_name": "...", "os": "...", "virtual_machine": false, ... },
  "requestHeaders": { "user-agent": "...", ... },
  "rawPayload": { ... }
}
```

**Errors:**
- `400` — Missing/invalid eventId or direct GET access
- `500` — API key not configured or upstream error
- `503` — Rate limited or service unavailable

## Acceptance Criteria

1. ✅ **Security** — `FP_SECRET_API_KEY` never appears in client bundles (Next.js excludes non-`NEXT_PUBLIC_` vars)
2. ✅ **GET /api/inspect** returns 400 with friendly message
3. ✅ **Human browser** — Page loads < 3s, shows 4 cards with stable visitor_id
4. ✅ **Automated browser** — Playwright/Puppeteer access renders correctly, detects automation signals
5. ✅ **AI Agent access** — Agent can read DOM text and report detected agent name, IP, environment markers
6. ✅ **Graceful degradation** — Undefined Smart Signal fields show "N/A", Raw JSON panel always works
