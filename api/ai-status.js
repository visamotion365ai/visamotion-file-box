module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const mod = require('./ai');
  const fakeRes = {
    setHeader() {}, status(c) { this._c = c; return this; },
    json(o) {
      const st = o.providers || {};
      const live = Object.values(st).some(v => v.configured);
      res.status(200).json({ live, provider: o.provider || (st.gemini?.configured ? 'gemini' : st.groq?.configured ? 'groq' : st.openrouter?.configured ? 'openrouter' : 'none'), providers: st });
      return this;
    },
    end() { res.status(200).json({ live: false, provider: 'none', providers: {} }); return this; },
  };
  return mod({ method: 'GET', body: { action: 'status' } }, fakeRes);
};
