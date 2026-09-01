const REQUIRED_ENV = [
  "TELEGRAM_BOT_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
];
const MINI_APP_VERSION = "20260901-1";

function miniAppUrl() {
  const url = new URL(process.env.ANATOM_WEBAPP_URL || "https://anatomapp.vercel.app/");
  url.searchParams.set("v", MINI_APP_VERSION);
  return url.toString();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) return res.status(503).json({ ok: false, missing });

  try {
    const telegramBase = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    const [telegram, supabase, menu] = await Promise.all([
      fetch(`${telegramBase}/getMe`, {
        signal: AbortSignal.timeout(8_000),
      }),
      fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/profiles?select=id&limit=1`, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(8_000),
      }),
      fetch(`${telegramBase}/setChatMenuButton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_button: {
            type: "web_app",
            text: "АНАТОМ",
            web_app: { url: miniAppUrl() },
          },
        }),
        signal: AbortSignal.timeout(8_000),
      }),
    ]);
    const telegramBody = await telegram.json().catch(() => ({}));
    const menuBody = await menu.json().catch(() => ({}));
    const checks = {
      telegram: telegram.ok && telegramBody.ok === true,
      supabase: supabase.ok,
      menu: menu.ok && menuBody.ok === true,
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
