const { readSession, supabase } = require("./_lib");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const session = readSession(req);
    if (!session || !session.isAdmin) return res.status(403).json({ error: "Forbidden" });
    const rows = await supabase("/rest/v1/profiles?select=id,name,username,handle,tg_id,course,faculty,xp,streak,last_active,created_at,language_code,is_premium,photo_url&order=last_active.desc&limit=500");
    const states = await supabase("/rest/v1/user_state?select=user_id,state&limit=500");
    const stateByUser = new Map((states || []).map(row => [row.user_id, row.state || {}]));
    const users = (rows || []).map(row => {
      const state = stateByUser.get(row.id) || {};
      return {
        ...row,
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
    return res.status(200).json({ users });
  } catch (error) {
    console.error("users", error);
    return res.status(500).json({ error: "Unable to load users" });
  }
};
