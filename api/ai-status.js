module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','no-store');
  const live = !!(process.env.GEMINI_API_KEY || process.env.BROWSER_USE_API_KEY);
  res.status(200).json({ live, provider: process.env.GEMINI_API_KEY ? 'gemini' : (live?'browser-use':'none') });
};
