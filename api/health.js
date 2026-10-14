module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const checks = {
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_anon: !!process.env.SUPABASE_ANON_KEY,
    supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const aiLive = checks.gemini || checks.groq || checks.openrouter;
  const dbLive = checks.supabase_url && checks.supabase_anon;

  res.status(200).json({
    ok: true,
    service: 'visamotion-api',
    time: new Date().toISOString(),
    ai_live: aiLive,
    db_live: dbLive,
    providers: { gemini: checks.gemini, groq: checks.groq, openrouter: checks.openrouter },
    // values are never returned — only configured/not-configured booleans
    configured: checks,
  });
};
