const { pickFromRange, pickFromList, pickMultipleFromList } = require('../scenario');

const INTERESTS_POOL = [
  'E-commerce shopper', 'Chatting', 'Social Networking', 'Video',
  'Online Transportation', 'Gaming', 'Automotive', 'Dating', 'Travel', 'Fashion',
];

// Most C1BYPASS products' decrypted plain-payload response is flat:
// {transaction_id, status_code, status_desc, score|result}. Telco Score's own
// documented example nests differently — {transaction:{...}, response:{score}} —
// and Tenure shares Telco Score's request shape (request/consent, no "parameter"),
// so it's modeled with the same nested response shape rather than guessed flat.
function buildFlat(transactionId, extra) {
  return { transaction_id: transactionId || 'TEST-01', status_code: '00000', status_desc: 'success', ...extra };
}
function buildNested(transactionId, extra) {
  return { transaction: { transaction_id: transactionId || 'TEST-01', status_code: '00000', status_desc: 'success' }, response: { ...extra } };
}

// transaction.product_id is repurposed as a MOCK-ONLY selector (see design doc /
// README) since the real doc shows every one of these 9 products sharing a single
// C1BYPASS product_code, and 3 of them (Active Status, Interests, SIM Swap) have an
// otherwise byte-identical plain-payload request shape.
const handlers = {
  LOCATION_VERIFICATION: (payload, msisdn) =>
    buildFlat(payload?.transaction?.transaction_id, { score: String(pickFromRange(msisdn, 1, 7, 'loc')) }),

  NIK_CHECK: (payload, msisdn) =>
    buildFlat(payload?.transaction?.transaction_id, { score: String(pickFromRange(msisdn, 1, 4, 'nik')) }),

  TELCO_SCORE: (payload, msisdn) =>
    buildNested(payload?.transaction?.transaction_id, { score: String(pickFromRange(msisdn, 1, 5, 'telco')) }),

  RECYCLE_CHECK: (payload, msisdn) =>
    buildFlat(payload?.transaction?.transaction_id, { result: pickFromList(msisdn, ['Yes', 'No'], 'recycle') }),

  ACTIVE_STATUS: (payload, msisdn) =>
    buildFlat(payload?.transaction?.transaction_id, {
      result: pickFromRange(msisdn, 1, 10, 'status') <= 7
        ? 'ACTIVE'
        : pickFromList(msisdn, ['GRACE', 'CHURN', 'EXPIRED'], 'status2'),
    }),

  INTERESTS: (payload, msisdn) =>
    buildFlat(payload?.transaction?.transaction_id, {
      result: pickMultipleFromList(msisdn, INTERESTS_POOL, pickFromRange(msisdn, 2, 5, 'icount'), 'interests'),
    }),

  SIM_SWAP: (payload, msisdn) =>
    buildFlat(payload?.transaction?.transaction_id, { score: String(pickFromRange(msisdn, 1, 4, 'simswap')) }),

  LAST_LOCATION: (payload, msisdn) =>
    buildFlat(payload?.transaction?.transaction_id, { result: pickFromRange(msisdn, 1, 10, 'lastloc') <= 6 }),

  TENURE: (payload, msisdn) =>
    buildNested(payload?.transaction?.transaction_id, { score: String(pickFromRange(msisdn, 1, 5, 'tenure')) }),
};

const PRODUCT_IDS = Object.keys(handlers);

module.exports = { handlers, PRODUCT_IDS };
