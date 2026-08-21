# TDI Mock Server — Design

Status: approved pending final review
Source of truth: `TDI - API DOC - v1.13.0 .pdf` (PT. Terra Data Indonesia / "Alterra"), sections 2.1-2.4, 3, 4. Indosat/IOH product sections (2.3.10-2.3.17) are explicitly out of scope — only Telkomsel, XL, and Smartfren are mocked.

## Purpose

A standalone mock of TDI's sandbox API so client code can be developed/tested against realistic TDI-shaped responses without a real TDI sandbox account. Deployed on Vercel. Not a rebuild of any internal IOH client — purely a server that returns dummy data shaped exactly like TDI's documented contract.

## Endpoints (paths match real TDI exactly)

| Operator | Path | Body |
|---|---|---|
| Telkomsel (9 products) | `POST /api/v1/c1/transaction/wrapper/bypass` | outer envelope wraps an AES-256-CBC encrypted `ciphertext` |
| XL (10 products) | `POST /api/v1/c3/transaction` | plain JSON, `product_code` field selects product |
| Smartfren (9 products) | `POST /api/v1/c4/transaction` | plain JSON, `product_code` field selects product |

Because a real client can just repoint its `base_url` at the deployed mock and everything else (paths, envelopes, encryption) behaves the same.

## Telkomsel encryption (Section 4, confirmed verbatim from the doc)

- AES-256-CBC, PKCS7 padding.
- Key = SHA-256(secret) → 32 bytes.
- IV = 16 random bytes, generated fresh per encryption, prepended to the ciphertext before Base64 encoding.
- The mock genuinely decrypts incoming `request.ciphertext` (to read the plain payload and pick a scenario) and genuinely encrypts its `response.ciphertext` the same way, using a fixed dummy secret (default `mock-telkomsel-secret-2026`, overridable via `TDI_MOCK_TELKOMSEL_SECRET`). This secret is documented prominently in the README and the Swagger description so a real client's existing encrypt/decrypt code works against the mock unmodified.

## Telkomsel product disambiguation (mock-only convention)

All 9 Telkomsel products share one outer `product_code: "C1BYPASS"` — the real distinguishing signal is the *shape* of the decrypted plain payload, and per the doc three products (Active Status, Interests, SIM Swap) have an **identical** plain-payload shape (`{transaction:{...}, parameter:{partner_name}}`), so shape alone can't disambiguate them; likewise Telco Score and Tenure share the same `{transaction, request:{msisdn,table_code}, consent}` shape. Real TDI presumably resolves this via the partner's provisioned product per API key — something a stateless mock can't replicate.

Fix: the mock repurposes the already-present outer field `transaction.product_id` (in the real doc this is always just a placeholder value like `"product_id_from_tsel"`) as an explicit selector. Callers set it to one of:

`LOCATION_VERIFICATION | NIK_CHECK | TELCO_SCORE | RECYCLE_CHECK | ACTIVE_STATUS | INTERESTS | SIM_SWAP | LAST_LOCATION | TENURE`

This is called out clearly as a **mock-only extension** in the README and Swagger (not part of the real TDI contract) so nobody mistakes it for a documented TDI field.

XL and Smartfren need no such trick — every product has its own explicit `product_code` value directly in the flat request body.

## Scenario selection: MSISDN convention

Every product's success response is generated deterministically from the request's `msisdn` (same MSISDN → same result on every call, so tests are repeatable), spread pseudo-randomly but deterministically across that product's real documented value range (e.g. location score 1-7, XL's lettered A-G zones, Yes/No, tenure buckets) via a hash of the digits — so different test numbers naturally exercise different buckets.

Reserved MSISDN block for forcing error scenarios: any MSISDN matching `62999########` routes to an error instead of success, with the digit immediately after `999` selecting which documented error (Section 2.4):

| MSISDN pattern | Error simulated |
|---|---|
| `629990...` | 4027 / 9001 — Product Not Found |
| `629991...` | 4027 / 9002 — Product Closed |
| `629992...` | 4027 / 9003 — Cipher Data Payload Error (TSEL) |
| `629993...` | 4027 / 9005 — Balance Not Enough |
| `629994...` | 4027 / 9008 — Error Hit Operator |
| `629995...` | 4027 / 9009 — Biller Response Not Mapping |
| `629996...` | 4002 — Empty Request Body-shaped issue |
| `629997...` | 4023 — User Deleted/Archived |
| `629998...` | 500X — generic Transaction Error |
| `629999...` | 5XX — Internal Error |

Header-level auth failures (missing/wrong `Api-Key`/`Partner-Secret`, bad `telkomsel_signature`) are tested by actually omitting/mutating those headers/fields — no MSISDN trick needed there; the mock validates them against configured dummy credentials and returns the real 4011/4001/423-style envelope on mismatch.

All of this (reserved block, per-product value ranges, dummy credentials) is documented in the README and surfaced in the Swagger UI descriptions.

## Stack & repo layout

Node.js + Express, deployed to Vercel as a single serverless function (catch-all `api/[...all].js` invoking the Express app) since the real TDI paths (`/api/v1/c1/...`) don't map cleanly onto Vercel's file-based routing — `vercel.json` rewrites everything to that one function.

```
tdi-mock-server/
  api/[...all].js          # Vercel entry, wraps the Express app
  src/app.js                # Express app: 3 routes + swagger-ui-express mount at /docs
  src/crypto.js             # AES-256-CBC encrypt/decrypt (Section 4)
  src/scenario.js           # MSISDN → deterministic bucket / reserved-error-block logic
  src/auth.js               # Api-Key/Partner-Secret/signature validation + TDI-shaped auth errors
  src/products/tsel.js      # 9-entry registry: plain-payload shape check (where unambiguous) + product_id dispatch, response builder per product
  src/products/xl.js        # 10-entry registry keyed by product_code
  src/products/smartfren.js # 9-entry registry keyed by product_code
  openapi.yaml               # hand-written spec, all 28 products documented with examples
  vercel.json
  package.json
  README.md                 # mock credentials, encryption secret, MSISDN scenario table, example curl/Postman calls
```

## Auth

Mock validates `Api-Key` / `Partner-Secret` headers against configured dummy values (`TDI_MOCK_API_KEY` / `TDI_MOCK_PARTNER_SECRET`, defaults documented in README/Swagger) and Telkomsel's additional `telkomsel_api_key`/`telkomsel_signature` (SHA-256(api_key+secret+epoch), per Section 3) with a generous time window (signature freshness isn't the point of this mock — presence/basic shape is). Mismatches return the real TDI-shaped error envelope with the matching `error_code` (4011, 4001, etc.) so the auth-failure path is itself testable.

## Response envelope fidelity

- XL/Smartfren: exact general envelope from Section 2.2.3 (`success, message, error_code, error_message, timestamp, request_id, data:{trx_rc, trx_status, trx_message, msisdn, partner_trx_id, trx_id, product_price, product_code, result}`).
- Telkomsel: exact wrapper envelope (`transaction:{transaction_id, status_code, status_desc}, response:{ciphertext}`), with the decrypted plain payload matching each product's own documented shape (e.g. `score` for Location Verification/NIK Check/SIM Swap/Telco Score/Tenure, `result` for Recycle Check/Active Status/Interests/Last Location).
- Field-name quirks are preserved deliberately, not smoothed over: XL's recycle `result` is the string `"true"`/`"false"` (not `"Yes"`/`"No"` like TSEL/SF); Smartfren's Interests `result` is a single comma-joined string (not an array like TSEL's).

## Swagger

`swagger-ui-express` serves the `openapi.yaml` at `/docs` on the deployed Vercel URL, so opening the deployment link immediately gives an interactive "try it out" console — the user's explicit ask for "easier check later when deployed." Each of the 28 products gets its own documented example (request + success response), plus the MSISDN scenario table and mock credentials reproduced in the spec's top-level `description`.

## Out of scope

- Indosat/IOH product sections (2.3.10-2.3.17) — not offnet, not requested.
- Async (`is_sync: false` + callback_url) delivery — mock always answers synchronously regardless of `is_sync`.
- Persisting/replaying transaction state across calls — every call is independently generated from its own MSISDN.
