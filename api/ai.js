// Live Gemini proxy. Set GEMINI_API_KEY in the Vercel project env.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error:'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch(e) { body = {}; } }
  body = body || {};
  const key = process.env.GEMINI_API_KEY || body.key;
  if (!key) return res.status(200).json({ text:null, error:'no-key' });
  const model = body.model || 'gemini-3.8-flash';
  const prompt = body.prompt || '';
  const system = body.system || '';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const r = await fetch(url, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        systemInstruction: system ? { parts:[{ text: system }] } : undefined,
        contents: [{ role:'user', parts:[{ text: prompt }] }],
        generationConfig:{ temperature:0.6, maxOutputTokens:1024 }
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(200).json({ text:null, error:(j.error&&j.error.message)||('HTTP '+r.status) });
    const text = (j.candidates && j.candidates[0] && j.candidates[0].content &&
      j.candidates[0].content.parts || []).map(p=>p.text).filter(Boolean).join('\n');
    return res.status(200).json({ text: text || null, provider:'gemini', model });
  } catch(e) {
    return res.status(200).json({ text:null, error:String(e && e.message || e) });
  }
};
