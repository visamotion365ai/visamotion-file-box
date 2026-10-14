// VisaMOTion AI Agency — serverless AI router (Vercel / Node runtime)
// Provider order: owner-selected -> Gemini -> Groq -> OpenRouter -> clear error.
// API keys live ONLY in environment variables. Never returned to the client.

const PROVIDERS = {
  gemini: {
    key: () => process.env.GEMINI_API_KEY,
    base: () => process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    model: () => process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    async call({ system, prompt, history, temperature }) {
      const key = this.key();
      const url = `${this.base()}/models/${this.model()}:generateContent?key=${key}`;
      const contents = [];
      for (const m of history || []) {
        contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
      }
      contents.push({ role: 'user', parts: [{ text: prompt }] });
      const body = {
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { temperature: temperature ?? 0.6, maxOutputTokens: 2048 },
      };
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw httpErr(j?.error?.message || ('gemini HTTP ' + r.status), r.status);
      const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text).join('').trim();
      if (!text) throw new Error('gemini returned no text');
      return { text, provider: 'gemini', model: this.model() };
    },
  },

  groq: {
    key: () => process.env.GROQ_API_KEY,
    base: () => process.env.GROQ_API_BASE_URL || 'https://api.groq.com/openai/v1',
    model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    async call({ system, prompt, history, temperature }) {
      const msgs = [];
      if (system) msgs.push({ role: 'system', content: system });
      for (const m of history || []) msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
      msgs.push({ role: 'user', content: prompt });
      const r = await fetch(`${this.base()}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.key() },
        body: JSON.stringify({ model: this.model(), messages: msgs, temperature: temperature ?? 0.6, max_tokens: 2048 }),
      });
      const j = await r.json();
      if (!r.ok) throw httpErr(j?.error?.message || ('groq HTTP ' + r.status), r.status);
      const text = j.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('groq returned no text');
      return { text, provider: 'groq', model: this.model() };
    },
  },

  openrouter: {
    key: () => process.env.OPENROUTER_API_KEY,
    base: () => process.env.OPENROUTER_API_BASE_URL || 'https://openrouter.ai/api/v1',
    model: () => process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
    async call({ system, prompt, history, temperature }) {
      const msgs = [];
      if (system) msgs.push({ role: 'system', content: system });
      for (const m of history || []) msgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
      msgs.push({ role: 'user', content: prompt });
      const r = await fetch(`${this.base()}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + this.key(),
          'HTTP-Referer': process.env.APP_BASE_URL || 'https://visamotion.app',
          'X-Title': 'VisaMOTion AI Agency',
        },
        body: JSON.stringify({ model: this.model(), messages: msgs, temperature: temperature ?? 0.6, max_tokens: 2048 }),
      });
      const j = await r.json();
      if (!r.ok) throw httpErr(j?.error?.message || ('openrouter HTTP ' + r.status), r.status);
      const text = j.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('openrouter returned no text');
      return { text, provider: 'openrouter', model: this.model() };
    },
  },
};

function httpErr(message, status) {
  const e = new Error(message || 'provider error');
  e.status = status;
  e.rateLimited = status === 429;
  return e;
}

function configuredOrder(preferred) {
  const order = [];
  if (preferred && PROVIDERS[preferred] && PROVIDERS[preferred].key()) order.push(preferred);
  for (const name of ['gemini', 'groq', 'openrouter']) {
    if (PROVIDERS[name].key() && !order.includes(name)) order.push(name);
  }
  return order;
}

function statusOf() {
  const out = {};
  for (const name of Object.keys(PROVIDERS)) {
    out[name] = { configured: !!PROVIDERS[name].key(), model: PROVIDERS[name].model() };
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // status probe
  if (req.method === 'GET' || body.action === 'status') {
    const st = statusOf();
    const live = Object.values(st).some(v => v.configured);
    return res.status(200).json({ live, providers: st });
  }

  const { prompt, system, history, preferred, fallback, temperature } = body;
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  let order = configuredOrder(preferred);
  if (fallback === false && order.length > 1) order = order.slice(0, 1);

  if (!order.length) {
    return res.status(503).json({
      error: 'not_configured',
      message: 'No AI provider is configured. Add GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY as a Vercel Secret environment variable.',
      providers: statusOf(),
    });
  }

  const attempts = [];
  for (const name of order) {
    const t0 = Date.now();
    try {
      const out = await PROVIDERS[name].call({ system, prompt, history, temperature });
      return res.status(200).json({
        text: out.text,
        provider: out.provider,
        model: out.model,
        latency_ms: Date.now() - t0,
        fallback_used: attempts.length > 0,
        attempts,
      });
    } catch (e) {
      attempts.push({ provider: name, error: e.message, rate_limited: !!e.rateLimited });
    }
  }
  return res.status(502).json({ error: 'all_providers_failed', attempts });
};
