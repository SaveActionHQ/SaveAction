# CORS & Security Headers Configuration

> **Last Updated:** February 2026  
> **Applies To:** @saveaction/api (Fastify), @saveaction/web (Next.js), Nginx reverse proxy

## Table of Contents

- [Overview](#overview)
- [CORS Configuration](#cors-configuration)
  - [How CORS Works in SaveAction](#how-cors-works-in-saveaction)
  - [Development Configuration](#development-configuration)
  - [Production Configuration](#production-configuration)
  - [Multi-Origin Configuration](#multi-origin-configuration)
  - [Credential Handling](#credential-handling)
  - [Preflight Requests](#preflight-requests)
- [Cookie Configuration](#cookie-configuration)
  - [Refresh Token Cookie](#refresh-token-cookie)
  - [CSRF Cookie](#csrf-cookie)
  - [Cookie Attributes Reference](#cookie-attributes-reference)
- [Security Headers](#security-headers)
  - [Content-Security-Policy (CSP)](#content-security-policy-csp)
  - [Strict-Transport-Security (HSTS)](#strict-transport-security-hsts)
  - [Other Security Headers](#other-security-headers)
- [CSRF Protection](#csrf-protection)
  - [How CSRF Works](#how-csrf-works)
  - [Protected Routes](#protected-routes)
  - [API Token Exemption](#api-token-exemption)
  - [Client Implementation](#client-implementation)
- [Rate Limiting](#rate-limiting)
- [Nginx Configuration](#nginx-configuration)
  - [Basic Reverse Proxy](#basic-reverse-proxy)
  - [HTTPS with SSL](#https-with-ssl)
  - [Security Headers in Nginx](#security-headers-in-nginx)
- [Fastify Configuration Reference](#fastify-configuration-reference)
- [Next.js Security Headers](#nextjs-security-headers)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)

---

## Overview

SaveAction uses a multi-layered security approach:

```
Request Flow:
                                                                  
  Browser → Nginx (TLS, headers) → Fastify (CORS, helmet, rate limit, CSRF, auth) → Handler
```

Each layer adds protection:

| Layer | Component | Protection |
|-------|-----------|-----------|
| 1 | Nginx | TLS termination, basic security headers, gzip |
| 2 | CORS | Origin validation, credential control |
| 3 | Helmet | CSP, HSTS, X-Frame-Options, etc. |
| 4 | Rate Limiting | Abuse prevention (Redis-backed) |
| 5 | CSRF | Cross-site request forgery prevention |
| 6 | Auth | JWT/API token verification |
| 7 | Validation | Zod input schemas |

---

## CORS Configuration

### How CORS Works in SaveAction

CORS is configured in `packages/api/src/app.ts` using `@fastify/cors`:

```typescript
await app.register(cors, {
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  maxAge: 86400, // 24 hours preflight cache
});
```

The `CORS_ORIGIN` environment variable controls which origins can make requests.

### Development Configuration

In development, CORS is permissive to allow local development with different ports:

```bash
# .env (development)
CORS_ORIGIN=*
```

This allows requests from any origin. The Fastify CORS plugin translates `*` to `origin: true`, which reflects the request's Origin header — required because `credentials: true` cannot be used with the literal `*` value.

### Production Configuration

In production, restrict CORS to your exact domain(s):

```bash
# .env.production
CORS_ORIGIN=https://saveaction.example.com
```

For separate API and web domains:

```bash
# API and Web on different subdomains
CORS_ORIGIN=https://app.saveaction.example.com,https://api.saveaction.example.com
```

### Multi-Origin Configuration

Pass comma-separated origins:

```bash
# Multiple allowed origins
CORS_ORIGIN=https://saveaction.example.com,https://staging.saveaction.example.com,https://admin.saveaction.example.com
```

The CORS plugin splits on commas and checks each request's `Origin` header against the list.

> **Important:** Do NOT include trailing slashes or paths in origins. Only scheme + host + port.

### Credential Handling

`credentials: true` is required because SaveAction uses:
- **httpOnly cookies** for refresh tokens
- **Cookies** for CSRF tokens

With credentials enabled:
- The browser sends cookies cross-origin
- The server responds with `Access-Control-Allow-Credentials: true`
- The `Access-Control-Allow-Origin` header must be an explicit origin (not `*`)

### Preflight Requests

Browsers send `OPTIONS` preflight requests for non-simple requests (e.g., `Content-Type: application/json`, custom headers). SaveAction caches preflight responses for 24 hours:

```
maxAge: 86400  // seconds
```

This means after the first preflight, subsequent requests from the same origin skip the preflight for 24 hours.

**Headers exposed to JavaScript:**

| Header | Purpose |
|--------|---------|
| `X-Request-ID` | Request tracing (correlate with server logs) |
| `X-RateLimit-Limit` | Max requests in window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Window reset time (Unix timestamp) |

**Custom headers allowed in requests:**

| Header | Purpose |
|--------|---------|
| `Content-Type` | JSON body |
| `Authorization` | JWT or API token |
| `X-Request-ID` | Client-generated request ID |
| `X-CSRF-Token` | CSRF protection token |

---

## Cookie Configuration

### Refresh Token Cookie

Set by `POST /api/v1/auth/login` and `POST /api/v1/auth/refresh`:

```
Set-Cookie: refreshToken=<jwt>; 
  Path=/api/v1/auth; 
  HttpOnly; 
  Secure;              // Production only
  SameSite=Strict; 
  Max-Age=2592000      // 30 days
```

| Attribute | Value | Why |
|-----------|-------|-----|
| `HttpOnly` | `true` | Prevents JavaScript access (XSS protection) |
| `Secure` | `true` (production) | Cookie sent only over HTTPS |
| `SameSite` | `Strict` | Cookie NOT sent on cross-site requests |
| `Path` | `/api/v1/auth` | Cookie only sent to auth endpoints |
| `Max-Age` | `2592000` | 30-day expiry (matches JWT refresh expiry) |

**Why SameSite=Strict?**

`Strict` provides the strongest CSRF protection — the cookie is never sent on cross-site navigation. Since the refresh token is only needed for API calls (not navigations), `Strict` is appropriate.

**Why Path=/api/v1/auth?**

Limiting the cookie path to `/api/v1/auth` means the refresh token is only sent with auth-related requests (refresh, logout). It's never sent with recording uploads, run triggers, or other API calls — reducing the cookie's attack surface.

### CSRF Cookie

Set by `GET /api/v1/auth/csrf`:

```
Set-Cookie: _csrf=<token>; 
  Path=/api; 
  SameSite=Strict; 
  Secure;              // Production only
```

| Attribute | Value | Why |
|-----------|-------|-----|
| `HttpOnly` | `false` | JavaScript must read this token |
| `Secure` | `true` (production) | Cookie sent only over HTTPS |
| `SameSite` | `Strict` | Prevents cross-site cookie sending |
| `Path` | `/api` | Available to all API routes |

**Why HttpOnly=false?**

The CSRF token must be readable by JavaScript so the client can include it in the `X-CSRF-Token` header. The double-submit cookie pattern works by comparing the cookie value with the header value — an attacker's site cannot read the cookie due to same-origin policy.

### Cookie Attributes Reference

| Cookie | Name | HttpOnly | Secure | SameSite | Path | Max-Age |
|--------|------|----------|--------|----------|------|---------|
| Refresh Token | `refreshToken` | ✅ Yes | ✅ Prod | Strict | `/api/v1/auth` | 30 days |
| CSRF Token | `_csrf` | ❌ No | ✅ Prod | Strict | `/api` | Session |

---

## Security Headers

Security headers are set by `@fastify/helmet` in `packages/api/src/plugins/helmet.ts`.

### Content-Security-Policy (CSP)

#### API Endpoints (Strict)

```
Content-Security-Policy: 
  default-src 'none'; 
  base-uri 'none'; 
  form-action 'none'; 
  frame-ancestors 'none'; 
  object-src 'none'
```

This is the strictest possible CSP — it blocks everything. API endpoints return JSON, not HTML, so no scripts, styles, images, or frames are needed.

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'none'` | Block all resource loading |
| `base-uri` | `'none'` | Prevent `<base>` tag injection |
| `form-action` | `'none'` | Prevent form submissions |
| `frame-ancestors` | `'none'` | Prevent framing (clickjacking) |
| `object-src` | `'none'` | Block Flash/Java plugins |

#### Swagger UI (Relaxed)

The Swagger UI at `/api/docs` needs a more permissive CSP:

```
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self' 'unsafe-inline' https://unpkg.com; 
  style-src 'self' 'unsafe-inline' https://unpkg.com; 
  img-src 'self' data: https://validator.swagger.io; 
  font-src 'self' data:; 
  connect-src 'self'; 
  base-uri 'self'; 
  form-action 'self'; 
  frame-ancestors 'none'; 
  object-src 'none'; 
  worker-src 'self' blob:
```

This CSP is applied automatically when the request URL starts with `/api/docs`. 

#### Web App CSP (Next.js)

For the Next.js web app, configure CSP via `next.config.ts` headers or the Nginx reverse proxy:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // Next.js requires these
              "style-src 'self' 'unsafe-inline'",                  // Tailwind inline styles
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' ws: wss:",                       // API calls + HMR websocket
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
```

> **Note:** Next.js requires `'unsafe-eval'` for development (React Fast Refresh) and `'unsafe-inline'` for styled-jsx. In production, consider using nonces for stricter CSP.

### Strict-Transport-Security (HSTS)

Only enabled in production (`NODE_ENV=production`):

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `max-age` | `31536000` (1 year) | Browser remembers HTTPS-only for 1 year |
| `includeSubDomains` | Present | Applies to all subdomains |
| `preload` | Present | Eligible for browser preload lists |

> **Warning:** Only enable HSTS when you are confident your TLS setup is permanent. Once browsers cache the HSTS policy, they will refuse HTTP connections for the entire max-age duration.

### Other Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent framing (clickjacking) |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-XSS-Protection` | `0` | Disabled (modern CSP is better) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit Referer header leakage |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolate browsing context |
| `Cross-Origin-Resource-Policy` | `same-origin` | Prevent cross-origin resource loading |
| `X-DNS-Prefetch-Control` | `off` | Prevent DNS prefetching |
| `X-Permitted-Cross-Domain-Policies` | `none` | Block Flash/PDF cross-domain |
| `X-Powered-By` | (removed) | Hide server technology |

---

## CSRF Protection

### How CSRF Works

SaveAction uses the **double-submit cookie pattern**:

```
1. Client: GET /api/v1/auth/csrf
   Server: Returns { csrfToken: "abc123" }
           Sets Cookie: _csrf=abc123

2. Client: POST /api/v1/auth/logout
           Header: X-CSRF-Token: abc123
           Cookie: _csrf=abc123 (sent automatically)
   
   Server: Compares header token with cookie token
           If match → request allowed
           If mismatch → 403 CSRF_TOKEN_MISSING
```

**Why this works:** An attacker's site can trigger cross-origin requests that include cookies (the `_csrf` cookie), but cannot:
- Read the cookie value (same-origin policy)
- Set the `X-CSRF-Token` header with the correct value

### Protected Routes

Only routes that use **cookie-based authentication** need CSRF protection:

| Route | Method | CSRF Required | Why |
|-------|--------|--------------|-----|
| `/api/v1/auth/logout` | POST | ✅ Yes | Uses refresh token cookie |
| `/api/v1/auth/change-password` | POST | ✅ Yes | Sensitive operation with cookie auth |
| `/api/v1/auth/refresh` | POST | ❌ No | Response protected by CORS |
| `/api/v1/recordings/*` | ALL | ❌ No | Uses Bearer token (JWT/API) |
| `/api/v1/runs/*` | ALL | ❌ No | Uses Bearer token |
| `/api/v1/schedules/*` | ALL | ❌ No | Uses Bearer token |

### API Token Exemption

Requests using API tokens (`Bearer sa_live_*` or `Bearer sa_test_*`) are exempt from CSRF validation. API tokens are:
- Not stored in cookies
- Explicitly included in `Authorization` header
- CSRF-immune by design

```typescript
// From csrf.ts — API tokens bypass CSRF
function usesApiToken(request: FastifyRequest): boolean {
  const auth = request.headers.authorization;
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, '');
  return token.startsWith('sa_live_') || token.startsWith('sa_test_');
}
```

### Client Implementation

#### Fetching CSRF Token (Web UI)

```typescript
// Fetch CSRF token before making protected requests
async function getCsrfToken(): Promise<string> {
  const response = await fetch('/api/v1/auth/csrf', {
    credentials: 'include',  // Include cookies
  });
  const data = await response.json();
  return data.csrfToken;
}
```

#### Using CSRF Token

```typescript
// Include token in protected requests
async function logout(): Promise<void> {
  const csrfToken = await getCsrfToken();
  
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
  });
}
```

#### CI/CD (API Tokens — No CSRF Needed)

```bash
# API tokens don't need CSRF tokens
curl -X POST https://saveaction.example.com/api/v1/runs \
  -H "Authorization: Bearer sa_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"recordingId": "rec_123", "browser": "chromium"}'
```

---

## Rate Limiting

Configured in `packages/api/src/plugins/rateLimit.ts` using `@fastify/rate-limit`:

### Rate Limit Tiers

| Tier | Limit | Time Window | Applies To |
|------|-------|-------------|-----------|
| **Unauthenticated** | 100 requests | 1 minute | All unauthenticated requests |
| **Authenticated** | 200 requests | 1 minute | Requests with valid JWT/API token |
| **Auth endpoints** | 20 requests | 1 minute | `/api/v1/auth/*` (anti-brute-force) |

### Excluded Routes

These routes are not rate-limited:

- `/api/health/*` — Health checks (monitoring systems)
- `/api/docs/*` — Swagger UI
- `/api/queues/*` — Queue status

### Response Headers

Every rate-limited response includes:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1708534800
```

When exceeded (HTTP 429):

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded, retry in 45 seconds"
  }
}
```

### Redis Store

In production with Redis, rate limiting is **distributed** — all API instances share the same counters. Without Redis, rate limiting falls back to in-memory (per-instance), which is less accurate in multi-instance deployments.

```bash
# Environment variable
REDIS_URL=redis://localhost:6379
```

---

## Nginx Configuration

### Basic Reverse Proxy

This is the security-relevant excerpt from `docker/nginx/nginx.conf` (the full file also includes health check, queue status, and static asset caching locations):

```nginx
upstream api {
    server api:3001;
}

upstream web {
    server web:3000;
}

server {
    listen 80;
    server_name _;

    # Security headers (Nginx layer)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml
               application/rss+xml image/svg+xml;

    # Recording upload limit 
    client_max_body_size 50m;

    # API routes
    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # SSE endpoint (special config — no buffering)
    location ~ ^/api/v1/runs/.*/progress/stream$ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';

        # Critical for SSE
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;

        proxy_read_timeout 3600s;
    }

    # Next.js
    location / {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### HTTPS with SSL

Full HTTPS configuration with Let's Encrypt certificates:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name saveaction.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name saveaction.example.com;

    # ─── TLS Certificates ───
    ssl_certificate     /etc/letsencrypt/live/saveaction.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/saveaction.example.com/privkey.pem;

    # ─── TLS Settings ───
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # ─── OCSP Stapling ───
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/saveaction.example.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # ─── Security Headers ───
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # CSP for the web app (adjust as needed)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' wss:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'" always;

    # ─── Proxy settings ───
    client_max_body_size 50m;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml
               image/svg+xml;

    # API
    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
    }

    # SSE (no buffering)
    location ~ ^/api/v1/runs/.*/progress/stream$ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 3600s;
    }

    # Web UI
    location / {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Next.js static assets (aggressive caching)
    location /_next/static/ {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Security Headers in Nginx

When using Nginx as the TLS endpoint, it's the right place for HSTS and web app CSP headers. The API's Helmet plugin handles API-specific headers.

**Recommended header placement:**

| Header | Set In | Why |
|--------|--------|-----|
| HSTS | Nginx | Only valid over HTTPS (Nginx terminates TLS) |
| CSP (API) | Fastify Helmet | Strict `default-src 'none'` for JSON API |
| CSP (Web) | Nginx or Next.js | Web app needs scripts, styles, images |
| X-Frame-Options | Both | Defense in depth |
| X-Content-Type-Options | Both | Defense in depth |
| Referrer-Policy | Both | Defense in depth |

> **Note on duplication:** When both Nginx and Fastify set the same header, browsers typically use the last one. Fastify's headers take precedence for API routes since they're set closer to the response. For the web app, Nginx headers apply.

---

## Fastify Configuration Reference

All security-related configuration in `app.ts`:

```typescript
// ─── CORS ───
await app.register(cors, {
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
});

// ─── Cookies (required for refresh tokens + CSRF) ───
await app.register(cookie, {
  secret: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
});

// ─── Helmet (security headers) ───
await app.register(helmetPlugin, {
  isProduction: env.NODE_ENV === 'production',
  enableHsts: env.NODE_ENV === 'production',
  swaggerPrefix: '/api/docs',
});

// ─── Rate Limiting ───
await app.register(rateLimitPlugin, {
  redis: app.redis?.getClient(),
  global: 100,        // 100/min unauthenticated
  authenticated: 200,  // 200/min authenticated
  auth: 20,           // 20/min auth endpoints
  timeWindow: 60000,   // 1 minute
});

// ─── CSRF ───
await app.register(csrfPlugin, {
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  cookie: {
    path: '/api',
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGIN` | `*` | Allowed origins (comma-separated, or `*` for all) |
| `NODE_ENV` | `development` | Affects Secure cookies, HSTS |
| `JWT_SECRET` | (required) | JWT signing + cookie signing |
| `JWT_REFRESH_SECRET` | (falls back to JWT_SECRET) | Refresh token signing |
| `REDIS_URL` | (optional) | Redis URL for distributed rate limiting |

---

## Next.js Security Headers

The web app can add security headers via `next.config.ts`:

```typescript
// packages/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options', 
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // CSP - adjust based on your CDN/analytics needs
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

> **Note:** When running behind Nginx, you may choose to set these headers only in Nginx to avoid duplication. Either approach works.

---

## Common Scenarios

### Scenario 1: Same Domain (Recommended)

Everything on one domain with Nginx routing:

```
https://saveaction.example.com/         → Web UI (Next.js)
https://saveaction.example.com/api/     → API (Fastify)
```

```bash
# .env.production
CORS_ORIGIN=https://saveaction.example.com
APP_BASE_URL=https://saveaction.example.com
```

**Pros:** Simplest setup, no cross-origin issues, cookies work natively.

### Scenario 2: Separate API and Web Domains

```
https://app.saveaction.example.com      → Web UI
https://api.saveaction.example.com      → API
```

```bash
# API .env.production
CORS_ORIGIN=https://app.saveaction.example.com
APP_BASE_URL=https://app.saveaction.example.com
```

Web UI API client must use the full API URL:

```typescript
// packages/web/src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.saveaction.example.com';
```

**Important:** Cookies require matching domain or SameSite adjustments:
- Set cookie `Domain=.saveaction.example.com` to share cookies across subdomains
- Or change `SameSite` from `Strict` to `Lax` for cross-subdomain

### Scenario 3: API Behind Cloud Load Balancer

```
Client → AWS ALB (TLS) → Nginx (HTTP) → Fastify
```

```bash
# Trust proxy headers from LB
# Fastify trusts X-Forwarded-* headers by default
CORS_ORIGIN=https://saveaction.example.com
```

Nginx config change — don't set HSTS (LB handles it):

```nginx
# Remove or comment out:
# add_header Strict-Transport-Security ...
```

### Scenario 4: Development with Docker Compose

```bash
# .env
CORS_ORIGIN=*
NODE_ENV=development
```

Access:
- Web: http://localhost (via Nginx)
- API: http://localhost/api/ (via Nginx)
- Direct API: http://localhost:3001 (bypassing Nginx)

### Scenario 5: CI/CD Pipeline (API Tokens Only)

For CI/CD, use API tokens — no cookies or CSRF needed:

```bash
# GitHub Actions workflow
- name: Run smoke tests
  env:
    SAVEACTION_API_URL: https://saveaction.example.com
    SAVEACTION_API_TOKEN: ${{ secrets.SAVEACTION_TOKEN }}
  run: |
    npx saveaction run --tag smoke --api-url $SAVEACTION_API_URL --api-token $SAVEACTION_API_TOKEN
```

API tokens authenticate via `Authorization: Bearer sa_live_...` header — no cookies involved.

---

## Troubleshooting

### CORS Errors

**Error:** `Access to fetch has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header`

**Causes:**
1. `CORS_ORIGIN` doesn't include the requesting origin
2. Origin has trailing slash or different port
3. Nginx is not forwarding headers

**Fix:**
```bash
# Check your origin exactly matches
CORS_ORIGIN=https://saveaction.example.com
# NOT: https://saveaction.example.com/
# NOT: https://saveaction.example.com:443

# For debugging, temporarily set:
CORS_ORIGIN=*
```

**Error:** `Access to fetch has been blocked by CORS policy: credentials flag is true but 'Access-Control-Allow-Origin' is '*'`

**Fix:** Set an explicit origin (not `*`) when `credentials: true`:
```bash
CORS_ORIGIN=http://localhost:3000
```

### Cookie Not Being Set

**Symptom:** Login succeeds but refresh token cookie is not stored

**Causes:**
1. **Not HTTPS in production** — `Secure` cookies require HTTPS
2. **SameSite mismatch** — Different origins with `SameSite=Strict`
3. **Path mismatch** — Cookie path doesn't match request path

**Fix:**
- Ensure HTTPS in production
- For development, `Secure` is automatically disabled
- Check cookie `Path` matches the endpoint path

### CSRF Token Invalid

**Symptom:** `403 CSRF_TOKEN_MISSING` or `403 CSRF_TOKEN_INVALID`

**Causes:**
1. Missing `X-CSRF-Token` header
2. CSRF cookie not included (no `credentials: 'include'`)
3. Token expired or from different session

**Fix:**
```typescript
// 1. Fetch fresh token before protected request
const { csrfToken } = await fetch('/api/v1/auth/csrf', {
  credentials: 'include',
}).then(r => r.json());

// 2. Include in header AND ensure cookies are sent
await fetch('/api/v1/auth/logout', {
  method: 'POST',
  credentials: 'include',
  headers: { 'X-CSRF-Token': csrfToken },
});
```

### Rate Limit Hit in Development

**Symptom:** `429 Too Many Requests` during development

**Fix:** Rate limits are low for auth endpoints (20/min). In development:
```bash
# The rate limit plugin can be skipped in tests via AppOptions
# For dev, restart the API server to reset in-memory counters
# Or configure Redis URL for persistent (but resettable) counters
```

### SSE Not Working Through Nginx

**Symptom:** SSE events not received, or received in batches

**Causes:**
1. Nginx buffering is enabled
2. Missing proxy headers for SSE

**Fix:** Ensure your Nginx config for SSE endpoints has:
```nginx
location ~ ^/api/v1/runs/.*/progress/stream$ {
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
    proxy_set_header Connection '';
    proxy_read_timeout 3600s;
}
```

### Headers Duplicated

**Symptom:** Security headers appear twice in responses

**Cause:** Both Nginx and Fastify setting the same headers

**Fix:** Choose one layer per header. Recommended approach:
- **Nginx:** HSTS, web app CSP, Permissions-Policy
- **Fastify:** API CSP, all other headers via Helmet

Or use `proxy_hide_header` in Nginx to remove Fastify headers:
```nginx
location /api/ {
    proxy_hide_header X-Frame-Options;  # Let Nginx set it
    proxy_pass http://api;
}
```

---

## Further Reading

| Document | Description |
|----------|-------------|
| [Architecture](./ARCHITECTURE.md) | System design and data flow |
| [Self-Hosting Guide](./SELF_HOSTING.md) | Production deployment |
| [Docker Deployment](./DOCKER_DEPLOYMENT.md) | Docker Compose reference |
| [API Documentation](./API.md) | Full API reference |
