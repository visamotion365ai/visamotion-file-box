// VisaMOTion — real website analysis. Fetches a public URL server-side (no CORS wall),
// extracts readable text, and asks the configured AI provider for a structured summary.
// Respects robots.txt and refuses private/login/paywalled targets.

const SKIP_GLOBS = [/login/i, /signin/i, /account/i, /checkout/i, /cart/i, /admin/i];

function isPrivateHost(host) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1)/.test(host);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]).slice(0, 200) : '';
}

async function robotsAllows(origin, path) {
  try {
    const r = await fetch(origin + '/robots.txt', { headers: { 'User-Agent': 'VisaMOTionBot/1.0' } });
    if (!r.ok) return true;
    const txt = await r.text();
    let applies = false;
    for (const line of txt.split(/\n/)) {
      const l = line.trim().toLowerCase();
      if (l.startsWith('user-agent:')) applies = l.includes('*') || l.includes('visamotion');
      else if (applies && l.startsWith('disallow:')) {
        const p = l.slice(9).trim();
        if (p && p !== '/' && path.startsWith(p)) return false;
      }
    }
    return true;
  } catch { return true; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const rawUrl = String(body.url || '').trim();
  if (!/^https?:\/\/.+\..+/i.test(rawUrl)) return res.status(400).json({ error: 'invalid_url' });

  let u;
  try { u = new URL(rawUrl); } catch { return res.status(400).json({ error: 'invalid_url' }); }
  if (isPrivateHost(u.hostname)) return res.status(400).json({ error: 'private_host_not_allowed' });
  if (SKIP_GLOBS.some(re => re.test(u.pathname))) return res.status(400).json({ error: 'restricted_path' });

  const allowed = await robotsAllows(u.origin, u.pathname);
  if (!allowed) return res.status(403).json({ error: 'robots_disallow' });

  let html = '', status = 0;
  try {
    const r = await fetch(u.href, {
      redirect: 'follow',
      headers: { 'User-Agent': 'VisaMOTionBot/1.0 (+https://visamotion.app)', Accept: 'text/html,application/xhtml+xml' },
    });
    status = r.status;
    const ct = r.headers.get('content-type') || '';
    if (!/html|text/i.test(ct)) return res.status(415).json({ error: 'unsupported_content_type', content_type: ct });
    html = (await r.text()).slice(0, 900_000);
  } catch (e) {
    return res.status(502).json({ error: 'fetch_failed', message: e.message });
  }

  const title = titleOf(html);
  const text = stripHtml(html).slice(0, 12000);
  const host = u.hostname;
  const trustHint = /\.gov|\.gov\.|immi\.|mfa\.|ica\.|evisa\.|embassy|ministry|visa\./i.test(host)
    ? 'official-looking government domain' : 'unverified domain — confirm it is the official source';

  // Summarize via the shared AI router if a provider is configured.
  let summary = null, provider = null;
  try {
    const mod = require('./ai');
    // Reuse the router by issuing an internal call through a fake req/res pair.
    const out = await new Promise(resolve => {
      const fakeRes = {
        setHeader() {}, status(c) { this._c = c; return this; },
        json(o) { resolve({ code: this._c, body: o }); return this; },
        end() { resolve({ code: 204, body: null }); return this; },
      };
      mod({
        method: 'POST',
        body: {
          system: 'You are a visa-research analyst. Summarize ONLY what is present in the provided page text. Never invent fees, dates or requirements.',
          prompt: `URL: ${u.href}\nTitle: ${title}\n\nPAGE TEXT:\n${text}\n\nReturn a concise structured report with: 1) what this page is, 2) key requirements/fees/dates mentioned (mark "not stated" if absent), 3) any official contact info, 4) what a visa applicant must verify next. Answer in the language of the page; if ambiguous, answer in English.`,
          preferred: body.preferred,
        },
      }, fakeRes);
    });
    if (out.code === 200 && out.body && out.body.text) { summary = out.body.text; provider = out.body.provider; }
  } catch { /* provider not configured — return raw extraction only */ }

  return res.status(200).json({
    ok: true,
    url: u.href,
    host,
    http_status: status,
    title,
    trust_hint: trustHint,
    robots_allowed: allowed,
    char_count: text.length,
    excerpt: text.slice(0, 1500),
    summary,
    provider,
    retrieved_at: new Date().toISOString(),
    note: summary ? 'AI summary generated from the fetched page.' : 'No AI provider configured — returning extracted text only (no summary).',
  });
};
