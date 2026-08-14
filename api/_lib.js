const crypto = require("node:crypto");

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signSession(payload) {
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }));
  const signature = crypto.createHmac("sha256", env("SESSION_SECRET")).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readSession(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", env("SESSION_SECRET")).update(body).digest();
  let received;
  try { received = Buffer.from(signature, "base64url"); } catch { return null; }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch { return null; }
}

function adminIds() {
  return new Set(String(process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(v => v.trim()).filter(Boolean));
}

async function readSupabaseUser(token) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${env("SUPABASE_URL").replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function readAdmin(req) {
  const appSession = readSession(req);
  if (appSession && appSession.isAdmin) return appSession;
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const user = await readSupabaseUser(token);
  const allowedEmails = new Set(String(process.env.ADMIN_EMAILS || "pismenniyaleks.1@gmail.com")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean));
  return user && allowedEmails.has(String(user.email || "").toLowerCase())
    ? { sub: user.id, email: user.email, isAdmin: true }
    : null;
}

async function supabase(path, options = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${env("SUPABASE_URL").replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error((data && (data.message || data.msg || data.error_description)) || `Supabase ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function cleanText(value, max = 120) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}

module.exports = { adminIds, cleanText, readAdmin, readSession, signSession, supabase };
