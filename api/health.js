const REQUIRED_ENV = [
  "TELEGRAM_BOT_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) return res.status(503).json({ ok: false, missing });

  try {
    const [telegram, supabase] = await Promise.all([
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, {
        signal: AbortSignal.timeout(8_000),
      }),
      fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/profiles?select=id&limit=1`, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(8_000),
      }),
    ]);
    const telegramBody = await telegram.json().catch(() => ({}));
    const checks = {
      telegram: telegram.ok && telegramBody.ok === true,
      supabase: supabase.ok,
      sessionSecret: process.env.SESSION_SECRET.length >= 32,
    };
    const ok = Object.values(checks).every(Boolean);
    return res.status(ok ? 200 : 503).json({
      ok,
      checks,
      bot: checks.telegram ? telegramBody.result.username : null,
    });
  } catch (error) {
    console.error("health check", error);
    return res.status(503).json({ ok: false, error: "Dependency check failed" });
  }
};
