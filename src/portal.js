/**
 * TokenDance Portal API — balance, redemption codes, usage records, and Agent
 * payments.
 *
 * Contract sources (fetched 2026-10-05):
 *   - https://tokendance.space/docs/open-api.md
 *   - https://tokendance.space/docs/agent-payment.md
 *
 * Everything here uses the SAME bearer key as model calls; there is no second
 * credential. All amounts on the open platform are in micro-yuan
 * (1 CNY = 1,000,000 micro), while payment session `amount` is in whole yuan
 * (integer 1..100000, no decimals) — both conversions live here so no caller
 * has to remember which is which.
 *
 * @module src/portal.js
 */
import { createRequire } from 'node:module'
import { request } from './http.js'

/** Portal API root. Distinct from the gateway root — it serves the open-platform endpoints. */
const PORTAL_BASE = 'https://tokendance.space/portal/api/v1'

/** Micro-yuan per yuan (open platform amounts) and yuan per payment session unit. */
export const MICRO_PER_YUAN = 1_000_000

/** Whole-yuan payment bounds from the agent-payment contract. */
export const PAYMENT_MIN = 1
export const PAYMENT_MAX = 100_000

/**
 * @typedef {object} Balance
 * @property {number} credits   total top-up credits, micro-yuan
 * @property {number} creditsUsed  consumed credits, micro-yuan
 * @property {number} balance   remaining credits, micro-yuan
 * @property {number} balanceYuan  remaining in whole yuan (2 decimals)
 */

/**
 * GET /user/balance — remaining credits for the key's account.
 *
 * @param {string} key - API key (same one used for model calls)
 * @param {{timeoutMs?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<{ok: boolean, status: number, balance?: Balance, error?: string}>}
 */
export async function fetchBalance(key, options = {}) {
  const result = await request(`${PORTAL_BASE}/user/balance`, { ...options, key })
  if (!result.ok) return { ok: false, status: result.status, error: result.error, ...(result.recovery === undefined ? {} : { recovery: result.recovery }) }
  const b = result.data?.balance
  if (b === null || typeof b !== 'object' || typeof b.balance !== 'number') {
    return { ok: false, status: result.status, error: 'balance response carried no balance object' }
  }
  return {
    ok: true,
    status: result.status,
    balance: {
      credits: num(b.credits),
      creditsUsed: num(b.credits_used),
      balance: num(b.balance),
      balanceYuan: round2(num(b.balance) / MICRO_PER_YUAN),
    },
  }
}

/**
 * POST /redemption/redeem — spend a redemption code.
 *
 * @param {string} key
 * @param {string} code - the redemption code from TokenDance
 * @param {{timeoutMs?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<{ok: boolean, status: number, credits?: number, creditsYuan?: number, error?: string}>}
 */
export async function redeemCode(key, code, options = {}) {
  const trimmed = typeof code === 'string' ? code.trim() : ''
  if (trimmed === '') return { ok: false, status: 0, error: 'redemption code is required' }
  const result = await request(`${PORTAL_BASE}/redemption/redeem`, {
    ...options,
    key,
    method: 'POST',
    body: { code: trimmed },
  })
  if (!result.ok) return { ok: false, status: result.status, error: result.error, ...(result.recovery === undefined ? {} : { recovery: result.recovery }) }
  const credits = result.data?.credits
  if (typeof credits !== 'number') {
    return { ok: false, status: result.status, error: 'redemption response carried no credits' }
  }
  return { ok: true, status: result.status, credits: num(credits), creditsYuan: round2(num(credits) / MICRO_PER_YUAN) }
}

/**
 * GET /usage — the user's call records, newest first.
 *
 * TokenDance always returns `total: 0`; pagination is by item count and
 * `end_id` (pass the LAST id of the previous page to go older). Rate limit:
 * 1 request/second per user — the Host route enforces that locally so a
 * refresh-spam cannot turn into a wall of 429s.
 *
 * @param {string} key
 * @param {object} [query]
 * @param {number} [query.limit] 1..500, default 20
 * @param {number} [query.offset]
 * @param {string} [query.startId] only records with id > startId
 * @param {string} [query.endId] only records with id < endId
 * @param {string} [query.window] `1h` `24h` `7d` or `YYYYMMDD-YYYYMMDD`
 * @param {string} [query.modelId]
 * @param {string} [query.providerName]
 * @param {string} [query.keyId]
 * @param {boolean} [query.successOnly]
 * @param {{timeoutMs?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<{ok: boolean, status: number, items?: object[], hasMore?: boolean, oldestId?: string, newestId?: string, error?: string}>}
 */
export async function fetchUsage(key, query = {}, options = {}) {
  const url = new URL(`${PORTAL_BASE}/usage`)
  const limit = clampInt(query.limit, 1, 500, 20)
  url.searchParams.set('limit', String(limit))
  if (Number.isFinite(query.offset) && query.offset > 0) url.searchParams.set('offset', String(Math.trunc(query.offset)))
  if (typeof query.startId === 'string' && query.startId !== '') url.searchParams.set('start_id', query.startId)
  if (typeof query.endId === 'string' && query.endId !== '') url.searchParams.set('end_id', query.endId)
  if (typeof query.window === 'string' && /^(1h|24h|7d|\d{8}-\d{8})$/.test(query.window)) {
    url.searchParams.set('window', query.window)
  }
  if (typeof query.modelId === 'string' && query.modelId !== '') url.searchParams.set('model_id', query.modelId)
  if (typeof query.providerName === 'string' && query.providerName !== '') url.searchParams.set('provider_name', query.providerName)
  if (typeof query.keyId === 'string' && query.keyId !== '') url.searchParams.set('key_id', query.keyId)
  if (query.successOnly === true) url.searchParams.set('is_success', 'true')
  else if (query.successOnly === false) url.searchParams.set('is_success', 'false')

  const result = await request(url.toString(), { ...options, key })
  if (!result.ok) return { ok: false, status: result.status, error: result.error, ...(result.recovery === undefined ? {} : { recovery: result.recovery }) }
  const items = Array.isArray(result.data?.items) ? result.data.items : []
  return {
    ok: true,
    status: result.status,
    items,
    // Contract: fewer than `limit` items (or none) means the last page.
    hasMore: items.length >= limit,
    ...(items.length > 0 ? { newestId: String(items[0].id), oldestId: String(items[items.length - 1].id) } : {}),
  }
}

/**
 * POST /payment/sessions — open an Agent payment session.
 *
 * @param {string} key
 * @param {object} params
 * @param {number} params.amountYuan - whole yuan, 1..100000, no decimals
 * @param {{timeoutMs?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<{ok: boolean, status: number, session?: PaymentSession, error?: string}>}
 */
export async function createPaymentSession(key, { amountYuan } = {}, options = {}) {
  const amount = Number(amountYuan)
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < PAYMENT_MIN || amount > PAYMENT_MAX) {
    return { ok: false, status: 0, error: `amount must be a whole number between ${PAYMENT_MIN} and ${PAYMENT_MAX} yuan` }
  }
  const result = await request(`${PORTAL_BASE}/payment/sessions`, {
    ...options,
    key,
    method: 'POST',
    body: { amount },
  })
  if (!result.ok) return { ok: false, status: result.status, error: result.error, ...(result.recovery === undefined ? {} : { recovery: result.recovery }) }
  const session = result.data?.session
  if (typeof session?.id !== 'string' || typeof session?.payment_url !== 'string') {
    return { ok: false, status: result.status, error: 'payment response carried no session' }
  }
  return { ok: true, status: result.status, session: normalizeSession(session) }
}

/**
 * GET /payment/sessions/{id} — poll a payment session.
 *
 * Contract: poll every 3 s until `expired_at`; `paid` (and only `paid`) means
 * the money arrived and the original model request may be retried.
 *
 * @param {string} key
 * @param {string} sessionId
 * @param {{timeoutMs?: number, signal?: AbortSignal}} [options]
 * @returns {Promise<{ok: boolean, status: number, session?: PaymentSession, error?: string}>}
 */
export async function fetchPaymentStatus(key, sessionId, options = {}) {
  const id = typeof sessionId === 'string' ? sessionId.trim() : ''
  if (id === '') return { ok: false, status: 0, error: 'session id is required' }
  const result = await request(`${PORTAL_BASE}/payment/sessions/${encodeURIComponent(id)}`, { ...options, key })
  if (!result.ok) return { ok: false, status: result.status, error: result.error, ...(result.recovery === undefined ? {} : { recovery: result.recovery }) }
  const session = result.data?.session ?? result.data
  if (session === null || typeof session !== 'object' || typeof session.status !== 'string') {
    return { ok: false, status: result.status, error: 'payment status response carried no session' }
  }
  return { ok: true, status: result.status, session: normalizeSession(session) }
}

/**
 * Render a payment_url (aggregate-code content) as a standalone SVG string.
 *
 * The docs are explicit that `payment_url` is the CONTENT of an aggregate QR
 * code, not a web page — the PC flow renders it as a QR image. The generator
 * is vendored (qrcode-generator 1.4.4, MIT, Kazuhiko Arase) as a .cjs so the
 * ESM Host half can load it via createRequire.
 *
 * @param {string} content - the aggregate-code content to encode
 * @param {{cellSize?: number, margin?: number}} [style]
 * @returns {string | undefined} SVG markup, or undefined when the content is empty
 */
export function paymentQrSvg(content, style = {}) {
  const text = typeof content === 'string' ? content.trim() : ''
  if (text === '') return undefined
  // Lazily require the vendored CJS module; keep the failure as undefined so
  // the caller can fall back to showing the raw payment_url text.
  try {
    const requireCjs = createRequire(import.meta.url)
    const qrcode = requireCjs('./vendor/qrcode.cjs')
    const qr = qrcode(Math.max(0, Math.min(40, Number(style.cellSize) || 6)), 'M')
    qr.addData(text)
    qr.make()
    return qr.createSvgTag({ cellSize: Math.max(0, Math.min(40, Number(style.cellSize) || 6)), margin: Math.max(0, Math.min(16, Number(style.margin ?? 2))), scalable: true })
  } catch (error) {
    return undefined
  }
}

/** Internal: micro-yuan integers arrive as numbers; anything else becomes 0. */
function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

/**
 * Normalize a payment session into a stable shape for the client.
 *
 * @param {object} session - raw session from the portal
 * @returns {object}
 */
function normalizeSession(session) {
  return {
    id: session.id,
    amount: num(session.amount),
    status: session.status,
    paymentUrl: typeof session.payment_url === 'string' ? session.payment_url : undefined,
    alipayUrl: typeof session.alipay_url === 'string' ? session.alipay_url : undefined,
    statusUrl: typeof session.status_url === 'string' ? session.status_url : undefined,
    expiredAt: num(session.expired_at),
    // Convenience flag for the UI: the session can no longer be paid.
    expired: typeof session.expired_at === 'number' && session.status !== 'paid' &&
      Date.now() / 1000 > session.expired_at,
    createdAt: num(session.created_at),
    paidAt: num(session.paid_at) || undefined,
  }
}
