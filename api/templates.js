// Returns country+purpose blank templates, auto-filled per applicant.
const COUNTRIES = [
  {c:'Australia',v:'Subclass 600 Tourist Stream',p:'https://immi.homeaffairs.gov.au/',d:'20-40'},
  {c:'Serbia',v:'D Visa (Long Stay)',p:'https://www.mfa.gov.rs/',d:'10-20'},
  {c:'Turkey',v:'e-Visa / Tourist',p:'https://www.evisa.gov.tr/',d:'1-3'},
  {c:'Singapore',v:'Short-Term Visit Pass',p:'https://www.ica.gov.sg/',d:'5-10'},
  {c:'Malaysia',v:'eVISA Tourist',p:'https://malaysiavisa.imi.gov.my/',d:'3-7'},
  {c:'Bahrain',v:'eVisa Visit',p:'https://www.evisa.gov.bh/',d:'2-5'}
];
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  const a = { name:'Imran Hossen', passport:'BX0XXXXXX', nationality:'Bangladesh', phone:'+880 17XX-XXXXXX' };
  const purpose = (req.query && req.query.purpose) || 'Tourism';
  const t = COUNTRIES.map(x => ({
    country:x.c, visa_type:x.v, purpose, portal:x.p, processing:x.d,
    fields:{ full_name:a.name, passport_no:a.passport, nationality:a.nationality, phone:a.phone,
      destination:x.c, visa_type:x.v, purpose, arrival:'2026-12-01', duration:'14 days',
      address:'Hotel address in '+x.c, occupation:'Business owner', funds:'BDT 8,50,000' },
    documents:['Passport bio page','Photo 35x45mm','Bank statement (6 mo)','Hotel booking','Return flight','Travel insurance','Cover letter']
  }));
  res.status(200).json({ applicant:a, purpose, templates:t });
};
