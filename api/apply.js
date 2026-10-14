// Live Browser-Use visa application task. Set BROWSER_USE_API_KEY in the Vercel env.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error:'POST only' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch(e) { b = {}; } }
  b = b || {};
  const key = process.env.BROWSER_USE_API_KEY;
  if (!key) return res.status(200).json({ task_id:null, error:'no-key',
    note:'Simulated flow used: run the agent from the app with your own Browser-Use key.' });
  const task = [
    `Go to ${b.portal} and prepare a ${b.country} visa application.`,
    `Visa type: ${b.visa || 'tourist'}. Purpose: ${b.purpose || 'tourism'}.`,
    `Applicant: ${b.applicant && b.applicant.name}, passport ${b.applicant && b.applicant.passport}, nationality ${b.applicant && b.applicant.nationality}.`,
    'Fill the online form fields with this data. Do NOT submit payment, OTP or biometrics — stop at the payment step and report what remains.'
  ].join(' ');
  try {
    const r = await fetch('https://api.browser-use.com/api/v2/tasks', {
      method:'POST', headers:{'Content-Type':'application/json','X-Browser-Use-API-Key':key},
      body: JSON.stringify({ task })
    });
    const j = await r.json();
    if (!r.ok) return res.status(200).json({ task_id:null, error: JSON.stringify(j).slice(0,300) });
    return res.status(200).json({ task_id: j.id || j.task_id || null, live:true });
  } catch(e) {
    return res.status(200).json({ task_id:null, error:String(e && e.message || e) });
  }
};
