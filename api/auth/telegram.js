const crypto = require("node:crypto");
const { adminIds, cleanText, signSession, supabase } = require("../_lib");

const MAX_AUTH_AGE_SECONDS = 60 * 60;

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left || "") || !/^[a-f0-9]{64}$/i.test(right || "")) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function fresh(authDate) {
  const value = Number(authDate);
  const now = Math.floor(Date.now() / 1000);
  return Number.isFinite(value) && value <= now + 30 && now - value <= MAX_AUTH_AGE_SECONDS;
}

function validateMiniApp(initData, botToken) {
  const params = new URLSearchParams(initData);
  const received = params.get("hash") || "";
  const authDate = params.get("auth_date");
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(check).digest("hex");
  if (!safeEqualHex(received, expected) || !fresh(authDate)) return null;
  try { return JSON.parse(params.get("user") || "null"); } catch { return null; }
}

function validateWidget(payload, botToken) {
  const check = Object.entries(payload).filter(([k, v]) => k !== "hash" && v != null)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHash("sha256").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(check).digest("hex");
  return safeEqualHex(String(payload.hash || ""), expected) && fresh(payload.auth_date) ? payload : null;
}

async function findOrCreateProfile(tg) {
  const tgId = String(tg.id);
  const found = await supabase(`/rest/v1/profiles?tg_id=eq.${encodeURIComponent(tgId)}&select=*&limit=1`);
  let profile = found && found[0];
  const name = cleanText([tg.first_name, tg.last_name].filter(Boolean).join(" ") || tg.username || `Студент ${tgId}`, 100);
  const username = cleanText(tg.username, 40);

  if (!profile) {
    const created = await supabase("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: `tg${tgId}@users.anatomapp.ru`,
        password: crypto.randomBytes(32).toString("base64url"),
        email_confirm: true,
        user_metadata: { name, username, tg_id: tgId },
      }),
    });
    profile = { id: created.id, course: 1, faculty: null, xp: 0, streak: 0 };
  }

  const row = {
    id: profile.id,
    email: profile.email || `tg${tgId}@users.anatomapp.ru`,
    name,
    username: username || null,
    tg_id: tgId,
    handle: username ? `@${username}` : `tg${tgId}`,
    language_code: cleanText(tg.language_code, 12) || null,
    is_premium: Boolean(tg.is_premium),
    photo_url: cleanText(tg.photo_url, 500) || null,
    course: profile.course || 1,
    faculty: profile.faculty || null,
    xp: profile.xp || 0,
    streak: profile.streak || 0,
    last_active: new Date().toISOString(),
  };
  const saved = await supabase("/rest/v1/profiles?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  return saved[0] || row;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = req.body || {};
    const tg = typeof body.init_data === "string"
      ? validateMiniApp(body.init_data, process.env.TELEGRAM_BOT_TOKEN || "")
      : validateWidget(body, process.env.TELEGRAM_BOT_TOKEN || "");
    if (!tg || !tg.id) return res.status(401).json({ error: "Invalid or expired Telegram data" });

    const profile = await findOrCreateProfile(tg);
    const tgId = String(tg.id);
    const isAdmin = adminIds().has(tgId);
    const token = signSession({ sub: profile.id, tgId, isAdmin });
    return res.status(200).json({
      token,
      user: {
        id: profile.id,
        tgId,
        first_name: tg.first_name || "",
        last_name: tg.last_name || "",
        username: tg.username || "",
        photo_url: tg.photo_url || "",
        language_code: tg.language_code || "",
        is_premium: Boolean(tg.is_premium),
        course: profile.course || 1,
        faculty: profile.faculty || "",
        isAdmin,
      },
    });
  } catch (error) {
    console.error("telegram auth", error);
    return res.status(500).json({ error: "Unable to create Telegram session" });
  }
};
