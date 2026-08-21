const { pickFromRange, pickFromList, pickMultipleFromList } = require('../scenario');

const INTERESTS_POOL = [
  'Video/Movie', 'Dating', 'Automotive', 'Chat', 'Meeting',
  'Gaming', 'Shopping', 'Sports', 'Music', 'Travel',
];

// Keyed by the real product_code sent in the flat request body (Section 2.3.28-2.3.36).
// Field-name quirk preserved deliberately: Interests' result is a single
// comma-joined STRING (not an array like Telkomsel's Interests product).
const handlers = {
  'SF-TENURE': (msisdn) => pickFromList(msisdn, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 'tenure'),

  'SF-ACTIVE-STATUS': (msisdn) => (pickFromRange(msisdn, 1, 10, 'active') <= 8 ? 'Yes' : 'No'),

  'SF-HOME-LOCVER': (msisdn) => String(pickFromRange(msisdn, 1, 7, 'home')),

  'SF-OFFICE-LOCVER': (msisdn) => String(pickFromRange(msisdn, 1, 7, 'office')),

  'SF-TELCO-SCORE': (msisdn) => String(pickFromRange(msisdn, 1, 100, 'score')),

  'SF-RECYCLE': (msisdn) => pickFromList(msisdn, ['Yes', 'No'], 'recycle'),

  'SF-INTERESTS': (msisdn) =>
    pickMultipleFromList(msisdn, INTERESTS_POOL, pickFromRange(msisdn, 2, 5, 'icount'), 'interests').join(', '),

  'SF-KTP-MATCH': (msisdn) => pickFromList(msisdn, ['Yes', 'No'], 'ktp'),

  'SF-SIM-SWAP': (msisdn) => pickFromList(msisdn, ['Yes', 'No'], 'simswap'),
};

module.exports = { handlers };
