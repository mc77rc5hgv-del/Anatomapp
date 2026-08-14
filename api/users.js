const { readAdmin, supabase } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const session = await readAdmin(req);
    if (!session) return res.status(403).json({ error: "Forbidden" });
    const rows = await supabase("/rest/v1/profiles?select=id,email,name,username,handle,tg_id,course,faculty,xp,streak,last_active,created_at,language_code,is_premium,photo_url&order=last_active.desc&limit=500");
    const states = await supabase("/rest/v1/user_state?select=user_id,state&limit=500");
    const stateByUser = new Map((states || []).map(row => [row.user_id, row.state || {}]));
    const enriched = (rows || []).map(row => {
      const state = stateByUser.get(row.id) || {};
      const emailMatch = String(row.email || "").toLowerCase().match(/^tg([0-9]+)@(users\.)?anatomapp\.ru$/);
      return {
        ...row,
        tg_id: row.tg_id || (emailMatch && emailMatch[1]) || null,
        stats: {
          topics: Object.keys(state.progress || {}).length,
          mistakes: Array.isArray(state.mistakes) ? state.mistakes.length : 0,
          favorites: Array.isArray(state.favorites) ? state.favorites.length : 0,
          notes: Object.keys(state.notes || {}).length,
          sessions: Array.isArray(state.history) ? state.history.length : 0,
          dayDone: Number(state.dayDone) || 0,
          dayGoal: Number(state.dayGoal) || 20,
          examDone: Boolean(state.examDone),
        },
      };
    });
    const grouped = new Map();
    for (const user of enriched) {
      const key = user.tg_id ? `tg:${user.tg_id}` : `user:${user.id}`;
      const previous = grouped.get(key);
      if (!previous) { grouped.set(key, user); continue; }
      const currentScore = (user.xp || 0) + (Date.parse(user.last_active || 0) || 0) / 1e13;
      const previousScore = (previous.xp || 0) + (Date.parse(previous.last_active || 0) || 0) / 1e13;
      const primary = currentScore > previousScore ? user : previous;
      const secondary = primary === user ? previous : user;
      for (const field of ["username", "handle", "language_code", "photo_url", "faculty"]) {
        if (!primary[field] && secondary[field]) primary[field] = secondary[field];
      }
      primary.is_premium = primary.is_premium || secondary.is_premium;
      primary.created_at = [primary.created_at, secondary.created_at].filter(Boolean).sort()[0] || null;
      for (const field of ["topics", "mistakes", "favorites", "notes", "sessions", "dayDone"]) {
        primary.stats[field] = Math.max(primary.stats[field] || 0, secondary.stats[field] || 0);
      }
      primary.stats.examDone = primary.stats.examDone || secondary.stats.examDone;
      primary.duplicate_profiles = (previous.duplicate_profiles || 1) + 1;
      grouped.set(key, primary);
    }
    const users = [...grouped.values()].sort((a, b) => (Date.parse(b.last_active || 0) || 0) - (Date.parse(a.last_active || 0) || 0));
    return res.status(200).json({ users });
  } catch (error) {
    console.error("users", error);
    return res.status(500).json({ error: "Unable to load users" });
  }
};
