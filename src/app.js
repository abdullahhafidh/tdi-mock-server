const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const { aesEncrypt, aesDecrypt } = require('./crypto');
const { getScenario, mockTrxId } = require('./scenario');
const { checkBaseAuth, MOCK_TELKOMSEL_SECRET } = require('./auth');
const { handlers: tselHandlers, PRODUCT_IDS: TSEL_PRODUCT_IDS } = require('./products/tsel');
const { handlers: xlHandlers } = require('./products/xl');
const { handlers: smartfrenHandlers } = require('./products/smartfren');

const app = express();
app.use(express.json({ limit: '1mb' }));

function genericEnvelope({ success, message, error_code, error_message, data }) {
  return {
    success,
    message,
    error_code,
    error_message,
    timestamp: new Date().toISOString(),
    request_id: mockTrxId() + mockTrxId(),
    data,
  };
}

function genericErrorData({ trx_rc, trx_message, msisdn, partner_trx_id, product_code }) {
  return {
    trx_rc: trx_rc || '-',
    trx_status: 'FAILED',
    trx_message: trx_message || 'Transaction Failed',
    msisdn: msisdn || '-',
    partner_trx_id: partner_trx_id || '-',
    trx_id: '-',
    product_price: 0,
    product_code: product_code || '-',
    result: '-',
  };
}

// ---------------------------------------------------------------------------
// Telkomsel — POST /api/v1/c1/transaction/wrapper/bypass
// ---------------------------------------------------------------------------
app.post('/api/v1/c1/transaction/wrapper/bypass', (req, res) => {
  if (!checkBaseAuth(req, res)) return;

  const { transaction, request } = req.body || {};
  if (!transaction || !request || !request.ciphertext) {
    return res.status(400).json({
      transaction: { transaction_id: transaction?.transaction_id || '-', status_code: '4002', status_desc: 'Data Request Body is Empty' },
    });
  }
  if (!request.telkomsel_api_key || !request.telkomsel_signature) {
    return res.status(423).json({
      transaction: { transaction_id: transaction.transaction_id, status_code: '4001', status_desc: 'Invalid Signature' },
    });
  }

  let plainPayload;
  try {
    plainPayload = aesDecrypt(request.ciphertext, MOCK_TELKOMSEL_SECRET);
  } catch (e) {
    return res.status(400).json({
      transaction: { transaction_id: transaction.transaction_id, status_code: '9003', status_desc: 'Cipher Data Payload Error' },
    });
  }

  const msisdn = plainPayload?.transaction?.msisdn || plainPayload?.request?.msisdn;
  if (!msisdn) {
    return res.status(400).json({
      transaction: { transaction_id: transaction.transaction_id, status_code: '4027', status_desc: 'Request Body Mandatory Parameter not exists' },
    });
  }

  const productId = transaction.product_id;
  const handler = tselHandlers[productId];
  if (!handler) {
    return res.status(400).json({
      transaction: { transaction_id: transaction.transaction_id, status_code: '9001', status_desc: `Unknown transaction.product_id "${productId}" — mock-only selector, must be one of: ${TSEL_PRODUCT_IDS.join(', ')}` },
    });
  }

  const scenario = getScenario(msisdn);
  if (scenario.type === 'error') {
    const innerError = { transaction_id: plainPayload?.transaction?.transaction_id || 'TEST-01', status_code: scenario.trx_rc !== '-' ? scenario.trx_rc : scenario.error_code, status_desc: scenario.trx_message };
    return res.status(scenario.httpStatus).json({
      transaction: { transaction_id: transaction.transaction_id, status_code: scenario.error_code, status_desc: scenario.message },
      response: { ciphertext: aesEncrypt(innerError, MOCK_TELKOMSEL_SECRET) },
    });
  }

  const innerSuccess = handler(plainPayload, msisdn);
  return res.status(200).json({
    transaction: { transaction_id: transaction.transaction_id, status_code: '00000', status_desc: 'Success' },
    response: { ciphertext: aesEncrypt(innerSuccess, MOCK_TELKOMSEL_SECRET) },
  });
});

// ---------------------------------------------------------------------------
// XL — POST /api/v1/c3/transaction
// ---------------------------------------------------------------------------
app.post('/api/v1/c3/transaction', (req, res) => {
  if (!checkBaseAuth(req, res)) return;
  handleFlatOperator(req, res, xlHandlers);
});

// ---------------------------------------------------------------------------
// Smartfren — POST /api/v1/c4/transaction
// ---------------------------------------------------------------------------
app.post('/api/v1/c4/transaction', (req, res) => {
  if (!checkBaseAuth(req, res)) return;
  handleFlatOperator(req, res, smartfrenHandlers);
});

function handleFlatOperator(req, res, handlers) {
  const body = req.body || {};
  const { product_code, msisdn, partner_transaction_id } = body;

  if (!product_code || !msisdn) {
    return res.status(400).json(genericEnvelope({
      success: false, message: 'Bad Request', error_code: '4027', error_message: 'Request Body Mandatory Parameter not exists',
      data: genericErrorData({ trx_rc: '-', trx_message: 'Request Body Mandatory Parameter not exists', msisdn, partner_trx_id: partner_transaction_id, product_code }),
    }));
  }

  const handler = handlers[product_code];
  if (!handler) {
    return res.status(400).json(genericEnvelope({
      success: false, message: 'Bad Request', error_code: '4027', error_message: 'Bad Request! Transaction Issue',
      data: genericErrorData({ trx_rc: '9001', trx_message: '9001 - PRODUCT NOT FOUND', msisdn, partner_trx_id: partner_transaction_id, product_code }),
    }));
  }

  const scenario = getScenario(msisdn);
  if (scenario.type === 'error') {
    return res.status(scenario.httpStatus).json(genericEnvelope({
      success: false, message: scenario.message, error_code: scenario.error_code, error_message: scenario.error_message,
      data: genericErrorData({ trx_rc: scenario.trx_rc, trx_message: scenario.trx_message, msisdn, partner_trx_id: partner_transaction_id, product_code }),
    }));
  }

  const result = handler(msisdn);
  return res.status(200).json(genericEnvelope({
    success: true, message: 'OK', error_code: '0000', error_message: 'OK Everything',
    data: {
      trx_rc: '00', trx_status: 'SUCCESS', trx_message: 'Trx Success', msisdn,
      partner_trx_id: partner_transaction_id || '-', trx_id: mockTrxId(), product_price: 1, product_code, result,
    },
  }));
}

// ---------------------------------------------------------------------------
// Docs & misc
// ---------------------------------------------------------------------------
const openapiDoc = YAML.load(path.join(__dirname, '..', 'openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.redirect('/docs'));

module.exports = app;
