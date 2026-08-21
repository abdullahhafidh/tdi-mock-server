const crypto = require('crypto');

// Deterministic pseudo-randomness keyed off the MSISDN + a per-field salt, so the
// same MSISDN always returns the same result (repeatable tests) but different
// MSISDNs/fields naturally spread across a product's documented value range.
function hashToInt(seed) {
  const hash = crypto.createHash('md5').update(String(seed)).digest('hex');
  return parseInt(hash.substring(0, 8), 16);
}

function pickFromRange(msisdn, min, max, salt = '') {
  const h = hashToInt(`${msisdn}:${salt}`);
  return min + (h % (max - min + 1));
}

function pickFromList(msisdn, list, salt = '') {
  const h = hashToInt(`${msisdn}:${salt}`);
  return list[h % list.length];
}

// Deterministically picks `count` distinct items from `list`.
function pickMultipleFromList(msisdn, list, count, salt = '') {
  const pool = [...list];
  const result = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const h = hashToInt(`${msisdn}:${salt}:${i}`);
    const idx = h % pool.length;
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// Reserved MSISDN block 62999#XXXXXXX forces a documented error scenario, selected
// by the digit right after "999" (see Section 2.4 Status Code table and the design
// spec's scenario table). Any other MSISDN takes the success path.
const ERROR_SCENARIOS = {
  0: { httpStatus: 400, error_code: '4027', trx_rc: '9001', message: 'Bad Request', error_message: 'Bad Request! Transaction Issue', trx_message: '9001 - PRODUCT NOT FOUND' },
  1: { httpStatus: 400, error_code: '4027', trx_rc: '9002', message: 'Bad Request', error_message: 'Bad Request! Transaction Issue', trx_message: '9002 - PRODUCT CLOSED' },
  2: { httpStatus: 400, error_code: '4027', trx_rc: '9003', message: 'Bad Request', error_message: 'Bad Request! Transaction Issue', trx_message: '9003 - CIPHER DATA PAYLOAD ERROR' },
  3: { httpStatus: 400, error_code: '4027', trx_rc: '9005', message: 'Bad Request', error_message: 'Bad Request! Transaction Issue', trx_message: '9005 - BALANCE NOT ENOUGH' },
  4: { httpStatus: 400, error_code: '4027', trx_rc: '9008', message: 'Bad Request', error_message: 'Bad Request! Transaction Issue', trx_message: '9008 - ERROR HIT OPERATOR' },
  5: { httpStatus: 400, error_code: '4027', trx_rc: '9009', message: 'Bad Request', error_message: 'Bad Request! Transaction Issue', trx_message: '9009 - BILLER RESPONSE NOT MAPPING' },
  6: { httpStatus: 400, error_code: '4002', trx_rc: '-', message: 'Bad Request', error_message: 'Data Request Body is Empty', trx_message: '4002 - DATA REQUEST BODY IS EMPTY' },
  7: { httpStatus: 423, error_code: '4023', trx_rc: '-', message: 'Locked', error_message: 'User had been deleted or archived', trx_message: '4023 - USER DELETED OR ARCHIVED' },
  8: { httpStatus: 400, error_code: '5001', trx_rc: '-', message: 'Bad Request', error_message: 'Transaction Error', trx_message: '5001 - TRANSACTION ERROR' },
  9: { httpStatus: 500, error_code: '5099', trx_rc: '-', message: 'Internal Server Error', error_message: 'Internal Error Problem', trx_message: '5099 - INTERNAL ERROR PROBLEM' },
};

function getScenario(msisdn) {
  const digits = String(msisdn || '').replace(/\D/g, '');
  const match = digits.match(/^62999(\d)/);
  if (match) {
    return { type: 'error', ...ERROR_SCENARIOS[Number(match[1])] };
  }
  return { type: 'success' };
}

function mockTrxId() {
  return crypto.randomBytes(10).toString('hex');
}

module.exports = { pickFromRange, pickFromList, pickMultipleFromList, getScenario, mockTrxId, ERROR_SCENARIOS };
