const { pickFromRange, pickFromList } = require('../scenario');

// Keyed by the real product_code sent in the flat request body (Section 2.3.18-2.3.27).
// Field-name quirks preserved deliberately: C3RECYCLE's result is the STRING
// "true"/"false" (not "Yes"/"No" like other operators' recycle products).
const handlers = {
  C3NIKCHECK: (msisdn) => pickFromList(msisdn, ['1', '0'], 'nik'),

  C3CREDITSCORE: (msisdn) => (pickFromRange(msisdn, 3000, 9500, 'credit') / 10000).toFixed(4),

  C3RECYCLE: (msisdn) => pickFromList(msisdn, ['true', 'false'], 'recycle'),

  C3LOCVER: (msisdn) => JSON.stringify({
    closest_distance: pickFromList(msisdn, ['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'zone'),
    confidence_bucket: pickFromList(msisdn, ['Low', 'Medium', 'High', 'Very High', 'Strongest'], 'conf'),
    tower_density: pickFromList(msisdn, ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'], 'density'),
    location_type: pickFromList(msisdn, ['DAY', 'NIGHT'], 'time'),
  }),

  XLCHECKHOMELONGLAT: (msisdn) => pickFromList(msisdn, ['A', 'B', 'C', 'D', 'E', 'F', 'Out of Zone'], 'home'),

  XLCHECKWORKLONGLAT: (msisdn) => pickFromList(msisdn, ['A', 'B', 'C', 'D', 'E', 'F', 'Out of Zone'], 'work'),

  XLMSISDNSTATUS: (msisdn) => (pickFromRange(msisdn, 1, 10, 'active') <= 8 ? '1' : '0'),

  XLIMSICHANGE: (msisdn) => pickFromList(msisdn, ['3', '7', '30', '>30'], 'simswap'),

  XLSUBTENURE: (msisdn) => String(pickFromRange(msisdn, 1, 7, 'tenure')),

  XLLASTCITY: (msisdn) => JSON.stringify({
    last_city: pickFromList(msisdn, ['Y', 'N'], 'city'),
    last_location_update: pickFromList(msisdn, ['1', '2', '8'], 'update'),
  }),
};

module.exports = { handlers };
