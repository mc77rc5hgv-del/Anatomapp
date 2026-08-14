const { readSession, supabase } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    const session = readSession(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "GET") {
      const rows = await supabase(`/rest/v1/user_state?user_id=eq.${encodeURIComponent(session.sub)}&select=state&limit=1`);
      return res.status(200).json({ state: (rows[0] && rows[0].state) || {} });
    }

    if (req.method === "PUT") {
      const state = req.body && req.body.state;
      if (!state || typeof state !== "object" || Array.isArray(state)) return res.status(400).json({ error: "Invalid state" });
      if (Buffer.byteLength(JSON.stringify(state)) > 500000) return res.status(413).json({ error: "State is too large" });
      await supabase("/rest/v1/user_state?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: session.sub, state, updated_at: new Date().toISOString() }),
      });
      const profile = (req.body && req.body.profile) || {};
      await supabase(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.sub)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          xp: Math.max(0, Math.min(999999, Number(state.xp) || 0)),
          streak: Math.max(0, Math.min(9999, Number(state.streak) || 0)),
          name: String(profile.name || "Студент").replace(/[<>]/g, "").trim().slice(0, 100),
          course: Math.max(1, Math.min(6, Number(profile.course) || 1)),
          faculty: String(profile.faculty || "").replace(/[<>]/g, "").trim().slice(0, 80) || null,
          last_active: new Date().toISOString(),
        }),
      });
      return res.status(204).end();
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("state", error);
    return res.status(500).json({ error: "State storage failed" });
  }
};
