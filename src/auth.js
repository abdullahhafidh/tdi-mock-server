const crypto = require('crypto');

const MOCK_API_KEY = process.env.TDI_MOCK_API_KEY || 'mock-api-key';
const MOCK_PARTNER_SECRET = process.env.TDI_MOCK_PARTNER_SECRET || 'mock-partner-secret';
const MOCK_TELKOMSEL_SECRET = process.env.TDI_MOCK_TELKOMSEL_SECRET || 'mock-telkomsel-secret-2026';

function authErrorEnvelope(status, error_code, error_message) {
  return {
    success: false,
    message: status === 401 ? 'Unauthorized' : status === 423 ? 'Locked' : 'Bad Request',
    error_code,
    error_message,
    timestamp: new Date().toISOString(),
    request_id: crypto.randomBytes(16).toString('hex'),
  };
}

// Every real TDI product requires Api-Key + Partner-Secret headers (Section 2.2.1).
// Checked against configured mock credentials (defaults documented in the README).
function checkBaseAuth(req, res) {
  const apiKey = req.header('Api-Key');
  const partnerSecret = req.header('Partner-Secret');
  if (!apiKey || !partnerSecret) {
    res.status(400).json(authErrorEnvelope(400, '4002', 'Data Request Body is Empty'));
    return false;
  }
  if (apiKey !== MOCK_API_KEY || partnerSecret !== MOCK_PARTNER_SECRET) {
    res.status(401).json(authErrorEnvelope(401, '4011', 'API-KEY or Secret Not Match / Empty'));
    return false;
  }
  return true;
}

module.exports = { checkBaseAuth, authErrorEnvelope, MOCK_API_KEY, MOCK_PARTNER_SECRET, MOCK_TELKOMSEL_SECRET };
