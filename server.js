"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_ROOT = __dirname;
const UPSTREAM_API_URL = String(
  process.env.UPSTREAM_API_URL || "https://anatom-bot-api-production.up.railway.app"
).replace(/\/$/, "");
const ADMIN_TELEGRAM_IDS = new Set(
  String(process.env.ADMIN_TELEGRAM_IDS || "1326779223")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const MAX_PROXY_BODY = 600_000;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    ...securityHeaders("application/json; charset=utf-8"),
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_PROXY_BODY) {
      const error = new Error("Request body is too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function authTargetAndUser(pathname, body) {
  if (pathname !== "/api/auth/telegram") return { pathname, telegramUser: null };
  let payload = {};
  try {
    payload = JSON.parse(body.toString("utf8") || "{}");
  } catch {
    return { pathname: "/auth/telegram", telegramUser: null };
  }
  if (typeof payload.init_data !== "string") {
    return { pathname: "/auth/telegram", telegramUser: payload };
  }
  try {
    const params = new URLSearchParams(payload.init_data);
    return {
      pathname: "/auth/telegram-webapp",
      telegramUser: JSON.parse(params.get("user") || "null"),
    };
  } catch {
    return { pathname: "/auth/telegram-webapp", telegramUser: null };
  }
}

async function proxyApi(req, res, url) {
  try {
    const body = ["GET", "HEAD"].includes(req.method) ? Buffer.alloc(0) : await readBody(req);
    const route = authTargetAndUser(url.pathname, body);
    const target = new URL(route.pathname + url.search, UPSTREAM_API_URL);
    const headers = {
      Accept: req.headers.accept || "application/json",
      "Content-Type": req.headers["content-type"] || "application/json",
    };
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body.length ? body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    let responseBody = Buffer.from(await upstream.arrayBuffer());
    let contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";

    if (upstream.ok && url.pathname === "/api/auth/telegram" && route.telegramUser) {
      const data = JSON.parse(responseBody.toString("utf8"));
      const tgId = String(route.telegramUser.id || data.user_id || "");
      data.user = {
        ...route.telegramUser,
        id: data.user_id || route.telegramUser.id,
        tgId,
        isAdmin: ADMIN_TELEGRAM_IDS.has(tgId),
      };
      responseBody = Buffer.from(JSON.stringify(data));
      contentType = "application/json; charset=utf-8";
    }

    res.writeHead(upstream.status, {
      ...securityHeaders(contentType),
      "Cache-Control": "no-store",
    });
    res.end(responseBody);
  } catch (error) {
    const status = error.status || (error.name === "TimeoutError" ? 504 : 502);
    console.error("API proxy error", error.message);
    sendJson(res, status, { error: status === 504 ? "API timeout" : "API unavailable" });
  }
}

function safeFilePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_ROOT, relative);
  return filePath.startsWith(PUBLIC_ROOT + path.sep) ? filePath : null;
}

function serveFile(req, res, pathname) {
  let filePath = safeFilePath(pathname);
  if (!filePath) return sendJson(res, 400, { error: "Invalid path" });
  if (!path.extname(filePath)) filePath = path.join(PUBLIC_ROOT, "index.html");

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendJson(res, 404, { error: "Not found" });
    const ext = path.extname(filePath).toLowerCase();
    const headers = securityHeaders(MIME_TYPES[ext] || "application/octet-stream");
    headers["Cache-Control"] = filePath.endsWith("index.html")
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=31536000, immutable";
    headers["Content-Length"] = stats.size;
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "anatomapp-miniapp" });
  }
  if (url.pathname.startsWith("/api/")) return proxyApi(req, res, url);
  if (!["GET", "HEAD"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  return serveFile(req, res, url.pathname);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`АНАТОМ Mini App listening on port ${PORT}`);
});
