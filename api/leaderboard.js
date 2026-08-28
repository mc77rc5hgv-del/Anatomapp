const UPSTREAM_API_URL = String(
  process.env.UPSTREAM_API_URL || "https://anatom-bot-api-production.up.railway.app"
).replace(/\/$/, "");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const limit = Math.max(1, Math.min(100, Number(req.query && req.query.limit) || 50));
  try {
    const response = await fetch(`${UPSTREAM_API_URL}/api/leaderboard?limit=${limit}`, {
      headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {},
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.send(body);
  } catch (error) {
    console.error("leaderboard proxy", error);
    return res.status(502).json({ error: "Leaderboard unavailable" });
  }
};
